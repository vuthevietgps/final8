import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupplierPayable, SupplierPayableDocument } from '../schemas/supplier-payable.schema';
import { computeTotals, recalcPayableBalance } from '../helpers/payable.helpers';

/**
 * Service responsible for integrating payables with orders
 * Creates/updates payables automatically from order data
 */
@Injectable()
export class OrderIntegrationService {
  constructor(
    @InjectModel(SupplierPayable.name) private payableModel: Model<SupplierPayableDocument>,
  ) {}

  /**
   * Create or update payable for an order
   * Used by order system to sync payables with order changes
   */
  async upsertForOrder(params: {
    orderId: string;
    supplierId: string;
    items?: { productId?: string; productNameSnap?: string; quantity: number; unitPrice: number; amount?: number }[];
    totalAmount?: number;
    currency?: string;
    notes?: string;
  }) {
    const orderObjId = new Types.ObjectId(params.orderId);
    const supplierObjId = new Types.ObjectId(params.supplierId);

    const payload = params as any;
    const items = (payload.items || []).map((it: any) => ({
      productId: it.productId ? new Types.ObjectId(it.productId) : undefined,
      productNameSnap: it.productNameSnap,
      quantity: Number(it.quantity || 0),
      unitPrice: Number(it.unitPrice || 0),
      amount: it.amount !== undefined ? Number(it.amount) : Number(it.quantity || 0) * Number(it.unitPrice || 0),
    }));

    const total = payload.totalAmount !== undefined
      ? Number(payload.totalAmount)
      : items.reduce((s: number, it: any) => s + Number(it.amount || 0), 0);

    let doc = await this.payableModel.findOne({ orderId: orderObjId });
    if (!doc) {
      doc = new this.payableModel({
        orderId: orderObjId,
        supplierId: supplierObjId,
        items,
        totalAmount: total,
        amountPaid: 0,
        balance: total,
        currency: params.currency || 'VND',
        status: 'unpaid',
        notes: params.notes,
        payments: [],
      } as any);
    } else {
      doc.supplierId = supplierObjId;
      doc.items = items as any;
      doc.totalAmount = total;
      if (params.currency) doc.currency = params.currency;
      if (params.notes !== undefined) doc.notes = params.notes;
    }

    recalcPayableBalance(doc);
    await doc.save();
    return doc.toObject();
  }
}
