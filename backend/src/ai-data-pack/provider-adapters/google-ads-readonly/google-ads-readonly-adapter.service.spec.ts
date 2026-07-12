import { GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION } from "../provider-adapter.tokens";
import {
  GOOGLE_ADS_READONLY_FORBIDDEN_LOCAL_WRITES,
  GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST,
  assertGoogleAdsReadonlyLocalWriteTarget,
} from "./google-ads-readonly-local-write-allowlist";
import { GoogleAdsReadonlyAdapterService } from "./google-ads-readonly-adapter.service";
import { GoogleAdsReadOnlySyncInput } from "./google-ads-readonly-adapter.types";
import { GoogleAdsReadonlyAdapterError } from "./google-ads-readonly-error.util";
import { GoogleAdsReadonlyScopePolicyService } from "./google-ads-readonly-scope-policy.service";
import { GoogleAdsReadonlySyncPolicyService } from "./google-ads-readonly-sync-policy.service";
import {
  GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST,
  assertGoogleAdsReadonlyTransport,
} from "./google-ads-readonly-transport-allowlist";

function accountModel(accounts: any[]) {
  return {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(accounts),
      }),
    }),
  };
}

function input(
  overrides: Partial<GoogleAdsReadOnlySyncInput> = {},
): GoogleAdsReadOnlySyncInput {
  return {
    exportJobId: "JOB-1",
    correlationId: "CORR-1",
    sourceKey: "google_ads",
    reportDate: "2026-06-12",
    customerIds: ["1234567890"],
    syncPolicy: "sync_required",
    policyVersion: "google-readonly-v1",
    internalRequester: {
      id: "internal-worker-1",
      type: "internal_job",
      permissions: [GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION],
    },
    absoluteDeadlineAt: new Date(Date.now() + 120_000).toISOString(),
    ...overrides,
  };
}

const SAFE_WRITE_TELEMETRY = [
  {
    targetCollection: "google_ads_sync_runs",
    operationType: "insert",
    recordCount: 1,
    deleteAttempted: false,
    sourceStep: "sync_run_start",
  },
  {
    targetCollection: "google_ads_campaigns",
    operationType: "upsert",
    recordCount: 1,
    deleteAttempted: false,
    sourceStep: "campaigns",
  },
] as const;

function createAdapter(options?: {
  accounts?: any[];
  sync?: jest.Mock;
  lock?: any;
  assessment?: any;
  audit?: any;
}) {
  const policy = new GoogleAdsReadonlySyncPolicyService({
    retryBaseDelayMs: 0,
  });
  const scope = new GoogleAdsReadonlyScopePolicyService(
    accountModel(
      options?.accounts || [
        {
          accountId: "123-456-7890",
          loginCustomerId: "999-999-9999",
          accountType: "google",
          isActive: true,
        },
      ],
    ) as any,
    policy,
  );
  const sync =
    options?.sync ||
    jest.fn().mockResolvedValue({
      runId: "GAS-1",
      status: "success",
      startedAt: new Date(),
      completedAt: new Date(),
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
      customerIds: ["1234567890"],
      counts: { campaigns: 1 },
      errors: [],
      writeTelemetry: SAFE_WRITE_TELEMETRY,
    });
  const lock =
    options?.lock ||
    ({
      runtime: "implemented_mongo",
      acquire: jest
        .fn()
        .mockResolvedValue({ acquired: true, ownerToken: "owner-token" }),
      release: jest.fn().mockResolvedValue(undefined),
    } as any);
  const audit =
    options?.audit ||
    ({
      persist: jest.fn().mockResolvedValue({ auditId: "AUDIT-1" }),
    } as any);
  const service = new GoogleAdsReadonlyAdapterService(
    { sync } as any,
    scope,
    policy,
    options?.assessment,
    lock,
    audit,
  );
  return { service, sync, lock, audit, policy };
}

