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
import { AdGroupRoiQueryDto } from './dto/ad-group-roi-query.dto';
import { Summary5, Summary5Document } from '../summary5/schemas/summary5.schema';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class AdGroupProfitReportService {
  constructor(
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Summary5.name) private s5Model: Model<Summary5Document>,
    private financeService: FinanceService,
  ) {}

  private startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
  private endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }
  private toDateOnlyString(d: Date): string { return new Date(d).toISOString().split('T')[0]; }

  async getAdGroupProfitReport(filter: AdGroupProfitFilterDto) {
  const { from, to } = this.calculateDateRange(filter.year, filter.period, filter.fromDate, filter.toDate);

    // Lấy thông tin ad group để map tên
    const adGroups = await this.adGroupModel
      .find()
      .populate('productCategoryId', 'name')
      .populate('selectedProducts', 'name')
      .populate('agentId', 'name')
      .lean();
    const adGroupNameMap = new Map<string, { name: string; productName: string; agentName: string }>();
    adGroups.forEach(ag => {
      const firstProduct = (ag as any).selectedProducts?.[0]?.name;
      const productCategory = (ag as any).productCategoryId?.name;
      adGroupNameMap.set(ag.adGroupId, {
        name: ag.name,
        productName: firstProduct || productCategory || 'Unknown',
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

  // Chỉ lấy bản ghi có orderDate là kiểu Date hợp lệ trong khoảng thời gian
  const match: any = {
    $and: [
      { orderDate: { $gte: this.startOfDay(from), $lte: this.endOfDay(to) } },
      { orderDate: { $type: 'date' } },
    ],
  };
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

  // ROI và gợi ý phân bổ ngân sách theo ad group
  async getAdGroupRoiInsights(query: AdGroupRoiQueryDto) {
    const { from, to } = this.calculateDateRange(query.year, query.period, query.fromDate, query.toDate);
    const targetRoi = query.targetRoi ?? 1.5;
    const minOrders = query.minOrders ?? 5;
    const minAdCost = query.minAdCost ?? 50000; // VND

    const matchAnd: any[] = [
      { orderDate: { $gte: this.startOfDay(from), $lte: this.endOfDay(to) } },
      { orderDate: { $type: 'date' } },
    ];
    if (query.adGroupId) matchAnd.push({ adGroupId: query.adGroupId });

    const agg = await this.s5Model.aggregate([
      { $match: { $and: matchAnd } },
      {
        $group: {
          _id: '$adGroupId',
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { profit: -1 } },
    ]).exec();

    const adGroupIds = agg.map((x: any) => x._id).filter(Boolean);
    const adGroupDocs = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).lean();
    const nameMap = new Map<string, string>();
    adGroupDocs.forEach((ag: any) => nameMap.set(ag.adGroupId, ag.name || 'Unknown'));

    const insights = agg.map((row: any) => {
      const adGroupId = row._id || 'unknown';
      const revenue = Number(row.revenue || 0);
      const adCost = Number(row.adCost || 0);
      const profit = Number(row.profit || 0);
      const orders = Number(row.orders || 0);
      const roi = adCost > 0 ? profit / adCost : null;
      const margin = revenue > 0 ? profit / revenue : null;
      const suggestion = this.buildBudgetSuggestion({
        roi,
        margin,
        profit,
        orders,
        adCost,
        targetRoi,
        minOrders,
        minAdCost,
      });
      return {
        adGroupId,
        adGroupName: nameMap.get(adGroupId) || `AdGroup ${adGroupId}`,
        revenue,
        adCost,
        profit,
        orders,
        roi,
        margin,
        suggestion,
      };
    });

    const summary = insights.reduce(
      (acc, cur) => {
        acc.revenue += cur.revenue;
        acc.adCost += cur.adCost;
        acc.profit += cur.profit;
        if (cur.roi !== null && !Number.isNaN(cur.roi)) acc.roiSamples.push(cur.roi);
        return acc;
      },
      { revenue: 0, adCost: 0, profit: 0, roiSamples: [] as number[] },
    );

    return {
      period: { from: this.toDateOnlyString(from), to: this.toDateOnlyString(to) },
      targetRoi,
      minOrders,
      minAdCost,
      summary: {
        revenue: summary.revenue,
        adCost: summary.adCost,
        profit: summary.profit,
        averageRoi: summary.roiSamples.length
          ? summary.roiSamples.reduce((s, r) => s + r, 0) / summary.roiSamples.length
          : null,
      },
      insights,
    };
  }

  // Dòng tiền tuần mức ad group (dùng Summary5 làm gần đúng)
  async getWeeklyCashflowOverview(filter: AdGroupProfitFilterDto) {
    const { from, to } = this.calculateDateRange(filter.year, filter.period, filter.fromDate, filter.toDate);
    const matchAnd: any[] = [
      { orderDate: { $gte: this.startOfDay(from), $lte: this.endOfDay(to) } },
      { orderDate: { $type: 'date' } },
    ];
    if (filter.adGroupId) matchAnd.push({ adGroupId: filter.adGroupId });

    const weekly = await this.s5Model.aggregate([
      { $match: { $and: matchAnd } },
      {
        $addFields: {
          isoWeek: { $isoWeek: '$orderDate' },
          isoYear: { $isoWeekYear: '$orderDate' },
        },
      },
      {
        $addFields: {
          weekKey: { $concat: [{ $toString: '$isoYear' }, '-', { $toString: '$isoWeek' }] },
          weekStart: {
            $dateFromParts: { isoWeekYear: '$isoYear', isoWeek: '$isoWeek', isoDayOfWeek: 1 },
          },
          weekEnd: {
            $dateFromParts: { isoWeekYear: '$isoYear', isoWeek: '$isoWeek', isoDayOfWeek: 7 },
          },
        },
      },
      {
        $group: {
          _id: '$weekKey',
          weekStart: { $first: '$weekStart' },
          weekEnd: { $first: '$weekEnd' },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
          orders: { $sum: 1 },
        },
      },
      { $sort: { weekStart: 1 } },
    ]).exec();

    const weeks = weekly.map((w: any) => ({
      weekKey: w._id,
      weekStart: this.toDateOnlyString(w.weekStart),
      weekEnd: this.toDateOnlyString(w.weekEnd),
      revenue: Number(w.revenue || 0),
      adCost: Number(w.adCost || 0),
      profit: Number(w.profit || 0),
      orders: Number(w.orders || 0),
      netCash: Number(w.revenue || 0) - Number(w.adCost || 0),
    }));

    const topAgg = await this.s5Model.aggregate([
      { $match: { $and: matchAnd } },
      {
        $group: {
          _id: '$adGroupId',
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
        },
      },
      { $sort: { profit: -1 } },
      { $limit: 5 },
    ]).exec();

    const adGroupIds = topAgg.map((x: any) => x._id).filter(Boolean);
    const adGroupDocs = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).lean();
    const nameMap = new Map<string, string>();
    adGroupDocs.forEach((ag: any) => nameMap.set(ag.adGroupId, ag.name || 'Unknown'));

    const topAdGroups = topAgg.map((row: any) => ({
      adGroupId: row._id || 'unknown',
      adGroupName: nameMap.get(row._id) || `AdGroup ${row._id}`,
      revenue: Number(row.revenue || 0),
      adCost: Number(row.adCost || 0),
      profit: Number(row.profit || 0),
      roi: Number(row.adCost || 0) > 0 ? Number(row.profit || 0) / Number(row.adCost || 0) : null,
      netCash: Number(row.revenue || 0) - Number(row.adCost || 0),
    }));

    return {
      period: { from: this.toDateOnlyString(from), to: this.toDateOnlyString(to) },
      summary: {
        revenue: weeks.reduce((s, w) => s + w.revenue, 0),
        adCost: weeks.reduce((s, w) => s + w.adCost, 0),
        profit: weeks.reduce((s, w) => s + w.profit, 0),
        netCash: weeks.reduce((s, w) => s + w.netCash, 0),
        orders: weeks.reduce((s, w) => s + w.orders, 0),
      },
      weeks,
      topAdGroups,
    };
  }

  // Dòng tiền tháng mức ad group
  async getMonthlyCashflowOverview(filter: AdGroupProfitFilterDto) {
    const { from, to } = this.calculateDateRange(filter.year, filter.period, filter.fromDate, filter.toDate);
    const matchAnd: any[] = [
      { orderDate: { $gte: this.startOfDay(from), $lte: this.endOfDay(to) } },
      { orderDate: { $type: 'date' } },
    ];
    if (filter.adGroupId) matchAnd.push({ adGroupId: filter.adGroupId });

    const monthly = await this.s5Model.aggregate([
      { $match: { $and: matchAnd } },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            year: { $year: '$orderDate' },
            month: { $month: '$orderDate' },
          },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
          orders: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id.adGroupId',
          monthKey: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              { $cond: [{ $lt: ['$_id.month', 10] }, { $concat: ['0', { $toString: '$_id.month' }] }, { $toString: '$_id.month' }] },
            ],
          },
          year: '$_id.year',
          month: '$_id.month',
          revenue: 1,
          adCost: 1,
          profit: 1,
          orders: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]).exec();

    const adGroupIds = monthly.map((x: any) => x.adGroupId).filter(Boolean);
    const adGroupDocs = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).lean();
    const nameMap = new Map<string, string>();
    adGroupDocs.forEach((ag: any) => nameMap.set(ag.adGroupId, ag.name || 'Unknown'));

    const months = monthly.map((m: any) => ({
      adGroupId: m.adGroupId || 'unknown',
      adGroupName: nameMap.get(m.adGroupId) || `AdGroup ${m.adGroupId}`,
      monthKey: m.monthKey,
      revenue: Number(m.revenue || 0),
      adCost: Number(m.adCost || 0),
      profit: Number(m.profit || 0),
      orders: Number(m.orders || 0),
      netCash: Number(m.revenue || 0) - Number(m.adCost || 0),
    }));

    return {
      period: { from: this.toDateOnlyString(from), to: this.toDateOnlyString(to) },
      summary: {
        revenue: months.reduce((s, w) => s + w.revenue, 0),
        adCost: months.reduce((s, w) => s + w.adCost, 0),
        profit: months.reduce((s, w) => s + w.profit, 0),
        netCash: months.reduce((s, w) => s + w.netCash, 0),
        orders: months.reduce((s, w) => s + w.orders, 0),
      },
      months,
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

  /** Bảng 1: Daily cost & profit theo adGroup, từ Summary5 */
  async getDailyCostProfit(params: { from?: string; to?: string; adGroupId?: string }) {
    const { from, to, adGroupId } = params;
    const match: any = {};
    if (from || to) {
      match.orderDate = {} as any;
      if (from) match.orderDate.$gte = new Date(from);
      if (to) match.orderDate.$lte = new Date(to);
    }
    if (adGroupId) match.adGroupId = adGroupId;

    const rows = await this.s5Model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: {
              $dateToString: { format: '%Y-%m-%d', date: '$orderDate' },
            },
          },
          adCost: { $sum: { $ifNull: ['$adCost', 0] } },
          revenue: { $sum: { $ifNull: ['$revenue', 0] } },
          profit: { $sum: { $ifNull: ['$profit', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          adGroupId: '$_id.adGroupId',
          date: '$_id.date',
          adCost: 1,
          revenue: 1,
          profit: 1,
        },
      },
      { $sort: { date: 1, adGroupId: 1 } },
    ]).exec();

    const adGroupIds = Array.from(new Set(rows.map((r: any) => r.adGroupId))).filter(Boolean);
    const names = await this.adGroupModel.find({ adGroupId: { $in: adGroupIds } }).select('adGroupId name').lean();
    const nameMap = new Map(names.map((n: any) => [n.adGroupId, n.name]));

    return rows.map((r: any) => ({
      ...r,
      adGroupName: nameMap.get(r.adGroupId) || r.adGroupId,
    }));
  }

  /** Bảng 2: Chi phí ads tối ưu per adGroup (phi tuyến, có guardrail ±20%) */
  async getOptimalSpendSuggestions() {
    const today = new Date();
    const from = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000); // lấy rộng hơn để đủ mẫu

    const hist = await this.s5Model.aggregate([
      { $match: { orderDate: { $gte: from, $lte: today } } },
      {
        $project: {
          adGroupId: 1,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
          adCost: { $ifNull: ['$adCost', 0] },
          profit: { $ifNull: ['$profit', 0] },
          revenue: { $ifNull: ['$revenue', 0] },
          orders: { $ifNull: ['$orders', 0] },
        },
      },
      { $sort: { orderDate: -1 } },
    ]).exec();

    const byGroup = new Map<string, any[]>();
    for (const r of hist) {
      if (!r.adGroupId) continue;
      if (!byGroup.has(r.adGroupId)) byGroup.set(r.adGroupId, []);
      byGroup.get(r.adGroupId)!.push(r);
    }

    const result: any[] = [];
    for (const [adGroupId, rows] of byGroup.entries()) {
      if (!rows.length) continue;
      const last = rows[0];
      const lastSpend = Number(last.adCost || 0);
      const lastProfit = Number(last.profit || 0);

      // Yêu cầu dữ liệu tối thiểu: >=7 ngày và tổng đơn tối thiểu 5
      const minDays = 7;
      if (rows.length < minDays) continue;

      // Winsorize nhẹ để giảm outlier (p10-p90)
      const spends = rows.map((r) => Number(r.adCost || 0)).filter((x) => x >= 0);
      if (!spends.length) continue;
      const p10 = this.percentile(spends, 0.1);
      const p90 = this.percentile(spends, 0.9);
      const clean = rows.map((r) => ({
        ...r,
        adCost: Math.min(Math.max(Number(r.adCost || 0), p10), p90),
        profit: Number(r.profit || 0),
      }));

      // Chia 4 bucket chi phí theo quantile
      const edges = [0.25, 0.5, 0.75, 1].map((p) => this.percentile(spends, p));
      const buckets: Array<{ count: number; spend: number; profit: number; roi: number }> = [
        { count: 0, spend: 0, profit: 0, roi: 0 },
        { count: 0, spend: 0, profit: 0, roi: 0 },
        { count: 0, spend: 0, profit: 0, roi: 0 },
        { count: 0, spend: 0, profit: 0, roi: 0 },
      ];

      for (const r of clean) {
        const s = r.adCost;
        const idx = s <= edges[0] ? 0 : s <= edges[1] ? 1 : s <= edges[2] ? 2 : 3;
        buckets[idx].count += 1;
        buckets[idx].spend += s;
        buckets[idx].profit += r.profit;
      }

      buckets.forEach((b) => { if (b.count > 0) b.roi = b.profit / Math.max(1, b.spend); });

      // Chọn bucket có ROI cao nhất và đủ mẫu (>=2 ngày); nếu tất cả ROI <= 0, lấy bucket lỗ ít nhất
      const validBuckets = buckets.map((b, i) => ({
        idx: i,
        meanSpend: b.count ? b.spend / b.count : 0,
        roi: b.roi,
        profit: b.profit,
        count: b.count,
      })).filter((b) => b.count >= 2);

      if (!validBuckets.length) continue;

      let best = validBuckets[0];
      for (const b of validBuckets) {
        if (b.roi > best.roi) best = b;
      }
      if (best.roi <= 0) {
        // tất cả ROI <=0: chọn bucket lỗ ít nhất
        best = validBuckets.reduce((acc, cur) => cur.profit > acc.profit ? cur : acc, best);
      }

      const candidate = best.meanSpend || lastSpend;

      // Guardrail: chỉ thay đổi tối đa ±20% so với ngày gần nhất
      const applied = this.clamp(candidate, lastSpend * 0.8, lastSpend * 1.2);

      result.push({
        adGroupId,
        lastSpend,
        lastProfit,
        optimalSpend: Math.round(candidate),
        appliedSpend: Math.round(applied),
      });
    }

    const names = await this.adGroupModel.find({ adGroupId: { $in: result.map((r) => r.adGroupId) } }).select('adGroupId name').lean();
    const nameMap = new Map(names.map((n: any) => [n.adGroupId, n.name]));
    return result.map((r) => ({ ...r, adGroupName: nameMap.get(r.adGroupId) || r.adGroupId }));
  }

  private clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  private percentile(values: number[], p: number): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
    return sorted[idx];
  }

  /** Đề xuất scale ads theo chiều ngang: tạo thêm nhóm mới khi optimal vượt biên an toàn ±20% */
  async getHorizontalScaleSuggestions() {
    // Bước 1: lấy đề xuất optimal hiện có (đã phi tuyến + guardrail)
    const optimalRows = await this.getOptimalSpendSuggestions();

    // Bước 2: lấy vốn khả dụng (nếu lỗi, fallback 0 để an toàn)
    let availableFunds = 0;
    try {
      const funds = await this.financeService.computeAvailableFunds();
      availableFunds = funds?.available ?? 0;
    } catch (err) {
      availableFunds = 0;
    }

    const minStart = 50000; // ngân sách khởi động tối thiểu/nhóm (VND)
    const maxGroupsPerProduct = 5;

    const suggestions = optimalRows.map((row) => {
      const overflow = Math.max(0, row.optimalSpend - row.appliedSpend);
      const perGroup = Math.max(minStart, row.appliedSpend || minStart);

      let groups = overflow > 0 ? Math.max(1, Math.floor(overflow / perGroup)) : 0;
      groups = Math.min(groups, maxGroupsPerProduct);

      let total = groups * perGroup;
      if (availableFunds > 0 && total > availableFunds) {
        groups = Math.floor(availableFunds / perGroup);
        total = groups * perGroup;
      }

      return {
        adGroupId: row.adGroupId,
        adGroupName: row.adGroupName,
        lastSpend: row.lastSpend,
        lastProfit: row.lastProfit,
        optimalSpend: row.optimalSpend,
        appliedSpend: row.appliedSpend,
        overflow,
        recommendedGroups: groups,
        recommendedBudgetPerGroup: Math.round(perGroup),
        recommendedTotal: Math.round(total),
        availableFundsCapped: availableFunds > 0 ? availableFunds : null,
        reason: overflow > 0 ? 'Optimal vượt biên an toàn ±20%, nên mở thêm nhóm thay vì tăng dọc' : 'Chưa vượt biên, không cần scale ngang',
      };
    }).filter((r) => r.recommendedGroups > 0 && r.recommendedTotal > 0 && r.overflow > 0);

    return {
      availableFunds,
      count: suggestions.length,
      data: suggestions,
    };
  }

  /** Bảng 3: Profit 30 ngày gần nhất dạng pivot per adGroup */
  async getProfit30Days(params: { adGroupId?: string }) {
    const today = new Date();
    const from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
    const match: any = { orderDate: { $gte: from, $lte: today } };
    if (params.adGroupId) match.adGroupId = params.adGroupId;

    const rows = await this.s5Model.aggregate([
      { $match: match },
      {
        $project: {
          adGroupId: 1,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$orderDate' } },
          profit: { $ifNull: ['$profit', 0] },
        },
      },
    ]).exec();

    const dates: string[] = [];
    for (let d = new Date(from); d <= today; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().slice(0, 10));
    }

    const map = new Map<string, Map<string, number>>();
    for (const r of rows) {
      if (!map.has(r.adGroupId)) map.set(r.adGroupId, new Map());
      map.get(r.adGroupId)!.set(r.date, Number(r.profit || 0));
    }

    const result: any[] = [];
    for (const [adGroupId, dayMap] of map.entries()) {
      const dailyProfits: Record<string, number> = {};
      dates.forEach((d) => {
        dailyProfits[d] = dayMap.get(d) || 0;
      });
      result.push({ adGroupId, dailyProfits });
    }

    const names = await this.adGroupModel.find({ adGroupId: { $in: result.map((r) => r.adGroupId) } }).select('adGroupId name').lean();
    const nameMap = new Map(names.map((n: any) => [n.adGroupId, n.name]));

    return { dates, data: result.map((r) => ({ ...r, adGroupName: nameMap.get(r.adGroupId) || r.adGroupId })) };
  }

  private buildBudgetSuggestion(params: {
    roi: number | null;
    margin: number | null;
    profit: number;
    orders: number;
    adCost: number;
    targetRoi: number;
    minOrders: number;
    minAdCost: number;
  }) {
    const { roi, margin, profit, orders, adCost, targetRoi, minOrders, minAdCost } = params;

    if (orders < minOrders || adCost < minAdCost) {
      return {
        action: 'learn',
        budgetChangePct: 0,
        reason: 'Dữ liệu còn ít, chờ thêm mẫu',
      };
    }

    if (profit <= 0) {
      return {
        action: 'cut',
        budgetChangePct: -0.2,
        reason: 'Lợi nhuận âm',
      };
    }

    if (roi !== null && roi >= targetRoi) {
      return {
        action: 'scale',
        budgetChangePct: 0.2,
        reason: 'ROI vượt ngưỡng mục tiêu',
      };
    }

    if (roi !== null && roi < targetRoi) {
      return {
        action: 'cut',
        budgetChangePct: -0.15,
        reason: 'ROI thấp hơn mục tiêu',
      };
    }

    if (margin !== null && margin < 0.05) {
      return {
        action: 'cut',
        budgetChangePct: -0.1,
        reason: 'Biên lợi nhuận thấp',
      };
    }

    return {
      action: 'hold',
      budgetChangePct: 0,
      reason: 'Giữ ngân sách hiện tại',
    };
  }
}
