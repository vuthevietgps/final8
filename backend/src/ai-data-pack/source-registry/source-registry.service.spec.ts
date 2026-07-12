import { readFileSync } from "fs";
import { join } from "path";
import { CoverageGateService } from "./coverage-gate.service";
import { DbWatermarkService } from "./db-watermark.service";
import { FreshnessGateService } from "./freshness-gate.service";
import { SourceRegistryService } from "./source-registry.service";
import { SourceAssessment, SourceRegistryEntry } from "./source-registry.types";

function valueAt(row: Record<string, any>, field: string): any {
  return field.split(".").reduce((value, part) => value?.[part], row);
}

function matches(
  row: Record<string, any>,
  filter: Record<string, any>,
): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$and") {
      return (expected as Record<string, any>[]).every((item) =>
        matches(row, item),
      );
    }
    if (key === "$or") {
      return (expected as Record<string, any>[]).some((item) =>
        matches(row, item),
      );
    }
    const actual = valueAt(row, key);
    if (
      expected &&
      typeof expected === "object" &&
      !Array.isArray(expected) &&
      !(expected instanceof Date)
    ) {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === "$exists") return (actual !== undefined) === operand;
        if (operator === "$ne") return actual !== operand;
        if (operator === "$gt") return actual > operand;
        if (operator === "$gte") return actual >= operand;
        if (operator === "$lt") return actual < operand;
        if (operator === "$lte") return actual <= operand;
        return false;
      });
    }
    return actual === expected;
  });
}

class FakeConnection {
  readonly reads: string[] = [];

  constructor(
    private readonly rows: Record<string, Record<string, any>[]>,
    private readonly failingCollections: string[] = [],
  ) {}

  collection(name: string) {
    this.reads.push(name);
    if (this.failingCollections.includes(name)) {
      throw new Error(
        "Bearer provider-secret director@example.com +84901234567",
      );
    }
    const rows = this.rows[name] || [];
    return {
      findOne: async (
        filter: Record<string, any> = {},
        options: Record<string, any> = {},
      ) => {
        const matched = rows.filter((row) => matches(row, filter));
        const sort = options.sort || {};
        const [sortField, direction] = Object.entries(sort)[0] || [];
        if (sortField) {
          matched.sort((left, right) => {
            const leftValue = valueAt(left, sortField);
            const rightValue = valueAt(right, sortField);
            return (
              (new Date(leftValue).getTime() - new Date(rightValue).getTime()) *
              Number(direction)
            );
          });
        }
        return matched[0] || null;
      },
      countDocuments: async (filter: Record<string, any> = {}) =>
        rows.filter((row) => matches(row, filter)).length,
    };
  }
}

function testSource(
  overrides: Partial<SourceRegistryEntry> = {},
): SourceRegistryEntry {
  return {
    sourceKey: "test_source",
    domain: "orders",
    businessImportance: "critical",
    packRelevance: ["director", "data_quality"],
    defaultMaxStalenessMinutes: 60,
    freshnessMethod: "max_updated_at",
    coverageMethod: "report_date_count",
    readOnlyDbOnly: true,
    providerSyncAllowedInThisPr: false,
    mutationAllowed: false,
    availability: "supported",
    watermarkTargets: [
      {
        collectionName: "records",
        fields: [
          { field: "updatedAt", kind: "record_updated", valueType: "date" },
          { field: "recordDate", kind: "record_date", valueType: "date" },
        ],
      },
    ],
    coverageTargets: [
      {
        collectionName: "records",
        mode: "report_date",
        field: "recordDate",
        valueType: "date",
      },
    ],
    ...overrides,
  };
}

function assessment(
  sourceKey: string,
  freshnessStatus: SourceAssessment["freshnessStatus"] = "fresh",
  coverageStatus: SourceAssessment["coverageStatus"] = "covered",
): SourceAssessment {
  return {
    sourceKey,
    status: freshnessStatus,
    freshnessStatus,
    coverageStatus,
    evidence: [],
    warnings: [],
    blockingReasons: [],
    canUseForDecision:
      freshnessStatus === "fresh" &&
      ["covered", "not_applicable"].includes(coverageStatus)
        ? "yes"
        : "no",
  };
}

