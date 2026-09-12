import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'crypto';
import { Model, Types } from 'mongoose';
import { TestOrder2 } from '../test-order2/schemas/test-order2.schema';
import { BusinessLedgerService } from './business-ledger.service';
import { rangeDates } from './business-ledger.report';
import { AdGroupManagementReview } from './ad-group-management.schema';
import { AdGroupManagementQuery, CreateAdGroupManagementReviewDto } from './ad-group-management.dto';

@Injectable()
export class AdGroupManagementService {
  constructor(
    private readonly ledger: BusinessLedgerService,
    @InjectModel(TestOrder2.name) private readonly orders: Model<TestOrder2>,
    @InjectModel(AdGroupManagementReview.name) private readonly reviews: Model<AdGroupManagementReview>,
  ) {}

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private required(value: string, label: string) {
    if (!value?.trim()) throw new BadRequestException(`Cần ${label}.`);
    return value.trim();
  }

  private action(status: string) {
    const actions: Record<string, string> = {
      data_issue: 'Rà soát ánh xạ, đơn thiếu dữ liệu và chi phí chưa phân bổ trước khi quyết định.',
      insufficient_data: 'Tiếp tục quan sát; chưa đủ đơn đã qua thời gian hoàn/hủy để kết luận.',
      loss: 'Lập đề xuất giảm ngân sách hoặc ứng viên tạm dừng để người có quyền phê duyệt.',
      profitable: 'Có lãi theo hiệu quả quảng cáo; có thể lập đề xuất tăng có giới hạn. Khả năng cấp vốn được xem xét riêng trong kế hoạch tài chính.',
      break_even: 'Giữ ngân sách và thử nghiệm nội dung/đối tượng trước khi mở rộng.',
    };
    return actions[status];
  }

