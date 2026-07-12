import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { AdsManagerAccount, AdsManagerAccountDocument } from '../ads-manager-account/schemas/ads-manager-account.schema';
import { AdvertisingCost, AdvertisingCostDocument } from '../advertising-cost/schemas/advertising-cost.schema';
import { getAdsSafetyConfig, readBooleanEnv } from '../common/ads-safety-config';
import { EmergencyActionLog, EmergencyActionLogDocument } from '../emergency-action/schemas/emergency-action-log.schema';
import { AvailableFundSnapshot, AvailableFundSnapshotDocument } from '../finance/schemas/available-fund-snapshot.schema';
import { BudgetBucket, BudgetBucketDocument } from '../finance/schemas/budget-bucket.schema';
import { AdGroupDailyReport, AdGroupDailyReportDocument } from '../finance/schemas/ad-group-daily-report.schema';
import { GoogleAdsAdGroup, GoogleAdsAdGroupDocument } from '../google-ads/schemas/google-ads-ad-group.schema';
import { GoogleAdsCampaign, GoogleAdsCampaignDocument } from '../google-ads/schemas/google-ads-campaign.schema';
import { GoogleAdsCampaignBudget, GoogleAdsCampaignBudgetDocument } from '../google-ads/schemas/google-ads-campaign-budget.schema';
import { GoogleAdsActionPlan, GoogleAdsActionPlanDocument } from '../google-ads/schemas/google-ads-action-plan.schema';
import { InventorySummary, InventorySummaryDocument } from '../inventory/schemas/inventory-summary.schema';
import { Product, ProductDocument } from '../product/schemas/product.schema';
import { SupplierPayable, SupplierPayableDocument } from '../supplier-payable/schemas/supplier-payable.schema';
import { SupplierQuote, SupplierQuoteDocument } from '../supplier-quote/schemas/supplier-quote.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import {
  AdsAutomationAdGroupEvidence,
  AdsAutomationCommerceEvidence,
  AdsAutomationEvidenceRef,
  AdsAutomationEvidenceSnapshot,
  AdsAutomationFinanceGate,
  AdsAutomationGateEvidence,
  AdsAutomationInventoryEvidence,
  AdsAutomationMappingStatus,
  AdsAutomationPlatform,
  AdsAutomationSnapshotQuery,
  AdsAutomationSupplierEvidence,
} from './dto/ads-automation-evidence.dto';
import { evaluateAdGroupEvidence, freshnessFromDate, summarizeReadiness } from './ads-automation-evidence.rules';

interface CandidateAdGroup {
  platform: AdsAutomationPlatform;
  managerAccountId?: string;
  childAccountId?: string;
  campaignId?: string;
  campaignBudgetId?: string;
  adGroupId: string;
  erpAdGroupId?: string;
  name?: string;
  status?: string;
  productIds: string[];
  lastSyncAt?: Date;
}

interface CandidateAttributionContext {
  adGroupIdUnique: boolean;
  uniqueProductIds: string[];
}

interface SnapshotSharedEvidence {
  productsById: Map<string, any>;
  inventoryByProductId: Map<string, any[]>;
  supplierQuotesByProductId: Map<string, any[]>;
  ordersByCandidateKey: Map<string, any[]>;
  latestReportByCandidateKey: Map<string, any>;
  spendByCandidateKey: Map<string, { dailySpend: number; monthlySpend: number }>;
  supplierPayablesByCandidateKey: Map<string, any[]>;
  latestActionPlanByCandidateKey: Map<string, any>;
  latestAvailableFund: any;
  activeBudgetBuckets: any[];
}

