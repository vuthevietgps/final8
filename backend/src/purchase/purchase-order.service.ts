import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { CreatePurchaseOrderDto, PurchaseStatus } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';
import { PurchaseOrder, PurchaseOrderDocument } from './schemas/purchase-order.schema';
import { InventoryService } from '../inventory/inventory.service';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { PurchasePriceHistoryDto } from './dto/purchase-price-history.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectModel(PurchaseOrder.name)
    private poModel: Model<PurchaseOrderDocument>,
    private readonly inventory: InventoryService,
    private readonly supplierPayable: SupplierPayableService,
  ) {}

  private calcTotals(dto: { items: { quantity: number; unitPrice: number }[]; tax?: number; shippingFee?: number; discount?: number }) {
    const itemsTotal = (dto.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
    const tax = Number(dto.tax || 0);
    const shippingFee = Number(dto.shippingFee || 0);
    const discount = Number(dto.discount || 0);
    const grandTotal = Math.max(0, itemsTotal + tax + shippingFee - discount);
    return { itemsTotal, tax, shippingFee, discount, grandTotal };
  }

  private asObjectId(value: string, fieldName: string): Types.ObjectId {
    if (!value || !Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${fieldName} must be a valid ObjectId`);
    }
    return new Types.ObjectId(value);
  }

  /** Lịch sử giá nhập cho 1 sản phẩm, tùy chọn lọc theo NCC, khoảng ngày; trả về bản ghi mới nhất trước */
  async priceHistory(params: PurchasePriceHistoryDto) {
    const q: any = { 'items.productId': new Types.ObjectId(params.productId), 'items.quantityReceived': { $gt: 0 } };
    if (params.supplierId) q.supplierId = new Types.ObjectId(params.supplierId);
    const from = params.from ? new Date(params.from) : undefined;
    const to = params.to ? new Date(params.to) : undefined;
    if (from || to) {
      q.receivedDate = {} as any;
      if (from && !isNaN(from.getTime())) q.receivedDate.$gte = from;
      if (to && !isNaN(to.getTime())) { to.setHours(23,59,59,999); q.receivedDate.$lte = to; }
      if (Object.keys(q.receivedDate).length === 0) delete q.receivedDate;
    }
    const limit = Math.max(1, Math.min(200, Number(params.limit || 50)));
    const pipeline: any[] = [
      { $match: q },
      { $unwind: '$items' },
      { $match: { 'items.productId': new Types.ObjectId(params.productId), 'items.quantityReceived': { $gt: 0 } } },
      { $addFields: { receivedAt: { $ifNull: ['$receivedDate', '$updatedAt'] } } },
      {
        $project: {
          _id: 0,
          purchaseOrderId: '$_id',
          supplierId: 1,
          supplierNameSnap: 1,
          productId: '$items.productId',
          productNameSnap: '$items.productNameSnap',
          unitPrice: '$items.unitPrice',
          quantityReceived: '$items.quantityReceived',
          receivedAt: 1,
        },
      },
      { $sort: { receivedAt: -1 } },
      { $limit: limit },
    ];
    const rows = await this.poModel.aggregate(pipeline);
    if (!rows.length) return { data: [], stats: null };

    // Stats: latest, min/median/max (unitPrice) and avg 30/90 ngày nếu muốn
    const prices = rows.map((r: any) => Number(r.unitPrice || 0)).sort((a, b) => a - b);
    const median = prices.length % 2 === 1 ? prices[(prices.length - 1) / 2] : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
    const stats = {
      latest: rows[0].unitPrice,
      min: prices[0],
      max: prices[prices.length - 1],
      median,
    };
    return { data: rows, stats };
  }

  async create(dto: CreatePurchaseOrderDto) {
    if (!dto.items || dto.items.length === 0) throw new BadRequestException('Cần ít nhất 1 dòng hàng');
    const totals = this.calcTotals(dto);
    const doc = await this.poModel.create({
      supplierId: new Types.ObjectId(dto.supplierId),
      supplierNameSnap: dto.supplierNameSnap,
      status: dto.status || PurchaseStatus.DRAFT,
      expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
      items: dto.items.map(it => ({
        productId: new Types.ObjectId(it.productId),
        productNameSnap: it.productNameSnap,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        currency: it.currency || 'VND',
        quantityReceived: 0,
      })),
      ...totals,
      notes: dto.notes,
    });
    return doc.toObject();
  }

  async findAll(filter: { supplierId?: string; status?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, Number(filter.page || 1));
    const limit = Math.max(1, Math.min(100, Number(filter.limit || 20)));
    const q: any = {};
    if (filter.supplierId) q.supplierId = this.asObjectId(filter.supplierId, 'supplierId');
    if (filter.status) q.status = filter.status;
    const [data, total] = await Promise.all([
      this.poModel.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.poModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.poModel.findById(this.asObjectId(id, 'id')).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy PO');
    return doc;
  }

  /**
   * Báo cáo theo nhà cung cấp: tổng lượng đã nhận và tổng chi phí nhập (cũng là doanh thu phía nhà cung cấp)
   */
  async supplierReport(params: { from?: string; to?: string; supplierId?: string }) {
    const match: any = { qtyReceived: { $gt: 0 } };

    if (params.supplierId) {
      match.supplierId = this.asObjectId(params.supplierId, 'supplierId');
    }

    const fromDate = params.from ? new Date(params.from) : undefined;
    const toDate = params.to ? new Date(params.to) : undefined;
    if (toDate) toDate.setHours(23, 59, 59, 999);
    if (fromDate || toDate) {
      match.receivedAt = {};
      if (fromDate && !isNaN(fromDate.getTime())) match.receivedAt.$gte = fromDate;
      if (toDate && !isNaN(toDate.getTime())) match.receivedAt.$lte = toDate;
      if (Object.keys(match.receivedAt).length === 0) delete match.receivedAt;
    }

    const pipeline: any[] = [
      { $unwind: '$items' },
      {
        $addFields: {
          qtyReceived: '$items.quantityReceived',
          unitPrice: '$items.unitPrice',
          receivedAt: { $ifNull: ['$receivedDate', '$updatedAt'] },
        },
      },
      { $match: match },
      {
        $group: {
          _id: '$supplierId',
          supplierNameSnap: { $last: '$supplierNameSnap' },
          totalQuantityReceived: { $sum: '$qtyReceived' },
          totalCostReceived: { $sum: { $multiply: ['$qtyReceived', '$unitPrice'] } },
          orderIds: { $addToSet: '$_id' },
          lastReceivedAt: { $max: '$receivedAt' },
        },
      },
      {
        $project: {
          _id: 0,
          supplierId: '$_id',
          supplierNameSnap: 1,
          totalQuantityReceived: 1,
          totalCostReceived: 1,
          orderCount: { $size: '$orderIds' },
          lastReceivedAt: 1,
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplier',
        },
      },
      {
        $addFields: {
          supplierName: {
            $ifNull: [
              '$supplierNameSnap',
              { $arrayElemAt: ['$supplier.name', 0] },
            ],
          },
        },
      },
      { $project: { supplier: 0, supplierNameSnap: 0 } },
      { $sort: { totalCostReceived: -1 } },
    ];

    return this.poModel.aggregate(pipeline);
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const po = await this.poModel.findById(this.asObjectId(id, 'id'));
    if (!po) throw new NotFoundException('Không tìm thấy PO');
    if (dto.items && dto.items.length === 0) throw new BadRequestException('Cần ít nhất 1 dòng hàng');

    if (dto.supplierId) po.supplierId = new Types.ObjectId(dto.supplierId);
    if (dto.supplierNameSnap !== undefined) po.supplierNameSnap = dto.supplierNameSnap;
    if (dto.status) po.status = dto.status as any;
    if (dto.expectedDeliveryDate !== undefined) po.expectedDeliveryDate = dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined;
    if (dto.items) {
      // Giữ lại số lượng đã nhận cho các dòng không đổi productId; giới hạn bởi quantity mới
      const existingByProduct = new Map<string, number>();
      for (const ex of (po.items as any[] || [])) {
        const key = String(ex.productId);
        const received = Number(ex.quantityReceived || 0);
        // Nếu trùng product xuất hiện nhiều lần (hiếm), lấy giá trị nhận lớn nhất
        existingByProduct.set(key, Math.max(received, existingByProduct.get(key) || 0));
      }

      po.items = dto.items.map(it => {
        const productId = new Types.ObjectId(it.productId);
        const quantity = Number(it.quantity);
        const prevReceived = existingByProduct.get(String(productId)) || 0;
        return {
          productId,
          productNameSnap: it.productNameSnap,
          quantity,
          unitPrice: Number(it.unitPrice),
          currency: it.currency || 'VND',
          quantityReceived: Math.min(prevReceived, quantity),
          notes: it.notes,
        } as any;
      }) as any;
    }
    if (dto.tax !== undefined) po.tax = Number(dto.tax);
    if (dto.shippingFee !== undefined) po.shippingFee = Number(dto.shippingFee);
    if (dto.discount !== undefined) po.discount = Number(dto.discount);

    const totals = this.calcTotals({ items: po.items as any, tax: po.tax, shippingFee: po.shippingFee, discount: po.discount });
    po.itemsTotal = totals.itemsTotal;
    po.tax = totals.tax;
    po.shippingFee = totals.shippingFee;
    po.discount = totals.discount;
    po.grandTotal = totals.grandTotal;

    await po.save();
    return po.toObject();
  }

  async remove(id: string) {
    const res = await this.poModel.findByIdAndDelete(this.asObjectId(id, 'id')).lean();
    if (!res) throw new NotFoundException('Không tìm thấy PO');
    return res;
  }

  async receive(id: string, dto: ReceivePurchaseDto) {
    const purchaseOrderId = this.asObjectId(id, 'id');
    const session = await this.poModel.db.startSession();
    let result: any;
    await session.withTransaction(async () => {
      const po = await this.poModel.findById(purchaseOrderId).session(session);
      if (!po) throw new NotFoundException('Không tìm thấy PO');
      if (po.status === PurchaseStatus.CANCELLED) throw new BadRequestException('PO đã hủy, không thể nhập kho');
      if (po.status === PurchaseStatus.RECEIVED) throw new BadRequestException('PO đã nhập đủ');
      const byId = new Map<string, number>();
      for (const it of dto.items) {
        byId.set(String(it.itemId), Number(it.qtyReceived));
      }
      let anyReceived = false;
      const receivedForTx: Array<{ productId: string; quantity: number; unitPrice: number }> = [];
      const receivedForPayable: Array<{ productId: string; productNameSnap?: string; quantity: number; unitPrice: number }> = [];
      po.items = (po.items || []).map((it: any) => {
        // Support both subdocument _id and fallback by productId for older POs created without subdocument _id
        const requestedQty = byId.get(String((it as any)._id)) ?? byId.get(String((it as any).productId));
        if (requestedQty && requestedQty > 0) {
          const already = Number(it.quantityReceived || 0);
          const remaining = Math.max(0, Number(it.quantity || 0) - already);
          const appliedQty = Math.min(remaining, requestedQty);
          if (appliedQty > 0) {
            it.quantityReceived = already + appliedQty;
            anyReceived = true;
            // Record only the applied (non-over) quantity for inventory
            receivedForTx.push({ productId: String(it.productId), quantity: Number(appliedQty), unitPrice: Number(it.unitPrice || 0) });
            receivedForPayable.push({ productId: String(it.productId), productNameSnap: it.productNameSnap, quantity: Number(appliedQty), unitPrice: Number(it.unitPrice || 0) });
          }
        }
        return it;
      }) as any;
      if (!anyReceived) throw new BadRequestException('Không có số lượng nhận hợp lệ');

      const allReceived = po.items.every((it: any) => (it.quantityReceived || 0) >= it.quantity);
      po.status = allReceived ? PurchaseStatus.RECEIVED : PurchaseStatus.PARTIALLY_RECEIVED;
      if (anyReceived && !po.receivedDate) po.receivedDate = new Date();
      if (allReceived) po.receivedDate = new Date();
      await po.save({ session });

      const supplierId = po.supplierId ? String(po.supplierId) : undefined;
      await this.inventory.recordReceiveFromPO(String(po._id), supplierId, receivedForTx, session);
      
      // Note: Payable creation removed - using dropshipping model (orders only)
      // Payables are now created from TestOrder2 when status = "Đã trả kết quả"
      
      result = po.toObject();
    });
    await session.endSession();
    return result;
  }
}
