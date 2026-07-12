import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { SectionQuality } from '../contracts/metadata.contract';
import { findRows } from './query.util';

@Injectable()
export class AdsPerformanceQuery {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async get(date: string) {
    const [accounts, legacyAdGroups, campaigns, googleAdGroups, keywords, ads, metrics, syncRuns] = await Promise.all([
      findRows(this.connection, 'adaccounts', {}, { accountId: 1, accountType: 1, name: 1, currency: 1, timezoneId: 1, isActive: 1, lastSyncAt: 1, lastSyncStatus: 1 }),
      findRows(this.connection, 'adgroups', {}, { adGroupId: 1, campaignId: 1, platform: 1, adAccountId: 1, productCategoryId: 1, selectedProducts: 1, isActive: 1, lastSyncAt: 1, lastSyncStatus: 1 }),
      findRows(this.connection, 'google_ads_campaigns', {}, { customerId: 1, campaignId: 1, campaignName: 1, status: 1, advertisingChannelType: 1, internalProductId: 1, lastSyncAt: 1 }),
      findRows(this.connection, 'google_ads_ad_groups', {}, { customerId: 1, campaignId: 1, adGroupId: 1, adGroupName: 1, status: 1, internalAdGroupId: 1, internalProductIds: 1, lastSyncAt: 1 }),
      findRows(this.connection, 'google_ads_keywords', {}, { customerId: 1, campaignId: 1, adGroupId: 1, criterionId: 1, keywordText: 1, matchType: 1, status: 1, qualityScore: 1, lastSyncAt: 1 }),
      findRows(this.connection, 'google_ads_ads', {}, { customerId: 1, campaignId: 1, adGroupId: 1, adId: 1, status: 1, creativeAssetId: 1, lastSyncAt: 1 }),
      findRows(this.connection, 'google_ads_daily_metrics', { date }, { date: 1, level: 1, customerId: 1, campaignId: 1, adGroupId: 1, criterionId: 1, adId: 1, costVnd: 1, impressions: 1, clicks: 1, conversions: 1, revenue: 1, grossProfit: 1, netProfit: 1, orders: 1, lastSyncAt: 1 }),
      findRows(this.connection, 'google_ads_sync_runs', {}, { runId: 1, status: 1, startedAt: 1, completedAt: 1, counts: 1, syncErrors: 1 }),
    ]);
    const allFreshness = [...accounts, ...legacyAdGroups, ...campaigns, ...googleAdGroups, ...keywords, ...ads, ...metrics]
      .map((row) => row.lastSyncAt).filter(Boolean);
    const quality: SectionQuality = {
      source: 'Google Ads read-only sync + legacy adgroups/adaccounts',
      source_table_or_service: 'google_ads_* + adgroups + adaccounts',
      freshness_at: allFreshness.length ? new Date(Math.max(...allFreshness.map((value) => new Date(value).getTime()))).toISOString() : null,
      period: 'custom',
      calculation_method: 'Read-only provider metadata and daily metrics.',
      data_quality_status: campaigns.length || legacyAdGroups.length ? 'partial' : 'missing',
      confidence: campaigns.length ? 'medium' : 'low',
      missing_fields: ['search_terms', 'geo_performance', 'device_performance', 'hour_performance', 'audience_performance'],
      warning: ['Multi-channel campaign/ad/keyword detail is partial.'],
      can_use_for_decision: campaigns.length ? 'cautious' : 'no',
      data_state: campaigns.length || legacyAdGroups.length ? 'available' : 'not_synced',
      empty_reason: campaigns.length || legacyAdGroups.length ? null : 'not_synced',
    };
    return { accounts, legacyAdGroups, campaigns, googleAdGroups, keywords, ads, metrics, syncRuns, quality };
  }
}
