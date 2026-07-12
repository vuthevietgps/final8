import { GoogleAdsReadonlySyncPolicyService } from "../provider-adapters/google-ads-readonly/google-ads-readonly-sync-policy.service";
import { MongoSourceSyncLockService } from "./mongo-source-sync-lock.service";
import { SourceSyncAuditService } from "./source-sync-audit.service";
import { AiDataPackSourceSyncLockSchema } from "./source-sync-lock.schema";

describe("MongoSourceSyncLockService", () => {
  const descriptor =
    new GoogleAdsReadonlySyncPolicyService().buildLockDescriptor({
      exportJobId: "JOB-1",
      customerIds: ["1234567890"],
      dateFrom: "2026-06-12",
      dateTo: "2026-06-12",
    });

  it("atomically acquires an indexed Mongo lock with expiry takeover policy", async () => {
    const model = {
      findOneAndUpdate: jest
        .fn()
        .mockResolvedValue({ lockKey: descriptor.key }),
    };
    const service = new MongoSourceSyncLockService(model as any);

    const result = await service.acquire(descriptor);

    expect(service.runtime).toBe("implemented_mongo");
    expect(result).toEqual({
      acquired: true,
      ownerToken: expect.any(String),
    });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        lockKey: descriptor.key,
        $or: expect.arrayContaining([
          { expiresAt: { $lte: expect.any(Date) } },
        ]),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          exportJobId: "JOB-1",
          sourceKey: "google_ads",
          scopeHash: descriptor.scopeHash,
          dateFrom: "2026-06-12",
          dateTo: "2026-06-12",
          status: "active",
        }),
      }),
      expect.objectContaining({ new: true, upsert: true }),
    );
  });

  it("denies a duplicate active lock and permits expired-lock takeover through the atomic filter", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
    const deniedModel = {
      findOneAndUpdate: jest.fn().mockRejectedValue(duplicate),
    };
    const denied = new MongoSourceSyncLockService(deniedModel as any);

    await expect(denied.acquire(descriptor)).resolves.toEqual({
      acquired: false,
    });
    expect(deniedModel.findOneAndUpdate.mock.calls[0][0].$or).toContainEqual({
      expiresAt: { $lte: expect.any(Date) },
    });
  });

  it("releases only for the active owner and owner token", async () => {
    const model = {
      findOneAndUpdate: jest
        .fn()
        .mockResolvedValueOnce({ status: "released" })
        .mockResolvedValueOnce(null),
    };
    const service = new MongoSourceSyncLockService(model as any);

    await expect(
      service.release({
        key: descriptor.key,
        owner: descriptor.owner,
        ownerToken: "owner-token",
      }),
    ).resolves.toBeUndefined();
    await expect(
      service.release({
        key: descriptor.key,
        owner: "wrong-owner",
        ownerToken: "wrong-token",
      }),
    ).rejects.toThrow("release denied");
    expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual({
      lockKey: descriptor.key,
      owner: descriptor.owner,
      ownerToken: "owner-token",
      status: "active",
    });
  });

  it("defines unique lock-key and TTL expiry indexes instead of an in-memory lock", () => {
    const indexes = AiDataPackSourceSyncLockSchema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ lockKey: 1 }, expect.objectContaining({ unique: true })],
        [{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })],
      ]),
    );
  });
});

describe("SourceSyncAuditService", () => {
  it("persists bounded sanitized adapter audit fields and fixed safety invariants", async () => {
    const model = { create: jest.fn().mockResolvedValue({}) };
    const service = new SourceSyncAuditService(model as any);

    await service.persist({
      preAssessmentRef: "google_ads:stale:missing",
      postAssessmentRef: "google_ads:fresh:covered",
      result: {
        sourceKey: "google_ads",
        mode: "read_only",
        exportJobId: "JOB-1",
        correlationId: "CORR-1",
        policyVersion: "v1",
        status: "partial",
        providerSyncAttempted: true,
        mutationAttempted: false,
        requestedCustomerIds: ["1234567890"],
        selectedCustomerIds: ["1234567890"],
        dateFrom: "2026-06-12",
        dateTo: "2026-06-12",
        startedAt: "2026-06-13T00:00:00.000Z",
        completedAt: "2026-06-13T00:01:00.000Z",
        durationMs: 60_000,
        attemptCount: 2,
        retryClassifications: ["rate_limited"],
        counts: {},
        localWriteTargets: ["ai_data_pack_source_sync_audits"],
        writeTelemetrySummary: {
          operationCount: 2,
          recordCount: 3,
          targets: ["google_ads_sync_runs", "google_ads_campaigns"],
          operations: {
            insert: 1,
            update: 0,
            upsert: 1,
          },
          writes: [],
        },
        lock: {
          distributedLockRuntime: "implemented_mongo",
          key: "google_ads:scope:2026-06-12:2026-06-12",
          owner: "JOB-1:owner",
          scopeHash: "scope",
          acquired: true,
        },
        errors: [
          {
            category: "rate_limited",
            retryable: true,
            message: "Authorization=Bearer secret https://provider.test/raw",
            customerId: "1234567890",
          },
        ],
        warnings: [],
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      },
    });

    const audit = model.create.mock.calls[0][0];
    expect(audit).toEqual(
      expect.objectContaining({
        exportJobId: "JOB-1",
        sourceKey: "google_ads",
        scopeHash: "scope",
        lockKey: "google_ads:scope:2026-06-12:2026-06-12",
        lockAcquired: true,
        attempts: 2,
        policyVersion: "v1",
        writeTelemetrySummary: expect.objectContaining({
          operationCount: 2,
          recordCount: 3,
          targets: ["google_ads_sync_runs", "google_ads_campaigns"],
        }),
        providerSyncAttempted: true,
        mutationAttempted: false,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(JSON.stringify(audit)).not.toMatch(
      /Bearer secret|provider\.test|headers|response|stack|refresh.?token/i,
    );
  });
});
