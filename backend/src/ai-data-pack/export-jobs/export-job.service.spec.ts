import { readFileSync } from "fs";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { DataPackMetadataService } from "../data-pack-metadata.service";
import { JsonExporterService } from "../export/json-exporter.service";
import { ExportRbacPolicyService } from "../rbac/export-rbac-policy.service";
import { ExportRedactionProfileService } from "../redaction/export-redaction-profile.service";
import { ExportJobArtifactService } from "./export-job-artifact.service";
import { AiDataPackExportJobSchema } from "./export-job.schema";
import { AiDataPackExportJobService } from "./export-job.service";
import {
  AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
  OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
} from "./export-job.types";

class FakeExportJobModel {
  rows: any[] = [];
  createCalls = 0;
  statusHistory: string[] = [];

  findOne(filter: Record<string, unknown>) {
    return {
      lean: () => ({
        exec: async () => {
          const row = this.rows.find((candidate) =>
            Object.entries(filter).every(
              ([key, value]) => candidate[key] === value,
            ),
          );
          return row ? structuredClone(row) : null;
        },
      }),
    };
  }

  async create(value: any) {
    this.createCalls += 1;
    if (
      value.activeIdempotencyKey &&
      this.rows.some(
        (row) => row.activeIdempotencyKey === value.activeIdempotencyKey,
      )
    ) {
      throw Object.assign(new Error("duplicate"), { code: 11000 });
    }
    this.rows.push(structuredClone(value));
    this.statusHistory.push(value.status);
    return structuredClone(value);
  }

  updateOne(filter: Record<string, unknown>, update: any) {
    return {
      exec: async () => {
        const row = this.rows.find((candidate) =>
          Object.entries(filter).every(
            ([key, value]) => candidate[key] === value,
          ),
        );
        if (!row) return { matchedCount: 0 };
        if (update.$set) {
          Object.assign(row, structuredClone(update.$set));
          if (update.$set.status) this.statusHistory.push(update.$set.status);
        }
        if (update.$unset) {
          for (const key of Object.keys(update.$unset)) delete row[key];
        }
        if (update.$push) {
          for (const [key, value] of Object.entries(update.$push)) {
            row[key] = [...(row[key] || []), structuredClone(value)];
          }
        }
        return { matchedCount: 1 };
      },
    };
  }
}

function pack(reportDate = "2026-06-12") {
  return {
    metadata: {
      data_pack_id: `test-${reportDate}`,
      data_pack_type: "director",
      schema_version: "1.0",
      report_date: reportDate,
      exported_at: new Date().toISOString(),
      data_sources: [],
      warnings: [],
    },
    sections: { report: { data: [{ value: 1 }], quality: null } },
  };
}

function createService(options?: {
  model?: FakeExportJobModel;
  directorBuild?: jest.Mock;
  sourceSyncOrchestrator?: any;
}) {
  const model = options?.model || new FakeExportJobModel();
  const json = new JsonExporterService();
  const directorBuild =
    options?.directorBuild ||
    jest.fn().mockImplementation(async () => json.attachChecksums(pack()));
  const builders = {
    director: { build: directorBuild },
    marketer: {
      build: jest
        .fn()
        .mockImplementation(async () => json.attachChecksums(pack())),
    },
    quality: {
      build: jest
        .fn()
        .mockImplementation(async () => json.attachChecksums(pack())),
    },
    mapping: {
      build: jest
        .fn()
        .mockImplementation(async () => json.attachChecksums(pack())),
    },
  };
  const artifactService = {
    writeArtifact: jest.fn().mockImplementation(async (input: any) => ({
      artifactId: `${input.packType}-${input.format}`,
      packType: input.packType,
      format: input.format,
      fileName: `${input.packType}.${input.format}`,
      storageKey: `${input.jobId}/${input.packType}.${input.format}`,
      artifactChecksum: json.checksum(input.content),
      dataContentChecksum: input.dataContentChecksum,
      fileSizeBytes: input.content.length,
      createdAt: new Date(),
      cachedExport: input.cachedExport ?? true,
      exportMode: input.exportMode,
      redactionProfile: input.redactionProfile,
      sectionAccessProfile: input.sectionAccessProfile,
      artifactClass: input.artifactClass,
      redactionRuntime: input.redactionRuntime,
      artifactRendering: input.artifactRendering,
      downloadReady: input.downloadReady,
      checksumAlgorithm: input.checksumAlgorithm,
    })),
  };
  const redactionProfiles = new ExportRedactionProfileService();
  const rbac = new ExportRbacPolicyService(redactionProfiles);
  const service = new AiDataPackExportJobService(
    model as any,
    builders.director as any,
    builders.marketer as any,
    builders.quality as any,
    builders.mapping as any,
    new DataPackMetadataService(),
    json,
    { export: jest.fn().mockReturnValue(Buffer.from("xlsx")) } as any,
    artifactService as any,
    rbac,
    redactionProfiles,
    options?.sourceSyncOrchestrator,
  );
  return { service, model, builders, artifactService, json };
}

