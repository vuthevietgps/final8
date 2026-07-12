import { assertGoogleAdsReadonlyLocalWriteTarget } from "./google-ads-readonly-local-write-allowlist";

export type GoogleAdsReadonlyWriteOperation = "insert" | "update" | "upsert";

export interface GoogleAdsReadonlyWriteTelemetry {
  targetCollection: string;
  operationType: GoogleAdsReadonlyWriteOperation;
  recordCount: number;
  deleteAttempted: false;
  sourceStep: string;
}

export interface GoogleAdsReadonlyWriteTelemetrySummary {
  operationCount: number;
  recordCount: number;
  targets: readonly string[];
  operations: Readonly<Record<GoogleAdsReadonlyWriteOperation, number>>;
  writes: readonly GoogleAdsReadonlyWriteTelemetry[];
}

export function validateGoogleAdsReadonlyWriteTelemetry(
  telemetry: readonly GoogleAdsReadonlyWriteTelemetry[] | undefined,
): readonly GoogleAdsReadonlyWriteTelemetry[] {
  if (!telemetry?.length) {
    throw new Error("Read-only sync write telemetry is unavailable.");
  }
  if (telemetry.length > 1_000) {
    throw new Error("Read-only sync write telemetry exceeds the safe limit.");
  }

  return telemetry.map((write) => {
    assertGoogleAdsReadonlyLocalWriteTarget(write?.targetCollection);
    if (!["insert", "update", "upsert"].includes(write?.operationType)) {
      throw new Error("Read-only sync write operation is not allowed.");
    }
    if (write?.deleteAttempted !== false) {
      throw new Error("Read-only sync delete telemetry is forbidden.");
    }
    if (
      !Number.isSafeInteger(write?.recordCount) ||
      write.recordCount < 1 ||
      write.recordCount > 1_000_000
    ) {
      throw new Error("Read-only sync write record count is invalid.");
    }
    const sourceStep = String(write?.sourceStep || "");
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(sourceStep)) {
      throw new Error("Read-only sync write source step is invalid.");
    }
    return {
      targetCollection: write.targetCollection,
      operationType: write.operationType,
      recordCount: write.recordCount,
      deleteAttempted: false,
      sourceStep,
    };
  });
}

export function summarizeGoogleAdsReadonlyWriteTelemetry(
  telemetry: readonly GoogleAdsReadonlyWriteTelemetry[],
): GoogleAdsReadonlyWriteTelemetrySummary {
  const writes = validateGoogleAdsReadonlyWriteTelemetry(telemetry);
  const operations: Record<GoogleAdsReadonlyWriteOperation, number> = {
    insert: 0,
    update: 0,
    upsert: 0,
  };
  for (const write of writes) operations[write.operationType] += 1;
  return {
    operationCount: writes.length,
    recordCount: writes.reduce((total, write) => total + write.recordCount, 0),
    targets: [...new Set(writes.map((write) => write.targetCollection))],
    operations,
    writes,
  };
}
