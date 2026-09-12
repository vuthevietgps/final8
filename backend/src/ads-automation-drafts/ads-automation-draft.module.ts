import { Module } from '@nestjs/common';
import { AdsAutomationEvidenceModule } from '../ads-automation-evidence/ads-automation-evidence.module';
import { GoogleAdsModule } from '../google-ads/google-ads.module';
import { MetaAdsModule } from '../meta-ads/meta-ads.module';
import { AdsAutomationDraftController } from './ads-automation-draft.controller';
import { AdsAutomationDraftService } from './ads-automation-draft.service';

@Module({
  imports: [
    AdsAutomationEvidenceModule,
    GoogleAdsModule,
    MetaAdsModule,
  ],
  controllers: [AdsAutomationDraftController],
  providers: [AdsAutomationDraftService],
  exports: [AdsAutomationDraftService],
})
export class AdsAutomationDraftModule {}
