import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { GoogleAdsAdGroup, GoogleAdsAdGroupDocument } from './schemas/google-ads-ad-group.schema';
import { GoogleAdsDailyMetric, GoogleAdsDailyMetricDocument } from './schemas/google-ads-daily-metric.schema';

type ProfitAggregate = {
  revenue: number;
  grossProfit: number;
  netProfit: number;
  orders: number;
  cancelledOrders: number;
  returnedOrders: number;
};

export interface GoogleAdsProfitEnrichmentResult {
  customerIds: string[];
  dateFrom: string;
  dateTo: string;
  scannedOrders: number;
  attributedOrders: number;
  enrichedMetrics: number;
  clearedUnsafeMetrics: number;
  updatedMetrics: number;
  ambiguousAdGroupIds: string[];
  erpEnrichedAt: Date;
  providerApiCalled: false;
  adsMutated: false;
}

@Injectable()
export class GoogleAdsProfitEnrichmentService {
  constructor(
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly adGroupModel: Model<GoogleAdsAdGroupDocument>,
    @InjectModel(GoogleAdsDailyMetric.name)
    private readonly dailyMetricModel: Model<GoogleAdsDailyMetricDocument>,
    @InjectModel(TestOrder2.name)
    private readonly orderModel: Model<TestOrder2Document>,
  ) {}

  async enrich(input: {
    customerIds: string[];
    dateFrom: string;
    dateTo: string;
  }): Promise<GoogleAdsProfitEnrichmentResult> {
    const customerIds = unique(input.customerIds.map(normalizeGoogleId).filter(Boolean) as string[]);
    const dateFrom = isoDate(input.dateFrom);
    const dateTo = isoDate(input.dateTo);
    if (dateFrom > dateTo) throw new Error('ERP profit enrichment date range is invalid.');
    const erpEnrichedAt = new Date();
    const emptyResult = {
      customerIds,
      dateFrom,
      dateTo,
      scannedOrders: 0,
      attributedOrders: 0,
      enrichedMetrics: 0,
      clearedUnsafeMetrics: 0,
      updatedMetrics: 0,
      ambiguousAdGroupIds: [],
      erpEnrichedAt,
      providerApiCalled: false as const,
      adsMutated: false as const,
    };
    if (!customerIds.length) return emptyResult;

    const [allAdGroups, metricRows] = await Promise.all([
      this.adGroupModel.find({}, {
        _id: 1,
        customerId: 1,
        campaignId: 1,
        adGroupId: 1,
      }).lean().exec(),
      this.dailyMetricModel.find({
        customerId: { $in: customerIds },
        date: { $gte: dateFrom, $lte: dateTo },
        level: { $in: ['campaign', 'ad_group'] },
      }).lean().exec(),
    ]);

    const groupsByProviderId = new Map<string, any[]>();
    for (const group of allAdGroups as any[]) {
      const adGroupId = normalizedAttributionId(group.adGroupId);
      if (!adGroupId) continue;
      groupsByProviderId.set(adGroupId, [...(groupsByProviderId.get(adGroupId) || []), group]);
    }
    const ambiguousAdGroupIds = [...groupsByProviderId.entries()]
      .filter(([, groups]) => groups.length !== 1)
      .map(([adGroupId]) => adGroupId)
      .sort();
    const selectedCustomerIds = new Set(customerIds);
    const safeGroups = [...groupsByProviderId.entries()]
      .filter(([, groups]) => groups.length === 1)
      .map(([, groups]) => groups[0])
      .filter((group) => selectedCustomerIds.has(String(group.customerId)));
    const safeGroupByIdentity = new Map(
      safeGroups.map((group) => [adGroupIdentity(group.customerId, group.adGroupId), group]),
    );

    const selectedGroupsByCampaign = new Map<string, any[]>();
    for (const group of allAdGroups as any[]) {
      if (!selectedCustomerIds.has(String(group.customerId))) continue;
      const key = campaignIdentity(group.customerId, group.campaignId);
      selectedGroupsByCampaign.set(key, [...(selectedGroupsByCampaign.get(key) || []), group]);
    }
    const safeCampaigns = new Set<string>();
    for (const [key, groups] of selectedGroupsByCampaign) {
      if (
        groups.length > 0
        && groups.every((group) => (groupsByProviderId.get(String(group.adGroupId)) || []).length === 1)
      ) {
        safeCampaigns.add(key);
      }
    }

    const safeAdGroupIds = unique(safeGroups.map((group) => String(group.adGroupId)));
    const orders = safeAdGroupIds.length
      ? await this.orderModel.find({
        adGroupId: { $in: safeAdGroupIds },
        orderDate: {
          $gte: new Date(`${dateFrom}T00:00:00.000+07:00`),
          $lte: new Date(`${dateTo}T23:59:59.999+07:00`),
        },
      }).lean().exec()
      : [];

    const adGroupAggregates = new Map<string, ProfitAggregate>();
    const campaignAggregates = new Map<string, ProfitAggregate>();
    let attributedOrders = 0;
    for (const order of orders as any[]) {
      const adGroupId = normalizedAttributionId(order.adGroupId);
      if (!adGroupId) continue;
      const groups = groupsByProviderId.get(adGroupId) || [];
      if (groups.length !== 1) continue;
      const group = groups[0];
      if (!selectedCustomerIds.has(String(group.customerId))) continue;
      const date = vietnamDate(order.orderDate);
      if (!date || date < dateFrom || date > dateTo) continue;
      const aggregate = orderProfit(order);
      addAggregate(
        adGroupAggregates,
        metricIdentity(date, group.customerId, group.campaignId, group.adGroupId),
        aggregate,
      );
      addAggregate(
        campaignAggregates,
        metricIdentity(date, group.customerId, group.campaignId),
        aggregate,
      );
      attributedOrders += 1;
    }

    let enrichedMetrics = 0;
    let clearedUnsafeMetrics = 0;
    const operations = (metricRows as any[]).map((metric) => {
      const safeAdGroup = metric.level === 'ad_group'
        ? safeGroupByIdentity.get(adGroupIdentity(metric.customerId, metric.adGroupId))
        : undefined;
      const campaignKey = campaignIdentity(metric.customerId, metric.campaignId);
      const safelyAttributable = metric.level === 'ad_group'
        ? Boolean(safeAdGroup && String(safeAdGroup.campaignId) === String(metric.campaignId))
        : safeCampaigns.has(campaignKey);
      const filter = metric._id ? { _id: metric._id } : {
        level: metric.level,
        date: metric.date,
        customerId: metric.customerId,
        campaignId: metric.campaignId,
        adGroupId: metric.adGroupId ?? null,
        criterionId: metric.criterionId ?? null,
        adId: metric.adId ?? null,
      };

      if (!safelyAttributable) {
        clearedUnsafeMetrics += 1;
        return {
          updateOne: {
            filter,
            update: {
              $set: emptyProfit(),
              $unset: { erpEnrichedAt: '', profitUpdatedAt: '' },
            },
            upsert: false,
          },
        };
      }

      const aggregateKey = metricIdentity(
        metric.date,
        metric.customerId,
        metric.campaignId,
        metric.level === 'ad_group' ? metric.adGroupId : undefined,
      );
      const aggregate = metric.level === 'ad_group'
        ? adGroupAggregates.get(aggregateKey) || emptyProfit()
        : campaignAggregates.get(aggregateKey) || emptyProfit();
      const spend = number(metric.costVnd);
      enrichedMetrics += 1;
      return {
        updateOne: {
          filter,
          update: {
            $set: {
              ...aggregate,
              roas: spend > 0 ? aggregate.revenue / spend : 0,
              profitPerSpend: spend > 0 ? aggregate.netProfit / spend : 0,
              erpEnrichedAt,
              profitUpdatedAt: erpEnrichedAt,
            },
          },
          upsert: false,
        },
      };
    });

    if (operations.length) {
      await this.dailyMetricModel.bulkWrite(operations as any[], { ordered: false });
    }

    return {
      ...emptyResult,
      scannedOrders: (orders as any[]).length,
      attributedOrders,
      enrichedMetrics,
      clearedUnsafeMetrics,
      updatedMetrics: operations.length,
      ambiguousAdGroupIds,
    };
  }
}

