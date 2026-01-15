import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Summary5, Summary5Document } from './schemas/summary5.schema';
import { Summary4, Summary4Document } from '../summary4/schemas/summary4.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';

export interface Summary5Filter {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class Summary5Service {
  constructor(
    @InjectModel(Summary5.name) private readonly model: Model<Summary5Document>,
    @InjectModel(Summary4.name) private readonly s4Model: Model<Summary4Document>,
    @InjectModel(AdvertisingCost.name) private readonly adCostModel: Model<AdvertisingCostDocument>,
  ) {}

  async findAll(filter: Summary5Filter = {}) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(200, filter.limit || 50));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.startDate || filter.endDate) {
      query.orderDate = {};
      if (filter.startDate) query.orderDate.$gte = new Date(filter.startDate);
      if (filter.endDate) query.orderDate.$lte = new Date(filter.endDate);
    }

    const sort: any = {};
    if (filter.sortBy) sort[filter.sortBy] = filter.sortOrder === 'asc' ? 1 : -1;
    else sort.orderDate = -1;

    const [data, total] = await Promise.all([
      this.model.find(query).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(startDate?: string, endDate?: string) {
    const match: any = {};
    if (startDate || endDate) {
      match.orderDate = {};
      if (startDate) match.orderDate.$gte = new Date(startDate);
      if (endDate) match.orderDate.$lte = new Date(endDate);
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
          totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
          totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
          // Placeholders for fields not in schema
          totalLaborCost: { $sum: 0 },
          totalOtherCost: { $sum: 0 },
          totalCostOfGoods: { $sum: 0 },
        },
      },
    ];

    const res = await this.model.aggregate(pipeline);
    const s = res[0] || {
      totalRecords: 0,
      totalAdCost: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalLaborCost: 0,
      totalOtherCost: 0,
      totalCostOfGoods: 0,
    };
    return s;
  }

  /**
   * Đồng bộ Summary5 từ Summary4 + AdvertisingCost để phục vụ báo cáo lợi nhuận theo nhóm quảng cáo / sản phẩm.
   * - revenue: dùng paidToCompanyAmount
   * - profit: paidToCompanyAmount - mustPayAmount - manualPaymentAmount
   * - adCost: lấy từ AdvertisingCost (spentAmount) theo adGroupId + ngày; nếu không có thì 0
   */
  async sync(startDate?: string, endDate?: string) {
    try {
      console.log('[summary5.sync] Starting sync with params:', { startDate, endDate });
      
      const match: any = { isActive: { $ne: false } };
      const dateRange: any = {};
      if (startDate) dateRange.$gte = new Date(startDate);
      if (endDate) dateRange.$lte = new Date(endDate);
      if (Object.keys(dateRange).length) {
        match.orderDate = dateRange;
      }
      
      console.log('[summary5.sync] Match filter:', JSON.stringify(match));

      // Aggregate từ Summary4 (chỉ lấy orderDate dạng Date)
      console.log('[summary5.sync] Starting Summary4 aggregation...');
      
      // Debug: Kiểm tra 1 record để xem cấu trúc productId
      const sampleRecord = await this.model.db.collection('summary4').findOne({ productId: { $exists: true, $ne: null } });
      if (sampleRecord) {
        console.log('[summary5.sync] DEBUG - Sample productId type:', typeof sampleRecord.productId);
        console.log('[summary5.sync] DEBUG - Sample productId value:', JSON.stringify(sampleRecord.productId));
      }
      
      const summary4Agg = await this.model.db.collection('summary4').aggregate([
        { $match: match },
        {
          $project: {
            summary4Id: { $toString: '$_id' },
            // Nếu không có adGroupId thì gán = '0' (đại lý không chạy ads)
            adGroupId: {
              $cond: {
                if: {
                  $or: [
                    { $eq: [{ $type: '$adGroupId' }, 'missing'] },
                    { $eq: ['$adGroupId', null] },
                    { $eq: ['$adGroupId', ''] }
                  ]
                },
                then: '0',
                else: '$adGroupId'
              }
            },
            // Đảm bảo productId là ObjectId, không phải object populated
            productId: {
              $cond: {
                if: { $eq: [{ $type: '$productId' }, 'objectId'] },
                then: '$productId',
                else: {
                  $cond: {
                    if: { $ne: [{ $type: '$productId._id' }, 'missing'] },
                    then: '$productId._id',
                    else: null
                  }
                }
              }
            },
            orderDate: { $ifNull: ['$orderDate', '$createdAt'] },
            paidToCompanyAmount: { $ifNull: ['$paidToCompanyAmount', 0] },
            mustPayAmount: { $ifNull: ['$mustPayAmount', 0] },
            manualPaymentAmount: { $ifNull: ['$manualPaymentAmount', 0] },
            collectionStatus: { $ifNull: ['$collectionStatus', 'receivable'] },
            collectedAmount: { $ifNull: ['$collectedAmount', 0] },
            receivableAmount: { $ifNull: ['$receivableAmount', 0] },
          },
        },
        {
          $match: {
            orderDate: { $type: 'date' }
            // Không filter paidToCompanyAmount nữa vì logic doanh thu đã đúng:
            // - Internal agent: revenue khi giao thành công
            // - External agent: revenue khi đã trả kết quả
          },
        },
        {
          $addFields: {
            orderDateStr: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
            revenue: '$paidToCompanyAmount',
            profit: {
              revenue: {
                $cond: [
                  { $gt: ['$collectedAmount', 0] },
                  '$collectedAmount',
                  '$paidToCompanyAmount'
                ]
              },
              $subtract: [
                '$paidToCompanyAmount',
                { $add: ['$mustPayAmount', '$manualPaymentAmount'] },
              ],
            },
            adCost: 0,
          },
              collectionStatus: '$collectionStatus',
              collectedAmount: '$collectedAmount',
              receivableAmount: '$receivableAmount',
        },
        {
          $project: {
            _id: 0,
            summary4Id: 1,
            adGroupId: 1,
            // Chuyển productId về string để khớp với schema
            productId: {
              $cond: {
                if: { $eq: [{ $type: '$productId' }, 'objectId'] },
                then: { $toString: '$productId' },
                else: { $ifNull: ['$productId', null] }
              }
            },
            orderDate: 1,
            orderDateStr: 1,
            profit: 1,
            revenue: 1,
            adCost: 1,
              collectionStatus: 1,
              collectedAmount: 1,
              receivableAmount: 1,
          },
        },
      ], { allowDiskUse: true }).toArray();
      
      console.log('[summary5.sync] Summary4 aggregation complete. Records:', summary4Agg.length);

      // Aggregate chi phí quảng cáo theo adGroupId + ngày từ AdvertisingCost
      console.log('[summary5.sync] Starting AdvertisingCost aggregation...');
      const costMatch: any = { adGroupId: { $exists: true, $ne: null } };
      if (Object.keys(dateRange).length) costMatch.date = dateRange;
      const costAgg = await this.model.db.collection('advertisingcosts').aggregate([
        { $match: costMatch },
        {
          $match: { date: { $type: 'date' } },
        },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              dateStr: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            },
            adCost: { $sum: { $ifNull: ['$spentAmount', 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            adGroupId: '$_id.adGroupId',
            dateStr: '$_id.dateStr',
            adCost: 1,
          },
        },
      ], { allowDiskUse: true }).toArray();
      
      console.log('[summary5.sync] AdvertisingCost aggregation complete. Records:', costAgg.length);

      const costMap = new Map<string, number>();
      costAgg.forEach(c => {
        const key = `${c.adGroupId || ''}|${c.dateStr}`;
        costMap.set(key, (costMap.get(key) || 0) + Number(c.adCost || 0));
      });

      // Xóa dữ liệu Summary5 trong cùng khoảng thời gian để tránh trùng
      console.log('[summary5.sync] Deleting existing Summary5 records in date range...');
      const deleteFilter: any = {};
      if (Object.keys(dateRange).length) deleteFilter.orderDate = dateRange;
      const delRes = await this.model.deleteMany(deleteFilter);
      console.log('[summary5.sync] Deleted records:', delRes.deletedCount || 0);

      if (!summary4Agg.length) {
        console.log('[summary5.sync] No Summary4 records found, sync complete');
        return { synced: 0, inserted: 0, deleted: delRes.deletedCount || 0 };
      }

      // Hợp nhất chi phí QC vào kết quả Summary4 đã tổng hợp
      console.log('[summary5.sync] Merging advertising costs...');
      const merged = summary4Agg.map(row => {
        const dateStr = row.orderDate instanceof Date ? row.orderDate.toISOString().slice(0, 10) : '';
        const costKey = `${row.adGroupId || ''}|${dateStr}`;
        const adCost = costMap.get(costKey) || 0;
        return { ...row, adCost };
      });

      console.log('[summary5.sync] Inserting merged records...');
      const inserted = await this.model.insertMany(merged);
      console.log('[summary5.sync] Sync complete. Inserted:', inserted.length);
      return { synced: merged.length, inserted: inserted.length, deleted: delRes.deletedCount || 0 };
    } catch (error: any) {
      // Ghi log lỗi chi tiết để debug
      // eslint-disable-next-line no-console
      console.error('[summary5.sync] ERROR:', error?.message || error);
      console.error('[summary5.sync] Stack:', error?.stack);
      throw error;
    }
  }

  async syncFromSummary4AndAdCost(params: { startDate?: string; endDate?: string }) {
    const to = params.endDate ? new Date(params.endDate) : new Date();
    to.setHours(23, 59, 59, 999);
    const from = params.startDate ? new Date(params.startDate) : new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
    from.setHours(0, 0, 0, 0);

    // 1) Lấy doanh thu + cost-of-goods từ Summary4 theo adGroupId + day
    const s4Agg = await this.s4Model.aggregate([
      { $match: { adGroupId: { $exists: true, $ne: '' }, orderDate: { $gte: from, $lte: to }, isActive: { $ne: false } } },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            y: { $year: '$orderDate' },
            m: { $month: '$orderDate' },
            d: { $dayOfMonth: '$orderDate' },
          },
          revenue: { $sum: { $add: [ { $ifNull: ['$codAmount', 0] }, { $ifNull: ['$depositAmount', 0] }, { $ifNull: ['$manualPaymentAmount', 0] } ] } },
          costOfGoods: { $sum: { $ifNull: ['$mustPayAmount', 0] } },
          quantity: { $sum: { $ifNull: ['$quantity', 0] } },
          orders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id.adGroupId',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } },
            },
          },
          revenue: 1,
          costOfGoods: 1,
          quantity: 1,
          orders: 1,
        },
      },
    ]);

    // 2) Lấy ad cost từ advertising_cost
    const adCosts = await this.adCostModel.aggregate([
      { $match: { date: { $gte: from, $lte: to }, adGroupId: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: '$date',
          },
          adCost: { $sum: { $ifNull: ['$spentAmount', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id.adGroupId',
          // date trong advertising_cost đã là start-of-day UTC; convert sang string để join
          date: { $dateToString: { format: '%Y-%m-%d', date: '$_id.date' } },
          adCost: 1,
        },
      },
    ]);

    const adCostMap = new Map<string, number>();
    for (const c of adCosts) {
      adCostMap.set(`${c.adGroupId}|${c.date}`, Number(c.adCost || 0));
    }

    // 3) Merge và upsert Summary5
    let updated = 0;
    let created = 0;
    const seenKeys = new Set<string>();

    for (const row of s4Agg) {
      const key = `${row.adGroupId}|${row.date}`;
      const adCost = adCostMap.get(key) || 0;
      seenKeys.add(key);

      const revenue = Number(row.revenue || 0);
      const costOfGoods = Number(row.costOfGoods || 0);
      const profitBeforeAds = revenue - costOfGoods;
      const profit = profitBeforeAds - adCost;
      const orderDate = new Date(`${row.date}T00:00:00.000Z`);

      const res = await this.model.updateOne(
        { adGroupId: row.adGroupId, orderDate },
        {
          $set: {
            adGroupId: row.adGroupId,
            orderDate,
            revenue,
            profit,
            adCost,
            collectedAmount: revenue,
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount && res.upsertedCount > 0) created += 1; else if (res.modifiedCount && res.modifiedCount > 0) updated += 1;
    }

    // 4) Xử lý trường hợp chỉ có chi phí (không có đơn)
    for (const c of adCosts) {
      const key = `${c.adGroupId}|${c.date}`;
      if (seenKeys.has(key)) continue;
      const orderDate = new Date(`${c.date}T00:00:00.000Z`);
      const res = await this.model.updateOne(
        { adGroupId: c.adGroupId, orderDate },
        {
          $set: {
            adGroupId: c.adGroupId,
            orderDate,
            revenue: 0,
            profit: -Number(c.adCost || 0),
            adCost: Number(c.adCost || 0),
            collectedAmount: 0,
          },
        },
        { upsert: true },
      );
      if (res.upsertedCount && res.upsertedCount > 0) created += 1; else if (res.modifiedCount && res.modifiedCount > 0) updated += 1;
    }

    return { from, to, created, updated, total: created + updated };
  }
}
