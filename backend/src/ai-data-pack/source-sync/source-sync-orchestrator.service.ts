import { Inject, Injectable, Optional } from "@nestjs/common";
import { AiDataPackProviderReadOnlyAdapter } from "../provider-adapters/provider-readonly-adapter.types";
import {
  AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER,
  GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION,
} from "../provider-adapters/provider-adapter.tokens";
import type {
  GoogleAdsReadOnlySyncInput,
  ProviderReadOnlySyncResult,
} from "../provider-adapters/google-ads-readonly/google-ads-readonly-adapter.types";
import { FreshnessGateService } from "../source-registry/freshness-gate.service";
import { FreshnessGateResult } from "../source-registry/source-registry.types";
import { SourceSyncPolicyService } from "./source-sync-policy.service";
import {
  SourceSyncAdapterDecision,
  SourceSyncAdapterResultSummary,
  SourceSyncDecisionEvidence,
  SourceSyncImpact,
  SourceSyncPreparationInput,
  SourceSyncPreparationResult,
  SourceSyncSourceResult,
} from "./source-sync-result.types";

const DEFAULT_POLICY_VERSION = "source-sync-orchestrator-v1";
const DEFAULT_SYNC_DEADLINE_MS = 180_000;
const ADS_SCALE_GATE_SOURCES = [
  "google_ads",
  "advertising_costs",
  "product_mapping",
  "inventory_profit",
  "supplier_safety",
] as const;

@Injectable()
export class SourceSyncOrchestratorService {
  constructor(
    private readonly freshness: FreshnessGateService,
    private readonly policy: SourceSyncPolicyService,
    @Optional()
    @Inject(AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER)
    private readonly googleAdsAdapter?: AiDataPackProviderReadOnlyAdapter<
      GoogleAdsReadOnlySyncInput,
      ProviderReadOnlySyncResult
    >,
  ) {}

