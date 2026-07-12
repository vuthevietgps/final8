import { Injectable } from '@nestjs/common';
import { DataQualityMetric, DataQualityReport, DecisionGate } from './contracts/data-quality.contract';
import { SectionQuality } from './contracts/metadata.contract';
import { DataPackMetadataService } from './data-pack-metadata.service';
import { AdsPerformanceQuery } from './queries/ads-performance.query';
import { LeadFunnelQuery } from './queries/lead-funnel.query';
import { OrderProfitQuery } from './queries/order-profit.query';
import { calculateAttributionConfidence, rate } from './utils/confidence.util';
import { freshnessHours } from './utils/freshness.util';
import { JsonExporterService } from './export/json-exporter.service';

@Injectable()
export class DataQualityReportService {
  constructor(
    private readonly metadata: DataPackMetadataService,
    private readonly orders: OrderProfitQuery,
    private readonly leads: LeadFunnelQuery,
    private readonly ads: AdsPerformanceQuery,
    private readonly json: JsonExporterService,
  ) {}

  async build(date: string, format: 'json' | 'xlsx' = 'json', generatedBy?: unknown): Promise<DataQualityReport> {
    const [orderData, leadData, adsData] = await Promise.all([
      this.orders.get(date),
      this.leads.get(date),
      this.ads.get(date),
    ]);
    const orders = orderData.orders;
    const leads = leadData.leads;
    const adGroups = adsData.legacyAdGroups;
    const syncRuns = adsData.syncRuns;
    const latestAdsSync = adsData.quality.freshness_at;

    const metrics: DataQualityMetric[] = [
      this.metric('lead_source_mapping_rate', rate(leads.filter((row) => row.sourcePlatform).length, leads.length), 90, leads.filter((row) => row.sourcePlatform).length, leads.length, 'warning'),
      this.metric('lead_campaign_mapping_rate', rate(leads.filter((row) => row.campaignId).length, leads.length), 80, leads.filter((row) => row.campaignId).length, leads.length, 'warning'),
      this.metric('order_lead_mapping_rate', rate(new Set(leads.filter((row) => row.orderId).map((row) => String(row.orderId))).size, orders.length), 80, new Set(leads.filter((row) => row.orderId).map((row) => String(row.orderId))).size, orders.length, 'blocked'),
      this.metric('order_service_mapping_rate', rate(orders.filter((row) => row.productId).length, orders.length), 90, orders.filter((row) => row.productId).length, orders.length, 'warning'),
      this.metric('order_customer_mapping_rate', orders.length ? 0 : null, 90, 0, orders.length, 'blocked', 'Order has no durable customerId field.'),
      this.metric('order_profit_completion_rate', rate(orders.filter((row) => Number.isFinite(row.netProfit) && Number.isFinite(row.grossProfit)).length, orders.length), 80, orders.filter((row) => Number.isFinite(row.netProfit) && Number.isFinite(row.grossProfit)).length, orders.length, 'blocked'),
      this.metric('campaign_service_mapping_rate', rate(adGroups.filter((row) => row.productCategoryId || row.selectedProducts?.length).length, adGroups.length), 80, adGroups.filter((row) => row.productCategoryId || row.selectedProducts?.length).length, adGroups.length, 'blocked'),
      this.metric('ads_sync_success_rate', rate(syncRuns.filter((row) => row.status === 'success').length, syncRuns.length), 95, syncRuns.filter((row) => row.status === 'success').length, syncRuns.length, 'blocked'),
      {
        metric: 'ads_data_freshness_hours',
        value: freshnessHours(latestAdsSync),
        unit: 'hours',
        status: latestAdsSync ? (Number(freshnessHours(latestAdsSync)) <= 24 ? 'ok' : 'blocked') : 'missing',
        threshold: 24,
        numerator: null,
        denominator: null,
        warning: latestAdsSync ? null : 'No ads freshness timestamp.',
        value_state: latestAdsSync ? 'available' : 'not_synced',
      },
      {
        metric: 'attribution_confidence',
        value: calculateAttributionConfidence({
          platformAccount: adsData.accounts.length > 0,
          campaign: adsData.campaigns.length > 0,
          adGroup: orders.some((row) => row.adGroupId),
          leadToOrder: leads.some((row) => row.orderId),
          durableCustomer: false,
          freshAdsData: latestAdsSync ? Number(freshnessHours(latestAdsSync)) <= 24 : false,
        }),
        unit: 'score',
        status: 'blocked',
        threshold: 0.8,
        numerator: null,
        denominator: null,
        warning: 'Durable order-customer and full attribution links are missing.',
        value_state: 'weak_mapping',
      },
      this.metric('estimated_vs_realized_profit_rate', rate(orders.filter((row) => row.realizedNetProfit !== undefined && row.realizedNetProfit !== null).length, orders.filter((row) => row.netProfit !== undefined && row.netProfit !== null).length), 80, orders.filter((row) => row.realizedNetProfit !== undefined && row.realizedNetProfit !== null).length, orders.filter((row) => row.netProfit !== undefined && row.netProfit !== null).length, 'warning'),
    ];
    const metricMap = new Map(metrics.map((item) => [item.metric, item]));
    const gate: DecisionGate = {
      can_conclude_profit: this.pass(metricMap.get('order_profit_completion_rate')),
      can_use_ltv_strongly: this.pass(metricMap.get('order_customer_mapping_rate')),
      can_recommend_ads_scale: this.pass(metricMap.get('campaign_service_mapping_rate'))
        && this.pass(metricMap.get('attribution_confidence'))
        && this.pass(metricMap.get('ads_data_freshness_hours')),
      can_generate_action_draft: true,
      can_import_action_file: false,
      can_dry_run: false,
      can_execute_live: false,
      blocking_reasons: metrics.filter((item) => item.status === 'blocked' || item.status === 'missing').map((item) => `${item.metric}: ${item.warning || 'threshold not met'}`),
      warnings: metrics.filter((item) => item.status === 'warning').map((item) => `${item.metric}: ${item.warning || 'below threshold'}`),
    };
    return this.json.attachChecksums({
      metadata: this.metadata.create('data_quality', date, format, generatedBy),
      metrics,
      decision_gate: gate,
      quality: {
        source: 'AI Data Pack quality calculator',
        source_table_or_service: 'ordertest2, marketing_leads, adgroups, google_ads_sync_runs',
        freshness_at: latestAdsSync,
        period: 'custom',
        calculation_method: 'Deterministic V1 mapping/completeness/freshness formulas.',
        data_quality_status: gate.blocking_reasons.length ? 'weak' : 'ok',
        confidence: gate.blocking_reasons.length ? 'low' : 'medium',
        missing_fields: metrics.filter((item) => item.status === 'missing').map((item) => item.metric),
        warning: [...gate.blocking_reasons, ...gate.warnings],
        can_use_for_decision: gate.blocking_reasons.length ? 'cautious' : 'yes',
        data_state: gate.blocking_reasons.length ? 'weak_mapping' : 'available',
        empty_reason: null,
      } as SectionQuality,
    });
  }

  private metric(name: string, value: number | null, threshold: number, numerator: number, denominator: number, failureStatus: 'warning' | 'blocked', warning?: string): DataQualityMetric {
    return {
      metric: name,
      value,
      unit: 'percent',
      status: value === null ? 'missing' : value >= threshold ? 'ok' : failureStatus,
      threshold,
      numerator,
      denominator,
      warning: warning || (value !== null && value < threshold ? `${name} is below ${threshold}.` : null),
      value_state: value === null ? 'no_records_for_report_date' : value === 0 ? 'zero_value' : 'available',
    };
  }

  private pass(metric?: DataQualityMetric): boolean {
    return metric?.status === 'ok';
  }
}
