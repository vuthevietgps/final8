import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { InventorySummary, InventorySummaryDocument } from './schemas/inventory-summary.schema';
import { InventoryTransaction, InventoryTransactionDocument } from './schemas/inventory-transaction.schema';
import { InventoryBatch, InventoryBatchDocument } from './schemas/inventory-batch.schema';

export interface ReturnStockContext {
  orderId: string;
  receiptId: string;
  ownerKind: 'company' | 'dealer';
  ownerId?: string;
  holderKind: 'company' | 'supplier' | 'agent';
  holderId?: string;
  holderAddress?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(InventorySummary.name) private summaryModel: Model<InventorySummaryDocument>,
    @InjectModel(InventoryTransaction.name) private txModel: Model<InventoryTransactionDocument>,
    @InjectModel(InventoryBatch.name) private batchModel: Model<InventoryBatchDocument>,
  ) {}

  async availableBatches(productId?: string, orderId?: string) {
    const match: any = { condition: 'resellable', ownerKind: { $in: ['company', 'dealer'] },
      $expr: { $gt: [{ $subtract: ['$quantityRemaining', { $ifNull: ['$quantityReserved', 0] }] }, 0] } };
    if (productId) match.productId = new Types.ObjectId(productId);
    if (orderId) {
      match.$or = [{ $expr: match.$expr }, { reservations: { $elemMatch: { orderId, state: 'reserved' } } }];
      delete match.$expr;
    }
    return this.batchModel.find(match).sort({ receivedAt: 1 }).lean();
  }

  /** Reserve one exact batch, atomically. Its owner and old cost follow the order. */
  async prepareOrderSource(order: any) {
    if (!['inventory', 'dealer_custody'].includes(order.productSource)) return;
    if (!order.inventoryBatchId) throw new BadRequestException('Chọn lô hàng đang có để xuất.');
    const batch = await this.batchModel.findById(order.inventoryBatchId).lean();
    const quantity = Number(order.quantity);
    if (!batch || !Number.isInteger(quantity) || quantity <= 0 || String(batch.productId) !== String(order.productId)
      || batch.condition !== 'resellable') throw new BadRequestException('Lô hàng/số lượng không hợp lệ.');
    if (order.productSource === 'inventory' ? batch.ownerKind !== 'company'
      : batch.ownerKind !== 'dealer' || !order.agentId || batch.ownerId !== String(order.agentId)) {
      throw new BadRequestException('Hàng không thuộc chủ sở hữu của giao dịch này.');
    }
    const orderId = String(order._id);
    const prior = batch.reservations?.find(r => r.orderId === orderId && r.state !== 'released');
    if (prior && prior.quantity !== quantity) throw new BadRequestException('Lô đã giữ cho số lượng khác; giải phóng trước khi đổi.');
    if (!prior) {
      const reserved = await this.batchModel.findOneAndUpdate({ _id: batch._id,
        reservations: { $not: { $elemMatch: { orderId, state: { $ne: 'released' } } } },
        $expr: { $gte: [{ $subtract: ['$quantityRemaining', { $ifNull: ['$quantityReserved', 0] }] }, quantity] },
      }, { $inc: { quantityReserved: quantity }, $push: { reservations: { orderId, quantity, state: 'reserved' } } });
      if (!reserved) throw new BadRequestException('Hàng đã được giữ cho đơn khác hoặc không đủ số lượng.');
    }
    order.inventoryUnitCostSnapshot = batch.unitCost;
    order.originalOrderId = batch.originalOrderId;
    order.senderKind = batch.holderKind;
    order.senderId = batch.holderId;
    order.senderAddress = batch.holderAddress;
    order.resalePolicySnapshot = 'resellable';
  }

  async commitOrderStock(order: any) {
    if (!['inventory', 'dealer_custody'].includes(order.productSource)) return;
    if (!(order.productionStatus === 'Đã trả kết quả' && String(order.trackingNumber || '').trim())) return;
    const orderId = String(order._id);
    const batch = await this.batchModel.findOneAndUpdate({ _id: order.inventoryBatchId,
      reservations: { $elemMatch: { orderId, state: 'reserved', quantity: order.quantity } },
      quantityRemaining: { $gte: order.quantity },
    }, { $inc: { quantityRemaining: -order.quantity, quantityReserved: -order.quantity },
      $set: { 'reservations.$.state': 'dispatched' } }, { new: true });
    if (!batch) {
      const already = await this.batchModel.exists({ _id: order.inventoryBatchId,
        reservations: { $elemMatch: { orderId, state: 'dispatched', quantity: order.quantity } } });
      if (!already) throw new BadRequestException('Không có hàng đã giữ để xuất cho đơn.');
    }
    await this.txModel.updateOne({ businessKey: `order-stock:${orderId}` }, { $setOnInsert: {
      productId: order.productId, orderId, batchId: order.inventoryBatchId, type: 'sale',
      quantity: -order.quantity, unitCost: order.inventoryUnitCostSnapshot,
      ownerKind: order.productSource === 'dealer_custody' ? 'dealer' : 'company',
      ownerId: order.productSource === 'dealer_custody' ? String(order.agentId) : undefined,
      occurredAt: new Date(), notes: 'Xuất hàng đang có; không mua NCC thêm.',
    } }, { upsert: true });
  }

  async releaseOrderReservation(batchId: unknown, orderId: string) {
    if (!batchId) return;
    const batch = await this.batchModel.findById(batchId).lean();
    const reservation = batch?.reservations?.find(r => r.orderId === orderId && r.state === 'reserved');
    if (!reservation) return;
    await this.batchModel.updateOne({ _id: batchId, reservations: { $elemMatch: { orderId, state: 'reserved' } } },
      { $inc: { quantityReserved: -reservation.quantity }, $set: { 'reservations.$.state': 'released' } });
  }

  /** Record receive transactions from a PO, create batches and update WAC (supports session). */
  async recordReceiveFromPO(
    poId: string,
    supplierId: string | undefined,
    items: Array<{ productId: string; quantity: number; unitPrice: number }>,
    session?: ClientSession,
  ) {
    const txs: any[] = [];
    const batchDocs: any[] = [];
    const summaryUpdates = new Map<string, { productId: Types.ObjectId; quantity: number; totalCost: number }>();
    const now = new Date();

    for (const it of items) {
      const pid = new Types.ObjectId(it.productId);
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice || 0);
      if (qty <= 0) continue;

      batchDocs.push({
        ownerKind: 'company', holderKind: 'company',
        productId: pid,
        source: 'purchase',
        supplierId: supplierId ? new Types.ObjectId(supplierId) : undefined,
        purchaseOrderId: new Types.ObjectId(poId),
        quantityRemaining: qty,
        unitCost: price,
        receivedAt: now,
        notes: 'Nhập từ đơn nhập hàng',
      });

      // Update summary (non-pipeline for clarity; safe when wrapped in session/transaction)
      const sum = await this.summaryModel.findOne({ productId: pid }).session(session || null);
      const onHand = sum?.onHand || 0;
      const avg = sum?.avgCost || 0;
      const newOnHand = onHand + qty;
      const newAvg = newOnHand > 0 ? ((onHand * avg) + (qty * price)) / newOnHand : 0;
      if (sum) {
        sum.onHand = newOnHand;
        sum.avgCost = newAvg;
        await sum.save({ session });
      } else {
        await this.summaryModel.create([{ productId: pid, onHand: newOnHand, avgCost: newAvg }], { session });
      }
    }

    const insertedBatches = batchDocs.length ? await this.batchModel.insertMany(batchDocs, { session, ordered: false }) : [];

    insertedBatches.forEach((b: any) => {
      txs.push({
        productId: b.productId,
        type: 'receive',
        quantity: b.quantityRemaining,
        unitCost: b.unitCost,
        purchaseOrderId: b.purchaseOrderId,
        supplierId: b.supplierId,
        occurredAt: b.receivedAt,
        batchId: b._id,
        notes: 'Nhập từ đơn nhập hàng',
      });
    });

    if (txs.length) await this.txModel.insertMany(txs, { session });
  }

  /** Adjustment: can be positive or negative. If positive and unitCost provided, update WAC */
  async adjustStock(productId: string, quantity: number, unitCost?: number, notes?: string) : Promise<any> { throw new BadRequestException('Cần chứng từ theo lô và chủ hàng. Nhập bằng PO/phiếu nhận hoàn, xuất bằng lần giao của đơn; không đổi tồn tổng theo sản phẩm.'); }

  /** Issue (outbound) stock with FIFO batches; blocks nếu không đủ tồn. */
  async issueStock(productId: string, quantity: number, notes?: string, session?: ClientSession) : Promise<any> { throw new BadRequestException('Cần chứng từ theo lô và chủ hàng. Nhập bằng PO/phiếu nhận hoàn, xuất bằng lần giao của đơn; không đổi tồn tổng theo sản phẩm.'); }

  async listSummary(params: { page?: number; limit?: number; q?: string }) {
    const page = Math.max(1, Number(params.page || 1));
    const limit = Math.max(1, Math.min(100, Number(params.limit || 20)));
    const skip = (page - 1) * limit;
    const q = params.q?.trim();
    // Basic join with product name via aggregation for convenience
    const pipeline: any[] = [
      { $group: { _id: { productId: '$productId', ownerKind: '$ownerKind', ownerId: '$ownerId',
        holderKind: '$holderKind', holderId: '$holderId' }, onHand: { $sum: '$quantityRemaining' },
        reserved: { $sum: '$quantityReserved' }, value: { $sum: { $multiply: ['$quantityRemaining', '$unitCost'] } },
        updatedAt: { $max: '$updatedAt' } } },
      { $set: { productId: '$_id.productId', ownerKind: '$_id.ownerKind', ownerId: '$_id.ownerId',
        holderKind: '$_id.holderKind', holderId: '$_id.holderId',
        avgCost: { $cond: [{ $gt: ['$onHand', 0] }, { $divide: ['$value', '$onHand'] }, 0] } } },
      { $lookup: { from: 'users', let: { owner: { $convert: { input: '$ownerId', to: 'objectId', onError: null, onNull: null } } },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$owner'] } } }, { $project: { fullName: 1 } }], as: 'ownerUser' } },
      { $lookup: { from: 'users', let: { holder: { $convert: { input: '$holderId', to: 'objectId', onError: null, onNull: null } } },
        pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$holder'] } } }, { $project: { fullName: 1 } }], as: 'holderUser' } },
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
    const agg = await this.batchModel.aggregate(pipeline);
    const total = agg?.[0]?.total || 0;
    const data = (agg?.[0]?.data || []).map((row: any) => ({
      productId: row.productId,
      productName: row.product?.name,
      onHand: row.onHand,
      reserved: row.reserved || 0,
      available: row.onHand - (row.reserved || 0),
      ownerKind: row.ownerKind || 'unreviewed', ownerId: row.ownerId,
      ownerName: row.ownerKind === 'company' ? 'Công ty' : row.ownerUser?.[0]?.fullName || 'Chưa xác định chủ hàng',
      holderKind: row.holderKind, holderId: row.holderId,
      holderName: row.holderKind === 'company' ? 'Công ty' : row.holderUser?.[0]?.fullName || 'Chưa xác định nơi giữ',
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

  /** Restock from returns (hàng hoàn) as separate batches. */
  async recordReturnFromRMA(
    items: Array<{ productId: string; quantity: number; recoveryUnitCost: number }>,
    notes?: string,
    session?: ClientSession,
    context?: ReturnStockContext,
  ) {
    if (!context) throw new BadRequestException('Cần chủ sở hữu và nơi nhận hàng hoàn.');
    const txs: any[] = [];
    const batchDocs: any[] = [];
    const summaryUpdates = new Map<string, { productId: Types.ObjectId; quantity: number; totalCost: number }>();
    const now = new Date();

    for (const it of items) {
      const pid = new Types.ObjectId(it.productId);
      const qty = Number(it.quantity || 0);
      const price = Number(it.recoveryUnitCost || 0);
      if (qty <= 0) continue;

      batchDocs.push({
        ownerKind: context.ownerKind, ownerId: context.ownerId,
        holderKind: context.holderKind, holderId: context.holderId, holderAddress: context.holderAddress,
        originalOrderId: context.orderId, receiptKey: `${context.receiptId}:${batchDocs.length}`,
        productId: pid,
        source: 'return',
        quantityRemaining: qty,
        unitCost: price,
        receivedAt: now,
        notes: notes || 'Nhập hàng hoàn',
      });

      const key = pid.toHexString();
      const current = summaryUpdates.get(key);
      if (current) {
        current.quantity += qty;
        current.totalCost += qty * price;
      } else {
        summaryUpdates.set(key, {
          productId: pid,
          quantity: qty,
          totalCost: qty * price,
        });
      }
    }

    for (const update of context.ownerKind === 'company' ? summaryUpdates.values() : []) {
      const updateOptions = session ? { upsert: true, session } : { upsert: true };
      await this.summaryModel.updateOne(
        { productId: update.productId },
        [
          {
            $set: {
              productId: update.productId,
              onHand: {
                $add: [
                  { $ifNull: ['$onHand', 0] },
                  update.quantity,
                ],
              },
              avgCost: {
                $let: {
                  vars: {
                    currentOnHand: { $ifNull: ['$onHand', 0] },
                    currentAvg: { $ifNull: ['$avgCost', 0] },
                    newOnHand: {
                      $add: [
                        { $ifNull: ['$onHand', 0] },
                        update.quantity,
                      ],
                    },
                  },
                  in: {
                    $cond: [
                      { $gt: ['$$newOnHand', 0] },
                      {
                        $divide: [
                          {
                            $add: [
                              { $multiply: ['$$currentOnHand', '$$currentAvg'] },
                              update.totalCost,
                            ],
                          },
                          '$$newOnHand',
                        ],
                      },
                      0,
                    ],
                  },
                },
              },
            },
          },
        ],
        updateOptions,
      );
    }

    const inserted = batchDocs.length ? await this.batchModel.insertMany(batchDocs, { session, ordered: false }) : [];
    inserted.forEach((b: any) => {
      txs.push({
        productId: b.productId,
        type: 'receive',
        quantity: b.quantityRemaining,
        unitCost: b.unitCost,
        batchId: b._id,
        orderId: context.orderId, ownerKind: context.ownerKind, ownerId: context.ownerId,
        occurredAt: b.receivedAt,
        notes: b.notes,
      });
    });
    if (txs.length) await this.txModel.insertMany(txs, { session });
  }
}
