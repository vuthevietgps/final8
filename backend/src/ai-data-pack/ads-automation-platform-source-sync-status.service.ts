import { BadRequestException, Injectable } from "@nestjs/common";
import {
  AdsAutomationPlatformSourceStatus,
  AdsAutomationPlatformSourceSyncStatusInput,
  AdsAutomationPlatformSourceSyncStatusItem,
  AdsAutomationPlatformSourceSyncStatusResponse,
  AdsAutomationPlatformSourceSyncStatusSourceKey,
  AdsAutomationPlatformSourceRequiredConfigStatus,
} from "./contracts/ads-automation-platform-source-sync-status.contract";
import { FreshnessGateService } from "./source-registry/freshness-gate.service";
import { SourceRegistryService } from "./source-registry/source-registry.service";
import {
  SourceAssessment,
  SourceRegistryEntry,
} from "./source-registry/source-registry.types";
import type {
  SourceSyncDecisionEvidence,
} from "./source-sync/source-sync-result.types";

const DEFAULT_SOURCE_KEYS: AdsAutomationPlatformSourceSyncStatusSourceKey[] = [
  "google_ads",
  "advertising_costs",
  "product_mapping",
  "inventory_profit",
  "supplier_safety",
];

const GOOGLE_ADS_REQUIRED_CONFIG = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
] as const;

const GOOGLE_ADS_PRODUCTION_ENABLED = "GOOGLE_ADS_PRODUCTION_ENABLED";

@Injectable()
export class AdsAutomationPlatformSourceSyncStatusService {
  constructor(
    private readonly freshness: FreshnessGateService,
    private readonly registry: SourceRegistryService,
  ) {}

