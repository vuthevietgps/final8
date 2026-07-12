import { GoogleAdsReadonlySyncPortInstrumentationService } from "./google-ads-readonly-sync-port-instrumentation.service";

const baseResult = {
  runId: "GAS-1",
  status: "success",
  startedAt: new Date(),
  completedAt: new Date(),
  dateFrom: "2026-06-12",
  dateTo: "2026-06-12",
  customerIds: ["1234567890"],
  counts: {},
  errors: [],
};

describe("GoogleAdsReadonlySyncPortInstrumentationService", () => {
  it("preserves only validated actual-write telemetry from the raw sync port", async () => {
    const writeTelemetry = [
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
        recordCount: 2,
        deleteAttempted: false,
        sourceStep: "campaigns",
      },
    ] as const;
    const raw = {
      sync: jest.fn().mockResolvedValue({
        ...baseResult,
        writeTelemetry,
      }),
    };
    const service = new GoogleAdsReadonlySyncPortInstrumentationService(
      raw as any,
    );

    const result = await service.sync({
      customerIds: ["1234567890"],
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
      absoluteDeadlineAt: new Date(Date.now() + 60_000).toISOString(),
    });

    expect(result.writeTelemetry).toEqual(writeTelemetry);
    expect(
      result.writeTelemetry?.map((write) => write.targetCollection),
    ).toEqual(["google_ads_sync_runs", "google_ads_campaigns"]);
    expect(
      result.writeTelemetry?.every((write) => !write.deleteAttempted),
    ).toBe(true);
  });

  it("rejects missing, delete, and forbidden-target telemetry", async () => {
    for (const writeTelemetry of [
      undefined,
      [
        {
          targetCollection: "google_ads_sync_runs",
          operationType: "upsert",
          recordCount: 1,
          deleteAttempted: true,
          sourceStep: "sync_run",
        },
      ],
      [
        {
          targetCollection: "google_ads_action_plans",
          operationType: "insert",
          recordCount: 1,
          deleteAttempted: false,
          sourceStep: "action_plan",
        },
      ],
    ]) {
      const raw = {
        sync: jest.fn().mockResolvedValue({
          ...baseResult,
          writeTelemetry,
        }),
      };
      const service = new GoogleAdsReadonlySyncPortInstrumentationService(
        raw as any,
      );

      await expect(
        service.sync({
          customerIds: ["1234567890"],
          dateFrom: "2026-06-12",
          dateTo: "2026-06-12",
          absoluteDeadlineAt: new Date(Date.now() + 60_000).toISOString(),
        }),
      ).rejects.toThrow();
    }
  });
});