describe("GoogleAdsReadonlyAdapterService", () => {
  it("exposes only the read-only adapter identity and no action/execution methods", () => {
    const { service } = createAdapter();

    expect(service.sourceKey).toBe("google_ads");
    expect(service.mode).toBe("read_only");
    expect(service.supportsSourceRegistry).toBe(true);
    for (const forbidden of [
      "importActionPlan",
      "validatePlan",
      "approve",
      "dryRun",
      "execute",
      "executeLive",
    ]) {
      expect((service as any)[forbidden]).toBeUndefined();
    }
  });

  it("calls only the mocked read-only sync port after scope and lock guards pass", async () => {
    const { service, sync, lock, audit } = createAdapter();

    const result = await service.syncReadOnly(input());

    expect(sync).toHaveBeenCalledWith({
      customerIds: ["1234567890"],
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
      absoluteDeadlineAt: expect.any(String),
    });
    expect(lock.acquire).toHaveBeenCalledTimes(1);
    expect(lock.release).toHaveBeenCalledTimes(1);
    expect(audit.persist).toHaveBeenCalledTimes(1);
    expect(result).toEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        mode: "read_only",
        status: "success",
        providerSyncAttempted: true,
        mutationAttempted: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(result.localWriteTargets).toEqual([
      "google_ads_sync_runs",
      "google_ads_campaigns",
      "ai_data_pack_source_sync_audits",
    ]);
    expect(result.writeTelemetrySummary).toEqual(
      expect.objectContaining({
        operationCount: 2,
        recordCount: 2,
        targets: ["google_ads_sync_runs", "google_ads_campaigns"],
      }),
    );
  });

  it("fails closed without a distributed lock runtime and does not call sync", async () => {
    const { service, sync } = createAdapter({ lock: undefined });
    (service as any).lockPort = undefined;

    await expect(service.syncReadOnly(input())).rejects.toMatchObject({
      category: "lock_unavailable",
    });
    expect(sync).not.toHaveBeenCalled();
  });

  it("skips sync_if_stale when the DB-only assessment is already fresh and covered", async () => {
    const assessment = {
      assess: jest.fn().mockResolvedValue({
        assessments: [
          {
            sourceKey: "google_ads",
            status: "fresh",
            freshnessStatus: "fresh",
            coverageStatus: "covered",
            evidence: [],
            warnings: [],
            blockingReasons: [],
            canUseForDecision: "yes",
          },
        ],
      }),
    };
    const { service, sync, lock } = createAdapter({ assessment });

    const result = await service.syncReadOnly(
      input({ syncPolicy: "sync_if_stale" }),
    );

    expect(result.status).toBe("skipped_fresh_enough");
    expect(result.providerSyncAttempted).toBe(false);
    expect(sync).not.toHaveBeenCalled();
    expect(lock.acquire).not.toHaveBeenCalled();
  });

  it("returns bounded sanitized errors and never raw provider payloads", async () => {
    const sync = jest.fn().mockResolvedValue({
      runId: "GAS-2",
      status: "partial",
      startedAt: new Date(),
      completedAt: new Date(),
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
      customerIds: ["1234567890"],
      counts: { campaigns: 1 },
      errors: [
        {
          customerId: "1234567890",
          step: "campaigns",
          message:
            "Authorization=Bearer secret-token refresh_token=raw-value https://provider.test/raw",
        },
      ],
      writeTelemetry: SAFE_WRITE_TELEMETRY,
    });
    const { service } = createAdapter({ sync });

    const result = await service.syncReadOnly(input());
    const rendered = JSON.stringify(result.errors);

    expect(rendered).not.toMatch(
      /secret-token|raw-value|provider\.test|stack|headers|response/i,
    );
    expect(rendered).toContain("[REDACTED]");
  });

  it("sanitizes distributed lock implementation failures", async () => {
    const lock = {
      runtime: "implemented_mongo",
      acquire: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "Authorization=Bearer lock-secret https://lock-provider.test/raw",
          ),
        ),
      release: jest.fn(),
    };
    const { service, sync } = createAdapter({ lock });

    const promise = service.syncReadOnly(input());

    await expect(promise).rejects.toMatchObject({
      category: "lock_unavailable",
    });
    await expect(promise).rejects.not.toThrow(/lock-secret|lock-provider/i);
    expect(sync).not.toHaveBeenCalled();
  });

  it("fails closed on missing, forbidden, or delete write telemetry and audits only the safe failure", async () => {
    for (const writeTelemetry of [
      undefined,
      [
        {
          targetCollection: "google_ads_action_plans",
          operationType: "insert",
          recordCount: 1,
          deleteAttempted: false,
          sourceStep: "action_plan",
        },
      ],
      [
        {
          targetCollection: "google_ads_sync_runs",
          operationType: "upsert",
          recordCount: 1,
          deleteAttempted: true,
          sourceStep: "sync_run",
        },
      ],
    ]) {
      const sync = jest.fn().mockResolvedValue({
        runId: "GAS-unsafe",
        status: "success",
        startedAt: new Date(),
        completedAt: new Date(),
        dateFrom: "2026-06-12",
        dateTo: "2026-06-12",
        customerIds: ["1234567890"],
        counts: {},
        errors: [],
        writeTelemetry,
      });
      const { service, audit } = createAdapter({ sync });

      const result = await service.syncReadOnly(input());

      expect(result.status).toBe("failed");
      expect(result.errors[0].category).toBe("local_persistence_failed");
      expect(result.localWriteTargets).toEqual([
        "ai_data_pack_source_sync_audits",
      ]);
      expect(audit.persist).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.objectContaining({
            mutationAttempted: false,
            canImportActionFile: false,
            canDryRun: false,
            canExecuteLive: false,
          }),
        }),
      );
    }
  });

  it("delegates freshness and coverage assessment to the bound DB-only port", async () => {
    const dbOnlyAssessment = {
      sourceKey: "google_ads",
      status: "stale",
      freshnessStatus: "stale",
      coverageStatus: "missing",
      evidence: [],
      warnings: [],
      blockingReasons: ["freshness_stale", "coverage_missing"],
      canUseForDecision: "no",
    };
    const assessment = {
      assess: jest.fn().mockResolvedValue({ assessments: [dbOnlyAssessment] }),
    };
    const { service } = createAdapter({ assessment });

    await expect(
      service.assessLocalFreshness({
        sourceKey: "google_ads",
        reportDate: "2026-06-12",
      }),
    ).resolves.toBe(dbOnlyAssessment);
    await expect(
      service.assessCoverage({
        sourceKey: "google_ads",
        reportDate: "2026-06-12",
      }),
    ).resolves.toBe(dbOnlyAssessment);
    expect(assessment.assess).toHaveBeenCalledTimes(2);
  });
});

