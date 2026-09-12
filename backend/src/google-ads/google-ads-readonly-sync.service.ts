import { Injectable, Logger, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Model } from "mongoose";
import {
  AdAccount,
  AdAccountDocument,
} from "../ad-account/schemas/ad-account.schema";
import { GoogleAdsReadonlyQueryTemplateId } from "../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-query-templates";
import { DEFAULT_GOOGLE_ADS_READONLY_POLICY } from "../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-sync-policy.service";
import {
  createDefaultGoogleAdsReadonlyTransportService,
  GoogleAdsReadonlyTransportService,
} from "../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-transport.service";
import {
  GoogleAdsReadonlyWriteTelemetry,
  validateGoogleAdsReadonlyWriteTelemetry,
} from "../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-write-telemetry";
import { ApiTokenService } from "../api-token/api-token.service";
import { redactSecretString } from "../common/utils/secret-redaction.util";
import {
  GoogleAdsAd,
  GoogleAdsAdDocument,
} from "./schemas/google-ads-ad.schema";
import {
  GoogleAdsAdGroup,
  GoogleAdsAdGroupDocument,
} from "./schemas/google-ads-ad-group.schema";
import {
  GoogleAdsCampaign,
  GoogleAdsCampaignDocument,
} from "./schemas/google-ads-campaign.schema";
import {
  GoogleAdsCampaignBudget,
  GoogleAdsCampaignBudgetDocument,
} from "./schemas/google-ads-campaign-budget.schema";
import {
  GoogleAdsCampaignCriterion,
  GoogleAdsCampaignCriterionDocument,
} from "./schemas/google-ads-campaign-criterion.schema";
import {
  GoogleAdsCampaignConversionGoal,
  GoogleAdsCampaignConversionGoalDocument,
} from "./schemas/google-ads-campaign-conversion-goal.schema";
import {
  GoogleAdsConversionAction,
  GoogleAdsConversionActionDocument,
} from "./schemas/google-ads-conversion-action.schema";
import {
  GoogleAdsConversionGoalCampaignConfig,
  GoogleAdsConversionGoalCampaignConfigDocument,
} from "./schemas/google-ads-conversion-goal-campaign-config.schema";
import {
  GoogleAdsDailyMetric,
  GoogleAdsDailyMetricDocument,
  GoogleAdsMetricLevel,
} from "./schemas/google-ads-daily-metric.schema";
import {
  GoogleAdsKeyword,
  GoogleAdsKeywordDocument,
} from "./schemas/google-ads-keyword.schema";
import {
  GoogleAdsSyncRun,
  GoogleAdsSyncRunDocument,
} from "./schemas/google-ads-sync-run.schema";
import { GoogleAdsProfitEnrichmentService } from "./google-ads-profit-enrichment.service";

type SyncCountKey =
  | "accounts"
  | "campaigns"
  | "campaignBudgets"
  | "campaignCriteria"
  | "conversionActions"
  | "campaignConversionGoals"
  | "conversionGoalCampaignConfigs"
  | "adGroups"
  | "keywords"
  | "ads"
  | "dailyMetricsCampaign"
  | "dailyMetricsAdGroup"
  | "dailyMetricsKeyword"
  | "dailyMetricsAd";

export interface GoogleAdsReadonlySyncResult {
  runId: string;
  status: "success" | "partial" | "failed";
  startedAt: Date;
  completedAt: Date;
  dateFrom: string;
  dateTo: string;
  customerIds: string[];
  counts: Record<SyncCountKey, number>;
  errors: Array<{ customerId?: string; step?: string; message: string }>;
}

export interface GoogleAdsReadonlySyncTelemetryResult extends GoogleAdsReadonlySyncResult {
  writeTelemetry: readonly GoogleAdsReadonlyWriteTelemetry[];
}

type GoogleAdsReadonlySyncContext = {
  allowedCustomerIds: string[];
  absoluteDeadlineAt: string;
  writeTelemetry: GoogleAdsReadonlyWriteTelemetry[];
  conversionActionRows: Map<string, Promise<any[]>>;
};

const METRIC_TEMPLATE_BY_LEVEL: Record<
  GoogleAdsMetricLevel,
  GoogleAdsReadonlyQueryTemplateId
> = {
  campaign: "metrics_campaign",
  ad_group: "metrics_ad_group",
  keyword: "metrics_keyword",
  ad: "metrics_ad",
};

