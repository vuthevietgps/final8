import {
  GoogleAdsReadonlyAdapterError,
  sanitizeGoogleAdsReadonlyError,
} from "./google-ads-readonly-error.util";
import {
  DEFAULT_GOOGLE_ADS_READONLY_POLICY,
  GoogleAdsReadonlySyncPolicyService,
} from "./google-ads-readonly-sync-policy.service";

describe("GoogleAdsReadonlySyncPolicyService", () => {
  it("defines bounded timeout, retry, concurrency, and lock defaults", () => {
    expect(DEFAULT_GOOGLE_ADS_READONLY_POLICY).toEqual({
      connectionTimeoutMs: 5_000,
      requestTimeoutMs: 30_000,
      totalDeadlineMs: 180_000,
      maxRetriesAfterFirstAttempt: 2,
      maxRangeDays: 31,
      maxConcurrentCustomers: 2,
      retryBaseDelayMs: 250,
      lockTtlMs: 210_000,
    });
    expect(DEFAULT_GOOGLE_ADS_READONLY_POLICY.lockTtlMs).toBeGreaterThan(
      DEFAULT_GOOGLE_ADS_READONLY_POLICY.totalDeadlineMs,
    );
  });

  it("retries only transient, HTTP 429, and eligible 5xx errors", async () => {
    const service = new GoogleAdsReadonlySyncPolicyService({
      retryBaseDelayMs: 1,
    });
    const operation = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockResolvedValue("ok");
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(
      service.executeWithRetry(
        operation,
        new Date(Date.now() + 60_000).toISOString(),
        sleep,
      ),
    ).resolves.toEqual({
      value: "ok",
      attemptCount: 3,
      retryClassifications: ["rate_limited", "provider_transient"],
    });
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("does not retry auth, permission, policy, scope, or invalid-query errors", async () => {
    const service = new GoogleAdsReadonlySyncPolicyService({
      retryBaseDelayMs: 0,
    });
    for (const error of [
      { response: { status: 401 } },
      { response: { status: 403 } },
      { code: "INVALID_ARGUMENT" },
      new GoogleAdsReadonlyAdapterError("policy_denied", "denied"),
      new GoogleAdsReadonlyAdapterError("invalid_scope", "invalid"),
    ]) {
      const operation = jest.fn().mockRejectedValue(error);
      await expect(
        service.executeWithRetry(
          operation,
          new Date(Date.now() + 60_000).toISOString(),
          jest.fn(),
        ),
      ).rejects.toBe(error);
      expect(operation).toHaveBeenCalledTimes(1);
    }
  });

  it("creates a stable scoped lock key with owner-only release metadata contract", () => {
    const service = new GoogleAdsReadonlySyncPolicyService();
    const first = service.buildLockDescriptor({
      customerIds: ["2222222222", "1111111111"],
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
      exportJobId: "JOB-1",
    });
    const second = service.buildLockDescriptor({
      customerIds: ["1111111111", "2222222222"],
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
      exportJobId: "JOB-1",
    });

    expect(first.key).toBe(second.key);
    expect(first.scopeHash).toBe(second.scopeHash);
    expect(first.owner).not.toBe(second.owner);
    expect(first.ttlMs).toBeGreaterThan(service.config.totalDeadlineMs);
  });

  it("serializes only bounded redacted errors without raw response or stack", () => {
    const error: any = new Error(
      "Authorization=Bearer top-secret client_secret=value director@example.com +84901234567 https://provider.test/raw",
    );
    error.response = {
      status: 429,
      headers: { authorization: "Bearer raw-header" },
      data: { raw: "provider-body" },
    };

    const result = sanitizeGoogleAdsReadonlyError(error, 2, "1234567890");
    const rendered = JSON.stringify(result);

    expect(result.category).toBe("rate_limited");
    expect(result.retryable).toBe(true);
    expect(rendered).not.toMatch(
      /top-secret|raw-header|provider-body|director@example|84901234567|provider\.test|stack/i,
    );
    expect(rendered).toContain("[REDACTED]");
  });
});
