import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreatePurchaseOrderDto, PurchaseStatus } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ReceivePurchaseDto } from './dto/receive-purchase.dto';
import { PurchaseOrder, PurchaseOrderDocument } from './schemas/purchase-order.schema';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectModel(PurchaseOrder.name)
    private poModel: Model<PurchaseOrderDocument>,
    private readonly inventory: InventoryService,
  ) {}

  private calcTotals(dto: { items: { quantity: number; unitPrice: number }[]; tax?: number; shippingFee?: number; discount?: number }) {
    const itemsTotal = (dto.items || []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
    const tax = Number(dto.tax || 0);
    const shippingFee = Number(dto.shippingFee || 0);
    const discount = Number(dto.discount || 0);
    const grandTotal = Math.max(0, itemsTotal + tax + shippingFee - discount);
    return { itemsTotal, tax, shippingFee, discount, grandTotal };
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
    if (filter.supplierId) q.supplierId = new Types.ObjectId(filter.supplierId);
    if (filter.status) q.status = filter.status;
    const [data, total] = await Promise.all([
      this.poModel.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.poModel.countDocuments(q),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const doc = await this.poModel.findById(id).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy PO');
    return doc;
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    const po = await this.poModel.findById(id);
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
    const res = await this.poModel.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException('Không tìm thấy PO');
    return res;
  }

  async receive(id: string, dto: ReceivePurchaseDto) {
    const po = await this.poModel.findById(id);
    if (!po) throw new NotFoundException('Không tìm thấy PO');
    const byId = new Map<string, number>();
    for (const it of dto.items) {
      byId.set(String(it.itemId), Number(it.qtyReceived));
    }
    let anyReceived = false;
    const receivedForTx: Array<{ productId: string; quantity: number; unitPrice: number }> = [];
    po.items = (po.items || []).map((it: any) => {
      // Support both subdocument _id and fallback by productId for older POs created without subdocument _id
      const qty = byId.get(String((it as any)._id)) ?? byId.get(String((it as any).productId));
      if (qty && qty > 0) {
        it.quantityReceived = Math.min((it.quantityReceived || 0) + qty, it.quantity);
        anyReceived = true;
        // Record this for inventory receive transaction
        receivedForTx.push({ productId: String(it.productId), quantity: Number(qty), unitPrice: Number(it.unitPrice || 0) });
      }
      return it;
    }) as any;
    if (!anyReceived) throw new BadRequestException('Không có số lượng nhận hợp lệ');

    const allReceived = po.items.every((it: any) => (it.quantityReceived || 0) >= it.quantity);
    po.status = allReceived ? PurchaseStatus.RECEIVED : PurchaseStatus.PARTIALLY_RECEIVED;
    if (allReceived) po.receivedDate = new Date();
    await po.save();

    // Update inventory and WAC for received quantities
    try {
      const supplierId = po.supplierId ? String(po.supplierId) : undefined;
      await this.inventory.recordReceiveFromPO(String(po._id), supplierId, receivedForTx);
    } catch (e) {
      // Do not block PO flow on inventory errors, but they should be logged in real env
    }
    return po.toObject();
  }
}
