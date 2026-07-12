import { GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION } from "../provider-adapter.tokens";
import { GoogleAdsReadOnlySyncInput } from "./google-ads-readonly-adapter.types";
import { GoogleAdsReadonlyScopePolicyService } from "./google-ads-readonly-scope-policy.service";
import { GoogleAdsReadonlySyncPolicyService } from "./google-ads-readonly-sync-policy.service";

function model(accounts: any[]) {
  return {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(accounts),
      }),
    }),
  };
}

function request(
  overrides: Partial<GoogleAdsReadOnlySyncInput> = {},
): GoogleAdsReadOnlySyncInput {
  return {
    exportJobId: "JOB-1",
    correlationId: "CORR-1",
    sourceKey: "google_ads",
    reportDate: "2026-06-12",
    customerIds: ["1234567890"],
    syncPolicy: "sync_required",
    policyVersion: "v1",
    internalRequester: {
      id: "worker-1",
      type: "internal_job",
      permissions: [GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION],
    },
    absoluteDeadlineAt: new Date(Date.now() + 120_000).toISOString(),
    ...overrides,
  };
}

function service(accounts: any[], maxRangeDays = 31) {
  const accountModel = model(accounts);
  const policy = new GoogleAdsReadonlySyncPolicyService({ maxRangeDays });
  return {
    accountModel,
    service: new GoogleAdsReadonlyScopePolicyService(
      accountModel as any,
      policy,
    ),
  };
}

describe("GoogleAdsReadonlyScopePolicyService", () => {
  const active = {
    accountId: "123-456-7890",
    loginCustomerId: "999-999-9999",
    accountType: "google",
    isActive: true,
  };

  it("defaults an omitted range to reportDate only", async () => {
    const { service: scope } = service([active]);

    await expect(scope.validate(request())).resolves.toEqual(
      expect.objectContaining({
        dateFrom: "2026-06-12",
        dateTo: "2026-06-12",
        customerIds: ["1234567890"],
        customerScopes: [
          {
            customerId: "1234567890",
            loginCustomerId: "9999999999",
          },
        ],
      }),
    );
  });

  it("rejects google-ads.read alone before any account/provider lookup", async () => {
    const { service: scope, accountModel } = service([active]);

    await expect(
      scope.validate(
        request({
          internalRequester: {
            id: "manager-1",
            type: "internal_job",
            permissions: ["google-ads.read"],
          },
        }),
      ),
    ).rejects.toMatchObject({ category: "permission_denied" });
    expect(accountModel.find).not.toHaveBeenCalled();
  });

  it("requires an identified internal job or service requester", async () => {
    const { service: scope, accountModel } = service([active]);

    await expect(
      scope.validate(
        request({
          internalRequester: {
            id: "",
            type: "internal_job",
            permissions: [GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION],
          },
        }),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    await expect(
      scope.validate(
        request({
          internalRequester: {
            id: "user-1",
            type: "user" as any,
            permissions: [GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION],
          },
        }),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    expect(accountModel.find).not.toHaveBeenCalled();
  });

  it("rejects caller-supplied transport, credential, GAQL, and action fields", async () => {
    const { service: scope, accountModel } = service([active]);

    for (const forbidden of [
      { url: "https://googleads.googleapis.com" },
      { method: "POST" },
      { gaql: "SELECT customer.id FROM customer" },
      { refreshToken: "secret" },
      { actionPlan: { id: "plan-1" } },
      { mutationOperation: {} },
    ]) {
      await expect(
        scope.validate({ ...request(), ...forbidden } as any),
      ).rejects.toMatchObject({ category: "policy_denied" });
    }
    expect(accountModel.find).not.toHaveBeenCalled();
  });

  it("fails closed for malformed, duplicate, unknown, inactive, or mismatched scope", async () => {
    await expect(
      service([active]).service.validate(
        request({ customerIds: ["123-456-7890"] }),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    await expect(
      service([active]).service.validate(
        request({ customerIds: ["1234567890", "1234567890"] }),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    await expect(
      service([active]).service.validate(
        request({ customerIds: ["2222222222"] }),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    await expect(
      service([{ ...active, isActive: false }]).service.validate(request()),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    await expect(
      service([{ ...active, loginCustomerId: "invalid" }]).service.validate(
        request(),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
  });

  it("enforces date ordering, maximum range, and an unexpired deadline", async () => {
    await expect(
      service([active]).service.validate(
        request({ dateFrom: "2026-06-13", dateTo: "2026-06-12" }),
      ),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    await expect(
      service([active], 2).service.validate(
        request({ dateFrom: "2026-06-10", dateTo: "2026-06-12" }),
      ),
    ).rejects.toMatchObject({ category: "policy_denied" });
    await expect(
      service([active]).service.validate(
        request({ absoluteDeadlineAt: "2020-01-01T00:00:00.000Z" }),
      ),
    ).rejects.toMatchObject({ category: "policy_denied" });
  });
});
