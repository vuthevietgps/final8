/**
 * File: emergency-action/emergency-action.module.ts
 * Mục đích: Module quản lý Emergency Action Logs - lưu trạng thái task khẩn cấp,
 * verification trên platform, cảnh báo quá hạn.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmergencyActionController } from './emergency-action.controller';
import { EmergencyActionService } from './emergency-action.service';
import { EmergencyActionVerificationService } from './emergency-action-verification.service';
import {
  EmergencyActionLog,
  EmergencyActionLogSchema,
} from './schemas/emergency-action-log.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ApiToken, ApiTokenSchema } from '../api-token/schemas/api-token.schema';
import { AdsAlertsModule } from '../ads-alerts/ads-alerts.module';
import { ApiTokenModule } from '../api-token/api-token.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmergencyActionLog.name, schema: EmergencyActionLogSchema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: ApiToken.name, schema: ApiTokenSchema },
    ]),
    AdsAlertsModule,
    ApiTokenModule,
  ],
  controllers: [EmergencyActionController],
  providers: [EmergencyActionService, EmergencyActionVerificationService],
  exports: [EmergencyActionService],
})
export class EmergencyActionModule {}