describe("SourceRegistryService", () => {
  it("contains every minimum Prompt 5 source with DB-only no-mutation invariants", () => {
    const sources = new SourceRegistryService().list();
    const keys = sources.map((source) => source.sourceKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        "google_ads",
        "meta_ads",
        "tiktok_ads",
        "zalo_ads",
        "advertising_costs",
        "crm_leads",
        "orders",
        "payments_or_order_payments",
        "finance",
        "loans_debt",
        "operations",
        "product_mapping",
        "inventory_profit",
        "supplier_safety",
        "decision_history",
        "external_market",
        "supplier_settlement",
        "return_refund",
        "customer_referral",
        "employee_activity_payroll",
        "system_settings",
      ]),
    );
    for (const source of sources) {
      expect(source.readOnlyDbOnly).toBe(true);
      expect(source.providerSyncAllowedInThisPr).toBe(false);
      expect(source.mutationAllowed).toBe(false);
    }
  });

  it("does not classify unsupported sources as fresh or read the DB", async () => {
    const connection = new FakeConnection({});
    const service = new DbWatermarkService(connection as any);
    const result = await service.assess(
      new SourceRegistryService().get("zalo_ads")!,
    );

    expect(result.freshnessStatus).toBe("unsupported");
    expect(result.blockingReasons).toContain("freshness_unsupported");
    expect(connection.reads).toHaveLength(0);
  });
});

describe("DbWatermarkService and CoverageGateService", () => {
  const now = new Date("2026-06-13T12:00:00.000Z");

  it("classifies fresh, stale and missing local DB watermarks", async () => {
    const fresh = new DbWatermarkService(
      new FakeConnection({
        records: [
          {
            updatedAt: new Date("2026-06-13T11:30:00.000Z"),
            recordDate: new Date("2026-06-13T01:00:00.000Z"),
          },
        ],
      }) as any,
    );
    const stale = new DbWatermarkService(
      new FakeConnection({
        records: [
          {
            updatedAt: new Date("2026-06-13T08:00:00.000Z"),
            recordDate: new Date("2026-06-13T01:00:00.000Z"),
          },
        ],
      }) as any,
    );
    const missing = new DbWatermarkService(new FakeConnection({}) as any);

    await expect(fresh.assess(testSource(), now)).resolves.toEqual(
      expect.objectContaining({
        freshnessStatus: "fresh",
        freshnessMinutes: 30,
        staleByMinutes: 0,
      }),
    );
    await expect(stale.assess(testSource(), now)).resolves.toEqual(
      expect.objectContaining({
        freshnessStatus: "stale",
        freshnessMinutes: 240,
        staleByMinutes: 180,
      }),
    );
    await expect(missing.assess(testSource(), now)).resolves.toEqual(
      expect.objectContaining({ freshnessStatus: "missing" }),
    );
  });

  it("distinguishes covered from fresh data with no report-date records", async () => {
    const connection = new FakeConnection({
      records: [
        {
          updatedAt: new Date("2026-06-13T11:30:00.000Z"),
          recordDate: new Date("2026-06-13T01:00:00.000Z"),
        },
      ],
    });
    const watermark = await new DbWatermarkService(connection as any).assess(
      testSource(),
      now,
    );
    const coverage = new CoverageGateService(connection as any);

    await expect(
      coverage.assess(testSource(), "2026-06-13", watermark.hasAnyRecords),
    ).resolves.toEqual(
      expect.objectContaining({
        coverageStatus: "covered",
        reportDateRecordCount: 1,
      }),
    );
    await expect(
      coverage.assess(testSource(), "2026-06-12", watermark.hasAnyRecords),
    ).resolves.toEqual(
      expect.objectContaining({
        coverageStatus: "no_records_for_report_date",
        reportDateRecordCount: 0,
      }),
    );
  });

  it("classifies absent static configuration as not_configured", async () => {
    const connection = new FakeConnection({});
    const source = new SourceRegistryService().get("system_settings")!;
    const result = await new DbWatermarkService(connection as any).assess(
      source,
      now,
    );

    expect(result.freshnessStatus).toBe("not_configured");
    expect(result.freshnessStatus).not.toBe("fresh");
  });

  it("does not leak raw DB/provider-like error text", async () => {
    const result = await new DbWatermarkService(
      new FakeConnection({}, ["records"]) as any,
    ).assess(testSource(), now);
    const rendered = JSON.stringify(result);

    expect(result.freshnessStatus).toBe("unknown");
    expect(rendered).not.toMatch(
      /provider-secret|director@example\.com|84901234567|Bearer/i,
    );
  });
});

