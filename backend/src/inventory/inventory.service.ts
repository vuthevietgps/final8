import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InventorySummary, InventorySummaryDocument } from './schemas/inventory-summary.schema';
import { InventoryTransaction, InventoryTransactionDocument } from './schemas/inventory-transaction.schema';

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventorySummary.name) private summaryModel: Model<InventorySummaryDocument>,
    @InjectModel(InventoryTransaction.name) private txModel: Model<InventoryTransactionDocument>,
  ) {}

  /** Record receive transactions from a PO and update WAC */
  async recordReceiveFromPO(poId: string, supplierId: string | undefined, items: Array<{ productId: string; quantity: number; unitPrice: number }>) {
    const txs: any[] = [];
    for (const it of items) {
      const pid = new Types.ObjectId(it.productId);
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice || 0);
      if (qty <= 0) continue;

      // Upsert summary and compute new WAC
      const sum = await this.summaryModel.findOne({ productId: pid });
      const onHand = sum?.onHand || 0;
      const avg = sum?.avgCost || 0;
      const newOnHand = onHand + qty;
      const newAvg = newOnHand > 0 ? ((onHand * avg) + (qty * price)) / newOnHand : 0;
      if (sum) {
        sum.onHand = newOnHand;
        sum.avgCost = newAvg;
        await sum.save();
      } else {
        await this.summaryModel.create({ productId: pid, onHand: newOnHand, avgCost: newAvg });
      }

      txs.push({
        productId: pid,
        type: 'receive',
        quantity: qty,
        unitCost: price,
        purchaseOrderId: new Types.ObjectId(poId),
        supplierId: supplierId ? new Types.ObjectId(supplierId) : undefined,
        occurredAt: new Date(),
        notes: 'Nhập từ đơn nhập hàng',
      });
    }
    if (txs.length) await this.txModel.insertMany(txs);
  }

  /** Adjustment: can be positive or negative. If positive and unitCost provided, update WAC */
  async adjustStock(productId: string, quantity: number, unitCost?: number, notes?: string) {
    const pid = new Types.ObjectId(productId);
    const sum = await this.summaryModel.findOne({ productId: pid });
    const onHand = sum?.onHand || 0;
    let avg = sum?.avgCost || 0;
    const qty = Number(quantity || 0);
    if (qty === 0) return sum?.toObject();
    const newOnHand = onHand + qty;
    if (qty > 0 && unitCost !== undefined) {
      avg = newOnHand > 0 ? ((onHand * avg) + (qty * unitCost)) / newOnHand : 0;
    }
    if (sum) {
      sum.onHand = newOnHand;
      sum.avgCost = avg;
      await sum.save();
    } else {
      await this.summaryModel.create({ productId: pid, onHand: newOnHand, avgCost: qty > 0 ? (unitCost || 0) : 0 });
    }
    await this.txModel.create({ productId: pid, type: 'adjust', quantity: qty, unitCost, occurredAt: new Date(), notes });
    return this.summaryModel.findOne({ productId: pid }).lean();
  }

  async listSummary(params: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const skip = (page - 1) * limit;
    const q = params.q?.trim();
    // Basic join with product name via aggregation for convenience
    const pipeline: any[] = [
      { $lookup: { from: 'products', localField: 'productId', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
    ];
    if (q) {
      pipeline.push({ $match: { 'product.name': { $regex: q, $options: 'i' } } });
    }
    pipeline.push(
      { $sort: { updatedAt: -1 } },
      { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'c' }] } },
      { $project: { data: 1, total: { $ifNull: [{ $arrayElemAt: ['$total.c', 0] }, 0] } } },
    );
    const agg = await this.summaryModel.aggregate(pipeline);
    const total = agg?.[0]?.total || 0;
    const data = (agg?.[0]?.data || []).map((row: any) => ({
      productId: row.productId,
      productName: row.product?.name,
      onHand: row.onHand,
      avgCost: row.avgCost,
      updatedAt: row.updatedAt,
    }));
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listTransactions(productId: string, params: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const skip = (page - 1) * limit;
    const pid = new Types.ObjectId(productId);
    const [data, total] = await Promise.all([
      this.txModel.find({ productId: pid }).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
      this.txModel.countDocuments({ productId: pid }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
