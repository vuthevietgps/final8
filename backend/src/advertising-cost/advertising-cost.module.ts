/**
 * File: advertising-cost/advertising-cost.module.ts
 * Mục đích: Module NestJS cho Chi Phí Quảng Cáo.
 */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { AdvertisingCost, AdvertisingCostSchema } from './schemas/advertising-cost.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ChatMessage, ChatMessageSchema } from '../chat-message/schemas/chat-message.schema';
import { AdvertisingCostService } from './advertising-cost.service';
import { AdvertisingCostFacebookSyncService } from './advertising-cost.facebook-sync.service';
import { AdvertisingCostGoogleSyncService } from './advertising-cost.google-sync.service';
import { AdvertisingCostTiktokSyncService } from './advertising-cost.tiktok-sync.service';
import { AdvertisingCostRecalculationQueueService } from './advertising-cost.recalculation-queue.service';
import { ApiToken, ApiTokenSchema } from '../api-token/schemas/api-token.schema';
import { AdvertisingCostController } from './advertising-cost.controller';
import { TestOrder2Module } from '../test-order2/test-order2.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ApiToken.name, schema: ApiTokenSchema },
    ]),
    MulterModule.register({
      dest: './uploads/temp',
    }),
    forwardRef(() => TestOrder2Module), // Import to access TestOrder2Service
  ],
  controllers: [AdvertisingCostController],
  providers: [
    AdvertisingCostService,
    AdvertisingCostFacebookSyncService,
    AdvertisingCostGoogleSyncService,
    AdvertisingCostTiktokSyncService,
    AdvertisingCostRecalculationQueueService,
  ],
  exports: [
    AdvertisingCostService,
    AdvertisingCostFacebookSyncService,
    AdvertisingCostGoogleSyncService,
    AdvertisingCostTiktokSyncService,
    AdvertisingCostRecalculationQueueService,
  ],
})
export class AdvertisingCostModule {}