describe("Google Ads read-only allowlists", () => {
  it("allows only exact searchStream POST descriptors for approved customers", () => {
    expect(() =>
      assertGoogleAdsReadonlyTransport(
        {
          origin: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
          method: "POST",
          path: "/v24/customers/1234567890/googleAds:searchStream",
          querySource: "adapter_owned_static_templates",
        },
        ["1234567890"],
      ),
    ).not.toThrow();

    for (const descriptor of [
      {
        origin: "https://example.test",
        method: "POST",
        path: "/v24/customers/1234567890/googleAds:searchStream",
        querySource: "adapter_owned_static_templates",
      },
      {
        origin: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
        method: "GET",
        path: "/v24/customers/1234567890/googleAds:searchStream",
        querySource: "adapter_owned_static_templates",
      },
      {
        origin: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
        method: "POST",
        path: "/v24/customers/1234567890/googleAds:mutate",
        querySource: "adapter_owned_static_templates",
      },
      {
        origin: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
        method: "POST",
        path: "/v24/customers/2222222222/googleAds:searchStream",
        querySource: "adapter_owned_static_templates",
      },
    ]) {
      expect(() =>
        assertGoogleAdsReadonlyTransport(descriptor, ["1234567890"]),
      ).toThrow();
    }
  });

  it("allows only the declared local cache/audit targets", () => {
    for (const target of GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST) {
      expect(() =>
        assertGoogleAdsReadonlyLocalWriteTarget(target),
      ).not.toThrow();
    }
    for (const target of GOOGLE_ADS_READONLY_FORBIDDEN_LOCAL_WRITES) {
      expect(() => assertGoogleAdsReadonlyLocalWriteTarget(target)).toThrow();
    }
  });

  it("keeps mutation and validate-only transport disabled", () => {
    expect(GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.mutationAllowed).toBe(false);
    expect(GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.validateOnlyAllowed).toBe(
      false,
    );
  });
});
