/**
 * File: facebook-ads-sync/facebook-ads-sync.module.ts
 * Mục đích: Module NestJS cho Facebook Ads Sync
 */
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FacebookAdsSyncService } from './facebook-ads-sync.service';
import { FacebookAdsSyncController } from './facebook-ads-sync.controller';
import { FacebookAdsCronService } from './facebook-ads-cron.service';
import { AdvertisingCostModule } from '../advertising-cost/advertising-cost.module';
import { AdAccountModule } from '../ad-account/ad-account.module';
import { FacebookTokenModule } from '../facebook-token/facebook-token.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000, // 30 seconds timeout for Facebook API calls
      maxRedirects: 5,
    }),
    AdvertisingCostModule, // Import để sử dụng AdvertisingCostService
    AdAccountModule, // Import để sử dụng AdAccountService
    FacebookTokenModule, // Import để sử dụng FacebookTokenService
  ],
  controllers: [FacebookAdsSyncController],
  providers: [
    FacebookAdsSyncService,
    FacebookAdsCronService, // Cron job service
  ],
  exports: [FacebookAdsSyncService], // Export để có thể dùng ở module khác
})
export class FacebookAdsSyncModule {}