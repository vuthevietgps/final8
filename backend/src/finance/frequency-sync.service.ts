import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { AdGroup } from '../ad-group/schemas/ad-group.schema';

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
  ) {}

  /**
   * Daily cronjob to sync frequency metrics from Facebook API.
   * Runs at 03:00 AM every day.
   */
  @Cron('0 3 * * *')
  async runDailyFrequencySync() {
    this.logger.log('🔄 Starting daily frequency sync...');
    
    try {
      const activeAdGroups = await this.adGroupModel.find({
        isActive: true,
        provider: 'facebook', // Only Facebook has frequency metrics
      });

      this.logger.log(`Found ${activeAdGroups.length} active Facebook ad groups`);

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

    // Fetch metrics from Facebook API
    const metrics = await this.fetchFrequencyFromFacebook(adGroupId);

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
   * Fetch frequency metrics from Facebook Graph API.
   * 
   * Facebook API Documentation:
   * https://developers.facebook.com/docs/marketing-api/insights
   * 
   * Endpoint:
   * GET /{ad-set-id}/insights?fields=frequency,reach,actions
   * 
   * @param adGroupId - Facebook ad set ID
   * @returns Frequency metrics or null if failed
   */
  private async fetchFrequencyFromFacebook(
    adGroupId: string,
  ): Promise<{ frequency: number; reach: number; audienceSize: number } | null> {
    try {
      // TODO: Implement actual Facebook API call
      // For now, return mock data for development
      
      // Example implementation:
      // const accessToken = await this.getFacebookAccessToken();
      // const response = await fetch(
      //   `https://graph.facebook.com/v18.0/${adGroupId}/insights?fields=frequency,reach&access_token=${accessToken}`
      // );
      // const data = await response.json();
      // 
      // return {
      //   frequency: data.data[0].frequency,
      //   reach: data.data[0].reach,
      //   audienceSize: await this.getTargetingAudienceSize(adGroupId),
      // };

      // MOCK DATA for development (remove when implementing real API)
      this.logger.warn(`⚠️ Using mock data for ad group ${adGroupId} - implement Facebook API`);
      
      return {
        frequency: 1.2 + Math.random() * 2, // Random between 1.2 and 3.2
        reach: Math.floor(50000 + Math.random() * 150000), // Random between 50k and 200k
        audienceSize: Math.floor(500000 + Math.random() * 1500000), // Random between 500k and 2M
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch frequency from Facebook for ${adGroupId}: ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get Facebook access token.
   * 
   * TODO: Implement proper token management:
   * - Store tokens securely in database
   * - Handle token refresh
   * - Support multiple ad accounts
   */
  private async getFacebookAccessToken(): Promise<string> {
    // TODO: Implement token retrieval
    // For now, return placeholder
    return process.env.FACEBOOK_ACCESS_TOKEN || 'PLACEHOLDER_TOKEN';
  }

  /**
   * Get targeting audience size from Facebook.
   * 
   * Facebook API endpoint:
   * GET /{ad-set-id}?fields=targeting_optimization,targeting
   */
  private async getTargetingAudienceSize(adGroupId: string): Promise<number> {
    // TODO: Implement actual API call
    return 1000000; // Default 1M
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

    // Check if ad group has provider field (may not exist in schema)
    // if (adGroup.provider !== 'facebook') {
    //   throw new Error(`Ad group ${adGroupId} is not a Facebook ad group`);
    // }

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
      provider: 'facebook',
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
        provider: 'facebook',
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
