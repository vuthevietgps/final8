import {
  GoogleAdsReadonlyTransportInput,
  GoogleAdsReadonlyTransportService,
} from "./google-ads-readonly-transport.service";
import {
  GoogleAdsReadonlyQueryTemplateId,
  buildGoogleAdsReadonlyQuery,
} from "./google-ads-readonly-query-templates";
import { DEFAULT_GOOGLE_ADS_READONLY_POLICY } from "./google-ads-readonly-sync-policy.service";

function input(): GoogleAdsReadonlyTransportInput {
  return {
    customerId: "1234567890",
    loginCustomerId: "9999999999",
    allowedCustomerIds: ["1234567890"],
    templateId: "metrics_campaign",
    dateFrom: "2026-06-12",
    dateTo: "2026-06-12",
    absoluteDeadlineAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

function createService() {
  const http = {
    request: jest.fn().mockResolvedValue({ data: [{ results: [{ id: 1 }] }] }),
  };
  const tokens = {
    getGoogleAdsRuntimeConfig: jest.fn().mockResolvedValue({
      apiVersion: "v24",
      loginCustomerId: "9999999999",
      developerToken: "internal-developer-token",
      refreshToken: "internal-refresh-token",
    }),
    getGoogleAdsAccessToken: jest
      .fn()
      .mockResolvedValue("internal-access-token"),
  };
  return {
    http,
    tokens,
    service: new GoogleAdsReadonlyTransportService(
      http as any,
      DEFAULT_GOOGLE_ADS_READONLY_POLICY,
      tokens as any,
    ),
  };
}

describe("GoogleAdsReadonlyTransportService", () => {
  it("runtime-enforces searchStream POST, adapter templates, request timeout, and deadline", async () => {
    const { service, http } = createService();

    await expect(service.searchStream(input())).resolves.toEqual([{ id: 1 }]);

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://googleads.googleapis.com",
        url: "/v24/customers/1234567890/googleAds:searchStream",
        method: "POST",
        data: {
          query: expect.stringContaining(
            "WHERE segments.date BETWEEN '2026-06-12' AND '2026-06-12'",
          ),
        },
        timeout: expect.any(Number),
        signal: expect.anything(),
      }),
    );
    expect(http.request.mock.calls[0][0].timeout).toBeLessThanOrEqual(30_000);
  });

  it("rejects caller URL, method, GAQL, mutate, validateOnly, and out-of-scope customer before HTTP", async () => {
    const { service, http, tokens } = createService();

    for (const forbidden of [
      { url: "https://googleads.googleapis.com" },
      { method: "POST" },
      { gaql: "SELECT customer.id FROM customer" },
      { query: "mutate campaign" },
      { validateOnly: true },
      { mutation: {} },
    ]) {
      await expect(
        service.searchStream({ ...input(), ...forbidden } as any),
      ).rejects.toMatchObject({ category: "policy_denied" });
    }
    await expect(
      service.searchStream({
        ...input(),
        customerId: "2222222222",
      }),
    ).rejects.toMatchObject({ category: "invalid_scope" });
    expect(http.request).not.toHaveBeenCalled();
    expect(tokens.getGoogleAdsRuntimeConfig).not.toHaveBeenCalled();
  });

  it("rejects wrong runtime version and login-customer scope without HTTP", async () => {
    const { service, http, tokens } = createService();
    tokens.getGoogleAdsRuntimeConfig.mockResolvedValueOnce({
      apiVersion: "latest",
      developerToken: "internal",
      refreshToken: "internal",
    });

    await expect(service.searchStream(input())).rejects.toMatchObject({
      category: "provider_version_unsupported",
    });
    tokens.getGoogleAdsRuntimeConfig.mockResolvedValueOnce({
      apiVersion: "v24",
      loginCustomerId: "1111111111",
      developerToken: "internal",
      refreshToken: "internal",
    });
    await expect(service.searchStream(input())).rejects.toMatchObject({
      category: "invalid_scope",
    });
    expect(http.request).not.toHaveBeenCalled();
  });

  it("sanitizes HTTP failures without exposing provider payloads or credentials", async () => {
    const { service, http } = createService();
    http.request.mockRejectedValueOnce(
      Object.assign(
        new Error("Authorization=Bearer raw-secret https://provider.test/raw"),
        {
          response: {
            status: 429,
            data: { raw: "provider-body" },
            headers: { authorization: "Bearer raw-header" },
          },
        },
      ),
    );

    const promise = service.searchStream(input());

    await expect(promise).rejects.toMatchObject({
      category: "rate_limited",
      retryable: true,
    });
    await expect(promise).rejects.not.toThrow(
      /raw-secret|provider\.test|provider-body|raw-header/i,
    );
  });

  it("builds only adapter-owned static templates and validates metric dates", () => {
    const templateIds: GoogleAdsReadonlyQueryTemplateId[] = [
      "account",
      "campaigns",
      "campaign_budgets",
      "ad_groups",
      "keywords",
      "responsive_search_ads",
      "metrics_campaign",
      "metrics_ad_group",
      "metrics_keyword",
      "metrics_ad",
    ];

    for (const templateId of templateIds) {
      const query = buildGoogleAdsReadonlyQuery({
        templateId,
        dateFrom: "2026-06-12",
        dateTo: "2026-06-12",
      });
      expect(query).toMatch(/^SELECT /);
      expect(query).not.toMatch(/\bmutate\b|validateOnly|create|delete/i);
    }

    expect(() =>
      buildGoogleAdsReadonlyQuery({
        templateId: "metrics_campaign",
        dateFrom: "2026-06-31",
        dateTo: "2026-06-31",
      }),
    ).toThrow("date is invalid");
    expect(() =>
      buildGoogleAdsReadonlyQuery({
        templateId: "metrics_campaign",
        dateFrom: "2026-06-13",
        dateTo: "2026-06-12",
      }),
    ).toThrow("date range");
  });
});
