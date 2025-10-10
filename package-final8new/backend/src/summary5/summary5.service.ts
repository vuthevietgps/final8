/**
 * Summary5 Service - Báo cáo tổng hợp cuối cùng với chi phí và lợi nhuận theo ngày
 * Features: Tổng hợp từ Summary4, tính toán chi phí quảng cáo/nhân công/khác
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Summary5, Summary5Document } from './schemas/summary5.schema';
import { Summary4, Summary4Document } from '../summary4/schemas/summary4.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { LaborCost1, LaborCost1Document } from '../labor-cost1/schemas/labor-cost1.schema';
import { OtherCost, OtherCostDocument } from '../other-cost/schemas/other-cost.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { User, UserDocument } from '../user/user.schema';
import { UserRole } from '../user/user.enum';
import { Summary5FilterDto } from './dto/summary5-filter.dto';

@Injectable()
export class Summary5Service {
  private readonly logger = new Logger(Summary5Service.name);

  constructor(
    @InjectModel(Summary5.name) private readonly s5Model: Model<Summary5Document>,
    @InjectModel(Summary4.name) private readonly s4Model: Model<Summary4Document>,
    @InjectModel(AdvertisingCost.name) private readonly adModel: Model<AdvertisingCostDocument>,
    @InjectModel(LaborCost1.name) private readonly laborModel: Model<LaborCost1Document>,
    @InjectModel(OtherCost.name) private readonly otherModel: Model<OtherCostDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /**
   * Utility methods for date handling
   */
  private startOfDay(d: Date): Date { 
    const x = new Date(d); 
    x.setHours(0, 0, 0, 0); 
    return x; 
  }
  
  private endOfDay(d: Date): Date { 
    const x = new Date(d); 
    x.setHours(23, 59, 59, 999); 
    return x; 
  }

  async findAll(filter: Summary5FilterDto) {
    const q: any = {};
    if (filter.agentId) q.agentId = new Types.ObjectId(filter.agentId);
    if (filter.productId) q.productId = new Types.ObjectId(filter.productId);
    if (filter.productionStatus) q.productionStatus = { $regex: new RegExp(filter.productionStatus, 'i') };
    if (filter.orderStatus) q.orderStatus = { $regex: new RegExp(filter.orderStatus, 'i') };
    if (filter.startDate || filter.endDate) {
      q.orderDate = {};
      if (filter.startDate) q.orderDate.$gte = this.startOfDay(new Date(filter.startDate));
      if (filter.endDate) q.orderDate.$lte = this.endOfDay(new Date(filter.endDate));
    }
    const page = Number(filter.page || 1);
    const limit = Number(filter.limit || 50);
    const sortBy = filter.sortBy || 'orderDate';
    const sortOrder = filter.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.s5Model.find(q).sort({ [sortBy]: sortOrder, _id: -1 }).skip((page-1)*limit).limit(limit).lean(),
      this.s5Model.countDocuments(q),
    ]);

    return { data, total, page, totalPages: Math.ceil(total/limit) };
  }

  async stats(filter: Summary5FilterDto) {
    const match: any = {};
    if (filter.startDate || filter.endDate) {
      match.orderDate = {};
      if (filter.startDate) match.orderDate.$gte = this.startOfDay(new Date(filter.startDate));
      if (filter.endDate) match.orderDate.$lte = this.endOfDay(new Date(filter.endDate));
    }
    const [res] = await this.s5Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
          totalLaborCost: { $sum: { $ifNull: ['$laborCost', 0] } },
          totalOtherCost: { $sum: { $ifNull: ['$otherCost', 0] } },
          totalCostOfGoods: { $sum: { $ifNull: ['$costOfGoods', 0] } },
          totalRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
          totalProfit: { $sum: { $ifNull: ['$profit', 0] } },
        },
      },
    ]).exec();
    return res || { totalRecords: 0, totalAdCost: 0, totalLaborCost: 0, totalOtherCost: 0, totalCostOfGoods: 0, totalRevenue: 0, totalProfit: 0 };
  }

  /**
   * Đồng bộ Summary5 từ Summary4 theo ngày/điều kiện, tính toán các chi phí và doanh thu/lợi nhuận
   */
  async sync(filter?: { startDate?: string; endDate?: string }) {
    const q: any = {};
    if (filter?.startDate || filter?.endDate) {
      q.orderDate = {};
      if (filter.startDate) q.orderDate.$gte = this.startOfDay(new Date(filter.startDate));
      if (filter.endDate) q.orderDate.$lte = this.endOfDay(new Date(filter.endDate));
    }
    const s4Rows = await this.s4Model.find(q).lean();
    if (!s4Rows.length) return { synced: 0 };

    // Preload products by name for importPrice
    const productNames = Array.from(new Set(s4Rows.map(r => r.product).filter(Boolean)));
    const products = await this.productModel.find({ name: { $in: productNames } }).lean();
    const productMap = new Map(products.map(p => [p.name, p]));

    // Preload users by fullName for role lookup
    const agentNames = Array.from(new Set(s4Rows.map(r => r.agentName).filter(Boolean)));
    const users = await this.userModel.find({ fullName: { $in: agentNames } }).lean();
    const userMap = new Map(users.map(u => [u.fullName, u]));

    // Group S4 rows by day for allocations
    type DayKey = string; // yyyy-mm-dd
    const dayKey = (d: Date) => this.startOfDay(new Date(d)).toISOString();
    const rowsByDay = new Map<DayKey, Summary4[]>();
    for (const r of s4Rows) {
      const k = dayKey(r.orderDate);
      if (!rowsByDay.has(k)) rowsByDay.set(k, []);
      rowsByDay.get(k)!.push(r as any);
    }

    let synced = 0;

    for (const [k, dayRows] of rowsByDay) {
      const date = new Date(k);
      // totals for the day
      const totalQtyAll = dayRows.reduce((sum, x) => sum + (x.quantity || 0), 0);
      // ad cost per adGroupId for the day
      const adGroupIds = Array.from(new Set(dayRows.map(r => r.adGroupId).filter(Boolean)));
      const adCosts = await this.adModel.aggregate([
        { $match: { adGroupId: { $in: adGroupIds }, date: { $gte: this.startOfDay(date), $lte: this.endOfDay(date) } } },
        { $group: { _id: '$adGroupId', totalSpent: { $sum: { $ifNull: ['$spentAmount', 0] } } } }
      ]).exec();
      const adCostMap = new Map<string, number>(adCosts.map(x => [x._id as string, x.totalSpent || 0]));

      // labor cost total in the day
      const [laborAgg] = await this.laborModel.aggregate([
        { $match: { date: { $gte: this.startOfDay(date), $lte: this.endOfDay(date) } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$cost', 0] } } } }
      ]).exec();
      const totalLabor = laborAgg?.total || 0;

      // other cost total in the day
      const [otherAgg] = await this.otherModel.aggregate([
        { $match: { date: { $gte: this.startOfDay(date), $lte: this.endOfDay(date) } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$amount', 0] } } } }
      ]).exec();
      const totalOther = otherAgg?.total || 0;

      // totals per adGroupId for product count in the day (for ad allocation)
      const totalProductCountByAdGroup = new Map<string, number>();
      for (const gid of adGroupIds) {
        const rows = dayRows.filter(r => r.adGroupId === gid);
        const count = rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
        totalProductCountByAdGroup.set(gid, count || 1);
      }

      for (const row of dayRows) {
        const qty = row.quantity || 0;
        const gid = row.adGroupId || '0';

        // Ad cost allocation: total spent of adGroupId / total products of that adGroupId in that day * qty
        const adSpent = adCostMap.get(gid) || 0;
        const groupQtyTotal = totalProductCountByAdGroup.get(gid) || qty || 1;
        const adCost = (adSpent / groupQtyTotal) * qty;

        // Labor cost: total labor in day / total qty of all orders in day * qty
        const laborCost = totalQtyAll ? (totalLabor / totalQtyAll) * qty : 0;

        // Other cost: total other in day / total qty of all orders in day * qty
        const otherCost = totalQtyAll ? (totalOther / totalQtyAll) * qty : 0;

        // Cost of goods: importPrice * qty (lookup by product name) - only when productionStatus is "Đã trả kết quả"
        const prod = productMap.get(row.product);
        const importPrice = prod?.importPrice || 0;
        const costOfGoods = row.productionStatus === 'Đã trả kết quả' ? importPrice * qty : 0;

        // Revenue rules
        const user = userMap.get(row.agentName);
        let revenue = 0;
        if (user?.role === UserRole.EXTERNAL_AGENT && row.productionStatus === 'Đã trả kết quả') {
          revenue = (row.approvedQuotePrice || 0) * qty;
        } else if (user?.role) {
          const role = String(user.role).toLowerCase();
          const internalRoles = new Set(['internal_agent', 'internal_manager', 'director', 'manager', 'employee']);
          if (internalRoles.has(role)) {
          // Treat as internal: use COD when delivered success
          if (row.orderStatus === 'Giao thành công') revenue = row.codAmount || 0;
          }
        }

        const profit = revenue - costOfGoods - otherCost - laborCost - adCost;

        const doc: Partial<Summary5> = {
          // copy fields from s4 row (exclude testOrder2Id from $set to avoid conflict with $setOnInsert)
          orderDate: row.orderDate as any,
          customerName: row.customerName,
          product: row.product,
          quantity: row.quantity,
          agentName: row.agentName,
          adGroupId: row.adGroupId,
          isActive: row.isActive,
          serviceDetails: row.serviceDetails,
          productionStatus: row.productionStatus,
          orderStatus: row.orderStatus,
          submitLink: row.submitLink,
          trackingNumber: row.trackingNumber,
          depositAmount: row.depositAmount,
          codAmount: row.codAmount,
          agentId: row.agentId as any,
          productId: row.productId as any,
          approvedQuotePrice: row.approvedQuotePrice,
          mustPayToCompany: row.mustPayToCompany,
          paidToCompany: row.paidToCompany,
          manualPayment: row.manualPayment,
          needToPay: row.needToPay,
          // new fields
          adCost: Math.round(adCost),
          laborCost: Math.round(laborCost),
          otherCost: Math.round(otherCost),
          costOfGoods: Math.round(costOfGoods),
          revenue: Math.round(revenue),
          profit: Math.round(profit),
        };

        await this.s5Model.updateOne(
          { testOrder2Id: row.testOrder2Id },
          { $set: doc, $setOnInsert: { testOrder2Id: row.testOrder2Id } },
          { upsert: true }
        );
        synced++;
      }
    }

    return { synced };
  }

  /**
   * Xóa tất cả dữ liệu Summary5 để chuẩn bị đồng bộ lại
   * Sử dụng khi cần reset hoàn toàn dữ liệu Summary5
   */
  async clearAll(): Promise<{ success: boolean; deletedCount: number; message: string }> {
    const startTime = Date.now();
    
    try {
      this.logger.warn('[Summary5Service.clearAll] Starting clear operation...');
      
      // Đếm số records trước khi xóa để có thống kê chi tiết
      const countBefore = await this.s5Model.countDocuments();
      this.logger.log(`[Summary5Service.clearAll] Found ${countBefore} records to clear`);

      const result = await this.s5Model.deleteMany({});
      const duration = Date.now() - startTime;
      
      this.logger.log(`[Summary5Service.clearAll] Successfully cleared ${result.deletedCount} records from Summary5 (${duration}ms)`);
      
      // Verify the deletion
      const countAfter = await this.s5Model.countDocuments();
      if (countAfter > 0) {
        this.logger.warn(`[Summary5Service.clearAll] Warning: ${countAfter} records still remain after clear operation`);
      }

      return {
        success: true,
        deletedCount: result.deletedCount,
        message: `Đã xóa thành công ${result.deletedCount} records từ Summary5 (${duration}ms)`
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`[Summary5Service.clearAll] Error clearing Summary5 records (${duration}ms):`, {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        deletedCount: 0,
        message: `Lỗi khi xóa dữ liệu Summary5 (${duration}ms): ${error.message}`
      };
    }
  }
}
