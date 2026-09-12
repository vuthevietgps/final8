import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { TestOrder2, TestOrder2Document } from '../schemas/test-order2.schema';
import { InventoryService } from '../../inventory/inventory.service';
import { OrderCalculationService } from './order-calculation.service';
import { CreateOrderShipmentDto, CompleteOrderShipmentDto, AmendShipmentFeesDto } from '../dto/order-shipment.dto';
import { OrderShipment } from '../schemas/order-shipment.schema';
import { SupplierPayableService } from '../../supplier-payable/supplier-payable.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FinanceEvents } from '../../finance/events/finance-events.constants';
import { FINANCIAL_INPUT_CHANGED } from '../../advertising-cost/advertising-cost-refresh.module';

@Injectable()
export class OrderShipmentService {
  constructor(@InjectModel(TestOrder2.name) private orders: Model<TestOrder2Document>,
    private inventory: InventoryService, private calculation: OrderCalculationService,
    private payable: SupplierPayableService, private events: EventEmitter2) {}

  private async load(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã đơn không hợp lệ.');
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundException('Không tìm thấy đơn.');
    return order;
  }

  private stockOrder(order: TestOrder2Document, attempt: OrderShipment) {
    return { _id: `${order._id}:${attempt.requestKey}`, productId: order.productId, agentId: order.agentId,
      quantity: attempt.quantity, productSource: attempt.stockSource, inventoryBatchId: attempt.inventoryBatchId,
      inventoryUnitCostSnapshot: attempt.stockUnitCost, productionStatus: 'Đã trả kết quả', trackingNumber: attempt.trackingNumber };
  }

  async create(id: string, dto: CreateOrderShipmentDto, actorId: string) {
    const order = await this.load(id);
    const dealerSale = (await this.calculation.classifySaleMode(order)) === 'dealer';
    const hash = createHash('sha256').update(JSON.stringify(dto)).digest('hex');
    let attempt = order.shipments?.find(s => s.requestKey === dto.requestKey);
    if (attempt && attempt.requestHash !== hash) throw new BadRequestException('Mã yêu cầu đã dùng cho nội dung khác.');
    if (attempt && attempt.status !== 'preparing') return order;
    if (!attempt) {
      if (!dto.trackingNumber.trim()) throw new BadRequestException('Cần mã vận đơn.');
      if (order.productionStatus !== 'Đã trả kết quả') throw new BadRequestException('Hoàn tất chuẩn bị hàng trước khi xuất.');
      if (order.productSource === 'supplier' && !order.supplierQuoteId) throw new BadRequestException('Chưa có bản chụp báo giá NCC đã duyệt. Cập nhật đơn sau khi duyệt báo giá.');
      if (dealerSale && !order.agentQuoteId) throw new BadRequestException('Chưa có bản chụp báo giá đại lý ngoài đã duyệt.');
      if (!dealerSale && order.retailSaleAmount == null) throw new BadRequestException('Nhập tổng giá bán lẻ trước khi xuất hàng.');
      const previous = order.shipments?.[order.shipments.length - 1];
      if (!previous && order.trackingNumber?.trim()) throw new BadRequestException('Đơn đã giao theo dữ liệu cũ; cần đối chiếu lịch sử trước khi chuyển sang nhiều lần giao.');
      if (previous && previous.status !== 'returned') throw new BadRequestException('Lần giao trước chưa hoàn tất nhận hoàn.');
      if (previous && Number(order.receivedReturnQuantity || 0) < previous.quantity) throw new BadRequestException('Chưa nhận đủ hàng hoàn để giao lại.');
      if (previous && !dealerSale) throw new BadRequestException('Bán lại hàng công ty: tạo đơn mới và chọn lô hàng hoàn.');
      if (previous && !dto.inventoryBatchId) throw new BadRequestException('Giao lại phải chọn hàng đã nhận hoàn, không mua mới.');
      // Initial lot/source changes must go through the order update, which also
      // refreshes its acquisition snapshot and reservation before dispatch.
      if (!previous && dto.inventoryBatchId && (!['inventory', 'dealer_custody'].includes(order.productSource)
        || String(order.inventoryBatchId || '') !== dto.inventoryBatchId)) {
        throw new BadRequestException('Lần xuất đầu phải dùng đúng lô đã chọn trên đơn. Cập nhật nguồn hàng của đơn trước khi đổi lô.');
      }
      if (dto.senderKind !== 'company' && !dto.senderId) throw new BadRequestException('Chọn bên gửi hàng.');
      if (dto.feePayeeKind === 'supplier' && !order.supplierId) throw new BadRequestException('Đơn chưa xác định NCC nhận phí.');
      if (dto.feePayeeKind === 'other' && !dto.feePayeeName?.trim()) throw new BadRequestException('Nhập tên bên nhận phí vận chuyển.');
      const returnHolderKind = dto.returnHolderKind || dto.senderKind;
      const returnHolderId = returnHolderKind === 'company' ? undefined
        : dto.returnHolderId || (returnHolderKind === dto.senderKind ? dto.senderId : undefined);
      const returnsToSender = returnHolderKind === dto.senderKind
        && String(returnHolderId || '') === String(dto.senderKind === 'company' ? '' : dto.senderId || '');
      attempt = { ...dto, _id: new Types.ObjectId(), requestHash: hash, status: 'preparing',
        quantity: Number(order.quantity || 1), createdAt: new Date(), createdBy: actorId,
        returnHolderKind, returnHolderId,
        returnAddress: dto.returnAddress ?? (returnsToSender ? dto.senderAddress : undefined),
        returnCost: 0, dealerReturnCharge: 0, deliveredQuantity: 0,
        stockSource: previous ? 'dealer_custody' : order.productSource,
        inventoryBatchId: dto.inventoryBatchId ? new Types.ObjectId(dto.inventoryBatchId) : order.inventoryBatchId,
      };
      if (attempt.returnHolderKind !== 'company' && !attempt.returnHolderId) throw new BadRequestException('Chọn bên nhận hoàn.');
      // Initial inventory reservation was made when the order selected the lot.
      // Release it before reserving the exact shipment, then retain a retryable preparation record.
      if (!previous) await this.inventory.releaseOrderReservation(order.inventoryBatchId, String(order._id));
      const stock = this.stockOrder(order, attempt);
      await this.inventory.prepareOrderSource(stock);
      if (['inventory', 'dealer_custody'].includes(attempt.stockSource)
        && ((stock as any).senderKind !== dto.senderKind || String((stock as any).senderId || '') !== String(dto.senderId || ''))) {
        await this.inventory.releaseOrderReservation(attempt.inventoryBatchId, String(stock._id));
        throw new BadRequestException('Bên gửi phải là nơi đang giữ lô hàng đã chọn.');
      }
      attempt.stockUnitCost = stock.inventoryUnitCostSnapshot;
      try { order.shipments ||= []; order.shipments.push(attempt); await order.save(); }
      catch (error) {
        const persisted = await this.load(id);
        const sameRequest = persisted.shipments?.find(s => s.requestKey === attempt.requestKey);
        // A competing retry may already have persisted this same reservation.
        if (sameRequest) return sameRequest.status === 'preparing' ? this.resume(id, String(sameRequest._id)) : persisted;
        await this.inventory.releaseOrderReservation(attempt.inventoryBatchId, String(stock._id));
        throw error;
      }
      attempt = order.shipments[order.shipments.length - 1];
    }
    await this.inventory.commitOrderStock(this.stockOrder(order, attempt));
    attempt.status = 'dispatched';
    order.receivedReturnQuantity = 0;
    await this.project(order);
    return this.persist(order);
  }

