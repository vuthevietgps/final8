import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Error as MongooseError, Model, Types } from 'mongoose';
import { FinanceEvents } from '../finance/events/finance-events.constants';
import { FINANCIAL_INPUT_CHANGED } from '../advertising-cost/advertising-cost-refresh.module';
import { InventoryService } from '../inventory/inventory.service';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';
import { CreateReturnRequestDto } from './dto/create-return-request.dto';
import { ResolveReturnRequestDto } from './dto/resolve-return-request.dto';
import { ReturnRequest, ReturnRequestDocument } from './return-request.schema';

@Injectable()
export class ReturnRequestService {
  constructor(
    @InjectModel(ReturnRequest.name) private model: Model<ReturnRequestDocument>,
    @InjectModel(TestOrder2.name) private readonly orderModel: Model<TestOrder2Document>,
    private readonly inventory: InventoryService,
    private readonly calculationService: OrderCalculationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateReturnRequestDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Can it nhat 1 dong hang hoan');
    }

    const orderId = new Types.ObjectId(dto.orderId);
    const linkedOrder = await this.orderModel.findById(orderId);
    if (!linkedOrder) {
      throw new NotFoundException('Khong tim thay don hang lien ket voi phieu hang hoan');
    }
    const latest = linkedOrder.shipments?.[linkedOrder.shipments.length - 1];
    if (latest && (String(latest._id) !== dto.shipmentId || !['returning', 'returned', 'partial'].includes(latest.status))) {
      throw new BadRequestException('Chọn đúng lần giao đang hoàn hàng.');
    }
    if (!latest && !linkedOrder.trackingNumber?.trim()) throw new BadRequestException('Đơn chưa có bằng chứng xuất hàng.');
    const quantity = dto.items.reduce((n, i) => n + i.quantityReturned, 0);
    if (dto.items.some(i => i.productId !== String(linkedOrder.productId) || !Number.isInteger(i.quantityReturned) || i.quantityReturned <= 0)
      || quantity + Number(linkedOrder.receivedReturnQuantity || 0) > linkedOrder.quantity - Number(linkedOrder.deliveredQuantity || 0)) {
      throw new BadRequestException('Sản phẩm hoặc số lượng hoàn không khớp lần giao.');
    }

    const existingPending = await this.model.exists({ orderId, status: 'pending' });
    if (existingPending) {
      throw new ConflictException('Don hang da co phieu hang hoan dang cho xu ly');
    }

