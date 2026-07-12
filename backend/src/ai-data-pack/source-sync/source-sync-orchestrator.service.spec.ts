import { GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION } from "../provider-adapters/provider-adapter.tokens";
import type { ProviderReadOnlySyncResult } from "../provider-adapters/google-ads-readonly/google-ads-readonly-adapter.types";
import {
  FreshnessGateResult,
  SourceAssessment,
} from "../source-registry/source-registry.types";
import { SourceSyncOrchestratorService } from "./source-sync-orchestrator.service";
import { SourceSyncPolicyService } from "./source-sync-policy.service";

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
    reportDateRecordCount: coverageStatus === "covered" ? 1 : 0,
    expectedRecordCount: coverageStatus === "covered" ? 1 : null,
    evidence: [],
    warnings: [],
    blockingReasons: [],
    canUseForDecision: strong ? "yes" : cautious ? "cautious" : "no",
    ...overrides,
  };
}

function gate(assessments: SourceAssessment[]): FreshnessGateResult {
  const strong = (sourceKey: string) => {
    const item = assessments.find(
      (candidate) => candidate.sourceKey === sourceKey,
    );
    return (
      item?.freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(item.coverageStatus)
    );
  };
  return {
    reportDate: "2026-06-12",
    evaluatedAt: "2026-06-13T00:00:00.000Z",
    dbOnly: true,
    providerSyncAttempted: false,
    mutationAttempted: false,
    assessments,
    decisionGate: {
      canRecommendAdsScale:
        strong("google_ads") &&
        strong("advertising_costs") &&
        strong("product_mapping") &&
        strong("inventory_profit") &&
        strong("supplier_safety"),
      canConcludeProfitStrongly: false,
      canEvaluateSalesToday: false,
      canEvaluateFinanceStrongly: false,
      canUseLtvStrongly: false,
      canGenerateActionDraft:
        strong("google_ads") &&
        strong("advertising_costs") &&
        strong("product_mapping") &&
        strong("inventory_profit") &&
        strong("supplier_safety"),
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
  };
}

function adapterResult(
  overrides: Partial<ProviderReadOnlySyncResult> = {},
): ProviderReadOnlySyncResult {
  return {
    sourceKey: "google_ads",
    mode: "read_only",
    exportJobId: "JOB-1",
    correlationId: "CORR-1",
    policyVersion: "policy-v1",
    status: "success",
    providerSyncAttempted: true,
    mutationAttempted: false,
    syncRunId: "GAROSR-1",
    requestedCustomerIds: ["1234567890"],
    selectedCustomerIds: ["1234567890"],
    dateFrom: "2026-06-12",
    dateTo: "2026-06-12",
    startedAt: "2026-06-13T00:00:00.000Z",
    completedAt: "2026-06-13T00:00:01.000Z",
    durationMs: 1_000,
    attemptCount: 1,
    retryClassifications: [],
    counts: { campaigns: 1 },
    localWriteTargets: [
      "google_ads_sync_runs",
      "google_ads_campaigns",
      "ai_data_pack_source_sync_audits",
    ],
    writeTelemetrySummary: {
      operationCount: 2,
      recordCount: 2,
      targets: ["google_ads_sync_runs", "google_ads_campaigns"],
      operations: { insert: 1, update: 0, upsert: 1 },
      writes: [],
    },
    lock: {
      distributedLockRuntime: "implemented_mongo",
      key: "google_ads:scope:2026-06-12:2026-06-12",
      owner: "JOB-1:owner",
      scopeHash: "scope",
      acquired: true,
    },
    errors: [],
    warnings: [],
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
    ...overrides,
  };
}

function createService(options?: {
  freshnessResults?: FreshnessGateResult[];
  adapter?: any;
}) {
  const freshness = {
    assessAll: jest.fn(),
  };
  for (const result of options?.freshnessResults || []) {
    freshness.assessAll.mockResolvedValueOnce(result);
  }
  const adapter =
    options?.adapter ||
    ({
      sourceKey: "google_ads",
      mode: "read_only",
      supportsSourceRegistry: true,
      assessLocalFreshness: jest.fn(),
      assessCoverage: jest.fn(),
      syncReadOnly: jest.fn().mockResolvedValue(adapterResult()),
    } as any);
  const service = new SourceSyncOrchestratorService(
    freshness as any,
    new SourceSyncPolicyService(),
    adapter,
  );
  return { service, freshness, adapter };
}

const baseInput = {
  exportJobId: "JOB-1",
  correlationId: "CORR-1",
  policyVersion: "policy-v1",
  reportDate: "2026-06-12",
  dateFrom: "2026-06-12",
  dateTo: "2026-06-12",
  packTypes: ["director_data_pack"],
  customerIds: ["1234567890"],
  now: new Date("2026-06-13T00:00:00.000Z"),
};

describe("SourceSyncOrchestratorService", () => {
  it("keeps export_cached DB-only and never calls the Google Ads adapter", async () => {
    const pre = gate([
      assessment("google_ads", "stale", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const { service, freshness, adapter } = createService({
      freshnessResults: [pre],
    });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      syncPolicy: "export_cached",
    });

    expect(freshness.assessAll).toHaveBeenCalledTimes(1);
    expect(adapter.syncReadOnly).not.toHaveBeenCalled();
    expect(result.providerSyncAttempted).toBe(false);
    expect(result.mutationAttempted).toBe(false);
    expect(result.sourceImpact.google_ads.status).toBe("stale");
    expect(result.sourceImpact.google_ads.reportDate).toBe("2026-06-12");
    expect(result.sourceImpact.google_ads.canUseForAdsAutomationDecision).toBe(
      false,
    );
    expect(result.sourceImpact.google_ads.blockingReasons).toContain(
      "google_ads_not_ready_for_ads_automation_decision",
    );
    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        adapterDecision: "skipped_export_cached",
      }),
    );
    expect(result.decisionGates.canUseGoogleAdsDataClaim).toBe(false);
    expect(result.decisionGates.canGenerateActionDraft).toBe(false);
    expect(result.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-06-12",
          freshnessStatus: "stale",
          coverageStatus: "covered",
          blockingReason: "google_ads_not_ready_for_ads_automation_decision",
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(result.canImportActionFile).toBe(false);
    expect(result.canDryRun).toBe(false);
    expect(result.canExecuteLive).toBe(false);
  });

  it("skips sync_if_stale when Google Ads is already fresh and covered", async () => {
    const pre = gate([
      assessment("google_ads", "fresh", "covered", {
        lastSuccessfulSyncAt: "2026-06-12T23:30:00.000Z",
        latestRecordDate: "2026-06-12",
      }),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
      assessment("inventory_profit", "fresh", "covered"),
      assessment("supplier_safety", "fresh", "covered"),
    ]);
    const { service, adapter } = createService({ freshnessResults: [pre] });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      sourceKeys: ["google_ads"],
      syncPolicy: "sync_if_stale",
    });

    expect(adapter.syncReadOnly).not.toHaveBeenCalled();
    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        adapterDecision: "skipped_fresh_covered",
      }),
    );
    expect(result.decisionGates.canRecommendAdsScale).toBe(true);
    expect(result.decisionGates.canUseGoogleAdsDataClaim).toBe(true);
    expect(result.decisionGates.canGenerateActionDraft).toBe(true);
    expect(result.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-06-12",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          lastSuccessfulSyncAt: "2026-06-12T23:30:00.000Z",
          latestRecordDate: "2026-06-12",
          blockingReason: null,
          blockingReasons: [],
          canUseForAdsAutomationDecision: true,
        }),
      ]),
    );
    expect(result.providerSyncAttempted).toBe(false);
    expect(result.mutationAttempted).toBe(false);
    expect(result.canImportActionFile).toBe(false);
    expect(result.canDryRun).toBe(false);
    expect(result.canExecuteLive).toBe(false);
  });

  it("blocks scale, kill, pause, and draft gates when advertising costs are stale or missing", async () => {
    const pre = gate([
      assessment("google_ads", "fresh", "covered"),
      assessment("advertising_costs", "stale", "missing", {
        latestRecordDate: "2026-06-10",
        blockingReasons: ["freshness_stale", "coverage_missing"],
      }),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const { service, adapter } = createService({ freshnessResults: [pre] });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      sourceKeys: ["advertising_costs"],
      syncPolicy: "sync_if_stale",
    });

    expect(adapter.syncReadOnly).not.toHaveBeenCalled();
    expect(result.sourceImpact.advertising_costs).toEqual(
      expect.objectContaining({
        status: "stale",
        freshnessStatus: "stale",
        coverageStatus: "missing",
        latestRecordDate: "2026-06-10",
        canUseForAdsAutomationDecision: false,
      }),
    );
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        "freshness_stale",
        "coverage_missing",
        "advertising_costs_not_ready_for_ads_automation_decision",
      ]),
    );
    expect(result.decisionGates.canRecommendAdsScale).toBe(false);
    expect(result.decisionGates.canGenerateActionDraft).toBe(false);
    expect(result.decisionGates.canImportActionFile).toBe(false);
    expect(result.decisionGates.canDryRun).toBe(false);
    expect(result.decisionGates.canExecuteLive).toBe(false);
    expect(result.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "advertising_costs",
          reportDate: "2026-06-12",
          freshnessStatus: "stale",
          coverageStatus: "missing",
          latestRecordDate: "2026-06-10",
          blockingReasons: expect.arrayContaining([
            "freshness_stale",
            "coverage_missing",
            "advertising_costs_not_ready_for_ads_automation_decision",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(result.providerSyncAttempted).toBe(false);
    expect(result.mutationAttempted).toBe(false);
  });

  it("blocks product allocation and supplier decision drafts when product mapping is stale or missing", async () => {
    const pre = gate([
      assessment("google_ads", "fresh", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "missing", "missing", {
        blockingReasons: ["freshness_missing", "coverage_missing"],
      }),
    ]);
    const { service, adapter } = createService({ freshnessResults: [pre] });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      sourceKeys: ["product_mapping"],
      syncPolicy: "sync_if_stale",
    });

    expect(adapter.syncReadOnly).not.toHaveBeenCalled();
    expect(result.sourceImpact.product_mapping).toEqual(
      expect.objectContaining({
        status: "not_synced",
        freshnessStatus: "missing",
        coverageStatus: "missing",
        canUseForAdsAutomationDecision: false,
      }),
    );
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        "freshness_missing",
        "coverage_missing",
        "product_mapping_not_ready_for_ads_automation_decision",
      ]),
    );
    expect(result.decisionGates.canRecommendAdsScale).toBe(false);
    expect(result.decisionGates.canGenerateActionDraft).toBe(false);
    expect(result.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "product_mapping",
          reportDate: "2026-06-12",
          freshnessStatus: "missing",
          coverageStatus: "missing",
          blockingReasons: expect.arrayContaining([
            "freshness_missing",
            "coverage_missing",
            "product_mapping_not_ready_for_ads_automation_decision",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
    expect(result.providerSyncAttempted).toBe(false);
    expect(result.mutationAttempted).toBe(false);
  });

  it.each([
    {
      sourceKey: "inventory_profit",
      freshnessStatus: "stale" as const,
      coverageStatus: "covered" as const,
      blockingReasons: ["freshness_stale"],
      expectedStatus: "stale",
      companionSourceKey: "supplier_safety",
    },
    {
      sourceKey: "supplier_safety",
      freshnessStatus: "missing" as const,
      coverageStatus: "missing" as const,
      blockingReasons: ["freshness_missing", "coverage_missing"],
      expectedStatus: "not_synced",
      companionSourceKey: "inventory_profit",
    },
  ])(
    "blocks ads automation decisions when %s readiness is not fresh and covered",
    async ({
      sourceKey,
      freshnessStatus,
      coverageStatus,
      blockingReasons,
      expectedStatus,
      companionSourceKey,
    }) => {
      const pre = gate([
        assessment("google_ads", "fresh", "covered"),
        assessment("advertising_costs", "fresh", "covered"),
        assessment("product_mapping", "fresh", "covered"),
        assessment(sourceKey, freshnessStatus, coverageStatus, {
          latestRecordDate: coverageStatus === "covered" ? "2026-06-12" : null,
          blockingReasons,
        }),
        assessment(companionSourceKey, "fresh", "covered"),
      ]);
      const { service, adapter } = createService({ freshnessResults: [pre] });

      const result = await service.prepareSourcesForExportJob({
        ...baseInput,
        sourceKeys: [sourceKey],
        syncPolicy: "sync_if_stale",
      });

      expect(adapter.syncReadOnly).not.toHaveBeenCalled();
      expect(result.sourceImpact[sourceKey]).toEqual(
        expect.objectContaining({
          status: expectedStatus,
          freshnessStatus,
          coverageStatus,
          canUseForAdsAutomationDecision: false,
        }),
      );
      expect(result.blockingReasons).toEqual(
        expect.arrayContaining([
          ...blockingReasons,
          `${sourceKey}_not_ready_for_ads_automation_decision`,
        ]),
      );
      expect(result.decisionGates.canRecommendAdsScale).toBe(false);
      expect(result.decisionGates.canGenerateActionDraft).toBe(false);
      expect(result.decisionEvidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceKey,
            reportDate: "2026-06-12",
            blockingReasons: expect.arrayContaining([
              ...blockingReasons,
              `${sourceKey}_not_ready_for_ads_automation_decision`,
            ]),
            canUseForAdsAutomationDecision: false,
          }),
        ]),
      );
      expect(result.providerSyncAttempted).toBe(false);
      expect(result.mutationAttempted).toBe(false);
    },
  );

  it("calls the Google Ads adapter for stale sync_if_stale and trusts only post-sync DB assessment", async () => {
    const pre = gate([
      assessment("google_ads", "stale", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
      assessment("inventory_profit", "fresh", "covered"),
      assessment("supplier_safety", "fresh", "covered"),
    ]);
    const post = gate([
      assessment("google_ads", "fresh", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
      assessment("inventory_profit", "fresh", "covered"),
      assessment("supplier_safety", "fresh", "covered"),
    ]);
    const { service, freshness, adapter } = createService({
      freshnessResults: [pre, post],
    });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      sourceKeys: ["google_ads"],
      syncPolicy: "sync_if_stale",
    });

    expect(freshness.assessAll).toHaveBeenCalledTimes(2);
    expect(adapter.syncReadOnly).toHaveBeenCalledWith(
      expect.objectContaining({
        exportJobId: "JOB-1",
        correlationId: "CORR-1",
        sourceKey: "google_ads",
        syncPolicy: "sync_if_stale",
        customerIds: ["1234567890"],
        internalRequester: expect.objectContaining({
          type: "internal_job",
          permissions: [GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION],
        }),
      }),
    );
    expect(result.providerSyncAttempted).toBe(true);
    expect(result.sourceImpact.google_ads.status).toBe("fresh_covered");
    expect(result.decisionGates.canRecommendAdsScale).toBe(true);
    expect(result.decisionGates.canGenerateActionDraft).toBe(true);
    expect(result.decisionGates.canImportActionFile).toBe(false);
    expect(result.decisionGates.canDryRun).toBe(false);
    expect(result.decisionGates.canExecuteLive).toBe(false);
  });

  it("blocks sync_required when the adapter is unavailable", async () => {
    const pre = gate([
      assessment("google_ads", "stale", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const freshness = { assessAll: jest.fn().mockResolvedValue(pre) };
    const service = new SourceSyncOrchestratorService(
      freshness as any,
      new SourceSyncPolicyService(),
      undefined,
    );

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      syncPolicy: "sync_required",
    });

    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        adapterDecision: "adapter_unavailable",
      }),
    );
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        "google_ads_readonly_adapter_unavailable",
        "google_ads_not_fresh_after_sync",
      ]),
    );
    expect(result.decisionGates.canRecommendAdsScale).toBe(false);
  });

  it("does not treat google-ads.read as source-sync execution permission", async () => {
    const pre = gate([
      assessment("google_ads", "stale", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const { service, adapter } = createService({ freshnessResults: [pre] });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      syncPolicy: "sync_if_stale",
      internalRequester: {
        id: "manager-1",
        type: "internal_job",
        permissions: ["google-ads.read"],
      },
    });

    expect(adapter.syncReadOnly).not.toHaveBeenCalled();
    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        adapterDecision: "adapter_scope_denied",
      }),
    );
    expect(result.warnings).toContain(
      "google_ads_readonly_adapter_scope_denied",
    );
  });

  it("blocks sync_required when adapter succeeds but DB post-assessment still lacks report-date records", async () => {
    const pre = gate([
      assessment("google_ads", "stale", "missing"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const post = gate([
      assessment("google_ads", "fresh", "no_records_for_report_date"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const { service } = createService({ freshnessResults: [pre, post] });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      syncPolicy: "sync_required",
    });

    expect(result.sourceImpact.google_ads.status).toBe(
      "no_records_for_report_date",
    );
    expect(result.blockingReasons).toContain("google_ads_not_fresh_after_sync");
    expect(result.decisionGates.canRecommendAdsScale).toBe(false);
    expect(result.decisionGates.canUseGoogleAdsDataClaim).toBe(false);
    expect(result.decisionGates.canGenerateActionDraft).toBe(false);
    expect(result.decisionEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "google_ads",
          reportDate: "2026-06-12",
          freshnessStatus: "fresh",
          coverageStatus: "no_records_for_report_date",
          blockingReasons: expect.arrayContaining([
            "google_ads_not_ready_for_ads_automation_decision",
          ]),
          canUseForAdsAutomationDecision: false,
        }),
      ]),
    );
  });

  it("marks adapter exceptions as failed without exposing live execution gates", async () => {
    const pre = gate([
      assessment("google_ads", "stale", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const post = gate([
      assessment("google_ads", "stale", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "covered"),
    ]);
    const adapter = {
      sourceKey: "google_ads",
      mode: "read_only",
      supportsSourceRegistry: true,
      syncReadOnly: jest.fn().mockRejectedValue(new Error("provider failed")),
    };
    const { service } = createService({
      freshnessResults: [pre, post],
      adapter,
    });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      syncPolicy: "sync_required",
    });

    expect(result.sourceDecisions).toContainEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        adapterDecision: "adapter_failed",
        adapterResultSummary: expect.objectContaining({
          status: "failed",
          mutationAttempted: false,
          canImportActionFile: false,
          canDryRun: false,
          canExecuteLive: false,
        }),
      }),
    );
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        "google_ads_readonly_adapter_failed",
        "google_ads_not_fresh_after_sync",
      ]),
    );
  });

  it("keeps non-Google sources DB-only and preserves unsupported impact", async () => {
    const pre = gate([
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "unsupported", "unsupported"),
    ]);
    const { service, adapter } = createService({ freshnessResults: [pre] });

    const result = await service.prepareSourcesForExportJob({
      ...baseInput,
      sourceKeys: ["advertising_costs", "product_mapping"],
      syncPolicy: "sync_if_stale",
    });

    expect(adapter.syncReadOnly).not.toHaveBeenCalled();
    expect(result.sourceImpact.advertising_costs.status).toBe("fresh_covered");
    expect(result.sourceImpact.product_mapping.status).toBe("unsupported");
    expect(result.decisionGates.canGenerateActionDraft).toBe(false);
    expect(result.sourceDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKey: "advertising_costs",
          adapterDecision: "db_only",
        }),
        expect.objectContaining({
          sourceKey: "product_mapping",
          adapterDecision: "db_only",
        }),
      ]),
    );
  });
});