const request = {
  reportDate: "2026-06-12",
  packTypes: ["director_data_pack"] as const,
  formats: ["json"] as const,
  requestedBy: { id: "director-1", role: "director", fullName: "Director One" },
};

function sourceSyncResult(input: any, overrides: Record<string, unknown> = {}) {
  const result = {
    exportJobId: input.exportJobId,
    correlationId: input.correlationId,
    policyVersion: input.policyVersion,
    reportDate: input.reportDate,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    packTypes: input.packTypes,
    syncPolicy: input.syncPolicy,
    sourceImpact: {
      google_ads: {
        sourceKey: "google_ads",
        status: "fresh_covered",
        canUseForDecision: "yes",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        reportDateRecordCount: 12,
        lastSuccessfulSyncAt: "2026-06-12T00:00:00.000Z",
        latestRecordDate: "2026-06-12",
      },
    },
    sourceDecisions: [
      {
        sourceKey: "google_ads",
        adapterDecision: "skipped_fresh_covered",
        sourceImpact: {
          sourceKey: "google_ads",
          status: "fresh_covered",
          canUseForDecision: "yes",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          reportDateRecordCount: 12,
        },
        warnings: [],
        blockingReasons: [],
      },
    ],
    warnings: [],
    blockingReasons: [],
    decisionGates: {
      canUseForDecision: true,
      canUseGoogleAdsDataClaim: true,
      canGenerateActionDraft: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
    providerSyncAttempted: false,
    mutationAttempted: false,
    canImportActionFile: false,
    canDryRun: false,
    canExecuteLive: false,
  };
  return { ...result, ...overrides };
}

function officialPartialRequest(overrides: Record<string, unknown> = {}) {
  return {
    mode: "official_export",
    reportDate: "2026-06-12",
    dateFrom: "2026-06-01",
    dateTo: "2026-06-12",
    packTypes: ["director_data_pack"],
    formats: ["json"],
    requester: {
      id: "director-1",
      role: "director",
      fullName: "Director One",
      permissions: [
        AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
        "ai-data-pack.profile.director-full",
      ],
    },
    redactionProfile: "director_full",
    sectionAccessProfile: "director_full",
    policyVersion: OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
    idempotencyKey: "prompt13-official-1",
    sourceScope: {
      sourceKeys: ["google_ads"],
      googleAdsCustomerIds: ["1234567890"],
    },
    ...overrides,
  };
}

describe("AiDataPackExportJobService cached-only lifecycle", () => {
  it("creates and completes a cached export job with artifact audit and no syncing state", async () => {
    const { service, model, builders, artifactService } = createService();

    const result = await service.createCachedExport(request as any);

    expect(result).toEqual(
      expect.objectContaining({
        exportMode: "cached_export",
        syncPolicy: "export_cached",
        cachedExport: true,
        providerSyncAttempted: false,
        freshnessGateEvaluated: false,
        liveExecution: false,
        status: "completed",
        requestedByUserId: "director-1",
      }),
    );
    expect(model.statusHistory).toEqual(["pending", "exporting", "completed"]);
    expect(model.statusHistory).not.toContain("syncing");
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        cachedExport: true,
        artifactChecksum: expect.any(String),
        dataContentChecksum: expect.any(String),
        fileSizeBytes: expect.any(Number),
      }),
    );
    expect(builders.director.build).toHaveBeenCalledTimes(1);
    expect(artifactService.writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        packType: "director_data_pack",
        format: "json",
        dataContentChecksum: expect.any(String),
      }),
    );
    const rendered = JSON.parse(
      artifactService.writeArtifact.mock.calls[0][0].content.toString("utf8"),
    );
    expect(rendered.metadata).toEqual(
      expect.objectContaining({
        export_job_id: result.jobId,
        export_mode: "cached_export",
        cached_export: true,
        sync_policy: "export_cached",
        provider_sync_attempted: false,
        freshness_gate_evaluated: false,
        live_execution: false,
      }),
    );
  });

  it("reuses an equivalent active job instead of creating a duplicate", async () => {
    let releaseBuild!: () => void;
    let buildStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      buildStarted = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      releaseBuild = resolve;
    });
    const model = new FakeExportJobModel();
    const directorBuild = jest.fn().mockImplementation(async () => {
      buildStarted();
      await blocked;
      return new JsonExporterService().attachChecksums(pack());
    });
    const { service } = createService({ model, directorBuild });

    const firstPromise = service.createCachedExport(request as any);
    await started;
    const reused = await service.createCachedExport({
      ...request,
      packTypes: ["director_data_pack"],
      formats: ["json"],
    } as any);

    expect(reused.status).toBe("exporting");
    expect(model.createCalls).toBe(1);
    expect(directorBuild).toHaveBeenCalledTimes(1);
    releaseBuild();
    await firstPromise;
  });

  it("supports multiple cached pack types and formats through existing builders/exporters", async () => {
    const { service, builders, artifactService } = createService();

    const result = await service.createCachedExport({
      reportDate: "2026-06-12",
      packTypes: [
        "mapping_report",
        "director_data_pack",
        "data_quality_report",
        "marketer_data_pack",
      ],
      formats: ["xlsx", "json"],
      requestedBy: request.requestedBy,
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts).toHaveLength(8);
    expect(builders.director.build).toHaveBeenCalledTimes(2);
    expect(builders.marketer.build).toHaveBeenCalledTimes(2);
    expect(builders.quality.build).toHaveBeenCalledTimes(2);
    expect(builders.mapping.build).toHaveBeenCalledTimes(2);
    expect(artifactService.writeArtifact).toHaveBeenCalledTimes(8);
  });

  it("stores only a sanitized failure category and message", async () => {
    const directorBuild = jest
      .fn()
      .mockRejectedValue(
        Object.assign(
          new Error(
            "authorization=Bearer top-secret customer director@example.com phone +84901234567 https://provider.test/raw",
          ),
          { code: "PROVIDER_FAILURE" },
        ),
      );
    const { service, artifactService } = createService({ directorBuild });

    const result = await service.createCachedExport(request as any);

    expect(result.status).toBe("failed");
    expect(result.errorCategory).toBe("provider_failure");
    expect(result.sanitizedErrorMessage).not.toMatch(
      /top-secret|director@example\.com|84901234567|provider\.test/i,
    );
    expect(result.sanitizedErrorMessage).toContain("[REDACTED]");
    expect(artifactService.writeArtifact).not.toHaveBeenCalled();
  });

  it("keeps data content checksum stable when only cached job metadata changes", () => {
    const json = new JsonExporterService();
    const first = json.attachChecksums({
      metadata: {
        report_date: "2026-06-12",
        export_job_id: "job-1",
        export_mode: "cached_export",
        cached_export: true,
      },
      data: { value: 1 },
    });
    const second = json.attachChecksums({
      metadata: {
        report_date: "2026-06-12",
        export_job_id: "job-2",
        export_mode: "cached_export",
        cached_export: true,
      },
      data: { value: 1 },
    });
    expect(first.metadata.data_content_checksum).toBe(
      second.metadata.data_content_checksum,
    );
    expect(first.metadata.runtime_export_checksum).not.toBe(
      second.metadata.runtime_export_checksum,
    );
  });

  it("does not invoke source-sync preparation from cached export creation", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest.fn(),
    };
    const { service } = createService({ sourceSyncOrchestrator });

    await service.createCachedExport(request as any);

    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
  });

  it("exposes an internal source-sync preparation delegate without changing cached mode", async () => {
    const sourceSyncResult = {
      exportJobId: "JOB-1",
      correlationId: "CORR-1",
      syncPolicy: "sync_if_stale",
      providerSyncAttempted: false,
      mutationAttempted: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest.fn().mockResolvedValue(sourceSyncResult),
    };
    const { service } = createService({ sourceSyncOrchestrator });

    await expect(
      service.prepareSourcesForExportJob({
        exportJobId: "JOB-1",
        correlationId: "CORR-1",
        reportDate: "2026-06-12",
        syncPolicy: "sync_if_stale",
      }),
    ).resolves.toBe(sourceSyncResult);
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        exportJobId: "JOB-1",
        reportDate: "2026-06-12",
        syncPolicy: "sync_if_stale",
      }),
    );
  });

  it("creates an official internal lifecycle job with a rendered redacted JSON artifact", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest
        .fn()
        .mockImplementation(async (input: any) => sourceSyncResult(input)),
    };
    const { service, model, artifactService } = createService({
      sourceSyncOrchestrator,
    });

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest() as any,
    );

    expect(result).toEqual(
      expect.objectContaining({
        exportMode: "official_export",
        syncPolicy: "sync_required",
        cachedExport: false,
        providerSyncAttempted: false,
        freshnessGateEvaluated: true,
        liveExecution: false,
        status: "completed",
      }),
    );
    expect(model.statusHistory).toEqual([
      "requested",
      "pre_assessing",
      "syncing_sources",
      "post_assessing",
      "snapshotting",
      "exporting",
      "completed",
    ]);
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        exportJobId: result.jobId,
        syncPolicy: "sync_required",
        customerIds: ["1234567890"],
      }),
    );
    expect(result.artifacts).toHaveLength(1);
    expect(artifactService.writeArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        packType: "director_data_pack",
        format: "json",
        cachedExport: false,
        exportMode: "official_export",
        redactionProfile: "director_full",
        sectionAccessProfile: "director_full",
        artifactClass: "downloadable_redacted_artifact",
        redactionRuntime: "pre_rendered",
        artifactRendering: "rendered",
        downloadReady: true,
        checksumAlgorithm: "sha256",
      }),
    );
    expect(result.manifest).toEqual(
      expect.objectContaining({
        artifactId: expect.any(String),
        exportJobId: result.jobId,
        exportMode: "official_export",
        syncPolicy: "sync_required",
        redactionProfile: "director_full",
        sectionAccessProfile: "director_full",
        redactionRuntime: "pre_rendered",
        artifactRendering: "rendered",
        artifactClass: "downloadable_redacted_artifact",
        downloadReady: true,
        renderedArtifactCount: 1,
        storageLocation: expect.stringMatching(
          /^ai-data-pack\/AIDP-.*\/official-partial\/manifest-placeholder\.json$/,
        ),
        downloadPolicy: "direct_authenticated_download_only",
      }),
    );
    expect(result.manifest.downloadableArtifactIds).toEqual([
      result.artifacts[0].artifactId,
    ]);
    expect(result.manifest.warnings).not.toEqual(
      expect.arrayContaining([
        "artifact_rendering=deferred",
        "redaction_runtime=manifest_only",
      ]),
    );
    expect(result.manifest.storageLocation).not.toMatch(/^https?:\/\//);
    expect(result.manifest.artifactChecksum).not.toBe(
      result.manifest.dataContentChecksum,
    );
    expect(result.manifest.runtimeExportChecksum).not.toBe(
      result.manifest.dataContentChecksum,
    );
    expect(result.manifest.decisionGates).toEqual(
      expect.objectContaining({
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(result.auditEvents.map((event: any) => event.event)).toEqual(
      expect.arrayContaining([
        "export_requested",
        "pre_assessment_started",
        "source_sync_started",
        "source_sync_completed",
        "post_assessment_completed",
        "artifact_render_requested",
        "artifact_render_started",
        "artifact_render_completed",
        "artifact_generated",
      ]),
    );
    const rendered = JSON.parse(
      artifactService.writeArtifact.mock.calls[0][0].content.toString("utf8"),
    );
    expect(rendered.metadata).toEqual(
      expect.objectContaining({
        export_job_id: result.jobId,
        export_mode: "official_export",
        cached_export: false,
        redaction_runtime: "pre_rendered",
        artifact_rendering: "rendered",
        download_ready: true,
        can_import_action_file: false,
        can_dry_run: false,
        can_execute_live: false,
      }),
    );
  });

  it("uses sync_if_stale for partial export and reclassifies weak source data as warnings", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest.fn().mockImplementation(async (input) =>
        sourceSyncResult(input, {
          warnings: ["google_ads_stale"],
          blockingReasons: ["google_ads_not_fresh_after_sync"],
        }),
      ),
    };
    const { service } = createService({ sourceSyncOrchestrator });

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest({
        mode: "partial_export",
        requester: {
          id: "marketer-1",
          permissions: [
            AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
            "ai-data-pack.profile.manager-marketer",
          ],
        },
        redactionProfile: "manager_marketer",
        sectionAccessProfile: "manager_marketer",
        idempotencyKey: "prompt13-partial-1",
      }) as any,
    );

    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ syncPolicy: "sync_if_stale" }),
    );
    expect(result.status).toBe("completed_with_warnings");
    expect(result.blockingReasons).toEqual([]);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0]).toEqual(
      expect.objectContaining({
        cachedExport: false,
        exportMode: "partial_export",
        redactionProfile: "manager_marketer",
        artifactClass: "downloadable_redacted_artifact",
        redactionRuntime: "pre_rendered",
        artifactRendering: "rendered",
        downloadReady: true,
      }),
    );
    expect(result.manifest).toEqual(
      expect.objectContaining({
        exportMode: "partial_export",
        redactionRuntime: "pre_rendered",
        artifactRendering: "rendered",
        downloadReady: true,
      }),
    );
    expect(result.manifest.warnings).toEqual(
      expect.arrayContaining([
        "google_ads_stale",
        "partial_source_limited:google_ads_not_fresh_after_sync",
      ]),
    );
    expect(result.manifest.blockingReasons).toEqual([]);
  });

  it("keeps xlsx official artifacts not supported instead of faking a download file", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest
        .fn()
        .mockImplementation(async (input: any) => sourceSyncResult(input)),
    };
    const { service, artifactService } = createService({
      sourceSyncOrchestrator,
    });

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest({
        formats: ["xlsx"],
        idempotencyKey: "prompt25-xlsx-not-supported",
      }) as any,
    );

    expect(result.status).toBe("completed_with_warnings");
    expect(result.artifacts).toHaveLength(0);
    expect(artifactService.writeArtifact).not.toHaveBeenCalled();
    expect(result.manifest).toEqual(
      expect.objectContaining({
        redactionRuntime: "manifest_only",
        artifactRendering: "deferred",
        artifactClass: "manifest_only_artifact",
        downloadReady: false,
        unsupportedFormats: ["xlsx"],
      }),
    );
    expect(result.manifest.warnings).toEqual(
      expect.arrayContaining(["artifact_render_skipped_not_supported:xlsx"]),
    );
    expect(result.auditEvents.map((event: any) => event.event)).toContain(
      "artifact_render_skipped_not_supported",
    );
  });

  it("failed render leaves the job non-downloadable with sanitized failure state", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest
        .fn()
        .mockImplementation(async (input: any) => sourceSyncResult(input)),
    };
    const { service, artifactService } = createService({
      sourceSyncOrchestrator,
    });
    artifactService.writeArtifact.mockRejectedValueOnce(
      new Error("storage failed at C:/secret/path token=secret"),
    );

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest({
        idempotencyKey: "prompt25-render-failed",
      }) as any,
    );

    expect(result.status).toBe("failed");
    expect(result.artifacts).toHaveLength(0);
    expect(result.artifactRendering).toBe("failed");
    expect(result.manifest).toEqual(
      expect.objectContaining({
        artifactRendering: "failed",
        artifactClass: "manifest_only_artifact",
        downloadReady: false,
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/C:\/secret|token=secret/i);
    expect(result.auditEvents.map((event: any) => event.event)).toContain(
      "artifact_render_failed",
    );
  });

  it("blocks official export on critical source post-assessment failure without generating an artifact", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest.fn().mockImplementation(async (input) =>
        sourceSyncResult(input, {
          blockingReasons: [
            "google_ads_not_fresh_after_sync https://provider.test/raw",
          ],
        }),
      ),
    };
    const { service, artifactService } = createService({
      sourceSyncOrchestrator,
    });

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest({ idempotencyKey: "prompt13-blocked-1" }) as any,
    );

    expect(result.status).toBe("blocked");
    expect(result.errorCategory).toBe("source_assessment_blocked");
    expect(result.sanitizedErrorMessage).not.toContain("provider.test");
    expect(result.manifest).toBeUndefined();
    expect(result.artifacts).toHaveLength(0);
    expect(artifactService.writeArtifact).not.toHaveBeenCalled();
    expect(result.auditEvents.map((event: any) => event.event)).toContain(
      "export_blocked",
    );
  });

  it("downgrades official export only when explicitly allowed and audits the downgrade", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest.fn().mockImplementation(async (input) =>
        sourceSyncResult(input, {
          blockingReasons: ["google_ads_not_fresh_after_sync"],
        }),
      ),
    };
    const { service } = createService({ sourceSyncOrchestrator });

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest({
        idempotencyKey: "prompt13-downgrade-1",
        allowDowngradeToPartial: true,
      }) as any,
    );

    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ syncPolicy: "sync_required" }),
    );
    expect(result.status).toBe("completed_with_warnings");
    expect(result.exportMode).toBe("partial_export");
    expect(result.downgradedFromExportMode).toBe("official_export");
    expect(result.manifest.exportMode).toBe("partial_export");
    expect(result.manifest.syncPolicy).toBe("sync_required");
    expect(result.auditEvents.map((event: any) => event.event)).toContain(
      "export_downgraded",
    );
  });

  it("fails closed on missing RBAC/profile permission and does not call source sync", async () => {
    const sourceSyncOrchestrator = {
      prepareSourcesForExportJob: jest.fn(),
    };
    const { service } = createService({ sourceSyncOrchestrator });

    const result = await service.createOfficialPartialExportInternal(
      officialPartialRequest({
        idempotencyKey: "prompt13-rbac-denied-1",
        requester: { id: "manager-1", permissions: [] },
        redactionProfile: "director_full",
      }) as any,
    );

    expect(result.status).toBe("blocked");
    expect(result.errorCategory).toBe("rbac_denied");
    expect(result.manifest).toBeUndefined();
    expect(result.artifacts).toHaveLength(0);
    expect(
      sourceSyncOrchestrator.prepareSourcesForExportJob,
    ).not.toHaveBeenCalled();
    expect(result.auditEvents.map((event: any) => event.event)).toContain(
      "rbac_denied",
    );
  });

  it("rejects forbidden provider/action/live/OpenAI payload fields at internal input boundary", async () => {
    const { service } = createService({
      sourceSyncOrchestrator: { prepareSourcesForExportJob: jest.fn() },
    });

    await expect(
      service.createOfficialPartialExportInternal(
        officialPartialRequest({
          idempotencyKey: "prompt13-forbidden-1",
          sourceScope: {
            sourceKeys: ["google_ads"],
            googleAdsCustomerIds: ["1234567890"],
            refreshToken: "secret",
          },
        }) as any,
      ),
    ).rejects.toThrow("refreshToken is not accepted");
  });

  it("defines a unique active idempotency index and internal lifecycle schema enums", () => {
    const indexes = AiDataPackExportJobSchema.indexes();
    expect(indexes).toContainEqual([
      { activeIdempotencyKey: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { activeIdempotencyKey: { $type: "string" } },
      }),
    ]);
    expect(AiDataPackExportJobSchema.path("exportMode").options.enum).toEqual([
      "cached_export",
      "official_export",
      "partial_export",
    ]);
    expect(AiDataPackExportJobSchema.path("syncPolicy").options.enum).toEqual([
      "export_cached",
      "sync_required",
      "sync_if_stale",
    ]);
    expect(AiDataPackExportJobSchema.path("status").options.enum).toEqual(
      expect.arrayContaining([
        "requested",
        "pre_assessing",
        "syncing_sources",
        "post_assessing",
        "snapshotting",
        "completed_with_warnings",
        "blocked",
        "expired",
      ]),
    );
  });

  it("has no provider, action, sheet, payment, settlement, recalculation or OpenAI dependency", () => {
    const source = readFileSync(
      join(__dirname, "export-job.service.ts"),
      "utf8",
    );
    for (const forbidden of [
      "GoogleAdsReadonlySyncService",
      "AdvertisingCostFacebookSyncService",
      "AdvertisingCostGoogleSyncService",
      "AdvertisingCostTiktokSyncService",
      "DataCollectionService",
      "OrderSheetSyncService",
      "AutoControlService",
      "BudgetApplyService",
      "ExecutionService",
      "ProviderValidationService",
      "PaymentService",
      "StatementManagementService",
      "OrderCalculationService",
      "OpenAIConfigService",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("keeps existing GET exports independent from ExportJob side effects", () => {
    const controller = readFileSync(
      join(__dirname, "..", "ai-data-pack.controller.ts"),
      "utf8",
    );
    expect(controller).not.toContain("AiDataPackExportJobService");
    expect(controller).not.toContain("createCachedExport");
  });
});

describe("ExportJobArtifactService", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "ai-data-pack-artifacts-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes an immutable artifact under the configured root with deterministic checksum", async () => {
    const service = new ExportJobArtifactService(root);
    const content = Buffer.from("cached export");
    const artifact = await service.writeArtifact({
      jobId: "AIDP-test-1",
      packType: "director_data_pack",
      format: "json",
      content,
      dataContentChecksum: "content-checksum",
    });

    expect(artifact).toEqual(
      expect.objectContaining({
        storageKey: "AIDP-test-1/director_data_pack.json",
        cachedExport: true,
        dataContentChecksum: "content-checksum",
        fileSizeBytes: content.length,
      }),
    );
    expect(await readFile(join(root, artifact.storageKey), "utf8")).toBe(
      "cached export",
    );
    await expect(
      service.writeArtifact({
        jobId: "AIDP-test-1",
        packType: "director_data_pack",
        format: "json",
        content,
      }),
    ).rejects.toThrow();
  });

  it("rejects path traversal segments", async () => {
    const service = new ExportJobArtifactService(root);
    await expect(
      service.writeArtifact({
        jobId: "../escape",
        packType: "director_data_pack",
        format: "json",
        content: Buffer.from("x"),
      }),
    ).rejects.toThrow("Invalid artifact path segment");
  });
});
