/**
 * File: facebook-ads-sync/facebook-ads-cron.service.ts
 * Mục đích: Cron job tự động sync chi phí Facebook Ads hàng ngày
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FacebookAdsSyncService } from './facebook-ads-sync.service';

@Injectable()
export class FacebookAdsCronService {
  private readonly logger = new Logger(FacebookAdsCronService.name);

  constructor(
    private readonly facebookAdsSyncService: FacebookAdsSyncService,
  ) {}

  /**
   * Cron job chạy hàng ngày lúc 9:00 AM để sync chi phí ngày hôm qua
   */
  @Cron('0 9 * * *', {
    name: 'facebook-ads-daily-sync',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailySync() {
    this.logger.log('Starting daily Facebook Ads sync...');
    
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      
      const result = await this.facebookAdsSyncService.syncWithDefaultToken({
        since: dateStr,
        until: dateStr
      });
      
      this.logger.log(`Daily sync completed successfully:`, {
        success: result.success,
        failed: result.failed,
        errors: result.errors.length,
        syncedCount: result.synced.length
      });

      if (result.errors.length > 0) {
        this.logger.warn(`Daily sync had ${result.errors.length} errors:`, result.errors);
      }

    } catch (error) {
      this.logger.error('Daily Facebook sync failed:', error);
    }
  }

  /**
   * Cron job chạy hàng tuần vào Chủ nhật lúc 10:00 AM để sync lại cả tuần
   */
  @Cron('0 10 * * 0', {
    name: 'facebook-ads-weekly-sync',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleWeeklySync() {
    this.logger.log('Starting weekly Facebook Ads sync...');
    
    try {
      const today = new Date();
      const lastWeekStart = new Date(today);
      lastWeekStart.setDate(today.getDate() - 7);
      
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(today.getDate() - 1);
      
      const since = lastWeekStart.toISOString().split('T')[0];
      const until = lastWeekEnd.toISOString().split('T')[0];
      
      const result = await this.facebookAdsSyncService.syncWithDefaultToken({ since, until });
      
      this.logger.log(`Weekly sync completed successfully:`, {
        success: result.success,
        failed: result.failed,
        errors: result.errors.length,
        syncedCount: result.synced.length
      });

      if (result.errors.length > 0) {
        this.logger.warn(`Weekly sync had ${result.errors.length} errors:`, result.errors);
      }

    } catch (error) {
      this.logger.error('Weekly Facebook sync failed:', error);
    }
  }

  /**
   * Manual trigger để test cron job
   */
  async triggerDailySyncManually(): Promise<void> {
    this.logger.log('Manually triggering daily sync...');
    await this.handleDailySync();
  }

  /**
   * Manual trigger để test weekly sync
   */
  async triggerWeeklySyncManually(): Promise<void> {
    this.logger.log('Manually triggering weekly sync...');
    await this.handleWeeklySync();
  }
}