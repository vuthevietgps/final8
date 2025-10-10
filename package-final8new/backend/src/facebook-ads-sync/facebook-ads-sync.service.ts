/**
 * File: facebook-ads-sync/facebook-ads-sync.service.ts
 * Mục đích: Tự động đồng bộ chi phí từ Facebook Marketing API vào advertising-cost
 */
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';
import { AdAccountService } from '../ad-account/ad-account.service';
import { FacebookTokenService } from '../facebook-token/facebook-token.service';

export interface FacebookAdInsight {
  adset_id: string;
  adset_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  cpm: string;
  cpc: string;
  date_start: string;
  date_stop: string;
  account_id: string;
}

export interface FacebookSyncResult {
  success: number;
  failed: number;
  errors: string[];
  synced: Array<{
    adGroupId: string;
    date: string;
    spend: number;
    cpm: number;
    cpc: number;
    impressions: number;
    clicks: number;
  }>;
}

@Injectable()
export class FacebookAdsSyncService {
  private readonly logger = new Logger(FacebookAdsSyncService.name);
  private readonly FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';

  constructor(
    private readonly httpService: HttpService,
    private readonly advertisingCostService: AdvertisingCostService,
    private readonly adAccountService: AdAccountService,
    private readonly facebookTokenService: FacebookTokenService,
  ) {}

  /**
   * Sync chi phí với default token từ database
   */
  async syncWithDefaultToken(dateRange?: { since: string; until: string }): Promise<FacebookSyncResult> {
    const defaultToken = await this.facebookTokenService.getDefaultToken();
    
    if (!defaultToken) {
      throw new Error('No default Facebook token configured. Please add a token first.');
    }

    return this.syncAllAdAccounts(defaultToken, dateRange);
  }

  /**
   * Sync chi phí từ Facebook Marketing API cho tất cả ad accounts
   */
  async syncAllAdAccounts(accessToken: string, dateRange?: { since: string; until: string }): Promise<FacebookSyncResult> {
    this.logger.log('Starting Facebook Ads sync for all ad accounts');
    
    const result: FacebookSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
      synced: []
    };

