import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationPlatformSourceSyncStatusService } from "./ads-automation-platform-source-sync-status.service";
import type {
  AdsAutomationCategoryKey,
  AdsAutomationDecisionItem,
  AdsAutomationDecisionSnapshot,
} from "./contracts/ads-automation-decision.contract";
import { SourceRegistryService } from "./source-registry/source-registry.service";
import {
  FreshnessGateResult,
  SourceAssessment,
} from "./source-registry/source-registry.types";

const GOOGLE_ADS_ENV_KEYS = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_CLIENT_ID",
  "GOOGLE_ADS_CLIENT_SECRET",
  "GOOGLE_ADS_REFRESH_TOKEN",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_PRODUCTION_ENABLED",
] as const;

function assessment(
  sourceKey: string,
  freshnessStatus: SourceAssessment["freshnessStatus"],
  coverageStatus: SourceAssessment["coverageStatus"],
  overrides: Partial<SourceAssessment> = {},
): SourceAssessment {
  const strong =
    freshnessStatus === "fresh" &&
    ["covered", "not_applicable"].includes(coverageStatus);
  const cautious = freshnessStatus === "fresh" || freshnessStatus === "stale";
  return {
    sourceKey,
    status: freshnessStatus,
    freshnessStatus,
    coverageStatus,
    lastSuccessfulSyncAt:
      sourceKey === "google_ads" ? "2026-07-04T04:30:00.000Z" : null,
    latestRecordUpdatedAt: "2026-07-04T04:45:00.000Z",
    latestRecordDate: coverageStatus === "not_applicable" ? null : "2026-07-04",
    reportDateRecordCount: coverageStatus === "covered" ? 7 : 0,
    expectedRecordCount: null,
    maxStalenessMinutes: 60,
    freshnessMinutes: freshnessStatus === "stale" ? 240 : 15,
    staleByMinutes: freshnessStatus === "stale" ? 180 : 0,
    evidence: [],
    warnings: [],
    blockingReasons: strong
      ? []
      : [`freshness_${freshnessStatus}`, `coverage_${coverageStatus}`],
    canUseForDecision: strong ? "yes" : cautious ? "cautious" : "no",
    ...overrides,
  };
}

