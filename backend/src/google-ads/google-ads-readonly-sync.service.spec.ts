import { readFileSync } from "fs";
import { join } from "path";
import { buildGoogleAdsReadonlyQuery } from "../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-query-templates";
import { summarizeGoogleAdsReadonlyWriteTelemetry } from "../ai-data-pack/provider-adapters/google-ads-readonly/google-ads-readonly-write-telemetry";
import { GoogleAdsReadonlySyncService } from "./google-ads-readonly-sync.service";

const modelMock = () => ({
  bulkWrite: jest.fn().mockResolvedValue({}),
  create: jest.fn().mockResolvedValue({}),
  find: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn().mockResolvedValue({}),
});

const createService = () => {
  const models = Array.from({ length: 8 }, modelMock);
  const apiTokenService = {
    getGoogleAdsRuntimeConfig: jest.fn(),
    getGoogleAdsAccessToken: jest.fn(),
  };
  const profitEnrichmentService = {
    enrich: jest.fn().mockResolvedValue({ updatedMetrics: 0 }),
  };
  const transport = {
    searchStream: jest.fn().mockImplementation((input) => {
      if (input.templateId === "account") {
        return Promise.resolve([
          {
            customer: {
              descriptiveName: "Account",
              currencyCode: "VND",
              timeZone: "Asia/Ho_Chi_Minh",
            },
          },
        ]);
      }
      if (input.templateId === "campaigns") {
        return Promise.resolve([
          {
            campaign: {
              id: "100",
              resourceName: "customers/1234567890/campaigns/100",
              name: "Campaign",
              status: "ENABLED",
              campaignBudget: "customers/1234567890/campaignBudgets/700",
            },
          },
        ]);
      }
      return Promise.resolve([]);
    }),
  };
  const service = new GoogleAdsReadonlySyncService(
    models[0] as any,
    models[1] as any,
    models[2] as any,
    models[3] as any,
    models[4] as any,
    models[5] as any,
    models[6] as any,
    models[7] as any,
    apiTokenService as any,
    profitEnrichmentService as any,
    transport as any,
  );
  return { service: service as any, models, apiTokenService, profitEnrichmentService, transport };
};

describe("GoogleAdsReadonlySyncService", () => {
  it("maps Google conversion metrics without creating messaging metrics", () => {
    const { service } = createService();

    const metric = service.mapMetricRow(
      {
        segments: { date: "2026-06-11" },
        campaign: { id: "100", resourceName: "customers/1/campaigns/100" },
        metrics: {
          costMicros: "2500000",
          conversions: 2,
          allConversions: 3,
          conversionsValue: 900000,
          costPerConversion: 1250000,
        },
      },
      "1",
      "campaign",
      new Date("2026-06-12T00:00:00.000Z"),
    );

    expect(metric).toEqual(
      expect.objectContaining({
        conversions: 2,
        allConversions: 3,
        conversionValue: 900000,
        costPerConversion: 1.25,
      }),
    );
    expect(metric).not.toHaveProperty("messagingConversationStarted7d");
    expect(metric).not.toHaveProperty("costPerMessagingConversation");
  });

  it("routes every legacy search step through template IDs and the enforced transport wrapper", async () => {
    const { service, models, transport, apiTokenService, profitEnrichmentService } = createService();
    models[0].find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: "account-id",
          accountId: "123-456-7890",
          loginCustomerId: "999-999-9999",
          name: "Old Account",
        },
      ]),
    });
    const absoluteDeadlineAt = new Date(Date.now() + 60_000).toISOString();

    const result = await service.syncWithTelemetry({
      customerIds: ["1234567890"],
      dateFrom: "2026-06-10",
      dateTo: "2026-06-11",
      absoluteDeadlineAt,
    });

    expect(apiTokenService.getGoogleAdsRuntimeConfig).not.toHaveBeenCalled();
    expect(transport.searchStream).toHaveBeenCalledTimes(10);
    expect(
      transport.searchStream.mock.calls.map(([input]) => input.templateId),
    ).toEqual([
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
    ]);
    for (const [input] of transport.searchStream.mock.calls) {
      expect(input).toEqual(
        expect.objectContaining({
          customerId: "1234567890",
          loginCustomerId: "9999999999",
          allowedCustomerIds: ["1234567890"],
          absoluteDeadlineAt,
        }),
      );
      expect(input).not.toHaveProperty("query");
      expect(input).not.toHaveProperty("gaql");
      expect(input).not.toHaveProperty("url");
      expect(input).not.toHaveProperty("method");
    }
    expect(result.counts.accounts).toBe(1);
    expect(result.counts.campaigns).toBe(1);
    expect(profitEnrichmentService.enrich).toHaveBeenCalledWith({
      customerIds: ['1234567890'],
      dateFrom: '2026-06-10',
      dateTo: '2026-06-11',
    });
    expect(
      summarizeGoogleAdsReadonlyWriteTelemetry(result.writeTelemetry),
    ).toEqual(
      expect.objectContaining({
        targets: [
          "google_ads_sync_runs",
          "adaccounts.approved_sync_metadata",
          "google_ads_campaigns",
        ],
      }),
    );
  });

  it("keeps public sync output free of internal write telemetry", async () => {
    const { service, models } = createService();
    models[0].find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await service.sync({
      customerIds: ["1234567890"],
      dateFrom: "2026-06-10",
      dateTo: "2026-06-10",
    });

    expect(result).not.toHaveProperty("writeTelemetry");
  });

  it("builds read-only metrics queries from static templates with validated dates", () => {
    const query = buildGoogleAdsReadonlyQuery({
      templateId: "metrics_keyword",
      dateFrom: "2026-06-10",
      dateTo: "2026-06-11",
    });

    expect(query).toContain("metrics.conversions");
    expect(query).toContain("metrics.all_conversions");
    expect(query).toContain("metrics.conversions_value");
    expect(query).toContain("metrics.cost_per_conversion");
    expect(query).toContain("FROM keyword_view");
    expect(query).not.toMatch(/\bmutate\b|validateOnly/i);
    expect(() =>
      buildGoogleAdsReadonlyQuery({
        templateId: "metrics_keyword",
        dateFrom: "2026-06-12",
        dateTo: "2026-06-11",
      }),
    ).toThrow("date range");
  });

  it("contains no raw Axios/searchStream/GAQL provider path in the legacy service source", () => {
    const source = readFileSync(
      join(__dirname, "google-ads-readonly-sync.service.ts"),
      "utf8",
    );

    expect(source).toContain("GoogleAdsReadonlyTransportService");
    expect(source).toContain(".searchStream(");
    expect(source).not.toMatch(
      /axios|https:\/\/googleads\.googleapis|googleAds:searchStream|SELECT\s|FROM\s|WHERE\s/,
    );
  });
});