  async prepareSourcesForExportJob(
    input: SourceSyncPreparationInput,
  ): Promise<SourceSyncPreparationResult> {
    const normalized = this.normalize(input);
    const sourceKeys = this.sourceKeys(normalized.sourceKeys);
    const preAssessment = await this.freshness.assessAll({
      reportDate: normalized.reportDate,
      sourceKeys,
      now: normalized.now,
    });
    const googleAdsPre = this.assessment(preAssessment, "google_ads");
    let adapterDecision = this.googleAdsAdapterDecision(
      normalized,
      googleAdsPre,
    );
    const warnings: string[] = [];
    const blockingReasons: string[] = [];
    let adapterResultSummary: SourceSyncAdapterResultSummary | undefined;
    let providerSyncAttempted = false;
    let adapterWasInvoked = false;

    if (adapterDecision === "called_adapter") {
      try {
        adapterWasInvoked = true;
        const adapterResult = await this.googleAdsAdapter!.syncReadOnly(
          this.adapterInput(normalized),
        );
        providerSyncAttempted = adapterResult.providerSyncAttempted;
        adapterResultSummary = this.summarizeAdapterResult(adapterResult);
        warnings.push(...adapterResult.warnings);
        if (adapterResult.status === "failed") {
          adapterDecision = "adapter_failed";
          this.addAdapterFailure(
            normalized.syncPolicy,
            warnings,
            blockingReasons,
          );
        }
      } catch {
        adapterWasInvoked = true;
        adapterDecision = "adapter_failed";
        adapterResultSummary = this.failedAdapterSummary();
        this.addAdapterFailure(
          normalized.syncPolicy,
          warnings,
          blockingReasons,
        );
      }
    } else if (adapterDecision === "adapter_unavailable") {
      const reason = "google_ads_readonly_adapter_unavailable";
      if (normalized.syncPolicy === "sync_required") {
        blockingReasons.push(reason);
      } else {
        warnings.push(reason);
      }
    } else if (adapterDecision === "adapter_scope_denied") {
      const reason = "google_ads_readonly_adapter_scope_denied";
      if (normalized.syncPolicy === "sync_required") {
        blockingReasons.push(reason);
      } else {
        warnings.push(reason);
      }
    }

    const postAssessment = adapterWasInvoked
      ? await this.freshness.assessAll({
          reportDate: normalized.reportDate,
          sourceKeys,
          now: normalized.now,
        })
      : preAssessment;
    const sourceDecisions = this.sourceDecisions({
      input: normalized,
      sourceKeys: this.resultSourceKeys(
        sourceKeys,
        preAssessment,
        postAssessment,
      ),
      preAssessment,
      postAssessment,
      googleAdsAdapterDecision: adapterDecision,
      googleAdsAdapterResultSummary: adapterResultSummary,
      warnings,
      blockingReasons,
    });
    const sourceImpact = this.sourceImpact(sourceDecisions);
    const googleAdsImpact = sourceImpact.google_ads;
    if (
      normalized.syncPolicy === "sync_required" &&
      googleAdsImpact &&
      googleAdsImpact.status !== "fresh_covered" &&
      !blockingReasons.includes("google_ads_not_fresh_after_sync")
    ) {
      blockingReasons.push("google_ads_not_fresh_after_sync");
    }
    const decisionGates = this.policy.decisionGates({
      gate: postAssessment.decisionGate,
      sourceImpact,
    });
    const decisionEvidence = sourceDecisions.map(
      (decision) => decision.decisionEvidence,
    );

    return {
      exportJobId: normalized.exportJobId,
      correlationId: normalized.correlationId,
      policyVersion: normalized.policyVersion,
      reportDate: normalized.reportDate,
      dateFrom: normalized.dateFrom,
      dateTo: normalized.dateTo,
      packTypes: normalized.packTypes,
      syncPolicy: normalized.syncPolicy,
      preAssessment,
      postAssessment,
      sourceDecisions,
      sourceImpact,
      decisionEvidence,
      warnings: [
        ...new Set([...warnings, ...this.sourceWarnings(sourceDecisions)]),
      ],
      blockingReasons: [
        ...new Set([
          ...blockingReasons,
          ...this.sourceBlocking(sourceDecisions),
        ]),
      ],
      decisionGates,
      providerSyncAttempted,
      mutationAttempted: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private googleAdsAdapterDecision(
    input: RequiredNormalizedSourceSyncInput,
    assessment: ReturnType<SourceSyncOrchestratorService["assessment"]>,
  ): SourceSyncAdapterDecision {
    if (input.syncPolicy === "export_cached") return "skipped_export_cached";
    if (!assessment) return "unsupported_source";
    if (this.policy.isFreshCovered(assessment)) return "skipped_fresh_covered";
    if (
      assessment.freshnessStatus === "unsupported" ||
      assessment.freshnessStatus === "not_configured"
    ) {
      return "db_only";
    }
    if (
      !this.policy.shouldCallGoogleAdsAdapter({
        syncPolicy: input.syncPolicy,
        assessment,
      })
    ) {
      return "db_only";
    }
    if (!this.googleAdsAdapter) return "adapter_unavailable";
    if (!input.customerIds.length || !this.hasValidRequester(input)) {
      return "adapter_scope_denied";
    }
    return "called_adapter";
  }

  private adapterInput(
    input: RequiredNormalizedSourceSyncInput,
  ): GoogleAdsReadOnlySyncInput {
    return {
      exportJobId: input.exportJobId,
      correlationId: input.correlationId,
      sourceKey: "google_ads",
      reportDate: input.reportDate,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      customerIds: input.customerIds,
      syncPolicy: input.syncPolicy as "sync_if_stale" | "sync_required",
      policyVersion: input.policyVersion,
      internalRequester: input.internalRequester,
      absoluteDeadlineAt: input.absoluteDeadlineAt,
    };
  }

  private sourceDecisions(input: {
    input: RequiredNormalizedSourceSyncInput;
    sourceKeys: string[];
    preAssessment: FreshnessGateResult;
    postAssessment: FreshnessGateResult;
    googleAdsAdapterDecision: SourceSyncAdapterDecision;
    googleAdsAdapterResultSummary?: SourceSyncAdapterResultSummary;
    warnings: string[];
    blockingReasons: string[];
  }): SourceSyncSourceResult[] {
    return input.sourceKeys.map((sourceKey) => {
      const pre = this.assessment(input.preAssessment, sourceKey);
      const post = this.assessment(input.postAssessment, sourceKey);
      const isGoogleAds = sourceKey === "google_ads";
      const adapterDecision = isGoogleAds
        ? input.googleAdsAdapterDecision
        : pre || post
          ? "db_only"
          : "unsupported_source";
      const sourceWarnings = [
        ...(pre?.warnings || []),
        ...(post?.warnings || []),
        ...(isGoogleAds ? input.warnings : []),
      ];
      const initialBlockingReasons = [
        ...(pre?.blockingReasons || []),
        ...(post?.blockingReasons || []),
        ...(isGoogleAds ? input.blockingReasons : []),
      ];
      let sourceImpact = this.policy.impactFromAssessment(
        sourceKey,
        post || pre,
        undefined,
        {
          reportDate: input.input.reportDate,
          blockingReasons: initialBlockingReasons,
        },
      );
      const sourceBlockingReasons = [
        ...new Set([
          ...initialBlockingReasons,
          ...this.adsAutomationDecisionBlockers(sourceKey, sourceImpact),
        ]),
      ];
      sourceImpact = this.policy.impactFromAssessment(
        sourceKey,
        post || pre,
        undefined,
        {
          reportDate: input.input.reportDate,
          blockingReasons: sourceBlockingReasons,
        },
      );
      return {
        sourceKey,
        preAssessment: pre,
        adapterDecision,
        adapterResultSummary: isGoogleAds
          ? input.googleAdsAdapterResultSummary
          : undefined,
        postAssessment: post,
        sourceImpact,
        decisionEvidence: this.decisionEvidence({
          reportDate: input.input.reportDate,
          sourceKey,
          assessment: post || pre,
          sourceImpact,
          blockingReasons: sourceBlockingReasons,
        }),
        warnings: [...new Set(sourceWarnings)],
        blockingReasons: [...new Set(sourceBlockingReasons)],
      };
    });
  }

  private summarizeAdapterResult(
    result: ProviderReadOnlySyncResult,
  ): SourceSyncAdapterResultSummary {
    return {
      status: result.status,
      providerSyncAttempted: result.providerSyncAttempted,
      mutationAttempted: false,
      syncRunId: result.syncRunId,
      attemptCount: result.attemptCount,
      localWriteTargets: [...result.localWriteTargets],
      writeTelemetrySummary: result.writeTelemetrySummary
        ? {
            operationCount: result.writeTelemetrySummary.operationCount,
            recordCount: result.writeTelemetrySummary.recordCount,
            targets: [...result.writeTelemetrySummary.targets],
            operations: { ...result.writeTelemetrySummary.operations },
          }
        : undefined,
      requestedCustomerCount: result.requestedCustomerIds.length,
      selectedCustomerCount: result.selectedCustomerIds.length,
      errorCategories: [
        ...new Set(result.errors.map((error) => error.category)),
      ],
      warningCount: result.warnings.length,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private failedAdapterSummary(): SourceSyncAdapterResultSummary {
    return {
      status: "failed",
      providerSyncAttempted: false,
      mutationAttempted: false,
      localWriteTargets: [],
      errorCategories: ["unexpected"],
      warningCount: 0,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private addAdapterFailure(
    syncPolicy: RequiredNormalizedSourceSyncInput["syncPolicy"],
    warnings: string[],
    blockingReasons: string[],
  ): void {
    const reason = "google_ads_readonly_adapter_failed";
    if (syncPolicy === "sync_required") {
      blockingReasons.push(reason);
    } else {
      warnings.push(reason);
    }
  }

  private hasValidRequester(input: RequiredNormalizedSourceSyncInput): boolean {
    const permissions = input.internalRequester.permissions || [];
    return (
      input.internalRequester.type === "internal_job" &&
      permissions.includes(GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION) &&
      !permissions.includes("google-ads.read")
    );
  }

  private normalize(
    input: SourceSyncPreparationInput,
  ): RequiredNormalizedSourceSyncInput {
    const reportDate = this.isoDate(input.reportDate, "reportDate");
    const dateFrom = this.isoDate(input.dateFrom || reportDate, "dateFrom");
    const dateTo = this.isoDate(input.dateTo || reportDate, "dateTo");
    if (
      new Date(`${dateFrom}T00:00:00.000Z`) >
      new Date(`${dateTo}T00:00:00.000Z`)
    ) {
      throw new Error("dateFrom must not be after dateTo.");
    }
    const now = input.now || new Date();
    const internalRequester = input.internalRequester || {
      id: "ai-data-pack-export-job-source-sync",
      type: "internal_job",
      permissions: [GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION],
    };
    return {
      exportJobId: this.requiredText(input.exportJobId, "exportJobId"),
      correlationId: this.requiredText(
        input.correlationId || input.exportJobId,
        "correlationId",
      ),
      policyVersion: this.requiredText(
        input.policyVersion || DEFAULT_POLICY_VERSION,
        "policyVersion",
      ),
      reportDate,
      dateFrom,
      dateTo,
      packTypes: [...new Set(input.packTypes || [])].sort(),
      sourceKeys: input.sourceKeys
        ? [...new Set(input.sourceKeys)].sort()
        : undefined,
      syncPolicy: input.syncPolicy,
      customerIds: [...new Set(input.customerIds || [])].sort(),
      internalRequester,
      absoluteDeadlineAt:
        input.absoluteDeadlineAt ||
        new Date(now.getTime() + DEFAULT_SYNC_DEADLINE_MS).toISOString(),
      now,
    };
  }

  private sourceKeys(sourceKeys?: string[]): string[] | undefined {
    if (!sourceKeys?.length) return undefined;
    return [...new Set([...sourceKeys, ...ADS_SCALE_GATE_SOURCES])].sort();
  }

  private resultSourceKeys(
    requestedSourceKeys: string[] | undefined,
    preAssessment: FreshnessGateResult,
    postAssessment: FreshnessGateResult,
  ): string[] {
    return [
      ...new Set([
        ...(requestedSourceKeys || []),
        ...preAssessment.assessments.map((assessment) => assessment.sourceKey),
        ...postAssessment.assessments.map((assessment) => assessment.sourceKey),
      ]),
    ].sort();
  }

  private assessment(result: FreshnessGateResult, sourceKey: string) {
    return result.assessments.find(
      (assessment) => assessment.sourceKey === sourceKey,
    );
  }

  private sourceImpact(
    sourceDecisions: SourceSyncSourceResult[],
  ): Record<string, SourceSyncImpact> {
    return Object.fromEntries(
      sourceDecisions.map((decision) => [
        decision.sourceKey,
        decision.sourceImpact,
      ]),
    );
  }

  private sourceWarnings(sourceDecisions: SourceSyncSourceResult[]): string[] {
    return sourceDecisions.flatMap((decision) => decision.warnings);
  }

  private sourceBlocking(sourceDecisions: SourceSyncSourceResult[]): string[] {
    return sourceDecisions.flatMap((decision) => decision.blockingReasons);
  }

  private adsAutomationDecisionBlockers(
    sourceKey: string,
    sourceImpact: SourceSyncImpact,
  ): string[] {
    if (!ADS_SCALE_GATE_SOURCES.includes(sourceKey as any)) return [];
    return sourceImpact.status === "fresh_covered"
      ? []
      : [`${sourceKey}_not_ready_for_ads_automation_decision`];
  }

  private decisionEvidence(input: {
    reportDate: string;
    sourceKey: string;
    assessment?: SourceSyncSourceResult["postAssessment"];
    sourceImpact: SourceSyncImpact;
    blockingReasons: string[];
  }): SourceSyncDecisionEvidence {
    const blockingReasons = [...new Set(input.blockingReasons)];
    return {
      sourceKey: input.sourceKey,
      reportDate: input.reportDate,
      freshnessStatus: input.assessment?.freshnessStatus,
      coverageStatus: input.assessment?.coverageStatus,
      lastSuccessfulSyncAt: input.assessment?.lastSuccessfulSyncAt,
      latestRecordDate: input.assessment?.latestRecordDate,
      blockingReason: blockingReasons[0] || null,
      blockingReasons,
      canUseForAdsAutomationDecision:
        input.sourceImpact.status === "fresh_covered",
    };
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new Error(`${field} must use YYYY-MM-DD.`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new Error(`${field} is invalid.`);
    }
    return text;
  }

  private requiredText(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!text) throw new Error(`${field} is required.`);
    return text;
  }
}

type RequiredNormalizedSourceSyncInput = Required<
  Omit<
    SourceSyncPreparationInput,
    "sourceKeys" | "customerIds" | "packTypes" | "internalRequester"
  >
> & {
  sourceKeys?: string[];
  customerIds: string[];
  packTypes: string[];
  internalRequester: GoogleAdsReadOnlySyncInput["internalRequester"];
};
