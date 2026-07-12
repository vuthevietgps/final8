import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getPermissionsForRole } from "../../../auth/role-permissions";
import { UserRole } from "../../../user/user.enum";
import {
  AI_DATA_PACK_SYNC_DETAIL_READ_PERMISSION,
  GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION,
} from "../provider-adapter.tokens";

function productionSource(): string {
  return readdirSync(__dirname)
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"))
    .map((file) => readFileSync(join(__dirname, file), "utf8"))
    .join("\n");
}

function productionSourceExcept(...excluded: string[]): string {
  return readdirSync(__dirname)
    .filter(
      (file) =>
        file.endsWith(".ts") &&
        !file.endsWith(".spec.ts") &&
        !excluded.includes(file),
    )
    .map((file) => readFileSync(join(__dirname, file), "utf8"))
    .join("\n");
}

describe("Google Ads read-only adapter source guard", () => {
  it("has no forbidden broad, action, mutation, execution, or business-control dependency", () => {
    const source = productionSource();
    for (const forbidden of [
      "GoogleAdsModule",
      "GoogleAdsOperationBuilderService",
      "GoogleAdsProviderValidationService",
      "GoogleAdsExecutionService",
      "GoogleAdsPostExecutionService",
      "GoogleAdsEvaluationService",
      "GoogleAdsActionPlan",
      "EmergencyAction",
      "AutoControlService",
      "BudgetApplyService",
      "AdvertisingCostGoogleSyncService",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("confines the provider HTTP client to the runtime transport wrapper and contains no mutation path", () => {
    const source = productionSource();
    const outsideTransport = productionSourceExcept(
      "google-ads-readonly-adapter.module.ts",
      "google-ads-readonly-transport.service.ts",
    );
    const transport = readFileSync(
      join(__dirname, "google-ads-readonly-transport.service.ts"),
      "utf8",
    );

    expect(outsideTransport).not.toMatch(/axios|fetch\s*\(|\.request\s*\(/);
    expect(transport).toContain("this.http.request");
    expect(source).not.toMatch(
      /googleAds:mutate|adGroups:mutate|mutateOperations|validateOnly\s*:\s*true/,
    );
    expect(source).not.toMatch(
      /\.(updateOne|updateMany|findOneAndUpdate|deleteOne|deleteMany|bulkWrite|save)\s*\(/,
    );
  });

  it("binds the existing sync service through the runtime transport wrapper without broad GoogleAdsModule", () => {
    const module = readFileSync(
      join(__dirname, "google-ads-readonly-adapter.module.ts"),
      "utf8",
    );

    expect(module).not.toContain("GoogleAdsReadonlyBlockedSyncPortService");
    expect(module).toContain("GoogleAdsReadonlySyncService");
    expect(module).toContain("GoogleAdsReadonlySyncPortService");
    expect(module).not.toContain("GoogleAdsModule");
    expect(module).toContain(
      "exports: [AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER]",
    );
    expect(module).not.toMatch(
      /exports:\s*\[[^\]]*GoogleAdsReadonlySyncService/,
    );
    expect(module).toContain("MongoSourceSyncLockService");
    expect(module).toContain("SourceSyncAuditService");
    expect(module).toContain("useExisting: FreshnessGateService");
    expect(module).toContain("GoogleAdsReadonlyTransportService");
  });

  it("keeps the legacy sync provider boundary on the enforced transport wrapper only", () => {
    const readonlySync = readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "..",
        "google-ads",
        "google-ads-readonly-sync.service.ts",
      ),
      "utf8",
    );

    expect(readonlySync).toContain("GoogleAdsReadonlyTransportService");
    expect(readonlySync).toContain("templateId");
    expect(readonlySync).toContain(".searchStream(");
    expect(readonlySync).not.toMatch(
      /axios|fetch\s*\(|https:\/\/googleads\.googleapis|googleAds:searchStream|SELECT\s|FROM\s|WHERE\s|googleAds:mutate|adGroups:mutate/,
    );
  });

  it("does not wire the adapter into cached ExportJob, AI Data Pack module, or public controller", () => {
    const exportJob = readFileSync(
      join(__dirname, "..", "..", "export-jobs", "export-job.service.ts"),
      "utf8",
    );
    const module = readFileSync(
      join(__dirname, "..", "..", "ai-data-pack.module.ts"),
      "utf8",
    );
    const controller = readFileSync(
      join(__dirname, "..", "..", "ai-data-pack.controller.ts"),
      "utf8",
    );

    for (const source of [exportJob, module, controller]) {
      expect(source).not.toContain("GoogleAdsReadonlyAdapter");
      expect(source).not.toContain("AI_DATA_PACK_GOOGLE_ADS_READONLY_ADAPTER");
    }
    expect(exportJob).toContain("provider_sync_attempted: false");
    expect(exportJob).toContain("freshness_gate_evaluated: false");
    expect(controller).not.toMatch(
      /@Post\([^)]*(google-ads-readonly|readonly-sync|sync-execute|provider-adapters)/i,
    );
  });

  it("keeps sync execute unbound and sync-detail limited to director role binding", () => {
    const roles = readFileSync(
      join(__dirname, "..", "..", "..", "auth", "role-permissions.ts"),
      "utf8",
    );

    expect(GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION).not.toBe(
      "google-ads.read",
    );
    expect(roles).not.toContain(GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION);
    expect(getPermissionsForRole(UserRole.DIRECTOR)).toContain(
      AI_DATA_PACK_SYNC_DETAIL_READ_PERMISSION,
    );
    expect(getPermissionsForRole(UserRole.MANAGER)).not.toContain(
      AI_DATA_PACK_SYNC_DETAIL_READ_PERMISSION,
    );
    expect(getPermissionsForRole(UserRole.INVESTOR)).not.toContain(
      AI_DATA_PACK_SYNC_DETAIL_READ_PERMISSION,
    );
  });

  it("has no real provider call in focused adapter tests", () => {
    const tests = readdirSync(__dirname)
      .filter((file) => file.endsWith(".spec.ts"))
      .map((file) => readFileSync(join(__dirname, file), "utf8"))
      .join("\n");

    expect(tests).not.toMatch(/axios\.(get|post|patch|delete)|fetch\s*\(/);
  });
});