  private days(from: string, to: string) {
    const result: string[] = [];
    const current = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (+current <= +end) {
      result.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return result;
  }

  private dailyAnalysis(from: string, to: string, orderRows: any[]) {
    const days = new Map(this.days(from, to).map((date) => [date, {
      date, orders: 0, quantity: 0, revenue: 0, contributionBeforeAds: 0,
      advertisingCost: 0, profitAfterAds: 0, cashIn: 0, receivable: 0,
      unattributedAdvertisingCost: 0, needsReviewOrders: 0,
    }]));
    for (const row of orderRows) {
      const day: any = days.get(row.orderDay);
      if (!day) continue;
      if (!row.adsOnly && !row.costOnly && row.orderId !== 'unallocated') day.orders++;
      day.quantity += Number(row.quantity || 0);
      day.revenue += Number(row.revenue || 0);
      day.contributionBeforeAds += Number(row.revenue || 0) - Number(row.cogs || 0) - Number(row.expense || 0);
      day.advertisingCost += Number(row.advertisingCost || 0);
      day.profitAfterAds += Number(row.recordedNetProfit || 0);
      day.cashIn += Number(row.cashIn || 0);
      day.receivable += Number(row.receivable || 0);
      if (row.adsOnly) day.unattributedAdvertisingCost += Number(row.advertisingCost || 0);
      if (row.profitNeedsReview ?? row.needsReview) day.needsReviewOrders++;
    }
    const series = [...days.values()];
    const valid = series.filter((day) =>
      day.advertisingCost > 0 && !day.unattributedAdvertisingCost && !day.needsReviewOrders,
    );
    const distinctSpendLevels = new Set(valid.map((day) => Math.round(day.advertisingCost / 1000) * 1000)).size;
    const spendValues = valid.map((day) => day.advertisingCost);
    const averageSpend = spendValues.length
      ? spendValues.reduce((sum, value) => sum + value, 0) / spendValues.length : null;
    const spendVariation = averageSpend && spendValues.length
      ? (Math.max(...spendValues) - Math.min(...spendValues)) / averageSpend : 0;
    const blockers: string[] = [];
    if (series.length < 30) blockers.push('Cần ít nhất 30 ngày lịch sử.');
    if (valid.length < 20) blockers.push('Cần ít nhất 20 ngày có chi phí và dữ liệu đạt chất lượng.');
    if (distinctSpendLevels < 3 || spendVariation < 0.15)
      blockers.push('Chi phí ngày chưa đủ biến thiên để ước tính hiệu quả cận biên.');
    const sorted = [...valid].sort((a, b) => a.advertisingCost - b.advertisingCost);
    const bandCount = Math.min(4, Math.max(0, Math.floor(sorted.length / 5)));
    const bands = bandCount < 2 ? [] : Array.from({ length: bandCount }, (_, index) => {
      const start = Math.floor(index * sorted.length / bandCount);
      const end = Math.floor((index + 1) * sorted.length / bandCount);
      const bucket = sorted.slice(start, end);
      const average = (field: string) => bucket.reduce((sum, day: any) => sum + Number(day[field] || 0), 0) / bucket.length;
      return {
        level: index + 1,
        days: bucket.length,
        minSpend: bucket[0].advertisingCost,
        maxSpend: bucket[bucket.length - 1].advertisingCost,
        averageSpend: average('advertisingCost'),
        averageRevenue: average('revenue'),
        averageContributionBeforeAds: average('contributionBeforeAds'),
        averageProfitAfterAds: average('profitAfterAds'),
        roas: average('advertisingCost') > 0 ? average('revenue') / average('advertisingCost') : null,
      };
    });
    const marginalBands = bands.map((band: any, index) => {
      if (!index) return { ...band, marginalProfitPerAdditionalVnd: null };
      const previous: any = bands[index - 1];
      const extraSpend = band.averageSpend - previous.averageSpend;
      const extraContribution = band.averageContributionBeforeAds - previous.averageContributionBeforeAds;
      return {
        ...band,
        marginalProfitPerAdditionalVnd: extraSpend > 0 ? extraContribution / extraSpend - 1 : null,
      };
    });
    const ready = blockers.length === 0 && marginalBands.length >= 3;
    const best = ready
      ? [...marginalBands].sort((a: any, b: any) => b.averageProfitAfterAds - a.averageProfitAfterAds)[0]
      : null;
    const recentSpendDays = series.slice(-7).filter((day) => day.advertisingCost > 0);
    const currentDailySpend = recentSpendDays.length
      ? recentSpendDays.reduce((sum, day) => sum + day.advertisingCost, 0) / recentSpendDays.length : null;
    const nearest = ready && currentDailySpend != null
      ? marginalBands.slice(1).sort((a: any, b: any) =>
          Math.abs(a.averageSpend - currentDailySpend) - Math.abs(b.averageSpend - currentDailySpend))[0]
      : null;
    return {
      dailySeries: series,
      marginalAnalysis: {
        status: ready ? 'ready' : 'collecting',
        observedDays: series.length,
        validSpendDays: valid.length,
        distinctSpendLevels,
        spendVariation,
        currentDailySpend,
        optimalDailySpendEstimate: best?.averageSpend ?? null,
        optimalSpendRange: best ? { min: best.minSpend, max: best.maxSpend } : null,
        marginalProfitPerAdditionalVnd: nearest?.marginalProfitPerAdditionalVnd ?? null,
        bands: marginalBands,
        blockers,
        basis: 'observed_daily_spend_contribution_bands',
        note: 'Ước tính quan sát; cần thử nghiệm ngân sách có kiểm soát trước khi dùng làm căn cứ phê duyệt.',
      },
    };
  }

  async summary(query: AdGroupManagementQuery) {
    rangeDates(query.from, query.to);
    const maturityDays = Number(query.maturityDays ?? 7);
    const report = await this.ledger.report(query.from, query.to);
    const adGroups = await this.orders.db.collection('adgroups').find({}, {
      projection: {
        adGroupId: 1, name: 1, platform: 1, isActive: 1, remoteStatus: 1,
        effectiveStatus: 1, dailyBudget: 1, testingPhase: 1, productCategoryId: 1,
        selectedProducts: 1, assignedEmployeeId: 1, agentId: 1, adAccountId: 1,
        lastSyncAt: 1, lastSyncStatus: 1,
      },
    }).limit(10001).toArray();
    if (adGroups.length > 10000)
      throw new BadRequestException('Vượt giới hạn nhóm quảng cáo; cần lọc theo tài khoản.');

    const ids = new Set<string>([
      ...adGroups.map((group: any) => String(group.adGroupId)),
      ...report.adGroups.map((group: any) => String(group.key)),
    ]);
    const categoryIds = adGroups.map((g: any) => g.productCategoryId).filter(Boolean);
    const productIds = adGroups.flatMap((g: any) => g.selectedProducts || []).filter(Boolean);
    const userIds = adGroups.flatMap((g: any) => [g.assignedEmployeeId, g.agentId]).filter(Boolean);
    const accountIds = adGroups.map((g: any) => g.adAccountId).filter(Boolean);
    const [categories, products, users, accounts, reviews] = await Promise.all([
      this.orders.db.collection('productcategories').find({ _id: { $in: categoryIds } }, { projection: { name: 1, code: 1 } }).toArray(),
      this.orders.db.collection('products').find({ _id: { $in: productIds } }, { projection: { name: 1, sku: 1 } }).toArray(),
      this.orders.db.collection('users').find({ _id: { $in: userIds } }, { projection: { fullName: 1, name: 1 } }).toArray(),
      this.orders.db.collection('adaccounts').find({ _id: { $in: accountIds } }, { projection: { name: 1, accountId: 1 } }).toArray(),
      this.reviews.find({ adGroupId: { $in: [...ids] } }).sort({ createdAt: -1, _id: -1 }).lean(),
    ]);
    const byId = (rows: any[]) => new Map(rows.map((row) => [String(row._id), row]));
    const categoryMap = byId(categories), productMap = byId(products), userMap = byId(users), accountMap = byId(accounts);
    const metadata = new Map(adGroups.map((group: any) => [String(group.adGroupId), group]));
    const latestReview = new Map<string, any>();
    for (const review of reviews as any[]) if (!latestReview.has(review.adGroupId)) latestReview.set(review.adGroupId, review);
    const cutoff = new Date(`${query.to}T23:59:59.999+07:00`);
    cutoff.setUTCDate(cutoff.getUTCDate() - maturityDays);
    const ambiguous = new Set(report.quality.ambiguousAdGroupIds || []);
    const invalidGroups = new Set(report.quality.invalidAdGroupIds || []);
    const unidentifiedCostError = invalidGroups.has('unallocated');

    const rows = [...ids].map((adGroupId) => {
      const group: any = metadata.get(adGroupId) || {};
      const financial: any = report.adGroups.find((row: any) => String(row.key) === adGroupId) || {
        orders: 0, quantity: 0, revenue: 0, cogs: 0, expense: 0, advertisingCost: 0,
        recordedNetProfit: 0, needsReview: 0, cashIn: 0, cashOut: 0, receivable: 0,
        payable: 0, unallocatedAdvertisingCost: 0,
      };
      const orderRows = report.orders.filter((row: any) => row.adGroupId === adGroupId && !row.adsOnly && !row.costOnly);
      const allGroupRows = report.orders.filter((row: any) => row.adGroupId === adGroupId);
      const daily = this.dailyAnalysis(query.from, query.to, allGroupRows);
      const maturedOrders = orderRows.filter((row: any) => row.orderDay && +new Date(`${row.orderDay}T23:59:59.999+07:00`) <= +cutoff).length;
      const recentOrders = orderRows.length - maturedOrders;
      const returnedOrders = orderRows.filter((row: any) => row.orderStatus === 'Hàng hoàn').length;
      const spend = Number(financial.advertisingCost || 0);
      const unattributedSpend = Number(financial.unallocatedAdvertisingCost || 0);
      const attributionCoverage = spend > 0 ? Math.max(0, Math.min(100, ((spend - unattributedSpend) / spend) * 100)) : null;
      const profitReviewOrders = Number(financial.profitNeedsReview ?? financial.needsReview ?? 0);
      let confidence = orderRows.length ? 100 : 20;
      confidence -= Math.min(50, profitReviewOrders * 10);
      if (attributionCoverage != null) confidence -= (100 - attributionCoverage) * 0.4;
      if (orderRows.length) confidence -= (recentOrders / orderRows.length) * 20;
      if (ambiguous.has(adGroupId) || invalidGroups.has(adGroupId) || unidentifiedCostError) confidence = 0;
      confidence = Math.max(0, Math.round(confidence));
      const cashConversion = financial.revenue > 0
        ? Math.max(0, Math.min(1, Number(financial.customerCashCollected || 0) / financial.revenue)) : null;
      let status: string;
      if (ambiguous.has(adGroupId) || invalidGroups.has(adGroupId) || unidentifiedCostError
        || profitReviewOrders > 0 || unattributedSpend > 0) status = 'data_issue';
      else if (maturedOrders < 3) status = 'insufficient_data';
      else if (financial.recordedNetProfit < 0) status = 'loss';
      else if (financial.recordedNetProfit > 0) status = 'profitable';
      else status = 'break_even';
      const category: any = categoryMap.get(String(group.productCategoryId || ''));
      const product = group.selectedProducts?.length ? productMap.get(String(group.selectedProducts[0])) : null;
      const employee: any = userMap.get(String(group.assignedEmployeeId || ''));
      const agent: any = userMap.get(String(group.agentId || ''));
      const account: any = accountMap.get(String(group.adAccountId || ''));
      return {
        adGroupId,
        name: group.name || financial.name || adGroupId,
        platform: group.platform || null,
        isActive: group.isActive !== false,
        remoteStatus: group.remoteStatus || null,
        effectiveStatus: group.effectiveStatus || null,
        dailyBudget: group.dailyBudget ?? null,
        testingPhase: group.testingPhase || null,
        category: category ? { id: String(category._id), name: category.name, code: category.code } : null,
        product: product ? { id: String(product._id), name: product.name, sku: product.sku } : null,
        assignedEmployee: employee ? { id: String(employee._id), name: employee.fullName || employee.name } : null,
        commercialAgent: agent ? { id: String(agent._id), name: agent.fullName || agent.name } : null,
        adAccount: account ? { id: String(account._id), name: account.name || account.accountId } : null,
        lastSyncAt: group.lastSyncAt || null,
        lastSyncStatus: group.lastSyncStatus || null,
        financial: {
          orders: financial.orders, quantity: financial.quantity, revenue: financial.revenue,
          cogs: financial.cogs, expense: financial.expense, advertisingCost: spend,
          profitAfterAds: financial.recordedNetProfit, cashIn: financial.cashIn,
          cashOut: financial.cashOut, receivable: financial.receivable, payable: financial.payable,
          customerCashCollected: Number(financial.customerCashCollected || 0),
          roas: spend > 0 ? financial.revenue / spend : null,
          profitPerSpend: spend > 0 ? financial.recordedNetProfit / spend : null,
          profitMargin: financial.revenue > 0 ? financial.recordedNetProfit / financial.revenue : null,
          cashConversion,
        },
        quality: {
          status, confidence, needsReviewOrders: profitReviewOrders,
          maturedOrders, recentOrders, returnedOrders,
          returnRate: orderRows.length ? returnedOrders / orderRows.length : null,
          attributedAdvertisingCost: spend - unattributedSpend,
          unattributedAdvertisingCost: unattributedSpend,
          attributionCoverage,
          ambiguousIdentity: ambiguous.has(adGroupId),
          invalidAdvertisingCost: invalidGroups.has(adGroupId) || unidentifiedCostError,
        },
        recommendedAction: this.action(status),
        canProposeScale: status === 'profitable' && confidence >= 70,
        ...daily,
        latestReview: latestReview.get(adGroupId) || null,
      };
    }).sort((a, b) => b.financial.profitAfterAds - a.financial.profitAfterAds);

    const sum = (field: string) => rows.reduce((total, row: any) => total + Number(row.financial[field] || 0), 0);
    return {
      from: query.from,
      to: query.to,
      maturityDays,
      currency: 'VND',
      rows,
      totals: {
        adGroups: rows.length, spend: sum('advertisingCost'), revenue: sum('revenue'),
        cogs: sum('cogs'), expense: sum('expense'), profitAfterAds: sum('profitAfterAds'),
        cashIn: sum('cashIn'), cashOut: sum('cashOut'), customerCashCollected: sum('customerCashCollected'),
        receivable: sum('receivable'), payable: sum('payable'),
      },
      quality: {
        dataIssueGroups: rows.filter((row) => row.quality.status === 'data_issue').length,
        insufficientDataGroups: rows.filter((row) => row.quality.status === 'insufficient_data').length,
        marginalReadyGroups: rows.filter((row) => row.marginalAnalysis.status === 'ready').length,
        unattributedAdvertisingCost: rows.reduce((sum, row) => sum + row.quality.unattributedAdvertisingCost, 0),
        automaticExecutionAllowed: false,
        basis: 'business_ledger_financial_events_grouped_by_ad_group',
      },
    };
  }

  async createReview(adGroupId: string, dto: CreateAdGroupManagementReviewDto, actorId: string) {
    if (!adGroupId?.trim() || adGroupId.length > 160) throw new BadRequestException('Nhóm quảng cáo không hợp lệ.');
    if (!Types.ObjectId.isValid(actorId)) throw new BadRequestException('Người thao tác không hợp lệ.');
    const summary = await this.summary({ from: dto.periodFrom, to: dto.periodTo, maturityDays: 7 });
    const row = summary.rows.find((item) => item.adGroupId === adGroupId);
    if (!row) throw new BadRequestException('Không tìm thấy nhóm quảng cáo trong dữ liệu quản trị.');
    const { latestReview: _previousReview, ...metricsSnapshot } = row;
    const payload = {
      adGroupId,
      periodFrom: dto.periodFrom,
      periodTo: dto.periodTo,
      decision: dto.decision,
      rationale: this.required(dto.rationale, 'lý do quyết định'),
      evidence: this.required(dto.evidence, 'căn cứ quyết định'),
      metricsSnapshot,
    };
    const requestHash = this.hash(payload);
    const existing = await this.reviews.findOne({ requestKey: dto.requestKey }).lean();
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ConflictException('Mã yêu cầu đã dùng với quyết định khác.');
      return existing;
    }
    try {
      return await this.reviews.create({
        requestKey: this.required(dto.requestKey, 'mã yêu cầu'), requestHash, ...payload, createdBy: actorId,
      });
    } catch (error) {
      if ((error as any)?.code === 11000) throw new ConflictException('Quyết định đã được ghi nhận.');
      throw error;
    }
  }
}
