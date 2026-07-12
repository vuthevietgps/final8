import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { AdGroup, AdGroupSchema } from '../ad-group/schemas/ad-group.schema';
import { AdsManagerAccount, AdsManagerAccountSchema } from '../ads-manager-account/schemas/ads-manager-account.schema';
import { AdvertisingCost, AdvertisingCostSchema } from '../advertising-cost/schemas/advertising-cost.schema';
import { EmergencyActionLog, EmergencyActionLogSchema } from '../emergency-action/schemas/emergency-action-log.schema';
import { AvailableFundSnapshot, AvailableFundSnapshotSchema } from '../finance/schemas/available-fund-snapshot.schema';
import { BudgetBucket, BudgetBucketSchema } from '../finance/schemas/budget-bucket.schema';
import { AdGroupDailyReport, AdGroupDailyReportSchema } from '../finance/schemas/ad-group-daily-report.schema';
import { GoogleAdsAdGroup, GoogleAdsAdGroupSchema } from '../google-ads/schemas/google-ads-ad-group.schema';
import { GoogleAdsCampaign, GoogleAdsCampaignSchema } from '../google-ads/schemas/google-ads-campaign.schema';
import { GoogleAdsCampaignBudget, GoogleAdsCampaignBudgetSchema } from '../google-ads/schemas/google-ads-campaign-budget.schema';
import { GoogleAdsActionPlan, GoogleAdsActionPlanSchema } from '../google-ads/schemas/google-ads-action-plan.schema';
import { InventorySummary, InventorySummarySchema } from '../inventory/schemas/inventory-summary.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { SupplierPayable, SupplierPayableSchema } from '../supplier-payable/schemas/supplier-payable.schema';
import { SupplierQuote, SupplierQuoteSchema } from '../supplier-quote/schemas/supplier-quote.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { AdsAutomationEvidenceController } from './ads-automation-evidence.controller';
import { AdsAutomationEvidenceService } from './ads-automation-evidence.service';
import { AdsAutomationEvidenceSnapshotStoreService } from './ads-automation-evidence-snapshot-store.service';
import {
  AdsAutomationEvidenceSnapshotRecord,
  AdsAutomationEvidenceSnapshotRecordSchema,
} from './schemas/ads-automation-evidence-snapshot.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
      { name: AdsManagerAccount.name, schema: AdsManagerAccountSchema },
      { name: GoogleAdsAdGroup.name, schema: GoogleAdsAdGroupSchema },
      { name: GoogleAdsCampaign.name, schema: GoogleAdsCampaignSchema },
      { name: GoogleAdsCampaignBudget.name, schema: GoogleAdsCampaignBudgetSchema },
      { name: GoogleAdsActionPlan.name, schema: GoogleAdsActionPlanSchema },
      { name: Product.name, schema: ProductSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: AdGroupDailyReport.name, schema: AdGroupDailyReportSchema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: InventorySummary.name, schema: InventorySummarySchema },
      { name: SupplierQuote.name, schema: SupplierQuoteSchema },
      { name: SupplierPayable.name, schema: SupplierPayableSchema },
      { name: AvailableFundSnapshot.name, schema: AvailableFundSnapshotSchema },
      { name: BudgetBucket.name, schema: BudgetBucketSchema },
      { name: EmergencyActionLog.name, schema: EmergencyActionLogSchema },
      { name: AdsAutomationEvidenceSnapshotRecord.name, schema: AdsAutomationEvidenceSnapshotRecordSchema },
    ]),
  ],
  controllers: [AdsAutomationEvidenceController],
  providers: [AdsAutomationEvidenceService, AdsAutomationEvidenceSnapshotStoreService],
  exports: [AdsAutomationEvidenceService, AdsAutomationEvidenceSnapshotStoreService],
})
export class AdsAutomationEvidenceModule {}