@Injectable()
export class AdsAutomationEvidenceService {
  constructor(
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdsManagerAccount.name)
    private readonly adsManagerAccountModel: Model<AdsManagerAccountDocument>,
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly googleAdGroupModel: Model<GoogleAdsAdGroupDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly googleCampaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly googleCampaignBudgetModel: Model<GoogleAdsCampaignBudgetDocument>,
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly googleActionPlanModel: Model<GoogleAdsActionPlanDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
    @InjectModel(AdGroupDailyReport.name)
    private readonly adGroupDailyReportModel: Model<AdGroupDailyReportDocument>,
    @InjectModel(AdvertisingCost.name)
    private readonly advertisingCostModel: Model<AdvertisingCostDocument>,
    @InjectModel(InventorySummary.name)
    private readonly inventorySummaryModel: Model<InventorySummaryDocument>,
    @InjectModel(SupplierQuote.name)
    private readonly supplierQuoteModel: Model<SupplierQuoteDocument>,
    @InjectModel(SupplierPayable.name)
    private readonly supplierPayableModel: Model<SupplierPayableDocument>,
    @InjectModel(AvailableFundSnapshot.name)
    private readonly availableFundSnapshotModel: Model<AvailableFundSnapshotDocument>,
    @InjectModel(BudgetBucket.name)
    private readonly budgetBucketModel: Model<BudgetBucketDocument>,
    @InjectModel(EmergencyActionLog.name)
    private readonly emergencyActionLogModel: Model<EmergencyActionLogDocument>,
  ) {}

  async buildSnapshot(query: AdsAutomationSnapshotQuery = {}): Promise<AdsAutomationEvidenceSnapshot> {
    const now = new Date();
    const limit = this.clamp(query.limit, 1, 300, 100);
    const lookbackDays = this.clamp(query.lookbackDays, 1, 120, 30);
    const concurrency = this.clamp(process.env.ADS_EVIDENCE_QUERY_CONCURRENCY, 1, 16, 6);
    // One semaphore is shared by every query path in this snapshot. This keeps
    // nested Promise.all calls from multiplying the configured DB concurrency.
    const queryLimiter = new DbQuerySemaphore(concurrency);
    const safety = getAdsSafetyConfig();
    const killSwitchActive = await this.killSwitchActive(now, queryLimiter);
    const environment = this.environment();

    const candidates = await this.loadCandidates(limit, queryLimiter);
    const adGroupIdCounts = countCandidateValues(candidates, (candidate) => [candidate.adGroupId]);
    const productIdCounts = countCandidateValues(candidates, (candidate) => candidate.productIds);
    const shared = await this.loadSharedEvidence(candidates, {
      now,
      lookbackDays,
      adGroupIdCounts,
      productIdCounts,
    }, queryLimiter);
    const adGroups = await mapWithConcurrency(
      candidates,
      concurrency,
      (candidate) => this.buildAdGroupEvidence(candidate, {
        now,
        lookbackDays,
        safety,
        killSwitchActive,
        shared,
        attribution: {
          adGroupIdUnique: adGroupIdCounts.get(candidate.adGroupId) === 1,
          uniqueProductIds: candidate.productIds.filter((productId) => productIdCounts.get(productId) === 1),
        },
      }),
    );
    const summary = summarizeReadiness(adGroups);

    return {
      schemaVersion: 'ads_automation_evidence_snapshot.v1',
      snapshotId: `ads-evidence-${now.toISOString()}`,
      generatedAt: now.toISOString(),
      environment,
      productionEnabled: safety.googleAdsProductionEnabled,
      providerExecutionEnabled: safety.providerExecutionEnabled,
      dryRun: safety.dryRun,
      killSwitchActive,
      summary,
      adGroups,
      globalBlockers: this.globalBlockers(safety, killSwitchActive, adGroups),
      safety: {
        localOnly: environment === 'local',
        providerApiCalled: false,
        googleAdsApiCalled: false,
        liveExecutionUsed: false,
        secretsRedacted: true,
        campaignBudgetIdNoFallback: true,
      },
    };
  }

  private async loadCandidates(limit: number, queryLimiter?: DbQuerySemaphore): Promise<CandidateAdGroup[]> {
    const limiter = queryLimiter || new DbQuerySemaphore(
      this.clamp(process.env.ADS_EVIDENCE_QUERY_CONCURRENCY, 1, 16, 6),
    );
    const [googleAdGroups, legacyAdGroups, adAccounts, managerAccounts] = await Promise.all([
      limiter.run(() => this.googleAdGroupModel.find({})
        .sort({ lastSyncAt: -1, updatedAt: -1 }).limit(limit).lean().exec()),
      limiter.run(() => this.adGroupModel.find({})
        .sort({ updatedAt: -1 }).limit(limit).lean().exec()),
      limiter.run(() => this.adAccountModel.find({ isActive: { $ne: false } }).lean().exec()),
      limiter.run(() => this.adsManagerAccountModel.find({ isActive: { $ne: false } }).lean().exec()),
    ]);
    const campaignFilters = uniqueObjects(
      (googleAdGroups as any[]).map((item) => ({
        customerId: String(item.customerId || ''),
        campaignId: String(item.campaignId || ''),
      })).filter((item) => item.customerId && item.campaignId),
      (item) => `${item.customerId}:${item.campaignId}`,
    );
    const campaigns: any[] = campaignFilters.length
      ? await limiter.run(() => this.googleCampaignModel.find({ $or: campaignFilters }).lean().exec())
      : [];
    const campaignsByIdentity = new Map(
      campaigns.map((campaign) => [`${campaign.customerId}:${campaign.campaignId}`, campaign]),
    );
    const budgetFilters = uniqueObjects(
      campaigns.map((campaign) => ({
        customerId: String(campaign.customerId || ''),
        campaignBudgetId: String(campaign.campaignBudgetId || ''),
      })).filter((item) => item.customerId && item.campaignBudgetId),
      (item) => `${item.customerId}:${item.campaignBudgetId}`,
    );
    const campaignBudgets: any[] = budgetFilters.length
      ? await limiter.run(() => this.googleCampaignBudgetModel.find({ $or: budgetFilters }).lean().exec())
      : [];
    const budgetsByIdentity = new Map(
      campaignBudgets.map((budget) => [`${budget.customerId}:${budget.campaignBudgetId}`, budget]),
    );

    const googleAdGroupIdCounts = countValues(
      (googleAdGroups as any[]).map((item) => text(item.adGroupId)).filter(Boolean) as string[],
    );
    const legacyByInternalId = new Map<string, any>(
      legacyAdGroups
        .filter((item: any) => item._id)
        .map((item: any) => [String(item._id), item]),
    );
    const legacyByProviderId = new Map<string, any[]>();
    for (const item of legacyAdGroups as any[]) {
      const providerId = text(item.adGroupId);
      if (!providerId) continue;
      legacyByProviderId.set(providerId, [...(legacyByProviderId.get(providerId) || []), item]);
    }
    const mergedLegacyIds = new Set<string>();
    const candidates = new Map<string, CandidateAdGroup>();

    for (const item of googleAdGroups as any[]) {
      if (!isAttributedAdGroupId(item.adGroupId)) continue;
      const internalLegacy = item.internalAdGroupId
        ? legacyByInternalId.get(String(item.internalAdGroupId))
        : undefined;
      const providerMatches = legacyByProviderId.get(String(item.adGroupId)) || [];
      // Provider IDs are not globally unique. Only use this legacy fallback when
      // both sides are unambiguous; otherwise require internalAdGroupId.
      const legacy = internalLegacy || (
        googleAdGroupIdCounts.get(String(item.adGroupId)) === 1 && providerMatches.length === 1
          ? providerMatches[0]
          : undefined
      );
      if (legacy?._id) mergedLegacyIds.add(String(legacy._id));
      const campaign: any = campaignsByIdentity.get(`${item.customerId}:${item.campaignId}`);
      const productIds = unique([
        ...(item.internalProductIds || []),
        ...(legacy?.selectedProducts || []).map((value: any) => String(value)),
        campaign?.internalProductId,
      ]);
      const campaignBudgetId = text(campaign?.campaignBudgetId);
      const campaignBudget: any = campaignBudgetId
        ? budgetsByIdentity.get(`${item.customerId}:${campaignBudgetId}`)
        : null;
      const childAccountId = normalizeProviderAccountId('google_ads', item.customerId);
      const adAccount = (adAccounts as any[]).find((account) =>
        this.platform(account.accountType) === 'google_ads'
        && normalizeProviderAccountId('google_ads', account.accountId) === childAccountId);
      const managerAccountId = this.managerAccountIdFor(
        'google_ads',
        childAccountId,
        adAccount,
        managerAccounts as any[],
      );

      candidates.set(`google:${item.customerId}:${item.adGroupId}`, {
        platform: 'google_ads',
        managerAccountId,
        childAccountId,
        campaignId: item.campaignId,
        campaignBudgetId: campaignBudget?.campaignBudgetId ?? campaignBudgetId,
        adGroupId: String(item.adGroupId),
        erpAdGroupId: legacy?._id ? String(legacy._id) : text(item.internalAdGroupId),
        name: item.adGroupName || legacy?.name,
        status: item.status || legacy?.remoteStatus || legacy?.effectiveStatus,
        productIds,
        lastSyncAt: item.lastSyncAt,
      });
    }

    for (const item of legacyAdGroups as any[]) {
      if (!isAttributedAdGroupId(item.adGroupId)) continue;
      if (item._id && mergedLegacyIds.has(String(item._id))) continue;
      const key = `${this.platform(item.platform)}:${text(item.adAccountId) || 'unscoped'}:${item.adGroupId}`;
      const platform = this.platform(item.platform);
      const adAccount = (adAccounts as any[]).find((account) =>
        String(account._id || '') === String(item.adAccountId || ''));
      const childAccountId = normalizeProviderAccountId(platform, adAccount?.accountId);
      candidates.set(key, {
        platform,
        managerAccountId: this.managerAccountIdFor(platform, childAccountId, adAccount, managerAccounts as any[]),
        childAccountId,
        campaignId: text(item.campaignId),
        campaignBudgetId: text(item.campaignBudgetId),
        adGroupId: String(item.adGroupId),
        erpAdGroupId: item._id ? String(item._id) : undefined,
        name: item.name,
        status: item.remoteStatus || item.effectiveStatus || (item.isActive ? 'ENABLED' : 'PAUSED'),
        productIds: unique((item.selectedProducts || []).map((value: any) => String(value))),
        lastSyncAt: item.lastSyncAt,
      });
    }

    return [...candidates.values()].slice(0, limit);
  }

  private async loadSharedEvidence(
    candidates: CandidateAdGroup[],
    context: {
      now: Date;
      lookbackDays: number;
      adGroupIdCounts: Map<string, number>;
      productIdCounts: Map<string, number>;
    },
    queryLimiter: DbQuerySemaphore,
  ): Promise<SnapshotSharedEvidence> {
    const productIds = unique(candidates.flatMap((candidate) => candidate.productIds))
      .filter((value) => Types.ObjectId.isValid(value));
    const productObjectIds = productIds.map((value) => new Types.ObjectId(value));
    const adGroupIds = unique(candidates.map((candidate) => candidate.adGroupId));
    const attributableAdGroupIds = adGroupIds.filter((value) => context.adGroupIdCounts.get(value) === 1);
    const fallbackProductIds = productIds.filter((value) => context.productIdCounts.get(value) === 1);
    const since = new Date(context.now.getTime() - context.lookbackDays * 24 * 60 * 60 * 1000);
    const [
      products,
      inventoryRows,
      supplierQuotes,
      latestAvailableFund,
      activeBudgetBuckets,
      actionPlans,
    ] = await Promise.all([
      productObjectIds.length
        ? queryLimiter.run(() => this.productModel.find({ _id: { $in: productObjectIds } }).lean().exec())
        : Promise.resolve([]),
      productObjectIds.length
        ? queryLimiter.run(() => this.inventorySummaryModel
          .find({ productId: { $in: productObjectIds } }).lean().exec())
        : Promise.resolve([]),
      productObjectIds.length
        ? queryLimiter.run(() => this.supplierQuoteModel.find({
          productId: { $in: productObjectIds },
          approvalStatus: 'approved',
        })
          .sort({ effectiveAt: -1, createdAt: -1 }).lean().exec())
        : Promise.resolve([]),
      queryLimiter.run(() => this.availableFundSnapshotModel.findOne({})
        .sort({ capturedAt: -1, createdAt: -1 }).lean().exec()),
      queryLimiter.run(() => this.budgetBucketModel.find({ active: { $ne: false } }).lean().exec()),
      adGroupIds.length
        ? queryLimiter.run(() => this.googleActionPlanModel.find({
          'items.typedPayload.adGroupId': { $in: adGroupIds },
        }).sort({ createdAt: -1 }).limit(1000).lean().exec())
        : Promise.resolve([]),
    ]);

    const orderOr: any[] = [];
    if (attributableAdGroupIds.length) orderOr.push({ adGroupId: { $in: attributableAdGroupIds } });
    if (fallbackProductIds.length) {
      orderOr.push({
        productId: { $in: fallbackProductIds.map((value) => new Types.ObjectId(value)) },
        adGroupId: { $in: [null, '', '0'] },
      });
    }
    const orders = orderOr.length
      ? await this.loadOrdersPaged({ orderDate: { $gte: since }, $or: orderOr }, queryLimiter)
      : [];
    const reports: any[] = attributableAdGroupIds.length
      ? await queryLimiter.run(() => this.adGroupDailyReportModel.find({
        adGroupId: { $in: attributableAdGroupIds },
      }).sort({ date: -1 }).lean().exec())
      : [];
    const spendRows: any[] = attributableAdGroupIds.length
      ? await queryLimiter.run(() => this.advertisingCostModel.aggregate([
        {
          $match: {
            adGroupId: { $in: attributableAdGroupIds },
            channel: { $in: unique(candidates.map((candidate) => providerChannel(candidate.platform))) },
            date: { $gte: startOfMonth(context.now), $lte: context.now },
          },
        },
        {
          $group: {
            _id: { adGroupId: '$adGroupId', channel: '$channel', customerId: '$customerId' },
            monthlySpend: { $sum: '$spentAmount' },
            dailySpend: {
              $sum: {
                $cond: [{ $gte: ['$date', startOfDay(context.now)] }, '$spentAmount', 0],
              },
            },
          },
        },
      ]).exec())
      : [];

    const productsById = new Map((products as any[]).map((product) => [String(product._id), product]));
    const inventoryByProductId = groupBy(inventoryRows as any[], (row) => String(row.productId || ''));
    const supplierQuotesByProductId = groupBy(supplierQuotes as any[], (row) => String(row.productId || ''));
    const candidatesByAdGroupId = groupBy(candidates, (candidate) => candidate.adGroupId);
    const candidateByFallbackProductId = new Map<string, CandidateAdGroup>();
    for (const candidate of candidates) {
      for (const productId of candidate.productIds) {
        if (context.productIdCounts.get(productId) === 1) candidateByFallbackProductId.set(productId, candidate);
      }
    }
    const ordersByCandidateKey = new Map<string, any[]>();
    for (const order of orders as any[]) {
      const attributedId = text(order.adGroupId);
      const directCandidates = attributedId && context.adGroupIdCounts.get(attributedId) === 1
        ? candidatesByAdGroupId.get(attributedId) || []
        : [];
      const fallbackCandidate = !isAttributedAdGroupId(attributedId)
        ? candidateByFallbackProductId.get(String(order.productId || ''))
        : undefined;
      for (const candidate of directCandidates.length ? directCandidates : fallbackCandidate ? [fallbackCandidate] : []) {
        appendToMap(ordersByCandidateKey, candidateEvidenceKey(candidate), order);
      }
    }

    const allSupplierIds = unique([
      ...(products as any[]).flatMap((product) =>
        (product.suppliers || []).map((supplier: any) => String(supplier.supplierId || ''))),
      ...(supplierQuotes as any[]).map((quote) => String(quote.supplierId || '')),
      ...(orders as any[]).map((order) => String(order.supplierId || '')),
    ]).filter((value) => Types.ObjectId.isValid(value));
    const payableOr: any[] = [];
    if (allSupplierIds.length) payableOr.push({
      supplierId: { $in: allSupplierIds.map((value) => new Types.ObjectId(value)) },
    });
    if (productObjectIds.length) payableOr.push({ 'items.productId': { $in: productObjectIds } });
    const supplierPayables: any[] = payableOr.length
      ? await queryLimiter.run(() => this.supplierPayableModel.find({ $or: payableOr }).lean().exec())
      : [];

    const latestReportByCandidateKey = new Map<string, any>();
    const spendByCandidateKey = new Map<string, { dailySpend: number; monthlySpend: number }>();
    const supplierPayablesByCandidateKey = new Map<string, any[]>();
    const latestActionPlanByCandidateKey = new Map<string, any>();
    const reportsByIdentity = new Map<string, any>();
    for (const report of reports as any[]) {
      const adGroupId = text(report.adGroupId);
      if (!adGroupId) continue;
      const platform = text(report.platform) || '*';
      const identity = `${adGroupId}:${platform}`;
      if (!reportsByIdentity.has(identity)) reportsByIdentity.set(identity, report);
    }
    const spendByIdentity = new Map<string, any>();
    for (const row of spendRows) {
      const exactIdentity = [
        text(row._id?.adGroupId) || '',
        text(row._id?.channel) || '',
        text(row._id?.customerId) || '',
      ].join(':');
      spendByIdentity.set(exactIdentity, row);
      const anyIdentity = [
        text(row._id?.adGroupId) || '',
        text(row._id?.channel) || '',
        '*',
      ].join(':');
      if (!spendByIdentity.has(anyIdentity)) spendByIdentity.set(anyIdentity, row);
    }
    const payablesBySupplierId = groupBy(supplierPayables, (payable) => String(payable.supplierId || ''));
    const payablesByProductId = new Map<string, any[]>();
    for (const payable of supplierPayables) {
      for (const item of payable.items || []) {
        const productId = String(item.productId || '');
        if (productId) appendToMap(payablesByProductId, productId, payable);
      }
    }
    const actionPlansByItemIdentity = new Map<string, any>();
    for (const plan of actionPlans as any[]) {
      for (const item of plan.items || []) {
        const adGroupId = text(item.typedPayload?.adGroupId);
        if (!adGroupId) continue;
        const customerId = text(item.customerId) || '*';
        const exactIdentity = `${adGroupId}:${customerId}`;
        if (!actionPlansByItemIdentity.has(exactIdentity)) actionPlansByItemIdentity.set(exactIdentity, plan);
        const anyIdentity = `${adGroupId}:*`;
        if (!actionPlansByItemIdentity.has(anyIdentity)) actionPlansByItemIdentity.set(anyIdentity, plan);
      }
    }
    for (const candidate of candidates) {
      const key = candidateEvidenceKey(candidate);
      const report = reportsByIdentity.get(`${candidate.adGroupId}:${providerChannel(candidate.platform)}`)
        || reportsByIdentity.get(`${candidate.adGroupId}:*`);
      if (report) latestReportByCandidateKey.set(key, report);
      const spend = spendByIdentity.get([
        candidate.adGroupId,
        providerChannel(candidate.platform),
        candidate.childAccountId || '*',
      ].join(':'));
      spendByCandidateKey.set(key, {
        dailySpend: number(spend?.dailySpend),
        monthlySpend: number(spend?.monthlySpend),
      });
      const candidateOrders = ordersByCandidateKey.get(key) || [];
      const candidateSupplierIds = new Set(unique([
        ...candidate.productIds.flatMap((productId) =>
          (productsById.get(productId)?.suppliers || []).map((supplier: any) => String(supplier.supplierId || ''))),
        ...candidate.productIds.flatMap((productId) =>
          (supplierQuotesByProductId.get(productId) || []).map((quote: any) => String(quote.supplierId || ''))),
        ...candidateOrders.map((order) => String(order.supplierId || '')),
      ]));
      const candidatePayables = new Set<any>();
      for (const supplierId of candidateSupplierIds) {
        for (const payable of payablesBySupplierId.get(supplierId) || []) candidatePayables.add(payable);
      }
      for (const productId of candidate.productIds) {
        for (const payable of payablesByProductId.get(productId) || []) candidatePayables.add(payable);
      }
      supplierPayablesByCandidateKey.set(key, [...candidatePayables]);
      const plan = actionPlansByItemIdentity.get(`${candidate.adGroupId}:${candidate.childAccountId || '*'}`);
      if (plan) latestActionPlanByCandidateKey.set(key, plan);
    }
    return {
      productsById,
      inventoryByProductId,
      supplierQuotesByProductId,
      ordersByCandidateKey,
      latestReportByCandidateKey,
      spendByCandidateKey,
      supplierPayablesByCandidateKey,
      latestActionPlanByCandidateKey,
      latestAvailableFund,
      activeBudgetBuckets: activeBudgetBuckets as any[],
    };
  }

  private async loadOrdersPaged(filter: Record<string, any>, queryLimiter: DbQuerySemaphore): Promise<any[]> {
    const pageSize = this.clamp(process.env.ADS_EVIDENCE_ORDER_PAGE_SIZE, 100, 5000, 1000);
    const maxRows = this.clamp(process.env.ADS_EVIDENCE_MAX_ORDER_ROWS, 1000, 250000, 50000);
    const rows: any[] = [];
    let afterId: any;
    while (true) {
      const remaining = maxRows - rows.length;
      const pageFilter = afterId ? { $and: [filter, { _id: { $gt: afterId } }] } : filter;
      const page: any[] = await queryLimiter.run(() => this.orderModel.find(pageFilter)
        .sort({ _id: 1 }).limit(Math.min(pageSize, remaining + 1)).lean().exec());
      if (page.length > remaining) {
        throw new Error(
          `Ads evidence order scope exceeds ADS_EVIDENCE_MAX_ORDER_ROWS=${maxRows}; reduce lookbackDays or raise the reviewed bound.`,
        );
      }
      rows.push(...page);
      if (page.length < Math.min(pageSize, remaining + 1)) break;
      afterId = page[page.length - 1]?._id;
      if (!afterId) {
        throw new Error('Ads evidence order pagination requires stable _id values.');
      }
    }
    return rows;
  }

  private managerAccountIdFor(
    platform: AdsAutomationPlatform,
    childAccountId: string | undefined,
    adAccount: any,
    managerAccounts: any[],
  ): string | undefined {
    const provider = providerChannel(platform);
    const accountManagerId = normalizeProviderAccountId(
      platform,
      platform === 'google_ads' ? adAccount?.loginCustomerId : adAccount?.businessCenterId,
    );
    const registry = managerAccounts.find((manager) => {
      if (String(manager.provider || '') !== provider) return false;
      const managerId = normalizeProviderAccountId(platform, manager.managerAccountId);
      const childIds = (manager.childAccountIds || [])
        .map((value: unknown) => normalizeProviderAccountId(platform, value));
      return Boolean(
        (childAccountId && childIds.includes(childAccountId))
        || (accountManagerId && managerId === accountManagerId),
      );
    });
    return normalizeProviderAccountId(platform, registry?.managerAccountId) || accountManagerId;
  }

  private async buildAdGroupEvidence(
    candidate: CandidateAdGroup,
    context: {
      now: Date;
      lookbackDays: number;
      safety: ReturnType<typeof getAdsSafetyConfig>;
      killSwitchActive: boolean;
      shared: SnapshotSharedEvidence;
      attribution: CandidateAttributionContext;
    },
  ): Promise<AdsAutomationAdGroupEvidence> {
    const configuredProductIds = unique(candidate.productIds);
    const configuredProductObjectIds = configuredProductIds.filter((value) => Types.ObjectId.isValid(value));
    const products = configuredProductObjectIds
      .map((value) => context.shared.productsById.get(value))
      .filter(Boolean);
    const verifiedProductIds = unique((products as any[]).map((product) => String(product._id)));
    const productObjectIds = verifiedProductIds.map((value) => new Types.ObjectId(value));
    const uniqueFallbackProductIds = verifiedProductIds.filter((productId) =>
      context.attribution.uniqueProductIds.includes(productId));
    const key = candidateEvidenceKey(candidate);
    const orders = context.shared.ordersByCandidateKey?.get(key) || [];
    const latestReport = context.shared.latestReportByCandidateKey?.get(key);
    const spend = context.shared.spendByCandidateKey?.get(key) || { dailySpend: 0, monthlySpend: 0 };
    const inventoryRows = verifiedProductIds.flatMap((productId) =>
      context.shared.inventoryByProductId.get(productId) || []);
    const supplierQuotes = verifiedProductIds.flatMap((productId) =>
      context.shared.supplierQuotesByProductId.get(productId) || []);
    const latestAvailableFund = context.shared.latestAvailableFund;
    const activeBudgetBuckets = context.shared.activeBudgetBuckets;
    const latestActionPlan = context.shared.latestActionPlanByCandidateKey?.get(key);

    const usedProductFallback = (orders as any[]).some((order) =>
      !isAttributedAdGroupId(order.adGroupId)
      && uniqueFallbackProductIds.includes(String(order.productId || '')));
    const mappingStatus = productMappingStatus(configuredProductIds, verifiedProductIds, context.attribution.adGroupIdUnique);
    const mappingConfidence = usedProductFallback
      ? 'low'
      : mappingStatus === 'mapped' ? 'high'
        : mappingStatus === 'partial' ? 'medium' : 'low';

    const supplierIds = unique([
      ...products.flatMap((product: any) => (product.suppliers || []).map((supplier: any) => String(supplier.supplierId || ''))),
      ...orders.map((order: any) => String(order.supplierId || '')),
      ...supplierQuotes.map((quote: any) => String(quote.supplierId || '')),
    ]);
    const supplierPayables = context.shared.supplierPayablesByCandidateKey?.get(key) || [];

    const commerce = this.commerceEvidence(orders as any[], latestReport as any, context.now);
    const inventory = this.inventoryEvidence(verifiedProductIds, products as any[], inventoryRows as any[], context.now);
    const supplier = this.supplierEvidence(supplierIds, supplierQuotes as any[], supplierPayables as any[], context.now);
    const finance = this.financeEvidence({
      latestAvailableFund: latestAvailableFund as any,
      activeBudgetBuckets: activeBudgetBuckets as any[],
      productGroupIds: unique((products as any[]).map((product) => String(product.categoryId || ''))),
      dailySpend: spend.dailySpend,
      monthlySpend: spend.monthlySpend,
      netProfitAfterAds: commerce.netProfitAfterAds,
      now: context.now,
    });
    const adsGate = this.adsGateEvidence(
      context.safety,
      context.killSwitchActive,
      latestActionPlan as any,
      candidate,
    );
    const evidenceRefs = this.evidenceRefs(candidate, {
      products,
      orders,
      latestReport,
      inventoryRows,
      supplierQuotes,
      supplierPayables,
      latestAvailableFund,
    }, context.now);

    return evaluateAdGroupEvidence({
      platform: candidate.platform,
      managerAccountId: candidate.managerAccountId,
      childAccountId: candidate.childAccountId,
      campaignId: candidate.campaignId,
      campaignBudgetId: candidate.campaignBudgetId,
      adGroupId: candidate.adGroupId,
      erpAdGroupId: candidate.erpAdGroupId,
      name: candidate.name,
      status: candidate.status,
      productIds: verifiedProductIds,
      mappingStatus,
      mappingConfidence,
      commerce,
      inventory,
      supplier,
      finance,
      adsGate,
      evidenceRefs,
      now: context.now,
    });
  }

  private commerceEvidence(orders: any[], latestReport: any, now: Date): Partial<AdsAutomationCommerceEvidence> {
    const revenue = sum(orders, (order) =>
      number(order.codAmount) + number(order.manualPayment) + number(order.depositAmount));
    const grossProfit = sum(orders, (order) => number(order.grossProfit ?? order.realizedGrossProfit));
    const netProfitFromOrders = sum(orders, (order) => number(order.netProfit ?? order.realizedNetProfit));
    const netProfitAfterAds = orders.length ? netProfitFromOrders : number(latestReport?.netProfit);
    const latestOrderAt = latestDate(orders.map((order) => order.orderDate || order.createdAt || order.updatedAt));

    return {
      orders: orders.length || number(latestReport?.orders),
      revenue,
      cancellations: orders.filter((order) => /huỷ|hủy|cancel/i.test(String(order.orderStatus || ''))).length,
      returns: orders.filter((order) => /hoàn|return/i.test(String(order.orderStatus || ''))).length,
      grossProfit,
      netProfitAfterAds,
      marginPercent: revenue > 0 ? (netProfitAfterAds / revenue) * 100 : 0,
      latestOrderAt: latestOrderAt?.toISOString(),
      dataFreshness: freshnessFromDate(latestOrderAt || latestReport?.syncedAt || latestReport?.updatedAt, now, 14),
    };
  }

  private inventoryEvidence(
    productIds: string[],
    products: any[],
    rows: any[],
    now: Date,
  ): Partial<AdsAutomationInventoryEvidence> {
    const stockOnHand = rows.length ? sum(rows, (row) => number(row.onHand)) : undefined;
    const minStock = products.length ? sum(products, (product) => number(product.minStock)) : undefined;
    const latestUpdate = latestDate(rows.map((row) => row.updatedAt || row.createdAt));
    return {
      productIds,
      stockOnHand,
      minStock,
      updatedAt: latestUpdate?.toISOString(),
      dataFreshness: freshnessFromDate(latestUpdate, now, 7),
    };
  }

  private supplierEvidence(
    supplierIds: string[],
    quotes: any[],
    payables: any[],
    now: Date,
  ): Partial<AdsAutomationSupplierEvidence> {
    const latestQuote = latestDate(quotes.map((quote) => quote.effectiveAt || quote.updatedAt || quote.createdAt));
    const latestPayable = latestDate(payables.map((payable) => payable.updatedAt || payable.createdAt));
    const openPayableBalance = sum(
      payables.filter((payable) => ['draft', 'unpaid', 'partial'].includes(String(payable.status || ''))),
      (payable) => number(payable.balance),
    );
    const overdue = payables.some((payable) =>
      ['draft', 'unpaid', 'partial'].includes(String(payable.status || ''))
      && payable.dueDate
      && new Date(payable.dueDate).getTime() < now.getTime());

    return {
      supplierIds,
      quoteCount: quotes.length,
      openPayableBalance,
      quoteStatus: quotes.length ? (freshnessFromDate(latestQuote, now, 30) === 'fresh' ? 'available' : 'stale') : 'missing',
      payableStatus: overdue ? 'overdue' : openPayableBalance > 0 ? 'open' : supplierIds.length ? 'clear' : 'unknown',
      supplierRisk: overdue ? 'blocked' : undefined,
      updatedAt: latestDate([latestQuote, latestPayable])?.toISOString(),
      dataFreshness: freshnessFromDate(latestDate([latestQuote, latestPayable]), now, 30),
    };
  }

  private financeEvidence(input: {
    latestAvailableFund: any;
    activeBudgetBuckets: any[];
    productGroupIds: string[];
    dailySpend: number;
    monthlySpend: number;
    netProfitAfterAds: number;
    now: Date;
  }): Partial<AdsAutomationFinanceGate> {
    const applicableBuckets = input.activeBudgetBuckets.filter((bucket) => {
      const scope = unique(bucket.productGroupIds || []);
      return scope.length === 0 || scope.some((groupId) => input.productGroupIds.includes(groupId));
    });
    const dailyCap = strictestPositive(applicableBuckets.map((bucket) => bucket.dailyCap));
    const monthlyCap = strictestPositive(applicableBuckets.map((bucket) => bucket.monthlyCap));
    const realizedLoss = Math.max(0, -input.netProfitAfterAds);
    const availableCash = input.latestAvailableFund ? number(input.latestAvailableFund.available) : undefined;
    const lossLimit = optionalEnvNumber('ADS_AUTOMATION_DAILY_LOSS_LIMIT_VND');
    const capturedAt = input.latestAvailableFund?.capturedAt || input.latestAvailableFund?.createdAt;
    const cappedBudgetIncrease = budgetIncreaseHeadroom({
      availableCash,
      dailyCap,
      monthlyCap,
      currentDailySpend: input.dailySpend,
      currentMonthlySpend: input.monthlySpend,
    });

    return {
      availableCash,
      dailyCap: dailyCap || undefined,
      monthlyCap: monthlyCap || undefined,
      currentDailySpend: input.dailySpend,
      currentMonthlySpend: input.monthlySpend,
      lossLimit,
      realizedLoss,
      cappedBudgetIncrease,
      dataFreshness: freshnessFromDate(capturedAt, input.now, 2),
    };
  }

  private adsGateEvidence(
    safety: ReturnType<typeof getAdsSafetyConfig>,
    killSwitchActive: boolean,
    latestActionPlan: any,
    candidate: CandidateAdGroup,
  ): Partial<AdsAutomationGateEvidence> {
    const items = Array.isArray(latestActionPlan?.items) ? latestActionPlan.items : [];
    const matchingItems = items.filter((item: any) =>
      text(item.typedPayload?.adGroupId) === candidate.adGroupId
      && (!candidate.childAccountId || text(item.customerId) === candidate.childAccountId));
    const item = matchingItems.length === 1 ? matchingItems[0] : undefined;
    const hasValidatePassed = item?.providerValidationStatus === 'provider_validate_passed';
    const hasApproval = ['approved', 'executed'].includes(String(item?.status || ''));
    const hasIdempotency = Boolean(text(item?.idempotencyKey));
    const beforeStateSnapshotReady = Boolean(item?.evidence?.beforeState || item?.typedPayload?.beforeState);
    const importAuditReady = Boolean(
      text(latestActionPlan?.planId)
      && text(latestActionPlan?.sourceExportId)
      && text(latestActionPlan?.originalZipSha256)
      && latestActionPlan?.manifest
      && Object.keys(latestActionPlan.manifest).length > 0
      && text(item?.actionId)
      && text(item?.idempotencyKey),
    );
    const approvalAuditReady = !hasApproval || Boolean(
      item?.approvedAt
      && (text(item?.approvedByUserId) || text(item?.approvedBy))
      && Array.isArray(item?.approvalHistory)
      && item.approvalHistory.some((entry: any) => entry?.decision === 'approved' && entry?.at),
    );

    return {
      productionEnabled: safety.googleAdsProductionEnabled,
      providerExecutionEnabled: safety.providerExecutionEnabled,
      dryRun: safety.dryRun,
      killSwitchActive,
      providerValidateOnlyPassed: hasValidatePassed,
      approved: hasApproval,
      idempotencyReady: hasIdempotency,
      beforeStateSnapshotReady,
      auditReady: importAuditReady && approvalAuditReady,
    };
  }

  private evidenceRefs(candidate: CandidateAdGroup, refs: Record<string, any>, now: Date): AdsAutomationEvidenceRef[] {
    const rows: AdsAutomationEvidenceRef[] = [{
      source: candidate.platform === 'google_ads' ? 'google_ads_ad_groups' : 'ad-group',
      entityType: 'ad_group',
      entityId: candidate.adGroupId,
      observedAt: candidate.lastSyncAt?.toISOString(),
      freshnessStatus: freshnessFromDate(candidate.lastSyncAt, now, 7),
    }];

    const add = (source: string, entityType: string, item: any, observedAt?: any) => {
      if (!item) return;
      rows.push({
        source,
        entityType,
        entityId: text(item._id) || text(item.id),
        observedAt: observedAt ? new Date(observedAt).toISOString() : undefined,
        freshnessStatus: freshnessFromDate(observedAt, now, 30),
      });
    };

    for (const product of refs.products || []) add('product', 'product', product, product.updatedAt || product.createdAt);
    for (const order of (refs.orders || []).slice(0, 5)) add('ordertest2', 'order', order, order.orderDate || order.updatedAt || order.createdAt);
    add('ad_group_daily_reports', 'profit_report', refs.latestReport, refs.latestReport?.syncedAt || refs.latestReport?.updatedAt);
    for (const row of refs.inventoryRows || []) add('inventory_summaries', 'inventory_summary', row, row.updatedAt || row.createdAt);
    for (const quote of (refs.supplierQuotes || []).slice(0, 5)) add('supplier_quotes', 'supplier_quote', quote, quote.effectiveAt || quote.updatedAt || quote.createdAt);
    for (const payable of (refs.supplierPayables || []).slice(0, 5)) add('supplier_payables', 'supplier_payable', payable, payable.updatedAt || payable.createdAt);
    add('available_fund_snapshots', 'available_fund_snapshot', refs.latestAvailableFund, refs.latestAvailableFund?.capturedAt || refs.latestAvailableFund?.createdAt);

    return rows;
  }


  private async killSwitchActive(now: Date, queryLimiter: DbQuerySemaphore): Promise<boolean> {
    if (
      readBooleanEnv('ADS_AUTOMATION_KILL_SWITCH', false)
      || readBooleanEnv('GOOGLE_ADS_KILL_SWITCH', false)
    ) {
      return true;
    }
    const today = isoDate(now);
    const activeEmergency = await queryLimiter.run(() => this.emergencyActionLogModel.findOne({
      date: today,
      done: false,
      priority: { $in: ['critical', 'high'] },
      taskType: { $in: ['pause-ad-group', 'change-budget'] },
    }).lean().exec());
    return Boolean(activeEmergency);
  }

  private globalBlockers(
    safety: ReturnType<typeof getAdsSafetyConfig>,
    killSwitchActive: boolean,
    adGroups: AdsAutomationAdGroupEvidence[],
  ) {
    const blockers = [];
    if (!safety.googleAdsProductionEnabled) {
      blockers.push({ code: 'GOOGLE_ADS_PRODUCTION_ENABLED_FALSE', severity: 'error' as const, message: 'Production execution is disabled.' });
    }
    if (!safety.providerExecutionEnabled) {
      blockers.push({ code: 'PROVIDER_EXECUTION_DISABLED', severity: 'error' as const, message: 'Provider execution is disabled.' });
    }
    if (safety.dryRun) {
      blockers.push({ code: 'ADS_DRY_RUN_ENABLED', severity: 'error' as const, message: 'Dry-run is enabled.' });
    }
    if (killSwitchActive) {
      blockers.push({ code: 'ADS_KILL_SWITCH_ACTIVE', severity: 'error' as const, message: 'Kill switch or emergency budget task is active.' });
    }
    if (adGroups.some((item) => item.blockers.some((blocker) => blocker.code === 'BUDGET_CAMPAIGN_BUDGET_ID_MISSING'))) {
      blockers.push({
        code: 'CAMPAIGN_BUDGET_ID_REQUIRED',
        severity: 'error' as const,
        message: 'At least one budget candidate is missing campaignBudgetId. No fallback is allowed.',
      });
    }
    return blockers;
  }

  private platform(value: string): AdsAutomationPlatform {
    if (value === 'google') return 'google_ads';
    if (value === 'facebook') return 'meta_ads';
    if (value === 'tiktok') return 'tiktok_ads';
    return 'unknown';
  }

  private environment(): 'local' | 'demo' | 'staging' | 'production' {
    const env = String(process.env.NODE_ENV || '').toLowerCase();
    if (env === 'production') return 'production';
    if (env === 'staging') return 'staging';
    if (String(process.env.DATABASE_NAME || process.env.MONGODB_URI || '').toLowerCase().includes('demo')) return 'demo';
    return 'local';
  }

  private clamp(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(parsed)));
  }
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function latestDate(values: any[]): Date | undefined {
  const dates = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0];
}