  async complete(id: string, shipmentId: string, dto: CompleteOrderShipmentDto) {
    const order = await this.load(id);
    const attempt = order.shipments?.find(s => String(s._id) === shipmentId);
    if (!attempt || attempt !== order.shipments[order.shipments.length - 1]) throw new BadRequestException('Chỉ cập nhật lần giao hiện tại.');
    if (attempt.status === 'preparing') throw new BadRequestException('Lần xuất chưa hoàn tất, hãy gửi lại yêu cầu xuất.');
    if (attempt.status === 'returned' || attempt.status === 'delivered' || attempt.status === 'partial') {
      if (attempt.status === dto.status && (dto.returnCost == null || dto.returnCost === attempt.returnCost)
        && (dto.dealerReturnCharge == null || dto.dealerReturnCharge === attempt.dealerReturnCharge)
        && (dto.deliveredQuantity == null || dto.deliveredQuantity === attempt.deliveredQuantity)) return order;
      throw new BadRequestException('Lần giao đã chốt; không sửa lịch sử giao nhận.');
    }
    const delivered = dto.status === 'delivered' ? attempt.quantity : dto.status === 'partial' ? dto.deliveredQuantity : 0;
    if (!Number.isInteger(delivered) || delivered < 0 || delivered > attempt.quantity) throw new BadRequestException('Số lượng giao thành công không hợp lệ.');
    if (dto.status === 'partial' && (delivered === 0 || delivered === attempt.quantity)) throw new BadRequestException('Giao một phần phải ít hơn tổng số hàng và lớn hơn 0.');
    attempt.status = dto.status;
    attempt.deliveredQuantity = delivered;
    if (['returning', 'returned', 'partial'].includes(dto.status)) {
      attempt.returnCost = dto.returnCost ?? attempt.returnCostQuote;
      attempt.dealerReturnCharge = dto.dealerReturnCharge ?? attempt.dealerReturnChargeQuote;
    }
    attempt.feesConfirmed = dto.feesConfirmed ?? false;
    attempt.completedAt = new Date();
    await this.project(order);
    return this.persist(order);
  }