function gate(assessments: SourceAssessment[]): FreshnessGateResult {
  return {
    reportDate: "2026-07-04",
    evaluatedAt: "2026-07-04T05:00:00.000Z",
    dbOnly: true,
    providerSyncAttempted: false,
    mutationAttempted: false,
    assessments,
    decisionGate: {
      canRecommendAdsScale: false,
      canConcludeProfitStrongly: false,
      canEvaluateSalesToday: false,
      canEvaluateFinanceStrongly: false,
      canUseLtvStrongly: false,
      canGenerateActionDraft: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
  };
}

function createService(result: FreshnessGateResult) {
  const freshness = {
    assessAll: jest.fn().mockResolvedValue(result),
  };
  const service = new AdsAutomationPlatformSourceSyncStatusService(
    freshness as any,
    new SourceRegistryService(),
  );
  return { service, freshness };
}

function setGoogleAdsConfigPresent() {
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token-secret";
  process.env.GOOGLE_ADS_CLIENT_ID = "client-id-secret";
  process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret-value";
  process.env.GOOGLE_ADS_REFRESH_TOKEN = "refresh-token-value";
  process.env.GOOGLE_ADS_CUSTOMER_ID = "1234567890";
  delete process.env.GOOGLE_ADS_PRODUCTION_ENABLED;
}

const evidenceWindow = { from: "2026-06-21", to: "2026-07-04", days: 14 };

function decision(
  overrides: Partial<AdsAutomationDecisionItem>,
): AdsAutomationDecisionItem {
  const decisionType = overrides.decision_type || "scale_ads";
  const entityId = overrides.entity_id || "ENTITY_1";
  return {
    decision_id: `DEC-${decisionType}-${entityId}`,
    decision_type: decisionType,
    entity_type: overrides.entity_type || "ad_group",
    entity_id: entityId,
    platform: overrides.platform ?? "google",
    accountId: overrides.accountId ?? "1234567890",
    productId: overrides.productId ?? null,
    supplierId: overrides.supplierId ?? null,
    currentValue: overrides.currentValue ?? {},
    proposedValue: overrides.proposedValue ?? {},
    evidence_window: overrides.evidence_window || evidenceWindow,
    evidence_metrics: overrides.evidence_metrics || {},
    data_quality_score: overrides.data_quality_score ?? 0.9,
    confidence: overrides.confidence || "high",
    risk_level: overrides.risk_level || "medium",
    status: overrides.status || "needs_review",
    blockers: overrides.blockers || [],
    missing_fields: overrides.missing_fields || [],
    next_required_data: overrides.next_required_data || [],
    approval_required: true,
    execution_allowed_now: false,
    idempotency_key: overrides.idempotency_key ?? null,
    rollback_plan: overrides.rollback_plan ?? null,
    rationale: overrides.rationale || "Fixture decision rationale.",
  };
}

function snapshot(decisions: AdsAutomationDecisionItem[]): AdsAutomationDecisionSnapshot {
  return {
    schemaVersion: "ads_automation_decision_snapshot.v1",
    generatedAt: "2026-07-04T05:00:00.000Z",
    snapshotDate: "2026-07-04",
    safety: {
      read_only: true,
      provider_api_used: false,
      google_ads_api_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_future_actions: true,
    },
    summary: {
      categories: 7,
      decisions: decisions.length,
      scale_candidates: 1,
      pause_candidates: 1,
      product_scale_candidates: 1,
      supplier_safe_candidates: 1,
      insufficient_data_decisions: 0,
    },
    categories: {} as Record<AdsAutomationCategoryKey, any>,
    decisions,
  };
}

function decisionReadinessSnapshot(): AdsAutomationDecisionSnapshot {
  return snapshot([
    decision({
      decision_type: "scale_amount",
      entity_id: "2001",
      status: "scale_ready",
      productId: "P_SCALE",
      currentValue: {
        campaignId: "1001",
        adGroupId: "2001",
        campaignBudgetId: "3001",
        currentBudgetVnd: 1000000,
      },
      proposedValue: {
        action: "update_campaign_budget_draft",
        campaignBudgetId: "3001",
        proposedBudgetVnd: 1200000,
        currentBudgetVnd: 1000000,
        increaseVnd: 200000,
        increasePercent: 20,
      },
    }),
    decision({
      decision_type: "campaign_or_ad_group_pause",
      entity_id: "2002",
      status: "needs_review",
      productId: "P_BAD",
      currentValue: { campaignId: "1002", adGroupId: "2002" },
      proposedValue: { action: "pause_ad_group_draft" },
    }),
    decision({
      decision_type: "supplier_gate",
      entity_type: "supplier",
      entity_id: "SUP_WEAK",
      supplierId: "SUP_WEAK",
      productId: "P_BAD",
      platform: null,
      accountId: null,
      status: "blocked",
      blockers: ["margin_after_cost_below_minimum"],
      proposedValue: { action: "supplier_sourcing", supplierFitScore: 42 },
    }),
    decision({
      decision_type: "product_kill_or_stop_review",
      entity_type: "product",
      entity_id: "P_BAD",
      productId: "P_BAD",
      platform: null,
      accountId: null,
      status: "needs_review",
      blockers: ["negative_product_economics", "return_cancel_refund_rate_too_high"],
      proposedValue: {
        action: "stop_ads_review",
        disallowedActions: ["delete_product"],
      },
    }),
  ]);
}

describe("AdsAutomationPlatformSourceSyncStatusService", () => {
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of GOOGLE_ADS_ENV_KEYS) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of GOOGLE_ADS_ENV_KEYS) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
  });

  it("returns ready Google Ads ad group data, stale advertising costs, and ready ERP allocation sources", async () => {
    setGoogleAdsConfigPresent();
    const { service, freshness } = createService(
      gate([
        assessment("google_ads", "fresh", "covered"),
        assessment("advertising_costs", "stale", "covered", {
          blockingReasons: ["freshness_stale"],
        }),
        assessment("product_mapping", "fresh", "not_applicable", {
          reportDateRecordCount: null,
        }),
        assessment("inventory_profit", "fresh", "covered"),
        assessment("supplier_safety", "fresh", "covered"),
      ]),
    );

    const result = await service.build({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
    });

    expect(freshness.assessAll).toHaveBeenCalledWith({
      reportDate: "2026-07-04",
      sourceKeys: [
        "google_ads",
        "advertising_costs",
        "product_mapping",
        "inventory_profit",
        "supplier_safety",
      ],
      now: new Date("2026-07-04T05:00:00.000Z"),
    });
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          provider: "google_ads",
          platform: "google_ads",
          status: "ready",
          canUseForAdsAutomationDecision: true,
          reportDateCoverage: expect.objectContaining({
            reportDate: "2026-07-04",
            coverageStatus: "covered",
            reportDateRecordCount: 7,
          }),
          freshness: expect.objectContaining({
            freshnessStatus: "fresh",
            lastSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
            latestSuccessfulSyncOrReadModelWatermark:
              "2026-07-04T04:30:00.000Z",
          }),
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          provider: "erp_local",
          status: "stale",
          canUseForAdsAutomationDecision: false,
          sourceSyncBlockers: expect.arrayContaining(["freshness_stale"]),
        }),
        expect.objectContaining({
          sourceKey: "product_mapping",
          platform: "erp_product_mapping",
          status: "ready",
          reportDateCoverage: expect.objectContaining({
            coverageStatus: "not_applicable",
          }),
        }),
        expect.objectContaining({
          sourceKey: "inventory_profit",
          platform: "erp_inventory_profit",
          status: "ready",
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          platform: "erp_supplier_safety",
          status: "ready",
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        ready_source_count: 4,
        blocked_source_count: 1,
        stale_sources: ["advertising_costs"],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }),
    );
    expect(result.decisionGates).toEqual(
      expect.objectContaining({
        canUseGoogleAdsDataClaim: true,
        canGenerateActionDraft: false,
        canRecommendAdsScale: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(result.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-07-04",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          lastSuccessfulSyncAt: "2026-07-04T04:30:00.000Z",
          latestRecordDate: "2026-07-04",
          blockingReason: null,
          blockingReasons: [],
          canUseForAdsAutomationDecision: true,
        }),
        expect.objectContaining({
          sourceKey: "advertising_costs",
          freshnessStatus: "stale",
          coverageStatus: "covered",
          blockingReason: "advertising_costs_not_ready_for_ads_automation_decision",
          blockingReasons: expect.arrayContaining([
            "advertising_costs_not_ready_for_ads_automation_decision",
            "freshness_stale",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
  });

  it("marks Google Ads missing-config blockers without exposing plaintext credential values", async () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev-token-plaintext-secret";
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id-plaintext-secret";
    process.env.GOOGLE_ADS_PRODUCTION_ENABLED = "true";
    const { service } = createService(
      gate([
        assessment("google_ads", "fresh", "covered"),
        assessment("advertising_costs", "fresh", "covered"),
        assessment("product_mapping", "fresh", "not_applicable"),
        assessment("inventory_profit", "fresh", "covered"),
        assessment("supplier_safety", "fresh", "covered"),
      ]),
    );

    const result = await service.build({ reportDate: "2026-07-04" });
    const googleAds = result.sources.find(
      (source) => source.sourceKey === "google_ads",
    )!;
    const rendered = JSON.stringify(result);

    expect(googleAds.status).toBe("missing_config");
    expect(googleAds.canUseForAdsAutomationDecision).toBe(false);
    expect(googleAds.missingCredentialOrConfigBlockers).toEqual(
      expect.arrayContaining([
        "missing_config:GOOGLE_ADS_CLIENT_SECRET",
        "missing_config:GOOGLE_ADS_REFRESH_TOKEN",
        "missing_config:GOOGLE_ADS_CUSTOMER_ID",
        "blocked_config:GOOGLE_ADS_PRODUCTION_ENABLED_must_be_false_or_absent",
      ]),
    );
    expect(googleAds.requiredConfigPresence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "GOOGLE_ADS_DEVELOPER_TOKEN",
          present: true,
          secret: true,
          value_exposed: false,
        }),
        expect.objectContaining({
          key: "GOOGLE_ADS_CLIENT_SECRET",
          present: false,
          secret: true,
          value_exposed: false,
        }),
        expect.objectContaining({
          key: "GOOGLE_ADS_PRODUCTION_ENABLED",
          present: true,
          acceptable: false,
          value_exposed: false,
        }),
      ]),
    );
    expect(result.summary.missing_config_sources).toEqual(["google_ads"]);
    expect(result.safety).toEqual(
      expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        google_ads_production_enabled: false,
      }),
    );
    expect(rendered).not.toMatch(
      /dev-token-plaintext-secret|client-id-plaintext-secret|client-secret-value|refresh-token-value/i,
    );
  });

  it("does not call provider, Google Ads, validateOnly, live execution, or mutation collaborators", async () => {
    setGoogleAdsConfigPresent();
    const { service, freshness } = createService(
      gate([
        assessment("google_ads", "fresh", "covered"),
        assessment("advertising_costs", "fresh", "covered"),
        assessment("product_mapping", "fresh", "not_applicable"),
        assessment("inventory_profit", "fresh", "covered"),
        assessment("supplier_safety", "fresh", "covered"),
      ]),
    );
    const providerAdapter = { syncReadOnly: jest.fn() };
    const validateOnly = { build: jest.fn() };
    const liveExecution = { execute: jest.fn() };

    const result = await service.build({ reportDate: "2026-07-04" });

    expect(freshness.assessAll).toHaveBeenCalledTimes(1);
    expect(providerAdapter.syncReadOnly).not.toHaveBeenCalled();
    expect(validateOnly.build).not.toHaveBeenCalled();
    expect(liveExecution.execute).not.toHaveBeenCalled();
    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "ready",
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }),
    );
    expect(result.safety).toEqual(
      expect.objectContaining({
        read_only: true,
        local_only: true,
        adapter_boundary_only: true,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
      }),
    );
    expect(result.decisionGates).toEqual(
      expect.objectContaining({
        canUseGoogleAdsDataClaim: true,
        canGenerateActionDraft: true,
        canRecommendAdsScale: true,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
  });

  it.each([
    {
      sourceKey: "google_ads",
      freshnessStatus: "stale",
      coverageStatus: "covered",
      blockingReasons: ["freshness_stale"],
      summaryBucket: "stale_sources",
      googleAdsClaimAllowed: false,
    },
    {
      sourceKey: "advertising_costs",
      freshnessStatus: "fresh",
      coverageStatus: "no_records_for_report_date",
      blockingReasons: ["coverage_no_records_for_report_date"],
      summaryBucket: "missing_coverage_sources",
      googleAdsClaimAllowed: true,
    },
    {
      sourceKey: "product_mapping",
      freshnessStatus: "missing",
      coverageStatus: "missing",
      blockingReasons: ["freshness_missing", "coverage_missing"],
      summaryBucket: "not_synced_sources",
      googleAdsClaimAllowed: true,
    },
    {
      sourceKey: "inventory_profit",
      freshnessStatus: "stale",
      coverageStatus: "covered",
      blockingReasons: ["freshness_stale"],
      summaryBucket: "stale_sources",
      googleAdsClaimAllowed: true,
    },
    {
      sourceKey: "supplier_safety",
      freshnessStatus: "missing",
      coverageStatus: "missing",
      blockingReasons: ["freshness_missing", "coverage_missing"],
      summaryBucket: "not_synced_sources",
      googleAdsClaimAllowed: true,
    },
  ] as const)(
    "blocks action and scale gates when $sourceKey source readiness is unsafe",
    async ({
      sourceKey,
      freshnessStatus,
      coverageStatus,
      blockingReasons,
      summaryBucket,
      googleAdsClaimAllowed,
    }) => {
      setGoogleAdsConfigPresent();
      const sourceBlockingReasons = [...blockingReasons];
      const { service } = createService(
        gate([
          assessment(
            "google_ads",
            sourceKey === "google_ads" ? freshnessStatus : "fresh",
            "covered",
            sourceKey === "google_ads" ? { blockingReasons: sourceBlockingReasons } : {},
          ),
          assessment(
            "advertising_costs",
            sourceKey === "advertising_costs" ? freshnessStatus : "fresh",
            sourceKey === "advertising_costs" ? coverageStatus : "covered",
            sourceKey === "advertising_costs" ? { blockingReasons: sourceBlockingReasons } : {},
          ),
          assessment(
            "product_mapping",
            sourceKey === "product_mapping" ? freshnessStatus : "fresh",
            sourceKey === "product_mapping" ? coverageStatus : "not_applicable",
            sourceKey === "product_mapping"
              ? { reportDateRecordCount: null, blockingReasons: sourceBlockingReasons }
              : { reportDateRecordCount: null },
          ),
          assessment(
            "inventory_profit",
            sourceKey === "inventory_profit" ? freshnessStatus : "fresh",
            sourceKey === "inventory_profit" ? coverageStatus : "covered",
            sourceKey === "inventory_profit" ? { blockingReasons: sourceBlockingReasons } : {},
          ),
          assessment(
            "supplier_safety",
            sourceKey === "supplier_safety" ? freshnessStatus : "fresh",
            sourceKey === "supplier_safety" ? coverageStatus : "covered",
            sourceKey === "supplier_safety" ? { blockingReasons: sourceBlockingReasons } : {},
          ),
        ]),
      );

      const result = await service.build({
        reportDate: "2026-07-04",
        now: "2026-07-04T05:00:00.000Z",
      });
      const evidence = result.decisionEvidence.find((item) => item.sourceKey === sourceKey)!;

      expect(result.summary).toEqual(expect.objectContaining({
        status: "blocked",
        blocked_sources: expect.arrayContaining([sourceKey]),
        ready_source_count: 4,
        blocked_source_count: 1,
      }));
      expect(result.summary[summaryBucket]).toEqual(expect.arrayContaining([sourceKey]));
      expect(result.decisionGates).toEqual(expect.objectContaining({
        canUseGoogleAdsDataClaim: googleAdsClaimAllowed,
        canGenerateActionDraft: false,
        canRecommendAdsScale: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }));
      expect(evidence).toEqual(expect.objectContaining({
        sourceKey,
        freshnessStatus,
        coverageStatus,
        blockingReason: expect.any(String),
        blockingReasons: expect.arrayContaining([
          `${sourceKey}_not_ready_for_ads_automation_decision`,
          ...sourceBlockingReasons,
        ]),
        canUseForAdsAutomationDecision: false,
      }));
      expect(result.safety).toEqual(expect.objectContaining({
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
      }));
    },
  );

  it("turns platform source status into decision evidence that allows fresh drafts and blocks stale or uncovered sources", async () => {
    setGoogleAdsConfigPresent();
    const draftPreview = new AdsAutomationDecisionDraftPreviewService();
    const fresh = createService(
      gate([
        assessment("google_ads", "fresh", "covered"),
        assessment("advertising_costs", "fresh", "covered"),
        assessment("product_mapping", "fresh", "covered"),
        assessment("inventory_profit", "fresh", "covered"),
        assessment("supplier_safety", "fresh", "covered"),
      ]),
    );

    const freshStatus = await fresh.service.build({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
    });
    const freshPreview = draftPreview.build(decisionReadinessSnapshot(), {
      source: "mongo_read_model",
      sourceSyncDecisionEvidence: freshStatus.decisionEvidence,
      sourceSyncDecisionGates: freshStatus.decisionGates,
    });

    expect(freshStatus.summary).toEqual(expect.objectContaining({
      status: "ready",
      ready_source_count: 5,
      blocked_source_count: 0,
    }));
    expect(freshStatus.decisionEvidence.every((item) =>
      item.canUseForAdsAutomationDecision === true,
    )).toBe(true);
    expect(freshPreview.summary).toEqual(expect.objectContaining({
      drafts_created: 4,
      blocked_drafts: 0,
      provider_action_drafts: 2,
      internal_task_drafts: 2,
    }));
    expect(freshPreview.drafts.map((draft) => draft.action_type).sort()).toEqual([
      "pause_ad_group",
      "stop_import_review",
      "supplier_sourcing",
      "update_campaign_budget",
    ].sort());

    const blocked = createService(
      gate([
        assessment("google_ads", "stale", "covered", {
          blockingReasons: ["freshness_stale"],
        }),
        assessment("advertising_costs", "fresh", "no_records_for_report_date", {
          blockingReasons: ["coverage_no_records_for_report_date"],
        }),
        assessment("product_mapping", "missing", "missing", {
          latestRecordUpdatedAt: null,
          latestRecordDate: null,
          blockingReasons: ["freshness_missing", "coverage_missing"],
        }),
        assessment("inventory_profit", "stale", "covered", {
          latestRecordUpdatedAt: "2026-07-02T04:45:00.000Z",
          blockingReasons: ["freshness_stale"],
        }),
        assessment("supplier_safety", "missing", "missing", {
          latestRecordUpdatedAt: null,
          latestRecordDate: null,
          blockingReasons: ["freshness_missing", "coverage_missing"],
        }),
      ]),
    );

    const blockedStatus = await blocked.service.build({
      reportDate: "2026-07-04",
      now: "2026-07-04T05:00:00.000Z",
    });
    const blockedPreview = draftPreview.build(decisionReadinessSnapshot(), {
      source: "mongo_read_model",
      sourceSyncDecisionEvidence: blockedStatus.decisionEvidence,
      sourceSyncDecisionGates: blockedStatus.decisionGates,
    });

    expect(blockedStatus.summary).toEqual(expect.objectContaining({
      status: "blocked",
      blocked_sources: [
        "google_ads",
        "advertising_costs",
        "product_mapping",
        "inventory_profit",
        "supplier_safety",
      ],
      stale_sources: ["google_ads", "inventory_profit"],
      missing_coverage_sources: ["advertising_costs"],
      not_synced_sources: ["product_mapping", "supplier_safety"],
    }));
    expect(blockedStatus.decisionGates).toEqual(expect.objectContaining({
      canUseGoogleAdsDataClaim: false,
      canGenerateActionDraft: false,
      canRecommendAdsScale: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    }));
    expect(blockedStatus.decisionEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: "google_ads",
        freshnessStatus: "stale",
        coverageStatus: "covered",
        blockingReasons: expect.arrayContaining([
          "google_ads_not_ready_for_ads_automation_decision",
          "freshness_stale",
        ]),
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: "advertising_costs",
        coverageStatus: "no_records_for_report_date",
        blockingReasons: expect.arrayContaining([
          "advertising_costs_not_ready_for_ads_automation_decision",
          "coverage_no_records_for_report_date",
        ]),
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: "product_mapping",
        latestRecordDate: null,
        blockingReasons: expect.arrayContaining([
          "product_mapping_not_ready_for_ads_automation_decision",
          "freshness_missing",
          "coverage_missing",
        ]),
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: "inventory_profit",
        freshnessStatus: "stale",
        blockingReasons: expect.arrayContaining([
          "inventory_profit_not_ready_for_ads_automation_decision",
          "freshness_stale",
        ]),
        canUseForAdsAutomationDecision: false,
      }),
      expect.objectContaining({
        sourceKey: "supplier_safety",
        latestRecordDate: null,
        blockingReasons: expect.arrayContaining([
          "supplier_safety_not_ready_for_ads_automation_decision",
          "freshness_missing",
          "coverage_missing",
        ]),
        canUseForAdsAutomationDecision: false,
      }),
    ]));
    expect(blockedPreview.summary).toEqual(expect.objectContaining({
      drafts_created: 4,
      blocked_drafts: 4,
    }));
    expect(blockedPreview.drafts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        action_type: "update_campaign_budget",
        missing_data_blockers: expect.arrayContaining([
          "source_sync_gate_blocked_action_draft",
          "google_ads_not_ready_for_ads_automation_decision",
          "advertising_costs_not_ready_for_ads_automation_decision",
          "product_mapping_not_ready_for_ads_automation_decision",
          "inventory_profit_not_ready_for_ads_automation_decision",
          "supplier_safety_not_ready_for_ads_automation_decision",
        ]),
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      }),
      expect.objectContaining({
        action_type: "stop_import_review",
        provider: "erp_internal",
        missing_data_blockers: expect.arrayContaining([
          "product_mapping_not_ready_for_ads_automation_decision",
          "inventory_profit_not_ready_for_ads_automation_decision",
          "supplier_safety_not_ready_for_ads_automation_decision",
        ]),
      }),
      expect.objectContaining({
        action_type: "supplier_sourcing",
        provider: "erp_internal",
        missing_data_blockers: expect.arrayContaining([
          "supplier_safety_not_ready_for_ads_automation_decision",
        ]),
      }),
    ]));
  });

  it("surfaces stale inventory/profit and missing supplier safety as decision blockers", async () => {
    setGoogleAdsConfigPresent();
    const { service } = createService(
      gate([
        assessment("google_ads", "fresh", "covered"),
        assessment("advertising_costs", "fresh", "covered"),
        assessment("product_mapping", "fresh", "not_applicable"),
        assessment("inventory_profit", "stale", "covered", {
          latestRecordUpdatedAt: "2026-07-02T04:45:00.000Z",
          blockingReasons: ["freshness_stale"],
        }),
        assessment("supplier_safety", "missing", "missing", {
          latestRecordUpdatedAt: null,
          latestRecordDate: null,
          blockingReasons: ["freshness_missing", "coverage_missing"],
        }),
      ]),
    );

    const result = await service.build({ reportDate: "2026-07-04" });

    expect(result.summary).toEqual(
      expect.objectContaining({
        status: "blocked",
        stale_sources: ["inventory_profit"],
        not_synced_sources: ["supplier_safety"],
        blocked_sources: ["inventory_profit", "supplier_safety"],
        next_required_action: "resolve_source_sync_blockers",
      }),
    );
    expect(result.decisionGates).toEqual(
      expect.objectContaining({
        canUseGoogleAdsDataClaim: true,
        canGenerateActionDraft: false,
        canRecommendAdsScale: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "inventory_profit",
          status: "stale",
          freshness: expect.objectContaining({
            freshnessStatus: "stale",
            latestRecordUpdatedAt: "2026-07-02T04:45:00.000Z",
          }),
          sourceSyncBlockers: ["freshness_stale"],
          canUseForAdsAutomationDecision: false,
        }),
        expect.objectContaining({
          sourceKey: "supplier_safety",
          status: "not_synced",
          reportDateCoverage: expect.objectContaining({
            coverageStatus: "missing",
          }),
          sourceSyncBlockers: ["freshness_missing", "coverage_missing"],
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
  });
});
