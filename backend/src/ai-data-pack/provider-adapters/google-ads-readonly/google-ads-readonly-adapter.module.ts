import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import axios from "axios";
import {
  AdAccount,
  AdAccountSchema,
} from "../../../ad-account/schemas/ad-account.schema";
import { ApiTokenModule } from "../../../api-token/api-token.module";
import {
  AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER,
  GOOGLE_ADS_READONLY_ASSESSMENT_PORT,
  GOOGLE_ADS_READONLY_AUDIT_PORT,
  GOOGLE_ADS_READONLY_DISTRIBUTED_LOCK_PORT,
  GOOGLE_ADS_READONLY_HTTP_CLIENT,
  GOOGLE_ADS_READONLY_POLICY_CONFIG,
  GOOGLE_ADS_READONLY_RAW_SYNC_PORT,
  GOOGLE_ADS_READONLY_SYNC_PORT,
} from "../provider-adapter.tokens";
import {
  AiDataPackSourceSyncAudit,
  AiDataPackSourceSyncAuditSchema,
} from "../../source-sync/source-sync-audit.schema";
import {
  AiDataPackSourceSyncLock,
  AiDataPackSourceSyncLockSchema,
} from "../../source-sync/source-sync-lock.schema";
import { MongoSourceSyncLockService } from "../../source-sync/mongo-source-sync-lock.service";
import { SourceSyncAuditService } from "../../source-sync/source-sync-audit.service";
import { CoverageGateService } from "../../source-registry/coverage-gate.service";
import { DbWatermarkService } from "../../source-registry/db-watermark.service";
import { FreshnessGateService } from "../../source-registry/freshness-gate.service";
import { SourceRegistryService } from "../../source-registry/source-registry.service";
import { GoogleAdsReadonlySyncService } from "../../../google-ads/google-ads-readonly-sync.service";
import {
  GoogleAdsAd,
  GoogleAdsAdSchema,
} from "../../../google-ads/schemas/google-ads-ad.schema";
import {
  GoogleAdsAdGroup,
  GoogleAdsAdGroupSchema,
} from "../../../google-ads/schemas/google-ads-ad-group.schema";
import {
  GoogleAdsCampaign,
  GoogleAdsCampaignSchema,
} from "../../../google-ads/schemas/google-ads-campaign.schema";
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetSchema,
} from "../../../google-ads/schemas/google-ads-campaign-budget.schema";
import {
  GoogleAdsDailyMetric,
  GoogleAdsDailyMetricSchema,
} from "../../../google-ads/schemas/google-ads-daily-metric.schema";
import {
  GoogleAdsKeyword,
  GoogleAdsKeywordSchema,
} from "../../../google-ads/schemas/google-ads-keyword.schema";
import {
  GoogleAdsSyncRun,
  GoogleAdsSyncRunSchema,
} from "../../../google-ads/schemas/google-ads-sync-run.schema";
import { GoogleAdsReadonlyAdapterService } from "./google-ads-readonly-adapter.service";
import { GoogleAdsReadonlyScopePolicyService } from "./google-ads-readonly-scope-policy.service";
import { GoogleAdsReadonlySyncPortService } from "./google-ads-readonly-sync-port.service";
import { GoogleAdsReadonlySyncPortInstrumentationService } from "./google-ads-readonly-sync-port-instrumentation.service";
import {
  DEFAULT_GOOGLE_ADS_READONLY_POLICY,
  GoogleAdsReadonlySyncPolicyService,
} from "./google-ads-readonly-sync-policy.service";
import { GoogleAdsReadonlyTransportService } from "./google-ads-readonly-transport.service";

const GOOGLE_ADS_READONLY_MODEL_DEFINITIONS = [
  { name: AdAccount.name, schema: AdAccountSchema },
  { name: GoogleAdsCampaign.name, schema: GoogleAdsCampaignSchema },
  { name: GoogleAdsCampaignBudget.name, schema: GoogleAdsCampaignBudgetSchema },
  { name: GoogleAdsAdGroup.name, schema: GoogleAdsAdGroupSchema },
  { name: GoogleAdsKeyword.name, schema: GoogleAdsKeywordSchema },
  { name: GoogleAdsAd.name, schema: GoogleAdsAdSchema },
  { name: GoogleAdsDailyMetric.name, schema: GoogleAdsDailyMetricSchema },
  { name: GoogleAdsSyncRun.name, schema: GoogleAdsSyncRunSchema },
  {
    name: AiDataPackSourceSyncLock.name,
    schema: AiDataPackSourceSyncLockSchema,
  },
  {
    name: AiDataPackSourceSyncAudit.name,
    schema: AiDataPackSourceSyncAuditSchema,
  },
];

@Module({
  imports: [
    ApiTokenModule,
    MongooseModule.forFeature(GOOGLE_ADS_READONLY_MODEL_DEFINITIONS),
  ],
  providers: [
    GoogleAdsReadonlySyncService,
    GoogleAdsReadonlySyncPortService,
    {
      provide: GOOGLE_ADS_READONLY_RAW_SYNC_PORT,
      useExisting: GoogleAdsReadonlySyncPortService,
    },
    {
      provide: GOOGLE_ADS_READONLY_POLICY_CONFIG,
      useValue: DEFAULT_GOOGLE_ADS_READONLY_POLICY,
    },
    {
      provide: GOOGLE_ADS_READONLY_HTTP_CLIENT,
      useFactory: () =>
        axios.create({
          baseURL: "https://googleads.googleapis.com",
          timeout: DEFAULT_GOOGLE_ADS_READONLY_POLICY.requestTimeoutMs,
        }),
    },
    SourceRegistryService,
    DbWatermarkService,
    CoverageGateService,
    FreshnessGateService,
    {
      provide: GOOGLE_ADS_READONLY_ASSESSMENT_PORT,
      useExisting: FreshnessGateService,
    },
    MongoSourceSyncLockService,
    {
      provide: GOOGLE_ADS_READONLY_DISTRIBUTED_LOCK_PORT,
      useExisting: MongoSourceSyncLockService,
    },
    SourceSyncAuditService,
    {
      provide: GOOGLE_ADS_READONLY_AUDIT_PORT,
      useExisting: SourceSyncAuditService,
    },
    GoogleAdsReadonlySyncPortInstrumentationService,
    {
      provide: GOOGLE_ADS_READONLY_SYNC_PORT,
      useExisting: GoogleAdsReadonlySyncPortInstrumentationService,
    },
    GoogleAdsReadonlyTransportService,
    GoogleAdsReadonlySyncPolicyService,
    GoogleAdsReadonlyScopePolicyService,
    GoogleAdsReadonlyAdapterService,
    {
      provide: AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER,
      useExisting: GoogleAdsReadonlyAdapterService,
    },
  ],
  exports: [AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER],
})
export class GoogleAdsReadonlyAdapterModule {}