    try {
      const doc = await this.model.create({
        orderId,
        shipmentId: dto.shipmentId,
        supplierId: dto.supplierId ? new Types.ObjectId(dto.supplierId) : undefined,
        items: dto.items.map((it) => ({
          _id: new Types.ObjectId(),
          productId: new Types.ObjectId(it.productId),
          quantityReturned: Number(it.quantityReturned),
          notes: it.notes,
        })),
        reason: dto.reason,
        status: 'pending',
      });

      return doc.toObject();
    } catch (error) {
      if (error instanceof MongooseError && 'code' in error && (error as { code?: number }).code === 11000) {
        throw new ConflictException('Don hang da co phieu hang hoan dang cho xu ly');
      }
      throw error;
    }
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id);
    if (!doc) {
      throw new NotFoundException('Khong tim thay phieu hang hoan');
    }

    await this.ensureItemIds(doc);
    return doc.toObject();
  }

  async listForOrder(orderId: string) {
    if (!Types.ObjectId.isValid(orderId)) throw new BadRequestException('Mã đơn không hợp lệ.');
    return this.model.find({ orderId }).sort({ createdAt: -1 }).limit(100).lean();
  }

  async resolve(id: string, dto: ResolveReturnRequestDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Chua co quyet dinh xu ly');
    }

    const session = await this.model.db.startSession();
    let result: ReturnRequest | null = null;
    let orderForEvent: TestOrder2Document | null = null;

    try {
      await session.withTransaction(async () => {
        const resolvedAt = new Date();
        const doc = await this.model.findOneAndUpdate(
          { _id: id, status: 'pending' },
          {
            $set: {
              status: 'resolved',
              resolvedAt,
            },
          },
          { new: true, session },
        );

        if (!doc) {
          const existing = await this.model.findById(id).session(session);
          if (!existing) {
            throw new NotFoundException('Khong tim thay phieu hang hoan');
          }
          throw new BadRequestException('Phieu da xu ly');
        }

        await this.ensureItemIds(doc, session);

        const items = doc.items || [];
        if (!items.length) {
          throw new BadRequestException('Phieu hang hoan khong co dong hang hop le');
        }

        const payloadById = new Map<string, ResolveReturnRequestDto['items'][number]>();
        for (const payloadItem of dto.items) {
          const itemId = String(payloadItem.itemId);
          if (payloadById.has(itemId)) {
            throw new BadRequestException('Trung dong hang hoan trong payload');
          }
          payloadById.set(itemId, payloadItem);
        }

        const itemIds = items.map((item: any) => String(item._id));
        const unknownItemIds = [...payloadById.keys()].filter((itemId) => !itemIds.includes(itemId));
        if (unknownItemIds.length) {
          throw new BadRequestException('Dong hang hoan khong ton tai');
        }

        if (payloadById.size !== itemIds.length) {
          throw new BadRequestException('Chua du quyet dinh cho tat ca dong hang hoan');
        }

        const restock: Array<{ productId: string; quantity: number; recoveryUnitCost: number }> = [];
        const order = await this.orderModel.findById(doc.orderId).session(session);
        if (!order) throw new NotFoundException('Không tìm thấy đơn gốc.');
        const receivedQuantity = items.reduce((sum, item) => sum + Number(payloadById.get(String((item as any)._id))?.quantity ?? item.quantityReturned), 0);
        if (receivedQuantity + Number(order.receivedReturnQuantity || 0) > Number(order.quantity || 1) - Number(order.deliveredQuantity || 0)) {
          throw new BadRequestException('Tổng hàng nhận hoàn vượt số lượng đã giao của lần này.');
        }
        const unitCost = Number(order.productSource === 'inventory' || order.productSource === 'dealer_custody'
          ? order.inventoryUnitCostSnapshot : order.supplierAppliedPrice);
        doc.ownerKind = order.agentId ? 'dealer' : 'company';
        doc.ownerId = order.agentId ? String(order.agentId) : undefined;
        const shipment = order.shipments?.[order.shipments.length - 1];
        if (shipment && String(shipment._id) !== doc.shipmentId) throw new BadRequestException('Phiếu hoàn không thuộc lần giao hiện tại.');
        doc.holderKind = dto.holderKind || shipment?.returnHolderKind || order.senderKind || (order.productSource === 'inventory' ? 'company' : 'supplier');
        doc.holderId = doc.holderKind === 'company' ? undefined : dto.holderKind ? dto.holderId
          : shipment?.returnHolderId || order.senderId || (doc.holderKind === 'supplier' ? String(order.supplierId || '') : undefined);
        doc.holderAddress = dto.holderKind ? dto.holderAddress : dto.holderAddress || shipment?.returnAddress || order.senderAddress;
        if (doc.holderKind !== 'company' && !doc.holderId) throw new BadRequestException('Cần xác định bên đang nhận hàng hoàn.');

        doc.items = items.map((item: any) => {
          if (String(item.productId) !== String(order.productId)) throw new BadRequestException('Sản phẩm hoàn không thuộc đơn gốc.');
          const payload = payloadById.get(String(item._id));
          if (!payload) {
            throw new BadRequestException('Chua du quyet dinh cho tat ca dong hang hoan');
          }

          const quantity = Number(payload.quantity ?? item.quantityReturned);
          if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new BadRequestException('So luong phai > 0');
          }
          if (quantity > Number(item.quantityReturned)) {
            throw new BadRequestException('So luong vuot qua hang hoan');
          }

          if (payload.decision === 'restock') {
            if (order.resalePolicySnapshot === 'not_resellable') throw new BadRequestException('Hàng độc bản không được nhập thành hàng có thể bán lại.');
            const recoveryUnitCost = Number(payload.recoveryUnitCost);
            if (!Number.isFinite(recoveryUnitCost) || recoveryUnitCost < 0 || !Number.isFinite(unitCost) || recoveryUnitCost > unitCost) {
              throw new BadRequestException('Xác nhận giá trị thu hồi từ 0 đến giá vốn đã chụp.');
            }
            restock.push({
              productId: String(item.productId),
              quantity,
              recoveryUnitCost,
            });
            item.decision = 'restock';
            item.processedQuantity = quantity;
            item.recoveryUnitCost = recoveryUnitCost;
            return item;
          }

          if (payload.decision === 'scrap') {
            item.decision = 'scrap';
            item.processedQuantity = quantity;
            item.recoveryUnitCost = undefined;
            return item;
          }

          throw new BadRequestException('Quyet dinh khong hop le');
        }) as any;

        if (restock.length) {
          await this.inventory.recordReturnFromRMA(restock, dto.reason, session as ClientSession, {
            orderId: String(order._id), receiptId: String(doc._id),
            ownerKind: order.agentId ? 'dealer' : 'company', ownerId: doc.ownerId,
            holderKind: doc.holderKind as 'company' | 'supplier' | 'agent',
            holderId: doc.holderId, holderAddress: doc.holderAddress,
          });
        }
        if (!order.agentId) {
          order.recoveredInventoryValue = Number(order.recoveredInventoryValue || 0)
            + restock.reduce((sum, row) => sum + row.quantity * row.recoveryUnitCost, 0);
        }
        order.receivedReturnQuantity = Number(order.receivedReturnQuantity || 0) + receivedQuantity;

        order.orderStatus = order.deliveredQuantity ? 'Giao một phần' : await this.calculationService.resolveCanonicalReturnStatus();
        if (shipment && order.receivedReturnQuantity === shipment.quantity - Number(order.deliveredQuantity || 0)) {
          shipment.status = order.deliveredQuantity ? 'partial' : 'returned';
        }
        // Return resolve keeps the existing order quote snapshots; only the final
        // return financials need to be recomputed inside the transaction.
        await this.calculationService.applyCompletedStatusFinancials(order);
        await order.save({ session });
        orderForEvent = order;

        await doc.save({ session });
        result = doc.toObject();
      });
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('WriteConflict') || message.includes('TransientTransactionError')) {
        const latest = await this.model.findById(id).exec();
        if (latest) {
          throw new BadRequestException(latest.status === 'resolved' ? 'Phieu da xu ly' : 'Khong the xu ly phieu hang hoan luc nay');
        }
      }
      throw error;
    } finally {
      await session.endSession();
    }

    if (orderForEvent) {
      if (this.eventEmitter.emitAsync) await this.eventEmitter.emitAsync(FINANCIAL_INPUT_CHANGED, {
        dates: [orderForEvent.orderDate], revalue: false,
      });
      this.eventEmitter.emit(FinanceEvents.ORDER_COMPLETED, {
        orderId: String(orderForEvent._id),
        orderDate: orderForEvent.orderDate,
        adGroupId: orderForEvent.adGroupId,
        supplierId: orderForEvent.supplierId ? String(orderForEvent.supplierId) : undefined,
        agentId: orderForEvent.agentId ? String(orderForEvent.agentId) : undefined,
        codAmount: orderForEvent.codAmount,
      });
    }

    return result;
  }

  private async ensureItemIds(doc: ReturnRequestDocument, session?: ClientSession) {
    let changed = false;

    for (const item of doc.items || []) {
      if (!(item as any)._id) {
        (item as any)._id = new Types.ObjectId();
        changed = true;
      }
    }

    if (!changed) {
      return;
    }

    if (session) {
      await doc.save({ session });
      return;
    }

    await doc.save();
  }
}
