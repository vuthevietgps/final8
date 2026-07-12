import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { AdGroup } from '../ad-group/schemas/ad-group.schema';
import { AdvertisingCostFacebookSyncService } from '../advertising-cost/advertising-cost.facebook-sync.service';
import { AdvertisingCostTiktokSyncService } from '../advertising-cost/advertising-cost.tiktok-sync.service';

/**
 * Frequency Sync Service
 *
 * Responsible for syncing frequency metrics from Facebook Graph API.
 *
 * Frequency = Average number of times each person saw the ad
 * Reach = Number of unique people who saw the ad
 * Audience Size = Total targeting audience size
 *
 * Why Frequency Matters:
 * - Frequency < 1.5: Healthy, audience not saturated
 * - Frequency 1.5-2.5: Moderate, cap scale rate to prevent fatigue
 * - Frequency > 2.5: Saturated, recommend horizontal scaling
 *
 * Facebook API Endpoint:
 * GET /{ad-set-id}/insights?fields=frequency,reach
 *
 * Cronjob Schedule:
 * - Runs daily at 03:00 AM (after auto-scale execution at 02:00 AM)
 * - Updates all active ad groups
 * - Logs sync status and errors
 */
@Injectable()
export class FrequencySyncService {
  private readonly logger = new Logger(FrequencySyncService.name);

  constructor(
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroup>,
    private readonly facebookSyncService: AdvertisingCostFacebookSyncService,
    private readonly tiktokSyncService: AdvertisingCostTiktokSyncService,
  ) {}