    try {
      // Lấy danh sách ad accounts từ database
      const adAccounts = await this.adAccountService.findAll();
      this.logger.log(`Found ${adAccounts.length} ad accounts to sync`);

      for (const account of adAccounts) {
        if (account.accountId && account.isActive !== false) {
          try {
            const accountResult = await this.syncAdAccount(
              account.accountId, 
              accessToken, 
              dateRange
            );
            
            result.success += accountResult.success;
            result.failed += accountResult.failed;
            result.errors.push(...accountResult.errors);
            result.synced.push(...accountResult.synced);
            
          } catch (error) {
            this.logger.error(`Failed to sync account ${account.accountId}:`, error);
            result.failed++;
            result.errors.push(`Account ${account.accountId}: ${error.message}`);
          }
        }
      }

      this.logger.log(`Facebook sync completed: ${result.success} success, ${result.failed} failed`);
      return result;

    } catch (error) {
      this.logger.error('Facebook sync failed:', error);
      throw new Error(`Facebook sync failed: ${error.message}`);
    }
  }

  /**
   * Sync chi phí cho một ad account cụ thể
   */
  async syncAdAccount(
    accountId: string, 
    accessToken: string, 
    dateRange?: { since: string; until: string }
  ): Promise<FacebookSyncResult> {
    
    const result: FacebookSyncResult = {
      success: 0,
      failed: 0,
      errors: [],
      synced: []
    };

    try {
      // Default to yesterday if no date range provided
      if (!dateRange) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        dateRange = { since: dateStr, until: dateStr };
      }

      this.logger.log(`Syncing Facebook ads for account ${accountId} from ${dateRange.since} to ${dateRange.until}`);

      // Call Facebook Marketing API to get insights
      const insights = await this.getFacebookInsights(accountId, accessToken, dateRange);
      
      if (!insights || insights.length === 0) {
        this.logger.log(`No insights found for account ${accountId}`);
        return result;
      }

      // Process each adset insight
      for (const insight of insights) {
        try {
          await this.processAdsetInsight(insight);
          result.success++;
          result.synced.push({
            adGroupId: insight.adset_id,
            date: insight.date_start,
            spend: parseFloat(insight.spend) || 0,
            cpm: parseFloat(insight.cpm) || 0,
            cpc: parseFloat(insight.cpc) || 0,
            impressions: parseInt(insight.impressions) || 0,
            clicks: parseInt(insight.clicks) || 0
          });
        } catch (error) {
          this.logger.error(`Failed to process adset ${insight.adset_id}:`, error);
          result.failed++;
          result.errors.push(`Adset ${insight.adset_id}: ${error.message}`);
        }
      }

      return result;

    } catch (error) {
      this.logger.error(`Failed to sync account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Lấy insights từ Facebook Marketing API
   */
  private async getFacebookInsights(
    accountId: string, 
    accessToken: string, 
    dateRange: { since: string; until: string }
  ): Promise<FacebookAdInsight[]> {
    
    const url = `${this.FACEBOOK_API_BASE}/act_${accountId}/insights`;
    const params = {
      access_token: accessToken,
      level: 'adset',
      fields: 'adset_id,adset_name,spend,impressions,clicks,cpm,cpc',
      time_range: JSON.stringify({
        since: dateRange.since,
        until: dateRange.until
      }),
      time_increment: 1, // Daily breakdown
      limit: 1000
    };

    try {
      this.logger.log(`Calling Facebook API: ${url}`);
      const response = await firstValueFrom(
        this.httpService.get(url, { params })
      );

      if (response.data?.data) {
        this.logger.log(`Received ${response.data.data.length} insights from Facebook`);
        return response.data.data;
      }

      this.logger.warn('No data received from Facebook API');
      return [];

    } catch (error) {
      this.logger.error('Facebook API call failed:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Facebook access token is invalid or expired');
      }
      
      if (error.response?.status === 429) {
        throw new Error('Facebook API rate limit exceeded');
      }
      
      throw new Error(`Facebook API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Xử lý và lưu insight của một adset vào database
   */
  private async processAdsetInsight(insight: FacebookAdInsight): Promise<void> {
    const adGroupId = insight.adset_id;
    const date = new Date(insight.date_start);
    const spentAmount = parseFloat(insight.spend) || 0;
    const cpm = parseFloat(insight.cpm) || 0;
    const cpc = parseFloat(insight.cpc) || 0;
    const impressions = parseInt(insight.impressions) || 0;
    const clicks = parseInt(insight.clicks) || 0;

    // Check if record already exists for this date and adset
    const existing = await this.findExistingRecord(adGroupId, date);

    if (existing) {
      // Update existing record
      await this.advertisingCostService.update(existing._id, {
        spentAmount,
        cpm,
        cpc,
        frequency: impressions // Store impressions in frequency field
      });
      
      this.logger.log(`Updated existing record for adset ${adGroupId} on ${date.toISOString().split('T')[0]}`);
    } else {
      // Create new record
      await this.advertisingCostService.create({
        date: date.toISOString(),
        adGroupId,
        spentAmount,
        cpm,
        cpc,
        frequency: impressions // Store impressions in frequency field
      });
      
      this.logger.log(`Created new record for adset ${adGroupId} on ${date.toISOString().split('T')[0]}`);
    }
  }

  /**
   * Tìm record hiện có trong database
   */
  private async findExistingRecord(adGroupId: string, date: Date): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const records = await this.advertisingCostService.findAll({
        adGroupId,
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      });
      
      return records && records.length > 0 ? records[0] : null;
    } catch (error) {
      this.logger.error('Error finding existing record:', error);
      return null;
    }
  }

  /**
   * Sync chi phí của ngày hôm qua (cron job)
   */
  async syncYesterday(accessToken: string): Promise<FacebookSyncResult> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    this.logger.log(`Starting daily sync for ${dateStr}`);
    
    return this.syncAllAdAccounts(accessToken, {
      since: dateStr,
      until: dateStr
    });
  }

  /**
   * Sync chi phí của tuần trước
   */
  async syncLastWeek(accessToken: string): Promise<FacebookSyncResult> {
    const today = new Date();
    const lastWeekStart = new Date(today);
    lastWeekStart.setDate(today.getDate() - 7);
    
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - 1);
    
    const since = lastWeekStart.toISOString().split('T')[0];
    const until = lastWeekEnd.toISOString().split('T')[0];
    
    this.logger.log(`Starting weekly sync from ${since} to ${until}`);
    
    return this.syncAllAdAccounts(accessToken, { since, until });
  }

  /**
   * Sync theo khoảng thời gian tùy chỉnh
   */
  async syncDateRange(
    accessToken: string, 
    since: string, 
    until: string
  ): Promise<FacebookSyncResult> {
    this.logger.log(`Starting custom date range sync from ${since} to ${until}`);
    
    return this.syncAllAdAccounts(accessToken, { since, until });
  }
}