function sum<T>(rows: T[], selector: (row: T) => number): number {
  return rows.reduce((total, row) => total + selector(row), 0);
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalEnvNumber(name: string): number | undefined {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function strictestPositive(values: unknown[]): number | undefined {
  const positive = values
    .map((value) => number(value))
    .filter((value) => value > 0);
  return positive.length ? Math.min(...positive) : undefined;
}

function budgetIncreaseHeadroom(input: {
  availableCash?: number;
  dailyCap?: number;
  monthlyCap?: number;
  currentDailySpend: number;
  currentMonthlySpend: number;
}): number | undefined {
  const constraints: number[] = [];
  if (input.availableCash !== undefined) constraints.push(Math.max(0, input.availableCash));
  if (input.dailyCap !== undefined) {
    constraints.push(Math.max(0, input.dailyCap - input.currentDailySpend));
  }
  if (input.monthlyCap !== undefined) {
    constraints.push(Math.max(0, input.monthlyCap - input.currentMonthlySpend));
  }
  return constraints.length ? Math.min(...constraints) : undefined;
}

function text(value: unknown): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function unique(values: any[]): string[] {
  return Array.from(new Set(values.map((value) => text(value)).filter(Boolean) as string[]));
}

function uniqueObjects<T>(values: T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const identity = key(value);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const value of values) {
    const identity = key(value);
    if (!identity) continue;
    grouped.set(identity, [...(grouped.get(identity) || []), value]);
  }
  return grouped;
}

function appendToMap<T>(target: Map<string, T[]>, key: string, value: T): void {
  const current = target.get(key);
  if (current) current.push(value);
  else target.set(key, [value]);
}

function candidateEvidenceKey(candidate: CandidateAdGroup): string {
  return [
    candidate.platform,
    candidate.managerAccountId || '',
    candidate.childAccountId || '',
    candidate.campaignId || '',
    candidate.adGroupId,
  ].join(':');
}

/** Snapshot-scoped semaphore for all database I/O, including nested query fans. */
class DbQuerySemaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.active -= 1;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function countValues(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of new Set(values)) {
    counts.set(value, values.filter((item) => item === value).length);
  }
  return counts;
}

function countCandidateValues(
  candidates: CandidateAdGroup[],
  selector: (candidate: CandidateAdGroup) => string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    for (const value of unique(selector(candidate))) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }
  return counts;
}

function productMappingStatus(
  configuredProductIds: string[],
  verifiedProductIds: string[],
  adGroupIdUnique: boolean,
): AdsAutomationMappingStatus {
  if (!adGroupIdUnique) return 'conflict';
  if (!configuredProductIds.length) return 'missing';
  if (!verifiedProductIds.length) return 'conflict';
  return verifiedProductIds.length === configuredProductIds.length ? 'mapped' : 'partial';
}

function providerChannel(platform: AdsAutomationPlatform): string {
  if (platform === 'google_ads') return 'google';
  if (platform === 'meta_ads') return 'facebook';
  if (platform === 'tiktok_ads') return 'tiktok';
  return 'other';
}

function normalizeProviderAccountId(platform: AdsAutomationPlatform, value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  if (!normalized) return undefined;
  return platform === 'google_ads' ? normalized.replace(/\D/g, '') || undefined : normalized;
}

export function isAttributedAdGroupId(value: unknown): boolean {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 && normalized !== '0';
}