  /**
   * Daily cronjob to sync frequency metrics from Facebook API.
   * Runs at 09:00 AM every day (Asia/Ho_Chi_Minh).
   * Chạy sau AutoScale (08:30) để không ảnh hưởng tới quyết định scale.
   */
  @Cron('0 9 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyFrequencySync() {
    this.logger.log('🔄 Starting daily frequency sync...');

    try {
      // Facebook + TikTok both expose frequency/reach metrics
      const activeAdGroups = await this.adGroupModel.find({
        isActive: true,
        platform: { $in: ['facebook', 'tiktok'] },
      });

      const fbCount = activeAdGroups.filter(g => g.platform === 'facebook').length;
      const ttCount = activeAdGroups.filter(g => g.platform === 'tiktok').length;
      this.logger.log(`Found ${activeAdGroups.length} active ad groups (Facebook: ${fbCount}, TikTok: ${ttCount})`);

      let successCount = 0;
      let errorCount = 0;

      for (const adGroup of activeAdGroups) {
        try {
          await this.syncFrequencyForAdGroup(adGroup);
          successCount++;
        } catch (error) {
          errorCount++;
          this.logger.error(
            `Failed to sync frequency for ad group ${adGroup.adGroupId}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `✅ Frequency sync completed. Success: ${successCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      this.logger.error(`❌ Frequency sync failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Sync frequency metrics for a single ad group.
   *
   * @param adGroup - The ad group to sync
   */
  async syncFrequencyForAdGroup(adGroup: AdGroup) {
    const { adGroupId } = adGroup;

    // Yesterday's date — frequency metrics are synced for the previous day
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
    const dayISO = targetDate.toISOString().split('T')[0];

    // Fetch metrics từ API/DB theo từng platform
    const metrics = adGroup.platform === 'tiktok'
      ? await this.fetchFrequencyFromTiktok(adGroupId, dayISO)
      : await this.fetchFrequencyFromFacebook(adGroupId, dayISO);

    if (!metrics) {
      this.logger.warn(`No metrics returned for ad group ${adGroupId}`);
      return;
    }

    // Update ad group with new metrics
    await this.adGroupModel.updateOne(
      { adGroupId: adGroup.adGroupId },
      {
        $set: {
          frequency: metrics.frequency,
          reach: metrics.reach,
          audienceSize: metrics.audienceSize,
          lastFrequencyUpdateAt: new Date(),
        },
      },
    );

    this.logger.debug(
      `✅ Updated frequency for ${adGroupId}: ${metrics.frequency.toFixed(2)}`,
    );
  }

  /**
   * Fetch frequency + reach metrics from Facebook Graph API for a given adset and date.
   * Delegates token management and HTTP logic to AdvertisingCostFacebookSyncService.
   *
   * @param adGroupId - Facebook adset ID stored in AdGroup.adGroupId
   * @param dayISO    - ISO date string 'YYYY-MM-DD' to query
   */
  private async fetchFrequencyFromFacebook(
    adGroupId: string,
    dayISO: string,
  ): Promise<{ frequency: number; reach: number; audienceSize: number } | null> {
    const metrics = await this.facebookSyncService.fetchFrequencyMetrics(adGroupId, dayISO);
    if (!metrics) return null;
    return {
      frequency: metrics.frequency,
      reach: metrics.reach,
      // Targeting audience size requires a separate API call not covered by insights.
      // Set to 0; update via manual process or dedicated audience-size endpoint.
      audienceSize: 0,
    };
  }

  /**
   * Lấy frequency + reach cho một TikTok ad group.
   * Đọc từ collection advertisingcosts (đã được lưu lúc 00:00 bởi TiktokSyncService).
   */
  private async fetchFrequencyFromTiktok(
    adGroupId: string,
    dayISO: string,
  ): Promise<{ frequency: number; reach: number; audienceSize: number } | null> {
    const metrics = await this.tiktokSyncService.fetchFrequencyMetrics(adGroupId, dayISO);
    if (!metrics) return null;
    return { frequency: metrics.frequency, reach: metrics.reach, audienceSize: 0 };
  }

  /**
   * Manual trigger for frequency sync (for specific ad group).
   *
   * @param adGroupId - MongoDB _id of the ad group
   */
  async syncSingleAdGroup(adGroupId: string) {
    this.logger.log(`🔄 Manual sync requested for ad group ${adGroupId}`);

    const adGroup = await this.adGroupModel.findById(adGroupId);

    if (!adGroup) {
      throw new Error(`Ad group ${adGroupId} not found`);
    }

    if (adGroup.platform !== 'facebook' && adGroup.platform !== 'tiktok') {
      throw new Error(`Ad group ${adGroupId} does not support frequency sync (platform: ${adGroup.platform})`);
    }

    await this.syncFrequencyForAdGroup(adGroup);

    return {
      success: true,
      frequency: adGroup.frequency,
      reach: adGroup.reach,
      audienceSize: adGroup.audienceSize,
      lastUpdated: adGroup.lastFrequencyUpdateAt,
    };
  }

  /**
   * Get frequency statistics for all active ad groups.
   *
   * Returns summary:
   * - Total ad groups
   * - Average frequency
   * - High frequency count (>2.5)
   * - Moderate frequency count (1.5-2.5)
   * - Low frequency count (<1.5)
   */
  async getFrequencyStatistics() {
    const adGroups = await this.adGroupModel.find({
      isActive: true,
      platform: { $in: ['facebook', 'tiktok'] },
      frequency: { $exists: true, $ne: null },
    });

    const total = adGroups.length;
    const avgFrequency =
      adGroups.reduce((sum, ag) => sum + (ag.frequency || 0), 0) / total || 0;

    const high = adGroups.filter(ag => ag.frequency >= 2.5).length;
    const moderate = adGroups.filter(ag => ag.frequency >= 1.5 && ag.frequency < 2.5).length;
    const low = adGroups.filter(ag => ag.frequency < 1.5).length;

    return {
      total,
      avgFrequency: parseFloat(avgFrequency.toFixed(2)),
      distribution: {
        high: { count: high, percentage: (high / total * 100).toFixed(1) },
        moderate: { count: moderate, percentage: (moderate / total * 100).toFixed(1) },
        low: { count: low, percentage: (low / total * 100).toFixed(1) },
      },
      recommendations: this.getFrequencyRecommendations(high, moderate, low),
    };
  }

  /**
   * Generate recommendations based on frequency distribution.
   */
  private getFrequencyRecommendations(high: number, moderate: number, low: number): string[] {
    const recommendations: string[] = [];

    if (high > 0) {
      recommendations.push(
        `⚠️ ${high} ad groups have high frequency (>2.5) - Consider horizontal scaling`,
      );
    }

    if (moderate > 0) {
      recommendations.push(
        `📊 ${moderate} ad groups have moderate frequency (1.5-2.5) - Monitor closely`,
      );
    }

    if (low > 0) {
      recommendations.push(
        `✅ ${low} ad groups have low frequency (<1.5) - Safe to scale`,
      );
    }

    return recommendations;
  }

  /**
   * Get ad groups that need horizontal scaling due to high frequency.
   */
  async getHighFrequencyAdGroups() {
    const adGroups = await this.adGroupModel
      .find({
        isActive: true,
        platform: { $in: ['facebook', 'tiktok'] },
        frequency: { $gte: 2.5 },
      })
      .sort({ frequency: -1 });

    return adGroups.map(ag => ({
      adGroupId: ag._id,
      name: ag.name,
      frequency: ag.frequency,
      reach: ag.reach,
      dailyBudget: ag.dailyBudget,
      recommendation: 'HORIZONTAL_SCALE',
    }));
  }
}
