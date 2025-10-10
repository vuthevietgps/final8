/**
 * File: ad-group-profit/ad-group-profit.service.ts
 * Mục đích: Tính báo cáo lợi nhuận theo nhóm quảng cáo theo ngày từ dữ liệu Summary5
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { Summary5, Summary5Document } from '../summary5/schemas/summary5.schema';

export interface AdGroupProfitReport {
  date: string; // Ngày tháng (YYYY-MM-DD)
  adGroupId: string; // ID nhóm quảng cáo
  adGroupName: string; // Tên nhóm quảng cáo
  adsCost: number; // Chi phí quảng cáo theo ngày (từ Summary5.adCost)
  totalProfit: number; // Lợi nhuận tổng hợp (từ Summary5.profit)
  orderCount: number; // Số đơn hàng
  totalQuantity: number; // Tổng số lượng
  totalRevenue: number; // Tổng doanh thu
}

@Injectable()
export class AdGroupProfitService {
  constructor(
    @InjectModel(AdGroup.name) private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Summary5.name) private readonly s5Model: Model<Summary5Document>,
  ) {}

  private startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

  /**
   * Lấy báo cáo lợi nhuận theo nhóm quảng cáo theo ngày
   */
  async getAdGroupProfitReport(params: { 
    from?: string; 
    to?: string; 
    agentId?: string;
  }): Promise<AdGroupProfitReport[]> {
    try {
      // Build match for Summary5
  const match: any = {};
  if (params.from) match.orderDate = { ...(match.orderDate || {}), $gte: this.startOfDay(new Date(params.from)) };
  if (params.to) match.orderDate = { ...(match.orderDate || {}), $lte: this.endOfDay(new Date(params.to)) };
      if (params.agentId) {
        try {
          match.agentId = new Types.ObjectId(params.agentId);
        } catch {
          match.agentId = params.agentId; // fallback if not a valid ObjectId
        }
      }

      // Aggregate Summary5 by adGroupId + day
      const agg = await this.s5Model.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              adGroupId: '$adGroupId',
              y: { $year: '$orderDate' },
              m: { $month: '$orderDate' },
              d: { $dayOfMonth: '$orderDate' },
            },
            sumProfit: { $sum: { $ifNull: ['$profit', 0] } },
            sumRevenue: { $sum: { $ifNull: ['$revenue', 0] } },
            sumAdCost: { $sum: { $ifNull: ['$adCost', 0] } },
            sumQty: { $sum: { $ifNull: ['$quantity', 0] } },
            orders: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            adGroupId: '$_id.adGroupId',
            date: { $dateToString: { format: '%Y-%m-%d', date: { $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' } } } },
            sumProfit: 1,
            sumRevenue: 1,
            sumAdCost: 1,
            sumQty: 1,
            orders: 1,
          }
        }
      ]).exec();

      if (!agg || !agg.length) return [];

      // Map tên nhóm quảng cáo
      const adGroupIds = Array.from(new Set(agg.map((x: any) => x.adGroupId).filter(Boolean)));
      const adGroupDocs = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).lean();
      const nameMap = new Map<string, string>();
      for (const ag of adGroupDocs) nameMap.set((ag as any).adGroupId, (ag as any).name || `Nhóm QC ${(ag as any).adGroupId}`);

      // Tạo báo cáo
      const reports: AdGroupProfitReport[] = agg.map((row: any) => ({
        date: row.date,
        adGroupId: row.adGroupId || 'unknown',
        adGroupName: nameMap.get(row.adGroupId) || `Nhóm QC ${row.adGroupId}`,
        adsCost: Number(row.sumAdCost || 0),
        totalProfit: Number(row.sumProfit || 0),
        orderCount: Number(row.orders || 0),
        totalQuantity: Number(row.sumQty || 0),
        totalRevenue: Number(row.sumRevenue || 0),
      }));

      // Sắp xếp theo ngày giảm dần, sau đó theo tên nhóm
      reports.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return a.adGroupName.localeCompare(b.adGroupName);
      });

      return reports;
    } catch (error) {
      console.error('Lỗi khi tạo báo cáo lợi nhuận nhóm quảng cáo:', error);
      throw new Error('Không thể tạo báo cáo lợi nhuận nhóm quảng cáo');
    }
  }

  /**
   * Lấy thống kê tổng quan
   */
  async getSummaryStats(params: { 
    from?: string; 
    to?: string; 
    agentId?: string;
  }): Promise<{
    totalProfit: number;
    totalOrders: number;
    totalAdGroups: number;
    avgProfitPerOrder: number;
  }> {
    try {
      const reports = await this.getAdGroupProfitReport(params);
      const totalProfit = reports.reduce((sum, r) => sum + r.totalProfit, 0);
      const totalOrders = reports.reduce((sum, r) => sum + r.orderCount, 0);
      const uniqueAdGroups = new Set(reports.map(r => r.adGroupId || r.adGroupName)).size;
      const avgProfitPerOrder = totalOrders > 0 ? totalProfit / totalOrders : 0;

      return {
        totalProfit: Number(totalProfit.toFixed(2)),
        totalOrders,
        totalAdGroups: uniqueAdGroups,
        avgProfitPerOrder: Number(avgProfitPerOrder.toFixed(2))
      };
    } catch (error) {
      console.error('Lỗi khi tính thống kê tổng quan:', error);
      return {
        totalProfit: 0,
        totalOrders: 0,
        totalAdGroups: 0,
        avgProfitPerOrder: 0
      };
    }
  }
}