describe("FreshnessGateService", () => {
  it("keeps strong decisions false when required freshness or coverage fails", () => {
    const gate = new FreshnessGateService({} as any, {} as any, {} as any);
    const result = gate.buildDecisionGate([
      assessment("google_ads", "stale"),
      assessment("advertising_costs"),
      assessment("product_mapping"),
      assessment("orders"),
      assessment("payments_or_order_payments", "fresh", "missing"),
      assessment("crm_leads", "fresh", "no_records_for_report_date"),
      assessment("finance", "missing"),
      assessment("loans_debt"),
      assessment("customer_referral", "unsupported", "unsupported"),
    ]);

    expect(result.canRecommendAdsScale).toBe(false);
    expect(result.canConcludeProfitStrongly).toBe(false);
    expect(result.canEvaluateSalesToday).toBe(false);
    expect(result.canEvaluateFinanceStrongly).toBe(false);
    expect(result.canUseLtvStrongly).toBe(false);
    expect(result.canGenerateActionDraft).toBe(false);
    expect(result.canImportActionFile).toBe(false);
    expect(result.canDryRun).toBe(false);
    expect(result.canExecuteLive).toBe(false);
  });

  it("allows ads automation draft generation only when required ads sources are fresh and covered", () => {
    const gate = new FreshnessGateService({} as any, {} as any, {} as any);
    const result = gate.buildDecisionGate([
      assessment("google_ads", "fresh", "covered"),
      assessment("advertising_costs", "fresh", "covered"),
      assessment("product_mapping", "fresh", "not_applicable"),
      assessment("inventory_profit", "fresh", "covered"),
      assessment("supplier_safety", "fresh", "covered"),
    ]);

    expect(result.canRecommendAdsScale).toBe(true);
    expect(result.canGenerateActionDraft).toBe(true);
    expect(result.canImportActionFile).toBe(false);
    expect(result.canDryRun).toBe(false);
    expect(result.canExecuteLive).toBe(false);
  });

  it("marks a fresh source without report-date coverage cautious, not decision-ready", async () => {
    const registry = { list: () => [testSource()] };
    const connection = new FakeConnection({
      records: [
        {
          updatedAt: new Date("2026-06-13T11:30:00.000Z"),
          recordDate: new Date("2026-06-13T01:00:00.000Z"),
        },
      ],
    });
    const service = new FreshnessGateService(
      registry as any,
      new DbWatermarkService(connection as any),
      new CoverageGateService(connection as any),
    );
    const result = await service.assessAll({
      reportDate: "2026-06-12",
      now: new Date("2026-06-13T12:00:00.000Z"),
    });

    expect(result.dbOnly).toBe(true);
    expect(result.providerSyncAttempted).toBe(false);
    expect(result.mutationAttempted).toBe(false);
    expect(result.assessments[0]).toEqual(
      expect.objectContaining({
        freshnessStatus: "fresh",
        coverageStatus: "no_records_for_report_date",
        canUseForDecision: "cautious",
      }),
    );
  });

  it("has no provider, sync, action, write or execution service dependency", () => {
    const directory = __dirname;
    const source = [
      "source-registry.service.ts",
      "db-watermark.service.ts",
      "coverage-gate.service.ts",
      "freshness-gate.service.ts",
    ]
      .map((file) => readFileSync(join(directory, file), "utf8"))
      .join("\n");
    for (const forbidden of [
      "GoogleAdsReadonlySyncService",
      "AdvertisingCostFacebookSyncService",
      "AdvertisingCostGoogleSyncService",
      "AdvertisingCostTiktokSyncService",
      "DataCollectionService",
      "OrderSheetSyncService",
      "AutoControlService",
      "BudgetApplyService",
      "ExecutionService",
      "ProviderValidationService",
      "PaymentService",
      "StatementManagementService",
      "OrderCalculationService",
      "OpenAIConfigService",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps controller source preparation on the cached DB-only policy", () => {
    const exportJob = readFileSync(
      join(__dirname, "..", "export-jobs", "export-job.service.ts"),
      "utf8",
    );
    const controller = readFileSync(
      join(__dirname, "..", "ai-data-pack.controller.ts"),
      "utf8",
    );

    expect(exportJob).toContain("freshness_gate_evaluated: false");
    expect(exportJob).not.toContain("FreshnessGateService");
    expect(controller).not.toContain("FreshnessGateService");
    expect(controller).toContain("SourceSyncOrchestratorService");
    expect(controller).toContain("syncPolicy: 'export_cached'");
    expect(controller).not.toContain("syncPolicy: 'sync_required'");
    expect(controller).not.toContain("syncPolicy: 'sync_if_stale'");
  });
});
