import { Injectable } from "@nestjs/common";
import { CoverageGateService } from "./coverage-gate.service";
import { DbWatermarkService } from "./db-watermark.service";
import { SourceRegistryService } from "./source-registry.service";
import {
  FreshnessDecisionGate,
  FreshnessGateResult,
  SourceAssessment,
} from "./source-registry.types";

@Injectable()
export class FreshnessGateService {
  private readonly adsAutomationDecisionSources = [
    "google_ads",
    "advertising_costs",
    "product_mapping",
    "inventory_profit",
    "supplier_safety",
  ] as const;

  constructor(
    private readonly registry: SourceRegistryService,
    private readonly watermark: DbWatermarkService,
    private readonly coverage: CoverageGateService,
  ) {}

  async assessAll(input: {
    reportDate: string;
    sourceKeys?: string[];
    now?: Date;
  }): Promise<FreshnessGateResult> {
    const requested = new Set(input.sourceKeys || []);
    const sources = this.registry
      .list()
      .filter((source) => !requested.size || requested.has(source.sourceKey));
    const assessments: SourceAssessment[] = [];

    for (const source of sources) {
      const watermark = await this.watermark.assess(source, input.now);
      const coverage = await this.coverage.assess(
        source,
        input.reportDate,
        watermark.hasAnyRecords,
      );
      const strong =
        watermark.freshnessStatus === "fresh" &&
        ["covered", "not_applicable"].includes(coverage.coverageStatus);
      const cautious =
        watermark.freshnessStatus === "fresh" ||
        watermark.freshnessStatus === "stale";
      assessments.push({
        sourceKey: source.sourceKey,
        status: watermark.freshnessStatus,
        freshnessStatus: watermark.freshnessStatus,
        coverageStatus: coverage.coverageStatus,
        lastSuccessfulSyncAt: watermark.lastSuccessfulSyncAt,
        latestRecordUpdatedAt: watermark.latestRecordUpdatedAt,
        latestRecordDate: watermark.latestRecordDate,
        reportDateRecordCount: coverage.reportDateRecordCount,
        expectedRecordCount: coverage.expectedRecordCount,
        maxStalenessMinutes: watermark.maxStalenessMinutes,
        freshnessMinutes: watermark.freshnessMinutes,
        staleByMinutes: watermark.staleByMinutes,
        evidence: [...watermark.evidence, ...coverage.evidence],
        warnings: [...watermark.warnings, ...coverage.warnings],
        blockingReasons: [
          ...watermark.blockingReasons,
          ...coverage.blockingReasons,
        ],
        canUseForDecision: strong ? "yes" : cautious ? "cautious" : "no",
      });
    }

    return {
      reportDate: input.reportDate,
      evaluatedAt: (input.now || new Date()).toISOString(),
      dbOnly: true,
      providerSyncAttempted: false,
      mutationAttempted: false,
      assessments,
      decisionGate: this.buildDecisionGate(assessments),
    };
  }

  buildDecisionGate(assessments: SourceAssessment[]): FreshnessDecisionGate {
    const strong = (sourceKey: string) => {
      const assessment = assessments.find(
        (candidate) => candidate.sourceKey === sourceKey,
      );
      return (
        assessment?.freshnessStatus === "fresh" &&
        ["covered", "not_applicable"].includes(assessment.coverageStatus)
      );
    };
    const adsAutomationSourcesReady = this.adsAutomationDecisionSources.every(
      (sourceKey) => strong(sourceKey),
    );

    return {
      canRecommendAdsScale: adsAutomationSourcesReady,
      canConcludeProfitStrongly:
        strong("orders") &&
        strong("payments_or_order_payments") &&
        strong("advertising_costs"),
      canEvaluateSalesToday: strong("crm_leads"),
      canEvaluateFinanceStrongly: strong("finance") && strong("loans_debt"),
      canUseLtvStrongly:
        strong("customer_referral") && strong("product_mapping"),
      canGenerateActionDraft: adsAutomationSourcesReady,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }
}