  async build(
    input: AdsAutomationPlatformSourceSyncStatusInput,
  ): Promise<AdsAutomationPlatformSourceSyncStatusResponse> {
    const reportDate = this.isoDate(input.reportDate, "reportDate");
    const now = input.now ? this.dateTime(input.now, "now") : undefined;
    const sourceKeys = this.sourceKeys(input.sourceKeys);
    const freshness = await this.freshness.assessAll({
      reportDate,
      sourceKeys,
      now,
    });
    const sources = sourceKeys.map((sourceKey) => {
      const source = this.requiredSource(sourceKey);
      const assessment = freshness.assessments.find(
        (candidate) => candidate.sourceKey === sourceKey,
      );
      return this.sourceStatus(source, reportDate, assessment);
    });
    const blockedSources = sources
      .filter((source) => !source.canUseForAdsAutomationDecision)
      .map((source) => source.sourceKey);
    const googleAdsReady = this.ready(sources, "google_ads");
    const allAdsSourcesReady = DEFAULT_SOURCE_KEYS.every((sourceKey) =>
      this.ready(sources, sourceKey),
    );

    return {
      schemaVersion: "ads_automation_platform_source_sync_status.v1",
      generatedAt: freshness.evaluatedAt,
      reportDate,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        source_registry_reused: true,
        freshness_gate_reused: true,
        adapter_boundary_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        production_ready: false,
        execution_allowed_now: false,
        google_ads_production_enabled: false,
      },
      summary: {
        status: blockedSources.length ? "blocked" : "ready",
        source_count: sources.length,
        ready_source_count: sources.length - blockedSources.length,
        blocked_source_count: blockedSources.length,
        blocked_sources: blockedSources,
        missing_config_sources: this.sourcesWithStatus(
          sources,
          "missing_config",
        ),
        stale_sources: this.sourcesWithStatus(sources, "stale"),
        missing_coverage_sources: this.sourcesWithStatus(
          sources,
          "missing_coverage",
        ),
        not_synced_sources: this.sourcesWithStatus(sources, "not_synced"),
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: blockedSources.length
          ? "resolve_source_sync_blockers"
          : "ready_for_ads_automation_decision_review",
      },
      decisionGates: {
        canUseGoogleAdsDataClaim: googleAdsReady,
        canGenerateActionDraft: allAdsSourcesReady,
        canRecommendAdsScale: allAdsSourcesReady,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      },
      decisionEvidence: sources.map((source) =>
        this.decisionEvidence(source, reportDate),
      ),
      sources,
    };
  }

  private sourceStatus(
    source: SourceRegistryEntry,
    reportDate: string,
    assessment?: SourceAssessment,
  ): AdsAutomationPlatformSourceSyncStatusItem {
    const requiredConfigPresence = this.requiredConfigPresence(
      source.sourceKey,
    );
    const configBlockers = this.configBlockers(requiredConfigPresence);
    const sourceSyncBlockers = [
      ...new Set([
        ...(assessment?.blockingReasons || ["freshness_unknown"]),
        ...configBlockers,
      ]),
    ];
    const status = this.status(assessment, configBlockers);
    const canUseForAdsAutomationDecision = status === "ready";
    const latestSuccessfulSyncOrReadModelWatermark =
      assessment?.lastSuccessfulSyncAt ||
      assessment?.latestRecordUpdatedAt ||
      assessment?.latestRecordDate ||
      null;

    return {
      sourceKey:
        source.sourceKey as AdsAutomationPlatformSourceSyncStatusSourceKey,
      provider: source.sourceKey === "google_ads" ? "google_ads" : "erp_local",
      platform: this.platform(source.sourceKey),
      domain: source.domain,
      businessImportance: source.businessImportance,
      status,
      requiredConfigPresence,
      missingCredentialOrConfigBlockers: configBlockers,
      reportDateCoverage: {
        reportDate,
        coverageStatus: assessment?.coverageStatus || "unknown",
        reportDateRecordCount: assessment?.reportDateRecordCount ?? null,
        expectedRecordCount: assessment?.expectedRecordCount ?? null,
      },
      freshness: {
        freshnessStatus: assessment?.freshnessStatus || "unknown",
        maxStalenessMinutes: assessment?.maxStalenessMinutes ?? null,
        freshnessMinutes: assessment?.freshnessMinutes ?? null,
        staleByMinutes: assessment?.staleByMinutes ?? null,
        lastSuccessfulSyncAt: assessment?.lastSuccessfulSyncAt || null,
        latestRecordUpdatedAt: assessment?.latestRecordUpdatedAt || null,
        latestRecordDate: assessment?.latestRecordDate || null,
        latestSuccessfulSyncOrReadModelWatermark,
      },
      sourceSyncBlockers,
      warnings: assessment?.warnings || [],
      canUseForAdsAutomationDecision,
      usableForAdsAutomationDecisions: canUseForAdsAutomationDecision,
    };
  }

  private status(
    assessment: SourceAssessment | undefined,
    configBlockers: string[],
  ): AdsAutomationPlatformSourceStatus {
    if (configBlockers.length) return "missing_config";
    if (!assessment) return "unknown";
    if (assessment.freshnessStatus === "unsupported") return "unsupported";
    if (assessment.freshnessStatus === "not_configured") {
      return "not_configured";
    }
    if (assessment.freshnessStatus === "missing") return "not_synced";
    if (assessment.coverageStatus === "missing") return "not_synced";
    if (assessment.freshnessStatus === "stale") return "stale";
    if (assessment.coverageStatus === "no_records_for_report_date") {
      return "missing_coverage";
    }
    if (
      assessment.freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(assessment.coverageStatus)
    ) {
      return "ready";
    }
    return "unknown";
  }

  private requiredConfigPresence(
    sourceKey: string,
  ): AdsAutomationPlatformSourceRequiredConfigStatus[] {
    if (sourceKey !== "google_ads") return [];
    const required = GOOGLE_ADS_REQUIRED_CONFIG.map((key) => ({
      key,
      required: true,
      present: this.present(key),
      acceptable: this.present(key),
      secret: key !== "GOOGLE_ADS_CUSTOMER_ID",
      value_exposed: false as const,
    }));
    const productionEnabled = this.truthy(
      process.env[GOOGLE_ADS_PRODUCTION_ENABLED],
    );
    return [
      ...required,
      {
        key: GOOGLE_ADS_PRODUCTION_ENABLED,
        required: false,
        present: this.present(GOOGLE_ADS_PRODUCTION_ENABLED),
        acceptable: !productionEnabled,
        secret: false,
        value_exposed: false as const,
      },
    ];
  }

  private configBlockers(
    items: AdsAutomationPlatformSourceRequiredConfigStatus[],
  ): string[] {
    return items.flatMap((item) => {
      if (item.required && !item.present) {
        return [`missing_config:${item.key}`];
      }
      if (!item.acceptable) {
        return [`blocked_config:${item.key}_must_be_false_or_absent`];
      }
      return [];
    });
  }

  private sourceKeys(
    input?: AdsAutomationPlatformSourceSyncStatusSourceKey[],
  ): AdsAutomationPlatformSourceSyncStatusSourceKey[] {
    const requested = input?.length ? input : DEFAULT_SOURCE_KEYS;
    const allowed = new Set(DEFAULT_SOURCE_KEYS);
    const normalized = [...new Set(requested)];
    const unsupported = normalized.filter((sourceKey) => !allowed.has(sourceKey));
    if (unsupported.length) {
      throw new BadRequestException(
        `sourceKeys contains unsupported values: ${unsupported.join(", ")}`,
      );
    }
    return normalized;
  }

  private requiredSource(
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
  ): SourceRegistryEntry {
    const source = this.registry.get(sourceKey);
    if (!source) {
      throw new BadRequestException(`sourceKey is not registered: ${sourceKey}`);
    }
    return source;
  }

  private platform(
    sourceKey: string,
  ): AdsAutomationPlatformSourceSyncStatusItem["platform"] {
    if (sourceKey === "google_ads") return "google_ads";
    if (sourceKey === "advertising_costs") return "erp_advertising_costs";
    if (sourceKey === "product_mapping") return "erp_product_mapping";
    if (sourceKey === "inventory_profit") return "erp_inventory_profit";
    return "erp_supplier_safety";
  }

  private ready(
    sources: AdsAutomationPlatformSourceSyncStatusItem[],
    sourceKey: AdsAutomationPlatformSourceSyncStatusSourceKey,
  ): boolean {
    return (
      sources.find((source) => source.sourceKey === sourceKey)
        ?.canUseForAdsAutomationDecision === true
    );
  }

  private sourcesWithStatus(
    sources: AdsAutomationPlatformSourceSyncStatusItem[],
    status: AdsAutomationPlatformSourceStatus,
  ): AdsAutomationPlatformSourceSyncStatusSourceKey[] {
    return sources
      .filter((source) => source.status === status)
      .map((source) => source.sourceKey);
  }

  private decisionEvidence(
    source: AdsAutomationPlatformSourceSyncStatusItem,
    reportDate: string,
  ): SourceSyncDecisionEvidence {
    const sourceNotReady = `${source.sourceKey}_not_ready_for_ads_automation_decision`;
    const blockingReasons = source.canUseForAdsAutomationDecision
      ? []
      : this.unique([
          sourceNotReady,
          ...source.sourceSyncBlockers,
          ...source.missingCredentialOrConfigBlockers,
        ]);

    return {
      sourceKey: source.sourceKey,
      reportDate,
      freshnessStatus: source.freshness.freshnessStatus,
      coverageStatus: source.reportDateCoverage.coverageStatus,
      lastSuccessfulSyncAt: source.freshness.lastSuccessfulSyncAt,
      latestRecordDate: source.freshness.latestRecordDate,
      blockingReason: blockingReasons[0] || null,
      blockingReasons,
      canUseForAdsAutomationDecision: source.canUseForAdsAutomationDecision,
    };
  }

  private present(key: string): boolean {
    return String(process.env[key] || "").trim().length > 0;
  }

  private truthy(value: unknown): boolean {
    return ["1", "true", "yes", "on"].includes(
      String(value || "").trim().toLowerCase(),
    );
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort();
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }
}
