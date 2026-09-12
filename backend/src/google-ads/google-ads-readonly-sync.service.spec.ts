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
  const models = Array.from({ length: 12 }, modelMock);
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
              biddingStrategyType: "MAXIMIZE_CLICKS",
              biddingStrategySystemStatus: "ELIGIBLE",
              targetSpend: { cpcBidCeilingMicros: "2500000000" },
              maximizeConversions: { targetCpaMicros: "0" },
              campaignBudget: "customers/1234567890/campaignBudgets/700",
            },
          },
        ]);
      }
      if (input.templateId === "campaign_criteria") {
        return Promise.resolve([{
          campaign: { id: "100" },
          campaignCriterion: {
            resourceName: "customers/1234567890/campaignCriteria/100~2704",
            type: "LOCATION",
            negative: false,
            status: "ENABLED",
            location: { geoTargetConstant: "geoTargetConstants/2704" },
          },
        }, {
          campaign: { id: "100" },
          campaignCriterion: {
            resourceName: "customers/1234567890/campaignCriteria/100~1040",
            type: "LANGUAGE",
            negative: false,
            status: "ENABLED",
            language: { languageConstant: "languageConstants/1040" },
          },
        }]);
      }
      if (input.templateId === "conversion_actions") {
        return Promise.resolve([{
          conversionAction: {
            id: "900",
            resourceName: "customers/1234567890/conversionActions/900",
            ownerCustomer: "customers/1234567890",
            name: "Purchase",
            status: "ENABLED",
            category: "PURCHASE",
            origin: "WEBSITE",
            primaryForGoal: true,
          },
        }]);
      }
      if (input.templateId === "campaign_conversion_goals") {
        return Promise.resolve([{
          campaign: { id: "100" },
          campaignConversionGoal: {
            resourceName:
              "customers/1234567890/campaignConversionGoals/100~PURCHASE~WEBSITE",
            campaign: "customers/1234567890/campaigns/100",
            category: "PURCHASE",
            origin: "WEBSITE",
            biddable: true,
          },
        }]);
      }
      if (input.templateId === "conversion_goal_campaign_configs") {
        return Promise.resolve([{
          campaign: { id: "100" },
          conversionGoalCampaignConfig: {
            resourceName:
              "customers/1234567890/conversionGoalCampaignConfigs/100",
            campaign: "customers/1234567890/campaigns/100",
            goalConfigLevel: "CUSTOMER",
          },
        }]);
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
    models[8] as any,
    models[9] as any,
    models[10] as any,
    models[11] as any,
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
    expect(transport.searchStream).toHaveBeenCalledTimes(14);
    expect(
      transport.searchStream.mock.calls.map(([input]) => input.templateId),
    ).toEqual([
      "account",
      "campaigns",
      "campaign_budgets",
      "campaign_criteria",
      "conversion_actions",
      "campaign_conversion_goals",
      "conversion_goal_campaign_configs",
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
    expect(result.counts.campaignCriteria).toBe(2);
    expect(result.counts.conversionActions).toBe(1);
    expect(result.counts.campaignConversionGoals).toBe(1);
    expect(result.counts.conversionGoalCampaignConfigs).toBe(1);
    expect(models[1].bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          update: {
            $set: expect.objectContaining({
              biddingStrategyType: "MAXIMIZE_CLICKS",
              biddingStrategySystemStatus: "ELIGIBLE",
              targetSpendCpcBidCeilingMicros: 2_500_000_000,
              maximizeConversionsTargetCpaMicros: 0,
            }),
          },
        }),
      }),
    ], { ordered: false });
    expect(models[8].bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: {
            customerId: "1234567890",
            resourceName: "customers/1234567890/campaignCriteria/100~2704",
          },
          update: {
            $set: expect.objectContaining({
              campaignId: "100",
              criterionType: "LOCATION",
              targetConstantId: "2704",
              status: "ENABLED",
            }),
          },
        }),
      }),
      expect.objectContaining({
        updateOne: expect.objectContaining({
          update: {
            $set: expect.objectContaining({
              criterionType: "LANGUAGE",
              targetConstantId: "1040",
              status: "ENABLED",
            }),
          },
        }),
      }),
    ], { ordered: false });
    expect(models[9].bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          update: {
            $set: expect.objectContaining({
              conversionActionId: "900",
              ownerCustomerId: "1234567890",
              category: "PURCHASE",
              origin: "WEBSITE",
              primaryForGoal: true,
            }),
          },
        }),
      }),
    ], { ordered: false });
    expect(models[10].bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          update: {
            $set: expect.objectContaining({
              campaignId: "100",
              category: "PURCHASE",
              origin: "WEBSITE",
              biddable: true,
            }),
          },
        }),
      }),
    ], { ordered: false });
    expect(models[11].bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          update: {
            $set: expect.objectContaining({
              campaignId: "100",
              goalConfigLevel: "CUSTOMER",
            }),
          },
        }),
      }),
    ], { ordered: false });
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
          "google_ads_campaign_criteria",
          "google_ads_conversion_actions",
          "google_ads_campaign_conversion_goals",
          "google_ads_conversion_goal_campaign_configs",
        ],
      }),
    );
  });

  it("queries cross-account conversion actions from the canonical conversion customer", async () => {
    const { service, models, transport } = createService();
    models[0].find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          _id: "account-id",
          accountId: "1234567890",
          loginCustomerId: "9999999999",
          name: "Serving Account",
        },
      ]),
    });
    transport.searchStream.mockImplementation((input) => {
      if (input.templateId === "account") {
        return Promise.resolve([{
          customer: {
            descriptiveName: "Serving Account",
            conversionTrackingSetting: {
              googleAdsConversionCustomer: "customers/9999999999",
              conversionTrackingStatus: "GOOGLE_ADS_CONVERSION_CUSTOMER",
            },
          },
        }]);
      }
      if (input.templateId === "conversion_actions") {
        return Promise.resolve([{
          conversionAction: {
            id: "900",
            resourceName: "customers/9999999999/conversionActions/900",
            ownerCustomer: "customers/9999999999",
            status: "ENABLED",
            category: "PURCHASE",
            origin: "WEBSITE",
            primaryForGoal: true,
          },
        }]);
      }
      return Promise.resolve([]);
    });

    await service.sync({
      customerIds: ["1234567890"],
      dateFrom: "2026-06-10",
      dateTo: "2026-06-10",
    });

    const conversionCall = transport.searchStream.mock.calls
      .map(([input]) => input)
      .find((input) => input.templateId === "conversion_actions");
    expect(conversionCall).toEqual(expect.objectContaining({
      customerId: "9999999999",
      loginCustomerId: "9999999999",
      allowedCustomerIds: ["1234567890", "9999999999"],
    }));
    expect(models[9].bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: {
            customerId: "1234567890",
            conversionActionId: "900",
          },
          update: {
            $set: expect.objectContaining({
              customerId: "1234567890",
              ownerCustomerId: "9999999999",
            }),
          },
        }),
      }),
    ], { ordered: false });
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
    expect(buildGoogleAdsReadonlyQuery({ templateId: "campaign_criteria" })).toContain(
      "campaign_criterion.type IN (LOCATION, LANGUAGE)",
    );
    const campaignQuery = buildGoogleAdsReadonlyQuery({ templateId: "campaigns" });
    expect(campaignQuery).toContain("campaign.target_spend.cpc_bid_ceiling_micros");
    expect(campaignQuery).toContain("campaign.maximize_conversions.target_cpa_micros");
    expect(campaignQuery).toContain("campaign.bidding_strategy_system_status");
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
