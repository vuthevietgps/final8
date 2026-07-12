import { Injectable } from "@nestjs/common";
import {
  CoverageStatus,
  FreshnessDecisionGate,
  FreshnessStatus,
  SourceAssessment,
} from "../source-registry/source-registry.types";
import {
  AiDataPackSourceSyncPolicy,
  SourceSyncDecisionGates,
  SourceSyncImpact,
  SourceSyncImpactStatus,
} from "./source-sync-result.types";

@Injectable()
export class SourceSyncPolicyService {
  private readonly adsAutomationDecisionSources = [
    "google_ads",
    "advertising_costs",
    "product_mapping",
    "inventory_profit",
    "supplier_safety",
  ] as const;

  isFreshCovered(assessment?: SourceAssessment): boolean {
    return (
      assessment?.freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(assessment.coverageStatus)
    );
  }

  shouldCallGoogleAdsAdapter(input: {
    syncPolicy: AiDataPackSourceSyncPolicy;
    assessment?: SourceAssessment;
  }): boolean {
    if (input.syncPolicy === "export_cached") return false;
    if (!input.assessment) return false;
    if (input.assessment.sourceKey !== "google_ads") return false;
    if (["not_configured", "unsupported"].includes(input.assessment.status)) {
      return false;
    }
    return !this.isFreshCovered(input.assessment);
  }

  impactFromAssessment(
    sourceKey: string,
    assessment?: SourceAssessment,
    fallbackStatus?: SourceSyncImpactStatus,
    context: {
      reportDate?: string;
      blockingReasons?: string[];
    } = {},
  ): SourceSyncImpact {
    const status = fallbackStatus || this.statusFromAssessment(assessment);
    const blockingReasons = [...new Set(context.blockingReasons || [])];
    return {
      sourceKey,
      reportDate: context.reportDate,
      status,
      canUseForDecision: assessment?.canUseForDecision || "no",
      canUseForAdsAutomationDecision: status === "fresh_covered",
      freshnessStatus: assessment?.freshnessStatus,
      coverageStatus: assessment?.coverageStatus,
      reportDateRecordCount: assessment?.reportDateRecordCount,
      lastSuccessfulSyncAt: assessment?.lastSuccessfulSyncAt,
      latestRecordUpdatedAt: assessment?.latestRecordUpdatedAt,
      latestRecordDate: assessment?.latestRecordDate,
      blockingReason: blockingReasons[0] || null,
      blockingReasons,
    };
  }

  decisionGates(input: {
    gate: FreshnessDecisionGate;
    sourceImpact: Record<string, SourceSyncImpact>;
  }): SourceSyncDecisionGates {
    const googleAdsUsable =
      input.sourceImpact.google_ads?.status === "fresh_covered";
    const adsAutomationSourcesReady = this.adsAutomationDecisionSources.every(
      (sourceKey) => input.sourceImpact[sourceKey]?.status === "fresh_covered",
    );
    return {
      ...input.gate,
      canUseGoogleAdsDataClaim: googleAdsUsable,
      canRecommendAdsScale: adsAutomationSourcesReady,
      canGenerateActionDraft: adsAutomationSourcesReady,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private statusFromAssessment(
    assessment?: SourceAssessment,
  ): SourceSyncImpactStatus {
    if (!assessment) return "unsupported";
    if (assessment.freshnessStatus === "unsupported") return "unsupported";
    if (assessment.freshnessStatus === "not_configured")
      return "not_configured";
    if (assessment.freshnessStatus === "stale") return "stale";
    if (assessment.freshnessStatus === "missing") return "not_synced";
    if (assessment.coverageStatus === "no_records_for_report_date") {
      return "no_records_for_report_date";
    }
    if (assessment.coverageStatus === "missing") return "not_synced";
    if (
      assessment.freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(assessment.coverageStatus)
    ) {
      return "fresh_covered";
    }
    if (
      this.hasUnknown(assessment.freshnessStatus, assessment.coverageStatus)
    ) {
      return "not_synced";
    }
    return "stale";
  }

  private hasUnknown(
    freshnessStatus: FreshnessStatus,
    coverageStatus: CoverageStatus,
  ): boolean {
    return freshnessStatus === "unknown" || coverageStatus === "unknown";
  }
}
