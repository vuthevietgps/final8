import { Injectable } from '@nestjs/common';
import { MappingReport, MappingSegment } from './contracts/mapping-report.contract';
import { SectionQuality } from './contracts/metadata.contract';
import { DataPackMetadataService } from './data-pack-metadata.service';
import { AdsPerformanceQuery } from './queries/ads-performance.query';
import { LeadFunnelQuery } from './queries/lead-funnel.query';
import { OrderProfitQuery } from './queries/order-profit.query';
import { calculateAttributionConfidence, confidenceLevel, rate } from './utils/confidence.util';
import { freshnessHours } from './utils/freshness.util';
import { JsonExporterService } from './export/json-exporter.service';

@Injectable()
export class MappingReportService {
  constructor(
    private readonly metadata: DataPackMetadataService,
    private readonly orders: OrderProfitQuery,
    private readonly leads: LeadFunnelQuery,
    private readonly ads: AdsPerformanceQuery,
    private readonly json: JsonExporterService,
  ) {}

  async build(date: string, format: 'json' | 'xlsx' = 'json', generatedBy?: unknown): Promise<MappingReport> {
    const [orderData, leadData, adsData] = await Promise.all([this.orders.get(date), this.leads.get(date), this.ads.get(date)]);
    const orders = orderData.orders;
    const leads = leadData.leads;
    const legacy = adsData.legacyAdGroups;
    const products = orderData.products;
    const confidence = calculateAttributionConfidence({
      platformAccount: adsData.accounts.length > 0,
      campaign: adsData.campaigns.length > 0,
      adGroup: orders.some((row) => row.adGroupId),
      adCreative: false,
      keywordOrUtm: false,
      leadToOrder: leads.some((row) => row.orderId),
      durableCustomer: false,
      freshAdsData: adsData.quality.freshness_at ? Number(freshnessHours(adsData.quality.freshness_at)) <= 24 : false,
    });
    const segments: MappingSegment[] = [
      this.segment('ads_platform_to_ads_account', 'ads_platform', 'ads_account', adsData.accounts.filter((row) => row.accountType).length, adsData.accounts.length, 'Ads account platform/type metadata is missing.', 'P0'),
      this.segment('ads_account_to_campaign', 'ads_account', 'campaign', adsData.campaigns.filter((row) => row.customerId).length, adsData.campaigns.length, 'Campaign account/customer mapping is incomplete.', 'P0'),
      this.segment('platform_account_to_campaign', 'ads_account', 'campaign', adsData.campaigns.filter((row) => row.customerId).length, adsData.campaigns.length, 'Missing verified provider account/customer mapping.', 'P0'),
      this.segment('campaign_to_ad_group', 'campaign', 'ad_group', adsData.googleAdGroups.filter((row) => row.campaignId).length, adsData.googleAdGroups.length, 'Campaign metadata is partial outside Google.', 'P1'),
      this.segment('ad_group_to_ad_creative', 'ad_group', 'ad_or_creative', adsData.ads.filter((row) => row.adGroupId).length, adsData.ads.length, 'Multi-channel creative mapping is partial.', 'P1'),
      this.segment('ad_creative_to_keyword_search_term', 'ad_or_creative', 'keyword_or_search_term', 0, adsData.ads.length, 'Search term to ad/lead mapping is unavailable.', 'P1'),
      this.segment('keyword_search_term_to_utm_landing', 'keyword_or_search_term', 'utm_or_landing_page', 0, adsData.keywords.length, 'UTM/search-term tracking is unavailable.', 'P0'),
      this.segment('utm_landing_to_lead', 'utm_or_landing_page', 'lead', 0, leads.length, 'Lead has no durable UTM/landing-page relation.', 'P0'),
      this.segment('ad_group_to_lead', 'ad_group', 'lead', leads.filter((row) => row.adGroupId).length, leads.length, 'Lead ad-group mapping is partial/inferred.', 'P0'),
      this.segment('lead_to_sale', 'lead', 'sale', leads.filter((row) => row.assignedSaleId).length, leads.length, 'Assignment history is unavailable.', 'P1'),
      this.segment('lead_to_customer', 'lead', 'customer', leads.filter((row) => row.customerId).length, leads.length, 'Customer mapping is not durable across orders.', 'P0'),
      this.segment('sale_to_customer', 'sale', 'customer', leads.filter((row) => row.assignedSaleId && row.customerId).length, leads.filter((row) => row.assignedSaleId).length, 'Sale-to-customer relation is only available through partial lead records.', 'P0'),
      this.segment('lead_to_order', 'lead', 'order', leads.filter((row) => row.orderId).length, leads.length, 'Many orders do not retain a durable lead relation.', 'P0'),
      this.segment('order_to_customer', 'order', 'customer', 0, orders.length, 'TestOrder2 has no durable customerId.', 'P0'),
      this.segment('customer_to_order', 'customer', 'order', 0, orders.length, 'TestOrder2 has no durable customerId and Customer only retains latestOrderId.', 'P0'),
      this.segment('order_to_product_variant', 'order', 'product_variant', orders.filter((row) => row.productId).length, orders.length, 'Some orders may not have productId.', 'P0'),
      this.segment('product_variant_to_service_group', 'product_variant', 'service_group', products.filter((row) => row.categoryId).length, products.length, 'ProductCategory is a V1 alias requiring business confirmation.', 'P0'),
      this.segment('ad_group_to_service_group', 'ad_group', 'service_group', legacy.filter((row) => row.productCategoryId || row.selectedProducts?.length).length, legacy.length, 'Ad group product/service mapping is optional.', 'P0'),
      this.segment('order_to_profit', 'order', 'gross_and_net_profit', orders.filter((row) => Number.isFinite(row.grossProfit) && Number.isFinite(row.netProfit)).length, orders.length, 'Cost allocation may still be estimated.', 'P0'),
      this.segment('product_variant_to_revenue', 'product_variant', 'revenue', orders.filter((row) => row.productId).length, orders.length, 'Revenue is order-derived and requires product mapping.', 'P0'),
      this.segment('revenue_to_gross_profit', 'revenue', 'gross_profit', orders.filter((row) => Number.isFinite(row.grossProfit)).length, orders.length, 'Some orders may not have complete gross profit.', 'P0'),
      this.segment('gross_profit_to_net_profit', 'gross_profit', 'net_profit', orders.filter((row) => Number.isFinite(row.grossProfit) && Number.isFinite(row.netProfit)).length, orders.length, 'Net profit may remain estimated until allocations finalize.', 'P0'),
    ];
    return this.json.attachChecksums({
      metadata: this.metadata.create('mapping_report', date, format, generatedBy),
      segments,
      overall_attribution_confidence: confidence,
      quality: {
        source: 'AI Data Pack mapping calculator',
        source_table_or_service: 'ads, marketing_leads, ordertest2, products',
        freshness_at: adsData.quality.freshness_at,
        period: 'custom',
        calculation_method: 'Segment completeness rates plus capped weighted attribution confidence.',
        data_quality_status: confidence >= 0.8 ? 'ok' : 'weak',
        confidence: confidenceLevel(confidence),
        missing_fields: segments.filter((row) => row.mapping_rate === 0 || row.mapping_rate === null).map((row) => row.mapping_segment),
        warning: confidence < 0.8 ? ['Attribution confidence is below 0.8; ads scale/live decisions are blocked.'] : [],
        can_use_for_decision: confidence >= 0.8 ? 'yes' : 'no',
        data_state: confidence >= 0.8 ? 'available' : 'weak_mapping',
        empty_reason: null,
      } as SectionQuality,
    });
  }

  private segment(name: string, source: string, target: string, mapped: number, total: number, reason: string, priority: 'P0' | 'P1' | 'P2'): MappingSegment {
    const mappingRate = rate(mapped, total);
    return {
      mapping_segment: name,
      source_entity: source,
      target_entity: target,
      mapping_rate: mappingRate,
      confidence: mappingRate === null || mappingRate < 50 ? 'low' : mappingRate < 90 ? 'medium' : 'high',
      missing_count: Math.max(0, total - mapped),
      broken_reason: mappingRate === 100 ? null : reason,
      impact: mappingRate === 100 ? 'No material mapping gap detected for this segment.' : 'Downstream analysis must lower confidence or block strong decisions.',
      required_fix_priority: priority,
    };
  }
}