function emptyProfit(): ProfitAggregate {
  return {
    revenue: 0,
    grossProfit: 0,
    netProfit: 0,
    orders: 0,
    cancelledOrders: 0,
    returnedOrders: 0,
  };
}

function orderProfit(order: any): ProfitAggregate {
  const status = foldStatus(order.orderStatus);
  return {
    revenue: number(order.depositAmount) + number(order.codAmount) + number(order.manualPayment),
    grossProfit: number(order.realizedGrossProfit ?? order.grossProfit),
    netProfit: number(order.realizedNetProfit ?? order.netProfit),
    orders: 1,
    cancelledOrders: /huy|cancel/.test(status) ? 1 : 0,
    returnedOrders: /hoan|return/.test(status) ? 1 : 0,
  };
}

function addAggregate(target: Map<string, ProfitAggregate>, key: string, value: ProfitAggregate) {
  const current = target.get(key) || emptyProfit();
  target.set(key, {
    revenue: current.revenue + value.revenue,
    grossProfit: current.grossProfit + value.grossProfit,
    netProfit: current.netProfit + value.netProfit,
    orders: current.orders + value.orders,
    cancelledOrders: current.cancelledOrders + value.cancelledOrders,
    returnedOrders: current.returnedOrders + value.returnedOrders,
  });
}

function metricIdentity(
  date: unknown,
  customerId: unknown,
  campaignId: unknown,
  adGroupId?: unknown,
): string {
  return `${date}:${customerId}:${campaignId}:${adGroupId ?? ''}`;
}

function campaignIdentity(customerId: unknown, campaignId: unknown): string {
  return `${customerId}:${campaignId}`;
}

function adGroupIdentity(customerId: unknown, adGroupId: unknown): string {
  return `${customerId}:${adGroupId}`;
}

function normalizedAttributionId(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized && normalized !== '0' ? normalized : undefined;
}

function normalizeGoogleId(value: unknown): string | undefined {
  const normalized = String(value ?? '').replace(/\D/g, '');
  return normalized || undefined;
}

function isoDate(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`Invalid ERP profit enrichment date: ${normalized || '(empty)'}`);
  }
  return normalized;
}

function vietnamDate(value: unknown): string | undefined {
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function foldStatus(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '');
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