  async resume(id: string, shipmentId: string) {
    const order = await this.load(id);
    const attempt = order.shipments?.[order.shipments.length - 1];
    if (!attempt || String(attempt._id) !== shipmentId) throw new BadRequestException('Không tìm thấy lần xuất cần tiếp tục.');
    if (attempt.status !== 'preparing') return order;
    await this.inventory.commitOrderStock(this.stockOrder(order, attempt));
    attempt.status = 'dispatched'; order.receivedReturnQuantity = 0;
    await this.project(order);
    return this.persist(order);
  }

  async amendFees(id: string, shipmentId: string, dto: AmendShipmentFeesDto, actorId: string) {
    const order = await this.load(id);
    const dealerSale = (await this.calculation.classifySaleMode(order)) === 'dealer';
    const attempt = order.shipments?.find(s => String(s._id) === shipmentId);
    if (!attempt || attempt.status === 'preparing') throw new BadRequestException('Lần giao chưa xuất hàng.');
    const hash = createHash('sha256').update(JSON.stringify(dto)).digest('hex');
    const existing = attempt.feeRevisions?.find(r => r.requestKey === dto.requestKey);
    if (existing) {
      if (existing.requestHash !== hash) throw new BadRequestException('Mã điều chỉnh phí đã dùng cho nội dung khác.');
      return order;
    }
    if (!['returning', 'returned', 'partial'].includes(attempt.status) && (dto.returnCost || dto.dealerReturnCharge)) {
      throw new BadRequestException('Chưa phát sinh hoàn, không ghi phí hoàn.');
    }
    if (!dealerSale && (dto.dealerShippingCharge || dto.dealerReturnCharge)) throw new BadRequestException('Đơn bán lẻ không thu phí đại lý.');
    const keys = ['shippingCost', 'returnCost', 'dealerShippingCharge', 'dealerReturnCharge'];
    const before = Object.fromEntries(keys.map(key => [key, attempt[key]]));
    const after = Object.fromEntries(keys.map(key => [key, dto[key]]));
    attempt.feeRevisions ||= [];
    attempt.feeRevisions.push({ requestKey: dto.requestKey, requestHash: hash, before, after,
      evidence: dto.evidence, at: new Date(), actorId });
    Object.assign(attempt, after); attempt.feesConfirmed = true;
    await this.project(order);
    return this.persist(order);
  }

  private async persist(order: TestOrder2Document) {
    const saved = await order.save();
    if (saved.financialModelVersion !== 2 && saved.supplierId && saved.supplierContractAmount > 0) {
      const goods = saved.productSource === 'supplier' ? Number(saved.supplierAppliedPrice || 0) : 0;
      await this.payable.upsertForOrder({ orderId: String(saved._id), supplierId: String(saved.supplierId),
        items: [{ productId: String(saved.productId), quantity: saved.quantity, unitPrice: goods, amount: goods * saved.quantity }],
        totalAmount: saved.supplierContractAmount, currency: 'VND', notes: 'Nghĩa vụ theo hàng và phí từng lần giao.' });
    }
    this.events.emit(FinanceEvents.ORDER_COMPLETED, { orderId: String(saved._id), orderDate: saved.orderDate, adGroupId: saved.adGroupId });
    if (this.events.emitAsync) await this.events.emitAsync(FINANCIAL_INPUT_CHANGED, { dates: [saved.orderDate], revalue: false });
    else await this.calculation.recalculateOrdersForDate(saved.orderDate);
    return (await this.orders.findById(saved._id)) || saved;
  }

  private async project(order: TestOrder2Document) {
    const attempts = order.shipments.filter(s => s.status !== 'preparing');
    const last = attempts[attempts.length - 1];
    order.shippingFee = attempts.reduce((n, s) => n + s.shippingCost, 0);
    order.returnFee = attempts.reduce((n, s) => n + s.returnCost, 0);
    order.dealerShippingCharges = attempts.reduce((n, s) => n + s.dealerShippingCharge, 0);
    order.dealerReturnCharges = attempts.reduce((n, s) => n + s.dealerReturnCharge, 0);
    order.supplierFreightObligation = attempts.filter(s => s.feePayeeKind === 'supplier')
      .reduce((n, s) => n + s.shippingCost + s.returnCost, 0);
    order.trackingNumber = last.trackingNumber;
    order.senderKind = last.senderKind; order.senderId = last.senderId; order.senderAddress = last.senderAddress;
    order.deliveredQuantity = last.deliveredQuantity;
    order.orderStatus = ({ dispatched: 'Đang giao', delivered: 'Giao thành công', returning: 'Đang hoàn',
      returned: 'Hàng hoàn', partial: 'Giao một phần' })[last.status];
    await this.calculation.applyCompletedStatusFinancials(order);
  }
}
