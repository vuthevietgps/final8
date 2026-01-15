import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSupplierPayableDto } from './dto/create-supplier-payable.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { SupplierPayable, SupplierPayableDocument } from './schemas/supplier-payable.schema';

@Injectable()
export class SupplierPayableService {
  constructor(
    @InjectModel(SupplierPayable.name) private model: Model<SupplierPayableDocument>,
  ) {}

  private computeTotals(items: { quantity: number; unitPrice: number; amount?: number }[], providedTotal?: number) {
    const total = providedTotal !== undefined
      ? Number(providedTotal) || 0
      : (items || []).reduce((s, it) => s + Number(it.amount ?? (Number(it.quantity || 0) * Number(it.unitPrice || 0))), 0);
    return { totalAmount: total };
  }

  private recalc(doc: SupplierPayableDocument) {
    doc.balance = Math.max(0, Number(doc.totalAmount || 0) - Number(doc.amountPaid || 0));
    if (doc.amountPaid <= 0) doc.status = 'unpaid';
    else if (doc.balance <= 0.0001) doc.status = 'paid';
    else doc.status = 'partial';
  }

  async create(dto: CreateSupplierPayableDto) {
    if (!dto.items || dto.items.length === 0) throw new BadRequestException('Cần ít nhất 1 dòng công nợ');
    const items = dto.items.map(it => ({
      productId: it.productId ? new Types.ObjectId(it.productId) : undefined,
      productNameSnap: it.productNameSnap,
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      amount: it.amount !== undefined ? Number(it.amount) : Number(it.quantity || 0) * Number(it.unitPrice || 0),
    }));
    const { totalAmount } = this.computeTotals(items, dto.totalAmount);
    const doc = await this.model.create({
      supplierId: new Types.ObjectId(dto.supplierId),
      supplierNameSnap: dto.supplierNameSnap,
      purchaseOrderId: dto.purchaseOrderId ? new Types.ObjectId(dto.purchaseOrderId) : undefined,
      orderId: dto.orderId ? new Types.ObjectId(dto.orderId) : undefined,
      items,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      notes: dto.notes,
      currency: dto.currency || 'VND',
      status: dto.status || 'unpaid',
      payments: [],
    });
    return doc.toObject();
  }

  async findAll(params: { supplierId?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
    const query: any = {};
    if (params.supplierId) query.supplierId = new Types.ObjectId(params.supplierId);
    if (params.status) query.status = params.status;
    if (params.from || params.to) {
      query.createdAt = {} as any;
      if (params.from) (query.createdAt as any).$gte = new Date(params.from);
      if (params.to) {
        const to = new Date(params.to);
        to.setHours(23, 59, 59, 999);
        (query.createdAt as any).$lte = to;
      }
    }
    const [total, data] = await Promise.all([
      this.model.countDocuments(query),
      this.model.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return { data, pagination: { page, limit, total, totalPages: total ? Math.ceil(total / limit) : 0 } };
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException('Không tìm thấy công nợ');
    return doc;
  }

  async addPayment(id: string, dto: AddPaymentDto) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Không tìm thấy công nợ');
    const payment = {
      amount: Number(dto.amount),
      paidAt: new Date(dto.paidAt),
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
    };
    doc.payments.push(payment as any);
    doc.amountPaid = (doc.amountPaid || 0) + payment.amount;
    this.recalc(doc);
    await doc.save();
    return doc.toObject();
  }

  async update(id: string, payload: Partial<CreateSupplierPayableDto>) {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Không tìm thấy công nợ');
    if (payload.items) {
      const items = payload.items.map(it => ({
        productId: it.productId ? new Types.ObjectId(it.productId) : undefined,
        productNameSnap: it.productNameSnap,
        quantity: Number(it.quantity || 0),
        unitPrice: Number(it.unitPrice || 0),
        amount: it.amount !== undefined ? Number(it.amount) : Number(it.quantity || 0) * Number(it.unitPrice || 0),
      }));
      doc.items = items as any;
      const { totalAmount } = this.computeTotals(items, payload.totalAmount);
      doc.totalAmount = totalAmount;
    } else if (payload.totalAmount !== undefined) {
      doc.totalAmount = Number(payload.totalAmount);
    }
    if (payload.supplierId) doc.supplierId = new Types.ObjectId(payload.supplierId);
    if (payload.supplierNameSnap !== undefined) doc.supplierNameSnap = payload.supplierNameSnap;
    if (payload.purchaseOrderId) doc.purchaseOrderId = new Types.ObjectId(payload.purchaseOrderId);
    if (payload.orderId) doc.orderId = new Types.ObjectId(payload.orderId);
    if (payload.dueDate !== undefined) doc.dueDate = payload.dueDate ? new Date(payload.dueDate) : undefined;
    if (payload.notes !== undefined) doc.notes = payload.notes;
    if (payload.currency) doc.currency = payload.currency;
    this.recalc(doc);
    await doc.save();
    return doc.toObject();
  }

  async remove(id: string) {
    const res = await this.model.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException('Không tìm thấy công nợ');
    return res;
  }
}
