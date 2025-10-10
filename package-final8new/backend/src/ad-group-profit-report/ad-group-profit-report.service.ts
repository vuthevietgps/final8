/**
 * File: ad-group-profit-report/ad-group-profit-report.service.ts
 * Mục đích: Service xử lý nghiệp vụ báo cáo lợi nhuận nhóm quảng cáo theo ngày
 * Dữ liệu nguồn: Summary5 (đã bao gồm adCost/laborCost/otherCost/costOfGoods/revenue/profit)
 * Trả về cấu trúc tương tự product-profit-report
 */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdGroupProfitFilterDto } from './dto/ad-group-profit-filter.dto';
import { Summary5, Summary5Document } from '../summary5/schemas/summary5.schema';

@Injectable()
export class AdGroupProfitReportService {
  constructor(
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Summary5.name) private s5Model: Model<Summary5Document>,
  ) {}

  private startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

  async getAdGroupProfitReport(filter: AdGroupProfitFilterDto) {
  const { from, to } = this.calculateDateRange(filter.year, filter.period, filter.fromDate, filter.toDate);

    // Lấy thông tin ad group để map tên
    const adGroups = await this.adGroupModel.find().populate('productId', 'name').populate('agentId', 'name').lean();
    const adGroupNameMap = new Map<string, { name: string; productName: string; agentName: string }>();
    adGroups.forEach(ag => {
      adGroupNameMap.set(ag.adGroupId, {
        name: ag.name,
        productName: (ag as any).productId?.name || 'Unknown',
        agentName: (ag as any).agentId?.name || 'Unknown'
      });
    });

    // Tạo danh sách ngày liên tục
    const dates: string[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }

    // Tổng hợp dữ liệu theo adGroupId + ngày từ Summary5
    type Daily = { date: string; profit: number; revenue: number; adCost: number; orders: number };
    const byAdGroup = new Map<string, Map<string, Daily>>();

  const match: any = { orderDate: { $gte: this.startOfDay(from), $lte: this.endOfDay(to) } };
    if (filter.adGroupId) match.adGroupId = filter.adGroupId;

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
          sumProfit: 1,
          sumRevenue: 1,
          sumAdCost: 1,
          orders: 1,
        },
      },
    ]).exec();

    for (const row of agg as any[]) {
      const adGroupId = String(row.adGroupId || '');
      if (!adGroupId) continue;
      if (!byAdGroup.has(adGroupId)) byAdGroup.set(adGroupId, new Map<string, Daily>());
      const map = byAdGroup.get(adGroupId)!;
      const current = map.get(row.date) || { date: row.date, profit: 0, revenue: 0, adCost: 0, orders: 0 };
      current.profit += Number(row.sumProfit || 0);
      current.revenue += Number(row.sumRevenue || 0);
      current.adCost += Number(row.sumAdCost || 0);
      current.orders += Number(row.orders || 0);
      map.set(row.date, current);
    }

    // Chuyển thành ma trận theo định dạng giống product report
    const data: any[] = [];
    const adGroupsOut: any[] = [];
    const allAdGroupIds = new Set<string>([...byAdGroup.keys()]);
    allAdGroupIds.forEach((adGroupId) => {
      const dayMap = byAdGroup.get(adGroupId) || new Map<string, Daily>();
      const info = adGroupNameMap.get(adGroupId) || { name: 'Unknown', productName: 'Unknown', agentName: 'Unknown' };
      adGroupsOut.push({ id: adGroupId, name: info.name });

      const row: any = {
        adGroupId,
        adGroupName: info.name,
        productName: info.productName,
        agentName: info.agentName,
        dailyProfits: {} as Record<string, number>,
        dailyCosts: {} as Record<string, number>,
        totalProfit: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalOrders: 0
      };
      dates.forEach(date => {
        const d = dayMap.get(date);
        row.dailyProfits[date] = d?.profit || 0;
        // Chi phí mỗi ngày hiển thị: dùng tổng adCost từ Summary5
        const dailyAdCost = d?.adCost || 0;
        row.dailyCosts[date] = dailyAdCost;
        if (d) {
          row.totalProfit += d.profit;
          row.totalRevenue += d.revenue;
          row.totalCost += dailyAdCost; // tổng chi phí QC cho báo cáo này
          row.totalOrders += d.orders;
        }
      });

      data.push(row);
    });

    const summary = {
      totalProfit: data.reduce((s, r) => s + r.totalProfit, 0),
      totalRevenue: data.reduce((s, r) => s + r.totalRevenue, 0),
      totalCost: data.reduce((s, r) => s + r.totalCost, 0),
      totalOrders: data.reduce((s, r) => s + (r.totalOrders || 0), 0),
    };

    return {
      adGroups: adGroupsOut,
      dates,
      data,
      summary
    };
  }

  private calculateDateRange(year?: number, period?: string, fromDate?: string, toDate?: string) {
    const now = new Date();
    let from: Date, to: Date;
    if (period === 'custom' && fromDate && toDate) {
      from = this.startOfDay(new Date(fromDate));
      to = this.endOfDay(new Date(toDate));
    } else if (year) {
      from = this.startOfDay(new Date(year, 0, 1));
      to = this.endOfDay(new Date(year, 11, 31));
    } else {
      switch (period) {
        case 'week':
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); to = now; break;
        case '10days':
          from = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); to = now; break;
        case '30days':
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); to = now; break;
        case 'lastMonth':
          from = this.startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
          to = this.endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
          break;
        case 'thisMonth':
          from = this.startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)); to = now; break;
        default:
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); to = now;
      }
    }
    return { from, to };
  }

  async getAvailableYears(): Promise<number[]> {
    // Lấy danh sách năm có dữ liệu từ Summary5
    const years = await this.s5Model.aggregate([
      { $project: { y: { $year: '$orderDate' } } },
      { $group: { _id: '$y' } },
      { $project: { _id: 0, year: '$_id' } },
      { $sort: { year: -1 } },
    ]).exec();
    return years.map((x: any) => x.year).filter((y: any) => typeof y === 'number');
  }
}