@Injectable()
export class GoogleAdsReadonlySyncService {
  private readonly logger = new Logger(GoogleAdsReadonlySyncService.name);
  private fallbackReadonlyTransport?: GoogleAdsReadonlyTransportService;

  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @InjectModel(GoogleAdsCampaign.name)
    private readonly campaignModel: Model<GoogleAdsCampaignDocument>,
    @InjectModel(GoogleAdsCampaignBudget.name)
    private readonly campaignBudgetModel: Model<GoogleAdsCampaignBudgetDocument>,
    @InjectModel(GoogleAdsAdGroup.name)
    private readonly googleAdGroupModel: Model<GoogleAdsAdGroupDocument>,
    @InjectModel(GoogleAdsKeyword.name)
    private readonly keywordModel: Model<GoogleAdsKeywordDocument>,
    @InjectModel(GoogleAdsAd.name)
    private readonly adModel: Model<GoogleAdsAdDocument>,
    @InjectModel(GoogleAdsDailyMetric.name)
    private readonly dailyMetricModel: Model<GoogleAdsDailyMetricDocument>,
    @InjectModel(GoogleAdsSyncRun.name)
    private readonly syncRunModel: Model<GoogleAdsSyncRunDocument>,
    private readonly apiTokenService: ApiTokenService,
    private readonly profitEnrichmentService: GoogleAdsProfitEnrichmentService,
    @Optional()
    private readonly readonlyTransport?: GoogleAdsReadonlyTransportService,
    @Optional()
    @InjectModel(GoogleAdsCampaignCriterion.name)
    private readonly campaignCriterionModel?: Model<GoogleAdsCampaignCriterionDocument>,
    @Optional()
    @InjectModel(GoogleAdsConversionAction.name)
    private readonly conversionActionModel?: Model<GoogleAdsConversionActionDocument>,
    @Optional()
    @InjectModel(GoogleAdsCampaignConversionGoal.name)
    private readonly campaignConversionGoalModel?: Model<GoogleAdsCampaignConversionGoalDocument>,
    @Optional()
    @InjectModel(GoogleAdsConversionGoalCampaignConfig.name)
    private readonly conversionGoalCampaignConfigModel?: Model<GoogleAdsConversionGoalCampaignConfigDocument>,
  ) {}

  async sync(params?: {
    customerIds?: string[];
    dateFrom?: string;
    dateTo?: string;
  }): Promise<GoogleAdsReadonlySyncResult> {
    const { writeTelemetry: _writeTelemetry, ...result } =
      await this.syncWithTelemetry(params);
    return result;
  }

  async syncWithTelemetry(params?: {
    customerIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    absoluteDeadlineAt?: string;
  }): Promise<GoogleAdsReadonlySyncTelemetryResult> {
    const startedAt = new Date();
    const runId = `GAS-${startedAt
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)}-${randomUUID().slice(0, 8)}`;
    const dateTo = this.normalizeDate(params?.dateTo || this.yesterdayIso());
    const dateFrom = this.normalizeDate(params?.dateFrom || dateTo);
    const absoluteDeadlineAt =
      params?.absoluteDeadlineAt ||
      new Date(
        Date.now() + DEFAULT_GOOGLE_ADS_READONLY_POLICY.totalDeadlineMs,
      ).toISOString();
    const requestedIds = new Set(
      (params?.customerIds || [])
        .map((id) => this.sanitizeId(id))
        .filter(Boolean) as string[],
    );
    const accounts = await this.adAccountModel
      .find({ accountType: "google", isActive: true })
      .lean();
    const selectedAccounts = requestedIds.size
      ? accounts.filter((account) =>
          requestedIds.has(this.sanitizeId(String(account.accountId)) || ""),
        )
      : accounts;
    const customerIds = selectedAccounts
      .map((account) => this.sanitizeId(String(account.accountId)))
      .filter(Boolean) as string[];
    const counts = this.emptyCounts();
    const errors: Array<{
      customerId?: string;
      step?: string;
      message: string;
    }> = [];
    const writeTelemetry: GoogleAdsReadonlyWriteTelemetry[] = [];
    const context: GoogleAdsReadonlySyncContext = {
      allowedCustomerIds: customerIds,
      absoluteDeadlineAt,
      writeTelemetry,
      conversionActionRows: new Map(),
    };

    await this.recordWrite(
      writeTelemetry,
      {
        targetCollection: "google_ads_sync_runs",
        operationType: "insert",
        recordCount: 1,
        deleteAttempted: false,
        sourceStep: "sync_run_start",
      },
      () =>
        this.syncRunModel.create({
          runId,
          status: "running",
          startedAt,
          dateFrom,
          dateTo,
          customerIds,
          counts,
          syncErrors: errors,
        }),
    );

    if (!selectedAccounts.length) {
      errors.push({
        step: "accounts",
        message: "No active Google Ads accounts matched the sync request.",
      });
    }

    for (const account of selectedAccounts) {
      const customerId = this.sanitizeId(String(account.accountId));
      if (!customerId) {
        errors.push({
          step: "account",
          message: `Invalid Google Ads customer ID: ${account.accountId}`,
        });
        continue;
      }

      const steps: Array<
        [string, () => Promise<Partial<Record<SyncCountKey, number>>>]
      > = [
        [
          "account",
          () => this.syncCustomer(account as any, customerId, context),
        ],
        [
          "campaigns",
          () => this.syncCampaigns(account as any, customerId, context),
        ],
        [
          "campaignBudgets",
          () => this.syncCampaignBudgets(account as any, customerId, context),
        ],
        [
          "campaignCriteria",
          () => this.syncCampaignCriteria(account as any, customerId, context),
        ],
        [
          "conversionActions",
          () => this.syncConversionActions(account as any, customerId, context),
        ],
        [
          "campaignConversionGoals",
          () => this.syncCampaignConversionGoals(account as any, customerId, context),
        ],
        [
          "conversionGoalCampaignConfigs",
          () => this.syncConversionGoalCampaignConfigs(
            account as any,
            customerId,
            context,
          ),
        ],
        [
          "adGroups",
          () => this.syncAdGroups(account as any, customerId, context),
        ],
        [
          "keywords",
          () => this.syncKeywords(account as any, customerId, context),
        ],
        [
          "ads",
          () =>
            this.syncResponsiveSearchAds(account as any, customerId, context),
        ],
        [
          "dailyMetricsCampaign",
          () =>
            this.syncMetrics(
              account as any,
              customerId,
              "campaign",
              dateFrom,
              dateTo,
              context,
            ),
        ],
        [
          "dailyMetricsAdGroup",
          () =>
            this.syncMetrics(
              account as any,
              customerId,
              "ad_group",
              dateFrom,
              dateTo,
              context,
            ),
        ],
        [
          "dailyMetricsKeyword",
          () =>
            this.syncMetrics(
              account as any,
              customerId,
              "keyword",
              dateFrom,
              dateTo,
              context,
            ),
        ],
        [
          "dailyMetricsAd",
          () =>
            this.syncMetrics(
              account as any,
              customerId,
              "ad",
              dateFrom,
              dateTo,
              context,
            ),
        ],
      ];

      for (const [step, execute] of steps) {
        try {
          const result = await execute();
          for (const [key, value] of Object.entries(result)) {
            counts[key as SyncCountKey] += Number(value || 0);
          }
        } catch (error: any) {
          errors.push({
            customerId,
            step,
            message: redactSecretString(error?.message || String(error)),
          });
        }
      }
    }

    if (customerIds.length) {
      try {
        const enrichment = await this.profitEnrichmentService.enrich({
          customerIds,
          dateFrom,
          dateTo,
        });
        if (enrichment.updatedMetrics > 0) {
          const [telemetry] = validateGoogleAdsReadonlyWriteTelemetry([{
            targetCollection: "google_ads_daily_metrics",
            operationType: "update",
            recordCount: enrichment.updatedMetrics,
            deleteAttempted: false,
            sourceStep: "erp_profit_enrichment",
          }]);
          writeTelemetry.push(telemetry);
        }
      } catch (error: any) {
        errors.push({
          step: "erp_profit_enrichment",
          message: redactSecretString(error?.message || String(error)),
        });
      }
    }

    const completedAt = new Date();
    const status = errors.length
      ? Object.values(counts).some((value) => value > 0)
        ? "partial"
        : "failed"
      : "success";
    await this.recordWrite(
      writeTelemetry,
      {
        targetCollection: "google_ads_sync_runs",
        operationType: "update",
        recordCount: 1,
        deleteAttempted: false,
        sourceStep: "sync_run_finish",
      },
      () =>
        this.syncRunModel.updateOne(
          { runId },
          { $set: { status, completedAt, counts, syncErrors: errors } },
        ),
    );
    this.logger.log(
      `Google Ads read-only sync ${runId} completed with status=${status}`,
    );

    return {
      runId,
      status,
      startedAt,
      completedAt,
      dateFrom,
      dateTo,
      customerIds,
      counts,
      errors,
      writeTelemetry,
    };
  }

  async getLatestRun() {
    return this.syncRunModel.findOne().sort({ startedAt: -1 }).lean();
  }

  private async syncCustomer(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    const rows = await this.searchRows(account, customerId, context, "account");
    const customer = rows[0]?.customer;
    if (!customer) return { accounts: 0 };
    const conversion = customer.conversionTrackingSetting
      || customer.conversion_tracking_setting
      || {};
    const googleAdsConversionCustomer =
      conversion.googleAdsConversionCustomer
      || conversion.google_ads_conversion_customer;
    const conversionCustomerId = this.idFromResourceName(
      googleAdsConversionCustomer,
    );
    if (conversionCustomerId) {
      // This ID is provider-returned canonical scope, not caller input. It is
      // required for retrieving ConversionAction evidence under cross-account
      // conversion tracking.
      (account as any).googleAdsConversionCustomer =
        googleAdsConversionCustomer;
      if (!context.allowedCustomerIds.includes(conversionCustomerId)) {
        context.allowedCustomerIds.push(conversionCustomerId);
      }
    }

    await this.recordWrite(
      context.writeTelemetry,
      {
        targetCollection: "adaccounts.approved_sync_metadata",
        operationType: "update",
        recordCount: 1,
        deleteAttempted: false,
        sourceStep: "account",
      },
      () =>
        this.adAccountModel.updateOne(
          { _id: account._id },
          {
            $set: {
              name:
                customer.descriptiveName ||
                customer.descriptive_name ||
                account.name,
              currency: customer.currencyCode || customer.currency_code,
              timezoneId: customer.timeZone || customer.time_zone,
              conversionTrackingStatus:
                conversion.conversionTrackingStatus
                || conversion.conversion_tracking_status,
              googleAdsConversionCustomer,
              conversionTrackingId: this.optionalId(
                conversion.conversionTrackingId
                ?? conversion.conversion_tracking_id,
              ),
              crossAccountConversionTrackingId: this.optionalId(
                conversion.crossAccountConversionTrackingId
                ?? conversion.cross_account_conversion_tracking_id,
              ),
              acceptedCustomerDataTerms:
                conversion.acceptedCustomerDataTerms
                ?? conversion.accepted_customer_data_terms,
              enhancedConversionsForLeadsEnabled:
                conversion.enhancedConversionsForLeadsEnabled
                ?? conversion.enhanced_conversions_for_leads_enabled,
              lastSyncAt: new Date(),
              lastSyncStatus: "ok",
              lastSyncError: undefined,
            },
          },
        ),
    );
    return { accounts: 1 };
  }

  private async syncCampaigns(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "campaigns",
    );
    const now = new Date();
    const documents = rows
      .map((row) => {
        const campaign = row.campaign || {};
        const campaignBudgetResourceName =
          campaign.campaignBudget || campaign.campaign_budget;
        const networkSettings = campaign.networkSettings || campaign.network_settings || {};
        const geoTargetTypeSetting = campaign.geoTargetTypeSetting || campaign.geo_target_type_setting || {};
        const targetSpend = campaign.targetSpend || campaign.target_spend || {};
        const maximizeConversions =
          campaign.maximizeConversions || campaign.maximize_conversions || {};
        return {
          customerId,
          campaignId: this.optionalId(campaign.id),
          resourceName: campaign.resourceName || campaign.resource_name,
          campaignName: campaign.name,
          status: campaign.status,
          advertisingChannelType:
            campaign.advertisingChannelType ||
            campaign.advertising_channel_type,
          biddingStrategyType:
            campaign.biddingStrategyType || campaign.bidding_strategy_type,
          biddingStrategySystemStatus:
            campaign.biddingStrategySystemStatus
            || campaign.bidding_strategy_system_status,
          biddingStrategyResourceName:
            campaign.biddingStrategy || campaign.bidding_strategy || null,
          targetSpendCpcBidCeilingMicros: this.number(
            targetSpend.cpcBidCeilingMicros
            ?? targetSpend.cpc_bid_ceiling_micros,
          ),
          maximizeConversionsTargetCpaMicros: this.number(
            maximizeConversions.targetCpaMicros
            ?? maximizeConversions.target_cpa_micros,
          ),
          campaignBudgetId: this.idFromResourceName(campaignBudgetResourceName),
          campaignBudgetResourceName,
          startDate: campaign.startDate || campaign.start_date,
          endDate: campaign.endDate || campaign.end_date,
          targetGoogleSearch:
            networkSettings.targetGoogleSearch ?? networkSettings.target_google_search,
          targetSearchNetwork:
            networkSettings.targetSearchNetwork ?? networkSettings.target_search_network,
          targetContentNetwork:
            networkSettings.targetContentNetwork ?? networkSettings.target_content_network,
          targetPartnerSearchNetwork:
            networkSettings.targetPartnerSearchNetwork ?? networkSettings.target_partner_search_network,
          positiveGeoTargetType:
            geoTargetTypeSetting.positiveGeoTargetType
            || geoTargetTypeSetting.positive_geo_target_type,
          negativeGeoTargetType:
            geoTargetTypeSetting.negativeGeoTargetType
            || geoTargetTypeSetting.negative_geo_target_type,
          containsEuPoliticalAdvertising:
            campaign.containsEuPoliticalAdvertising
            || campaign.contains_eu_political_advertising,
          lastSyncAt: now,
        };
      })
      .filter((doc) => doc.campaignId && doc.resourceName);
    return {
      campaigns: await this.upsertMany(
        this.campaignModel,
        documents,
        ["customerId", "campaignId"],
        context.writeTelemetry,
        "google_ads_campaigns",
        "campaigns",
      ),
    };
  }

  private async syncCampaignBudgets(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "campaign_budgets",
    );
    const now = new Date();
    const documents = rows
      .map((row) => {
        const budget = row.campaignBudget || row.campaign_budget || {};
        const amountMicros = this.number(
          budget.amountMicros ?? budget.amount_micros,
        );
        return {
          customerId,
          campaignBudgetId: this.optionalId(budget.id),
          resourceName: budget.resourceName || budget.resource_name,
          name: budget.name,
          amountMicros,
          amountVnd: amountMicros / 1_000_000,
          deliveryMethod: budget.deliveryMethod || budget.delivery_method,
          explicitlyShared: Boolean(
            budget.explicitlyShared ?? budget.explicitly_shared,
          ),
          status: budget.status,
          lastSyncAt: now,
        };
      })
      .filter((doc) => doc.campaignBudgetId && doc.resourceName);
    return {
      campaignBudgets: await this.upsertMany(
        this.campaignBudgetModel,
        documents,
        ["customerId", "campaignBudgetId"],
        context.writeTelemetry,
        "google_ads_campaign_budgets",
        "campaign_budgets",
      ),
    };
  }

  private async syncCampaignCriteria(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    if (!this.campaignCriterionModel) return { campaignCriteria: 0 };
    const rows = await this.searchRows(account, customerId, context, "campaign_criteria");
    const now = new Date();
    const documents = rows.map((row) => {
      const criterion = row.campaignCriterion || row.campaign_criterion || {};
      const location = criterion.location || {};
      const language = criterion.language || {};
      const type = String(criterion.type || '').toUpperCase();
      const targetResource = type === 'LOCATION'
        ? location.geoTargetConstant || location.geo_target_constant
        : language.languageConstant || language.language_constant;
      return {
        customerId,
        campaignId: this.optionalId(row.campaign?.id),
        resourceName: criterion.resourceName || criterion.resource_name,
        criterionType: type,
        negative: criterion.negative === true,
        targetConstantId: this.idFromResourceName(targetResource),
        status: criterion.status,
        lastSyncAt: now,
      };
    }).filter((doc) => doc.campaignId && doc.resourceName
      && ['LOCATION', 'LANGUAGE'].includes(doc.criterionType)
      && doc.targetConstantId);
    return {
      campaignCriteria: await this.upsertMany(
        this.campaignCriterionModel,
        documents,
        ["customerId", "resourceName"],
        context.writeTelemetry,
        "google_ads_campaign_criteria",
        "campaign_criteria",
      ),
    };
  }

  private async syncConversionActions(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    if (!this.conversionActionModel) return { conversionActions: 0 };
    const conversionCustomerId = this.idFromResourceName(
      (account as any).googleAdsConversionCustomer,
    ) || customerId;
    const cacheKey = [
      conversionCustomerId,
      this.sanitizeId(String(account.loginCustomerId || "")) || "",
    ].join(":");
    let rowsPromise = context.conversionActionRows.get(cacheKey);
    if (!rowsPromise) {
      rowsPromise = this.searchRows(
        account,
        conversionCustomerId,
        context,
        "conversion_actions",
      );
      context.conversionActionRows.set(cacheKey, rowsPromise);
    }
    const rows = await rowsPromise;
    const now = new Date();
    const documents = rows.map((row) => {
      const action = row.conversionAction || row.conversion_action || {};
      const resourceName = action.resourceName || action.resource_name;
      const ownerCustomer = action.ownerCustomer || action.owner_customer;
      return {
        customerId,
        conversionActionId:
          this.optionalId(action.id) || this.idFromResourceName(resourceName),
        resourceName,
        ownerCustomerId:
          this.idFromResourceName(ownerCustomer)
          || this.idFromResourceName(resourceName),
        name: action.name,
        status: action.status,
        type: action.type,
        category: action.category,
        origin: action.origin,
        primaryForGoal:
          action.primaryForGoal ?? action.primary_for_goal,
        lastSyncAt: now,
      };
    }).filter((document) => document.conversionActionId && document.resourceName);
    return {
      conversionActions: await this.upsertMany(
        this.conversionActionModel,
        documents,
        ["customerId", "conversionActionId"],
        context.writeTelemetry,
        "google_ads_conversion_actions",
        "conversion_actions",
      ),
    };
  }

  private async syncCampaignConversionGoals(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    if (!this.campaignConversionGoalModel) return { campaignConversionGoals: 0 };
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "campaign_conversion_goals",
    );
    const now = new Date();
    const documents = rows.map((row) => {
      const goal = row.campaignConversionGoal || row.campaign_conversion_goal || {};
      const campaignResource = goal.campaign
        || row.campaign?.resourceName
        || row.campaign?.resource_name;
      return {
        customerId,
        campaignId:
          this.optionalId(row.campaign?.id)
          || this.idFromResourceName(campaignResource),
        resourceName: goal.resourceName || goal.resource_name,
        category: goal.category,
        origin: goal.origin,
        biddable: goal.biddable === true,
        lastSyncAt: now,
      };
    }).filter((document) => (
      document.campaignId
      && document.resourceName
      && document.category
      && document.origin
    ));
    return {
      campaignConversionGoals: await this.upsertMany(
        this.campaignConversionGoalModel,
        documents,
        ["customerId", "campaignId", "category", "origin"],
        context.writeTelemetry,
        "google_ads_campaign_conversion_goals",
        "campaign_conversion_goals",
      ),
    };
  }

  private async syncConversionGoalCampaignConfigs(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    if (!this.conversionGoalCampaignConfigModel) {
      return { conversionGoalCampaignConfigs: 0 };
    }
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "conversion_goal_campaign_configs",
    );
    const now = new Date();
    const documents = rows.map((row) => {
      const config =
        row.conversionGoalCampaignConfig
        || row.conversion_goal_campaign_config
        || {};
      const campaignResource = config.campaign
        || row.campaign?.resourceName
        || row.campaign?.resource_name;
      return {
        customerId,
        campaignId:
          this.optionalId(row.campaign?.id)
          || this.idFromResourceName(campaignResource),
        resourceName: config.resourceName || config.resource_name,
        goalConfigLevel:
          config.goalConfigLevel || config.goal_config_level,
        customConversionGoalResourceName:
          config.customConversionGoal
          || config.custom_conversion_goal
          || null,
        lastSyncAt: now,
      };
    }).filter((document) => document.campaignId && document.resourceName);
    return {
      conversionGoalCampaignConfigs: await this.upsertMany(
        this.conversionGoalCampaignConfigModel,
        documents,
        ["customerId", "campaignId"],
        context.writeTelemetry,
        "google_ads_conversion_goal_campaign_configs",
        "conversion_goal_campaign_configs",
      ),
    };
  }

  private async syncAdGroups(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "ad_groups",
    );
    const now = new Date();
    const documents = rows
      .map((row) => {
        const campaign = row.campaign || {};
        const adGroup = row.adGroup || row.ad_group || {};
        return {
          customerId,
          campaignId: this.optionalId(campaign.id),
          adGroupId: this.optionalId(adGroup.id),
          resourceName: adGroup.resourceName || adGroup.resource_name,
          adGroupName: adGroup.name,
          status: adGroup.status,
          type: adGroup.type,
          cpcBidMicros: this.number(
            adGroup.cpcBidMicros ?? adGroup.cpc_bid_micros,
          ),
          lastSyncAt: now,
        };
      })
      .filter((doc) => doc.campaignId && doc.adGroupId && doc.resourceName);
    return {
      adGroups: await this.upsertMany(
        this.googleAdGroupModel,
        documents,
        ["customerId", "adGroupId"],
        context.writeTelemetry,
        "google_ads_ad_groups",
        "ad_groups",
      ),
    };
  }

  private async syncKeywords(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "keywords",
    );
    const now = new Date();
    const documents = rows
      .map((row) => {
        const criterion = row.adGroupCriterion || row.ad_group_criterion || {};
        const keyword = criterion.keyword || {};
        const qualityInfo =
          criterion.qualityInfo || criterion.quality_info || {};
        return {
          customerId,
          campaignId: this.optionalId(row.campaign?.id),
          adGroupId: this.optionalId((row.adGroup || row.ad_group)?.id),
          criterionId: this.optionalId(
            criterion.criterionId ?? criterion.criterion_id,
          ),
          resourceName: criterion.resourceName || criterion.resource_name,
          keywordText: keyword.text,
          matchType: keyword.matchType || keyword.match_type,
          negative: Boolean(criterion.negative),
          status: criterion.status,
          cpcBidMicros: this.number(
            criterion.cpcBidMicros ?? criterion.cpc_bid_micros,
          ),
          finalUrls: Array.isArray(criterion.finalUrls || criterion.final_urls)
            ? criterion.finalUrls || criterion.final_urls
            : [],
          qualityScore: this.number(
            qualityInfo.qualityScore ?? qualityInfo.quality_score,
          ),
          lastSyncAt: now,
        };
      })
      .filter(
        (doc) =>
          doc.campaignId &&
          doc.adGroupId &&
          doc.criterionId &&
          doc.resourceName &&
          doc.keywordText,
      );
    return {
      keywords: await this.upsertMany(
        this.keywordModel,
        documents,
        ["customerId", "adGroupId", "criterionId"],
        context.writeTelemetry,
        "google_ads_keywords",
        "keywords",
      ),
    };
  }

  private async syncResponsiveSearchAds(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
  ) {
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      "responsive_search_ads",
    );
    const now = new Date();
    const documents = rows
      .map((row) => {
        const adGroupAd = row.adGroupAd || row.ad_group_ad || {};
        const ad = adGroupAd.ad || {};
        const rsa = ad.responsiveSearchAd || ad.responsive_search_ad || {};
        const policy =
          adGroupAd.policySummary || adGroupAd.policy_summary || {};
        return {
          customerId,
          campaignId: this.optionalId(row.campaign?.id),
          adGroupId: this.optionalId((row.adGroup || row.ad_group)?.id),
          adId: this.optionalId(ad.id),
          resourceName: adGroupAd.resourceName || adGroupAd.resource_name,
          adType: ad.type,
          status: adGroupAd.status,
          headlines: Array.isArray(rsa.headlines) ? rsa.headlines : [],
          descriptions: Array.isArray(rsa.descriptions) ? rsa.descriptions : [],
          finalUrls: Array.isArray(ad.finalUrls || ad.final_urls)
            ? ad.finalUrls || ad.final_urls
            : [],
          trackingUrlTemplate:
            ad.trackingUrlTemplate || ad.tracking_url_template,
          finalUrlSuffix: ad.finalUrlSuffix || ad.final_url_suffix,
          path1: rsa.path1,
          path2: rsa.path2,
          policyApprovalStatus: policy.approvalStatus || policy.approval_status,
          policyReviewStatus: policy.reviewStatus || policy.review_status,
          lastSyncAt: now,
        };
      })
      .filter(
        (doc) =>
          doc.campaignId && doc.adGroupId && doc.adId && doc.resourceName,
      );
    return {
      ads: await this.upsertMany(
        this.adModel,
        documents,
        ["customerId", "adGroupId", "adId"],
        context.writeTelemetry,
        "google_ads_ads",
        "ads",
      ),
    };
  }

  private async syncMetrics(
    account: AdAccountDocument,
    customerId: string,
    level: GoogleAdsMetricLevel,
    dateFrom: string,
    dateTo: string,
    context: GoogleAdsReadonlySyncContext,
  ): Promise<Partial<Record<SyncCountKey, number>>> {
    const rows = await this.searchRows(
      account,
      customerId,
      context,
      METRIC_TEMPLATE_BY_LEVEL[level],
      dateFrom,
      dateTo,
    );
    const now = new Date();
    const documents = rows
      .map((row) => this.mapMetricRow(row, customerId, level, now))
      .filter((doc) => doc.date && doc.campaignId);
    const count = await this.upsertMany(
      this.dailyMetricModel,
      documents,
      [
        "level",
        "date",
        "customerId",
        "campaignId",
        "adGroupId",
        "criterionId",
        "adId",
      ],
      context.writeTelemetry,
      "google_ads_daily_metrics",
      `metrics_${level}`,
    );
    const keyByLevel: Record<GoogleAdsMetricLevel, SyncCountKey> = {
      campaign: "dailyMetricsCampaign",
      ad_group: "dailyMetricsAdGroup",
      keyword: "dailyMetricsKeyword",
      ad: "dailyMetricsAd",
    };
    return { [keyByLevel[level]]: count };
  }

  private mapMetricRow(
    row: any,
    customerId: string,
    level: GoogleAdsMetricLevel,
    lastSyncAt: Date,
  ) {
    const metrics = row.metrics || {};
    const criterion = row.adGroupCriterion || row.ad_group_criterion || {};
    const keyword = criterion.keyword || {};
    const adGroupAd = row.adGroupAd || row.ad_group_ad || {};
    const resourceNames: Record<GoogleAdsMetricLevel, string | undefined> = {
      campaign: row.campaign?.resourceName || row.campaign?.resource_name,
      ad_group:
        (row.adGroup || row.ad_group)?.resourceName ||
        (row.adGroup || row.ad_group)?.resource_name,
      keyword: criterion.resourceName || criterion.resource_name,
      ad: adGroupAd.resourceName || adGroupAd.resource_name,
    };
    return {
      level,
      date: row.segments?.date,
      customerId,
      campaignId: String(row.campaign?.id || ""),
      adGroupId: this.optionalId((row.adGroup || row.ad_group)?.id),
      criterionId: this.optionalId(
        criterion.criterionId ?? criterion.criterion_id,
      ),
      adId: this.optionalId(adGroupAd.ad?.id),
      resourceName: resourceNames[level],
      keywordText: keyword.text,
      matchType: keyword.matchType || keyword.match_type,
      costMicros: this.number(metrics.costMicros ?? metrics.cost_micros),
      costVnd:
        this.number(metrics.costMicros ?? metrics.cost_micros) / 1_000_000,
      impressions: this.number(metrics.impressions),
      clicks: this.number(metrics.clicks),
      ctr: this.number(metrics.ctr),
      averageCpc:
        this.number(metrics.averageCpc ?? metrics.average_cpc) / 1_000_000,
      conversions: this.number(metrics.conversions),
      allConversions: this.number(
        metrics.allConversions ?? metrics.all_conversions,
      ),
      conversionValue: this.number(
        metrics.conversionsValue ?? metrics.conversions_value,
      ),
      costPerConversion:
        this.number(metrics.costPerConversion ?? metrics.cost_per_conversion) /
        1_000_000,
      lastSyncAt,
    };
  }

  private async searchRows(
    account: AdAccountDocument,
    customerId: string,
    context: GoogleAdsReadonlySyncContext,
    templateId: GoogleAdsReadonlyQueryTemplateId,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    return this.transport().searchStream({
      customerId,
      loginCustomerId: this.sanitizeId(String(account.loginCustomerId || "")),
      allowedCustomerIds: context.allowedCustomerIds,
      templateId,
      dateFrom,
      dateTo,
      absoluteDeadlineAt: context.absoluteDeadlineAt,
    });
  }

  private async upsertMany(
    model: Model<any>,
    documents: Record<string, any>[],
    keyFields: string[],
    writeTelemetry: GoogleAdsReadonlyWriteTelemetry[],
    targetCollection: string,
    sourceStep: string,
  ) {
    if (!documents.length) return 0;
    const operations = documents.map((document) => ({
      updateOne: {
        filter: Object.fromEntries(
          keyFields.map((field) => [field, document[field] ?? null]),
        ),
        update: { $set: document },
        upsert: true,
      },
    }));
    await this.recordWrite(
      writeTelemetry,
      {
        targetCollection,
        operationType: "upsert",
        recordCount: documents.length,
        deleteAttempted: false,
        sourceStep,
      },
      () => model.bulkWrite(operations, { ordered: false }),
    );
    return documents.length;
  }

  private async recordWrite<T>(
    writes: GoogleAdsReadonlyWriteTelemetry[],
    write: GoogleAdsReadonlyWriteTelemetry,
    execute: () => Promise<T>,
  ): Promise<T> {
    const [validated] = validateGoogleAdsReadonlyWriteTelemetry([write]);
    const result = await execute();
    writes.push(validated);
    return result;
  }

  private transport(): GoogleAdsReadonlyTransportService {
    if (this.readonlyTransport) return this.readonlyTransport;
    if (!this.fallbackReadonlyTransport) {
      this.fallbackReadonlyTransport =
        createDefaultGoogleAdsReadonlyTransportService(this.apiTokenService);
    }
    return this.fallbackReadonlyTransport;
  }

  private emptyCounts(): Record<SyncCountKey, number> {
    return {
      accounts: 0,
      campaigns: 0,
      campaignBudgets: 0,
      campaignCriteria: 0,
      conversionActions: 0,
      campaignConversionGoals: 0,
      conversionGoalCampaignConfigs: 0,
      adGroups: 0,
      keywords: 0,
      ads: 0,
      dailyMetricsCampaign: 0,
      dailyMetricsAdGroup: 0,
      dailyMetricsKeyword: 0,
      dailyMetricsAd: 0,
    };
  }

  private sanitizeId(value?: string): string | undefined {
    const clean = String(value || "").replace(/[^0-9]/g, "");
    return clean || undefined;
  }

  private idFromResourceName(value?: string): string | undefined {
    const match = String(value || "").match(/\/(\d+)$/);
    return match?.[1];
  }

  private optionalId(value: unknown): string | undefined {
    return value === undefined || value === null || value === ""
      ? undefined
      : String(value);
  }

  private number(value: unknown): number {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number : 0;
  }

  private normalizeDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
      throw new Error(`Invalid sync date: ${value}`);
    return date.toISOString().slice(0, 10);
  }

  private yesterdayIso(): string {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }
}
