import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHash } from "crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import request = require("supertest");
import { getPermissionsForRole } from "../../auth/role-permissions";
import { JwtAuthGuard } from "../../auth/guards/auth.guard";
import { UserRole } from "../../user/user.enum";
import { ExportEndpointAuditService } from "../audit/export-endpoint-audit.service";
import { JsonExporterService } from "../export/json-exporter.service";
import { ExportEndpointObservabilityService } from "../observability/export-endpoint-observability.service";
import {
  AI_DATA_PACK_PROFILE_PERMISSION,
  ExportEndpointPolicyService,
} from "../rbac/export-endpoint-policy.service";
import { ExportRedactionProfileService } from "../redaction/export-redaction-profile.service";
import { ExportEndpointRateLimitService } from "./export-endpoint-rate-limit.service";
import {
  AI_DATA_PACK_EXPORT_ROOT,
  ExportJobArtifactService,
} from "./export-job-artifact.service";
import { ExportJobEndpointController } from "./export-job-endpoint.controller";
import { ExportJobEndpointService } from "./export-job-endpoint.service";
import { ExportJobResponseRedactorService } from "./export-job-response-redactor.service";
import { AiDataPackExportJobService } from "./export-job.service";
import {
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_AUDIT_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
  AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION,
  CACHED_EXPORT_POLICY_VERSION,
  OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
} from "./export-job.types";

const DIRECTOR_PERMISSIONS = [
  AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_AUDIT_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION,
  AI_DATA_PACK_PROFILE_PERMISSION.director_full,
];

const MANAGER_PARTIAL_PERMISSIONS = [
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
  AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer,
];

function officialBody(overrides: Record<string, unknown> = {}) {
  return {
    exportMode: "official_export",
    reportDate: "2026-06-12",
    dateFrom: "2026-06-01",
    dateTo: "2026-06-12",
    packTypes: ["director_data_pack"],
    formats: ["json"],
    redactionProfile: "director_full",
    sectionAccessProfile: "director_full",
    sourceScope: {
      sourceKeys: ["google_ads"],
      googleAdsCustomerIds: ["1234567890"],
    },
    allowDowngradeToPartial: false,
    idempotencyKey: "official-idem-1",
    policyVersion: OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
    ...overrides,
  };
}

function partialBody(overrides: Record<string, unknown> = {}) {
  return {
    ...officialBody({
      exportMode: "partial_export",
      packTypes: ["marketer_data_pack"],
      redactionProfile: "manager_marketer",
      sectionAccessProfile: "manager_marketer",
      idempotencyKey: "partial-idem-1",
    }),
    ...overrides,
  };
}

function cachedBody(overrides: Record<string, unknown> = {}) {
  return {
    exportMode: "cached_export",
    reportDate: "2026-06-12",
    dateFrom: "2026-06-12",
    dateTo: "2026-06-12",
    packTypes: ["marketer_data_pack"],
    formats: ["json"],
    redactionProfile: "manager_marketer",
    sectionAccessProfile: "manager_marketer",
    idempotencyKey: "cached-idem-1",
    policyVersion: CACHED_EXPORT_POLICY_VERSION,
    ...overrides,
  };
}

function sourceSyncPreparation() {
  return {
    sourceImpact: {
      google_ads: {
        sourceKey: "google_ads",
        status: "fresh_covered",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        canUseForDecision: "yes",
        latestRecordDate: "2026-06-12",
        lastSuccessfulSyncAt: "2026-06-12T00:00:00.000Z",
      },
    },
    sourceDecisions: [
      {
        sourceKey: "google_ads",
        adapterDecision: "called_adapter",
        sourceImpact: {
          sourceKey: "google_ads",
          status: "fresh_covered",
          freshnessStatus: "fresh",
          coverageStatus: "covered",
          canUseForDecision: "yes",
        },
        warnings: ["provider warning with token=secret"],
        blockingReasons: [],
        adapterResultSummary: {
          providerSyncAttempted: true,
          requestedCustomerCount: 12,
          selectedCustomerCount: 1,
          errorCategories: ["oauth_error"],
          rawProviderResponse: { token: "secret" },
        },
      },
    ],
    decisionGates: {
      canUseForDecision: true,
      canUseGoogleAdsDataClaim: true,
      canGenerateActionDraft: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
  };
}

function manifest(jobId: string, exportMode = "official_export") {
  return {
    artifactId: "artifact-1",
    exportJobId: jobId,
    exportMode,
    syncPolicy: exportMode === "official_export" ? "sync_required" : "sync_if_stale",
    policyVersion: OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
    redactionProfile: "director_full",
    sectionAccessProfile: "director_full",
    packTypes: ["director_data_pack"],
    formats: ["json"],
    rowCounts: { orders: 10 },
    sourceFreshnessMetadata: {},
    sourceCoverageMetadata: {},
    decisionGates: {
      canUseForDecision: true,
      canUseGoogleAdsDataClaim: true,
      canGenerateActionDraft: true,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    },
    warnings: [],
    blockingReasons: [],
    containsPii: true,
    containsFinancialSensitive: true,
    containsEmployeeSensitive: true,
    containsSupplierSensitive: true,
    dataContentChecksum: "data-checksum",
    runtimeExportChecksum: "runtime-checksum",
    artifactChecksum: "artifact-checksum",
    createdAt: "2026-06-12T00:00:00.000Z",
    expiresAt: "2026-06-19T00:00:00.000Z",
    retentionUntil: "2026-07-12T00:00:00.000Z",
    storageLocation: `ai-data-pack/${jobId}/official-partial/manifest-placeholder.json`,
    downloadPolicy: "internal_only_no_public_download_endpoint",
    redactionRuntime: "manifest_only",
    artifactRendering: "deferred",
  };
}

describe("ExportJobEndpointController", () => {
  let app: INestApplication;
  let jobs: Map<string, any>;
  let auditModel: { create: jest.Mock };
  let observability: ExportEndpointObservabilityService;
  let exportJobs: {
    createCachedExport: jest.Mock;
    createOfficialPartialExportInternal: jest.Mock;
    findExportJobById: jest.Mock;
    appendEndpointAudit: jest.Mock;
  };
  let sequence: number;
  let artifactRoot: string;

  beforeEach(async () => {
    jobs = new Map<string, any>();
    auditModel = { create: jest.fn().mockResolvedValue({}) };
    sequence = 1;
    artifactRoot = mkdtempSync(join(tmpdir(), "ai-data-pack-download-"));
    exportJobs = {
      createCachedExport: jest.fn(async (input: any) => {
        const job = makeJob({
          jobId: `JOB-${sequence++}`,
          exportMode: "cached_export",
          syncPolicy: "export_cached",
          requestedByUserId: input.requestedBy.id,
          redactionProfile: input.redactionProfile,
          sectionAccessProfile: input.sectionAccessProfile,
          packTypes: input.packTypes,
          formats: input.formats,
          artifacts: [
            {
              artifactId: "cached-artifact",
              packType: input.packTypes[0],
              format: input.formats[0],
              fileName: "marketer_data_pack.json",
              storageKey: "JOB-1/marketer_data_pack.json",
              artifactChecksum: "artifact-checksum",
              dataContentChecksum: "data-checksum",
              fileSizeBytes: 100,
              createdAt: new Date("2026-06-12T00:00:00.000Z"),
              cachedExport: true,
            },
          ],
        });
        jobs.set(job.jobId, job);
        return job;
      }),
      createOfficialPartialExportInternal: jest.fn(async (input: any) => {
        const jobId = `JOB-${sequence++}`;
        const job = makeJob({
          jobId,
          exportMode: input.mode,
          syncPolicy:
            input.mode === "official_export" ? "sync_required" : "sync_if_stale",
          requestedByUserId: input.requester.id,
          redactionProfile: input.redactionProfile,
          sectionAccessProfile: input.sectionAccessProfile,
          packTypes: input.packTypes,
          formats: input.formats,
          providerSyncAttempted: input.mode !== "cached_export",
          freshnessGateEvaluated: true,
          manifest: manifest(jobId, input.mode),
          sourceSyncPreparation: sourceSyncPreparation(),
          decisionGates: sourceSyncPreparation().decisionGates,
        });
        jobs.set(job.jobId, job);
        return job;
      }),
      findExportJobById: jest.fn(async (jobId: string) => jobs.get(jobId) || null),
      appendEndpointAudit: jest.fn(async (jobId: string, event: any) => {
        const job = jobs.get(jobId);
        if (job) job.auditEvents = [...(job.auditEvents || []), event];
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [ExportJobEndpointController],
      providers: [
        JsonExporterService,
        {
          provide: ExportEndpointAuditService,
          useValue: new ExportEndpointAuditService(auditModel as any),
        },
        ExportEndpointPolicyService,
        ExportEndpointRateLimitService,
        ExportEndpointObservabilityService,
        ExportJobResponseRedactorService,
        ExportJobArtifactService,
        ExportJobEndpointService,
        ExportRedactionProfileService,
        { provide: AI_DATA_PACK_EXPORT_ROOT, useValue: artifactRoot },
        { provide: AiDataPackExportJobService, useValue: exportJobs },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: String(req.headers["x-test-user-id"] || "director-1"),
            role: String(req.headers["x-test-role"] || "director"),
            redactionProfile: String(
              req.headers["x-test-profile"] || "director_full",
            ),
            permissions: String(req.headers["x-test-permissions"] || "")
              .split(",")
              .filter(Boolean),
            sectionAccessProfile: String(
              req.headers["x-test-section-profile"] ||
                req.headers["x-test-profile"] ||
                "director_full",
            ),
          };
          return true;
        },
      })
      .compile();

    observability = moduleRef.get(ExportEndpointObservabilityService);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(artifactRoot, { recursive: true, force: true });
  });

  it("denies official create without the required permission", async () => {
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(authHeaders({ role: "employee", permissions: [] }))
      .send(officialBody())
      .expect(403);

    expect(exportJobs.createOfficialPartialExportInternal).not.toHaveBeenCalled();
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: "export_create_denied" }),
    );
  });

  it("binds Prompt 15 permissions through existing roles with fail-closed defaults", () => {
    const director = getPermissionsForRole(UserRole.DIRECTOR);
    expect(director).toEqual(
      expect.arrayContaining([
        AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
        AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
        AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
        AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
        AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION,
        AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_AUDIT_READ_PERMISSION,
        AI_DATA_PACK_PROFILE_PERMISSION.director_full,
      ]),
    );

    const manager = getPermissionsForRole(UserRole.MANAGER);
    expect(manager).toEqual(
      expect.arrayContaining([
        AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
        AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
        AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
        AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
        AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer,
      ]),
    );
    expect(manager).not.toContain(AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION);
    expect(manager).not.toContain(
      AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION,
    );
    expect(manager).not.toContain(AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION);
    expect(manager).not.toContain(AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION);

    const investor = getPermissionsForRole(UserRole.INVESTOR);
    expect(investor).toEqual(
      expect.arrayContaining([
        AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
        AI_DATA_PACK_PROFILE_PERMISSION.investor_redacted,
      ]),
    );
    expect(investor).not.toContain(AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION);
    expect(investor).not.toContain(AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION);
    expect(investor).not.toContain(AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION);

    const systemLike = getPermissionsForRole(UserRole.INTERNAL_AGENT);
    expect(systemLike).not.toContain(AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION);
    expect(systemLike).not.toContain(AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION);
  });

  it("allows role-bound director create without explicit user.permissions", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          userId: "director-role-only",
          role: "director",
          profile: "director_full",
          permissions: [],
        }),
      )
      .send(officialBody({ idempotencyKey: "director-role-bound" }))
      .expect(201);

    expect(response.body.exportMode).toBe("official_export");
    expect(exportJobs.createOfficialPartialExportInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        requester: expect.objectContaining({
          permissions: expect.arrayContaining([
            AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
          ]),
        }),
      }),
    );
  });

  it("persists sanitized HTTP request metadata without raw transport fields", async () => {
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(authHeaders({ role: "employee", permissions: [] }))
      .set("x-request-id", "req-prompt17-1")
      .set("x-correlation-id", "corr-prompt17-1")
      .set("x-forwarded-for", "203.0.113.9")
      .set("user-agent", "Prompt17RawUserAgent/1.0")
      .send(officialBody({ idempotencyKey: "prompt17-transport" }))
      .expect(403);

    const deniedAudit = auditModel.create.mock.calls
      .map((call) => call[0])
      .find((audit) => audit.event === "export_create_denied");
    expect(deniedAudit).toEqual(
      expect.objectContaining({
        requestId: "req-prompt17-1",
        correlationId: "corr-prompt17-1",
        routeTemplate: "/ai-data-pack/exports",
        method: "POST",
        ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        userAgentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(JSON.stringify(deniedAudit)).not.toMatch(
      /203\.0\.113\.9|Prompt17RawUserAgent|x-forwarded-for|headers|body|rawUserAgent/i,
    );

    const observations = observability.listForTest();
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricName: "ai_data_pack_export_create_denied_total",
          endpointName: "create",
          exportMode: "official_export",
          redactionProfile: "director_full",
          reasonCategory: "missing_permission",
        }),
      ]),
    );
    expect(JSON.stringify(observations)).not.toMatch(
      /203\.0\.113\.9|Prompt17RawUserAgent|prompt17-transport|director-1/i,
    );
  });

  it("still honors explicit user.permissions for a non-bound role", async () => {
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          userId: "explicit-employee",
          role: "employee",
          profile: "manager_marketer",
          permissions: MANAGER_PARTIAL_PERMISSIONS,
        }),
      )
      .send(partialBody({ idempotencyKey: "explicit-permissions" }))
      .expect(201);
  });

  it("denies manager profile from creating official exports", async () => {
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          userId: "manager-1",
          role: "manager",
          profile: "manager_marketer",
          permissions: MANAGER_PARTIAL_PERMISSIONS,
        }),
      )
      .send(officialBody({ redactionProfile: "manager_marketer" }))
      .expect(403);

    expect(exportJobs.createOfficialPartialExportInternal).not.toHaveBeenCalled();
  });

  it("enforces partial create permission and accepts a valid partial request", async () => {
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          userId: "manager-1",
          role: "employee",
          profile: "manager_marketer",
          permissions: [AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer],
        }),
      )
      .send(partialBody({ idempotencyKey: "partial-denied" }))
      .expect(403);

    const response = await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          userId: "manager-1",
          role: "manager",
          profile: "manager_marketer",
          permissions: MANAGER_PARTIAL_PERMISSIONS,
        }),
      )
      .send(partialBody())
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        jobId: "JOB-1",
        exportMode: "partial_export",
        syncPolicy: "sync_if_stale",
        responseRedaction: expect.objectContaining({
          isRedacted: true,
          manifestOnly: true,
        }),
      }),
    );
    expect(exportJobs.createOfficialPartialExportInternal).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "partial_export" }),
    );
  });

  it("reuses the same idempotent job without a second lifecycle call", async () => {
    const headers = authHeaders({ permissions: DIRECTOR_PERMISSIONS });

    const first = await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(headers)
      .send(officialBody())
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(headers)
      .send(officialBody())
      .expect(201);

    expect(first.body.jobId).toBe(second.body.jobId);
    expect(exportJobs.createOfficialPartialExportInternal).toHaveBeenCalledTimes(1);
    expect(exportJobs.appendEndpointAudit).toHaveBeenCalledWith(
      first.body.jobId,
      expect.objectContaining({ event: "idempotent_request_reused" }),
    );
  });

  it("creates cached exports through cached lifecycle only", async () => {
    const response = await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          userId: "manager-1",
          role: "manager",
          profile: "manager_marketer",
          permissions: MANAGER_PARTIAL_PERMISSIONS,
        }),
      )
      .send(cachedBody())
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        exportMode: "cached_export",
        syncPolicy: "export_cached",
      }),
    );
    expect(exportJobs.createCachedExport).toHaveBeenCalledTimes(1);
    expect(exportJobs.createOfficialPartialExportInternal).not.toHaveBeenCalled();
  });

  it("delegates official/partial to the internal lifecycle and has no provider call in controller", async () => {
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .send(officialBody({ idempotencyKey: "official-delegate" }))
      .expect(201);

    expect(exportJobs.createOfficialPartialExportInternal).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "official_export",
        sourceScope: expect.objectContaining({ sourceKeys: ["google_ads"] }),
      }),
    );
    const controllerSource = readFileSync(
      join(__dirname, "export-job-endpoint.controller.ts"),
      "utf8",
    );
    expect(controllerSource).not.toMatch(/GoogleAds|Provider|OpenAI|validateOnly/i);
  });

  it("returns generic not found for unrelated status reads", async () => {
    const job = makeJob({
      jobId: "JOB-OWNER",
      requestedByUserId: "owner-1",
      redactionProfile: "manager_marketer",
      sectionAccessProfile: "manager_marketer",
    });
    jobs.set(job.jobId, job);

    await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-OWNER/status")
      .set(
        authHeaders({
          userId: "other-1",
          role: "employee",
          profile: "manager_marketer",
          permissions: [
            AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
            AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer,
          ],
        }),
      )
      .expect(404);
  });

  it("makes unknown job and non-readable job status responses indistinguishable and audits both", async () => {
    const job = makeJob({
      jobId: "JOB-HIDDEN",
      requestedByUserId: "owner-hidden",
      redactionProfile: "manager_marketer",
      sectionAccessProfile: "manager_marketer",
    });
    jobs.set(job.jobId, job);
    const headers = authHeaders({
      userId: "other-hidden",
      role: "employee",
      profile: "manager_marketer",
      permissions: [
        AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
        AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer,
      ],
    });

    const forbidden = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-HIDDEN/status")
      .set(headers)
      .expect(404);
    const unknown = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-UNKNOWN/status")
      .set(headers)
      .expect(404);

    expect(forbidden.body).toEqual(unknown.body);
    expect(JSON.stringify(forbidden.body)).not.toContain("JOB-HIDDEN");
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: "export_status_denied" }),
    );
    expect(JSON.stringify(auditModel.create.mock.calls)).not.toMatch(
      /rawProviderResponse|secret|Bearer|stack/i,
    );
  });

  it("redacts status responses by profile and never exposes storage fields", async () => {
    const job = makeJob({
      jobId: "JOB-MANAGER",
      requestedByUserId: "manager-1",
      redactionProfile: "manager_marketer",
      sectionAccessProfile: "manager_marketer",
      artifacts: [
        {
          artifactId: "artifact-1",
          packType: "marketer_data_pack",
          format: "json",
          fileName: "marketer_data_pack.json",
          storageKey: "JOB-MANAGER/marketer_data_pack.json",
          artifactChecksum: "artifact-checksum",
          dataContentChecksum: "data-checksum",
          fileSizeBytes: 100,
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          cachedExport: true,
        },
      ],
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-MANAGER/status")
      .set(
        authHeaders({
          userId: "manager-1",
          profile: "manager_marketer",
          permissions: [
            AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
            AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer,
          ],
        }),
      )
      .expect(200);

    expect(response.body.responseRedaction).toEqual(
      expect.objectContaining({
        isRedacted: true,
        redactionProfile: "manager_marketer",
        manifestOnly: true,
      }),
    );
    expect(response.body.omittedSections).toEqual(
      expect.arrayContaining(["artifact_storage_paths", "row_level_data"]),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|storageLocation|artifactStoragePath|downloadToken|artifactBytes|publicUrl|JOB-MANAGER\/marketer_data_pack/i,
    );
  });

  it("streams an existing rendered redacted artifact with integrity headers only", async () => {
    const storageKey = "JOB-DOWNLOAD/director_data_pack.json";
    const stored = writeStoredArtifact(
      artifactRoot,
      storageKey,
      JSON.stringify({
        export_job_id: "JOB-DOWNLOAD",
        redaction_profile: "director_full",
        rows: [{ order_id: "redacted-order" }],
      }),
    );
    const job = makeJob({
      jobId: "JOB-DOWNLOAD",
      exportMode: "cached_export",
      syncPolicy: "export_cached",
      cachedExport: true,
      artifacts: [
        {
          artifactId: "artifact-rendered",
          packType: "director_data_pack",
          format: "json",
          fileName: "director_data_pack.json",
          storageKey,
          artifactChecksum: stored.artifactChecksum,
          dataContentChecksum: "data-checksum",
          fileSizeBytes: stored.fileSizeBytes,
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          cachedExport: true,
        },
      ],
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-DOWNLOAD/artifacts/artifact-rendered/download")
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(200);

    expect(response.headers["content-disposition"]).toContain(
      "ai-data-pack-JOB-DOWNLOAD-director_data_pack-json-director_full.json",
    );
    expect(response.headers["content-length"]).toBe(
      String(stored.fileSizeBytes),
    );
    expect(response.headers["x-ai-data-pack-checksum"]).toBe(
      stored.artifactChecksum,
    );
    expect(response.headers["x-ai-data-pack-manifest-only"]).toBe("false");
    expect(response.body).toEqual(
      expect.objectContaining({ export_job_id: "JOB-DOWNLOAD" }),
    );
    expect(JSON.stringify(response.headers)).not.toMatch(
      /storageKey|storageLocation|artifactStoragePath|downloadToken|publicUrl|ai-data-pack\/JOB-DOWNLOAD/i,
    );
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: "artifact_download_started" }),
    );
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: "artifact_download_completed" }),
    );
    expect(observability.listForTest()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metricName: "ai_data_pack_artifact_download_completed_total",
          endpointName: "download",
        }),
      ]),
    );
  });

  it("streams a newly rendered official redacted artifact", async () => {
    const storageKey = "JOB-OFFICIAL-RENDERED/director_data_pack.json";
    const stored = writeStoredArtifact(
      artifactRoot,
      storageKey,
      JSON.stringify({
        metadata: {
          export_job_id: "JOB-OFFICIAL-RENDERED",
          export_mode: "official_export",
          redaction_runtime: "pre_rendered",
          artifact_rendering: "rendered",
          download_ready: true,
        },
        sections: { report: { data: [{ value: 1 }] } },
      }),
    );
    const job = makeJob({
      jobId: "JOB-OFFICIAL-RENDERED",
      exportMode: "official_export",
      syncPolicy: "sync_required",
      redactionRuntime: "pre_rendered",
      artifactRendering: "rendered",
      manifest: {
        ...manifest("JOB-OFFICIAL-RENDERED", "official_export"),
        redactionRuntime: "pre_rendered",
        artifactRendering: "rendered",
        artifactClass: "downloadable_redacted_artifact",
        downloadReady: true,
        downloadableArtifactIds: ["official-rendered-artifact"],
      },
      artifacts: [
        {
          artifactId: "official-rendered-artifact",
          packType: "director_data_pack",
          format: "json",
          fileName: "director_data_pack.json",
          storageKey,
          artifactChecksum: stored.artifactChecksum,
          dataContentChecksum: "data-checksum",
          fileSizeBytes: stored.fileSizeBytes,
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          cachedExport: false,
          exportMode: "official_export",
          redactionProfile: "director_full",
          sectionAccessProfile: "director_full",
          artifactClass: "downloadable_redacted_artifact",
          redactionRuntime: "pre_rendered",
          artifactRendering: "rendered",
          downloadReady: true,
          checksumAlgorithm: "sha256",
        },
      ],
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get(
        "/ai-data-pack/exports/JOB-OFFICIAL-RENDERED/artifacts/official-rendered-artifact/download",
      )
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(200);

    expect(response.headers["x-ai-data-pack-checksum"]).toBe(
      stored.artifactChecksum,
    );
    expect(response.headers["x-ai-data-pack-manifest-only"]).toBe("false");
    expect(response.body.metadata).toEqual(
      expect.objectContaining({
        export_job_id: "JOB-OFFICIAL-RENDERED",
        artifact_rendering: "rendered",
        download_ready: true,
      }),
    );
    expect(JSON.stringify(response.headers)).not.toMatch(
      /storageKey|storageLocation|artifactStoragePath|publicUrl|downloadToken/i,
    );
  });

  it("returns 409 for official manifest-only deferred artifacts", async () => {
    const job = makeJob({
      jobId: "JOB-DEFERRED",
      exportMode: "official_export",
      syncPolicy: "sync_required",
      manifest: manifest("JOB-DEFERRED", "official_export"),
      redactionRuntime: "manifest_only",
      artifactRendering: "deferred",
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-DEFERRED/artifacts/artifact-1/download")
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(409);

    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|storageLocation|artifactStoragePath|downloadToken|publicUrl|manifest-placeholder/i,
    );
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "artifact_download_denied",
        reason: "artifact_not_ready",
      }),
    );
  });

  it("denies manager official artifact download even when the job is owned", async () => {
    const job = makeJob({
      jobId: "JOB-MANAGER-OFFICIAL",
      requestedByUserId: "manager-1",
      exportMode: "official_export",
      syncPolicy: "sync_required",
      redactionProfile: "manager_marketer",
      sectionAccessProfile: "manager_marketer",
      artifacts: [
        {
          artifactId: "official-marketer-artifact",
          packType: "marketer_data_pack",
          format: "json",
          fileName: "marketer_data_pack.json",
          storageKey: "JOB-MANAGER-OFFICIAL/marketer_data_pack.json",
          artifactChecksum: "not-read-before-policy",
          dataContentChecksum: "data-checksum",
          fileSizeBytes: 10,
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          cachedExport: false,
        },
      ],
    });
    jobs.set(job.jobId, job);

    await request(app.getHttpServer())
      .get(
        "/ai-data-pack/exports/JOB-MANAGER-OFFICIAL/artifacts/official-marketer-artifact/download",
      )
      .set(
        authHeaders({
          userId: "manager-1",
          role: "manager",
          profile: "manager_marketer",
          permissions: MANAGER_PARTIAL_PERMISSIONS,
        }),
      )
      .expect(403);
  });

  it.each([
    ["system_internal_worker", 403],
    ["unassigned_reviewer", 404],
  ])("denies %s profile for artifact download", async (profile, statusCode) => {
    const job = makeJob({
      jobId: `JOB-DOWNLOAD-DENIED-${profile}`,
      artifacts: [
        {
          artifactId: "artifact-denied",
          packType: "director_data_pack",
          format: "json",
          fileName: "director_data_pack.json",
          storageKey: `JOB-DOWNLOAD-DENIED-${profile}/director_data_pack.json`,
          artifactChecksum: "not-read-before-policy",
          dataContentChecksum: "data-checksum",
          fileSizeBytes: 10,
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          cachedExport: true,
        },
      ],
    });
    jobs.set(job.jobId, job);

    await request(app.getHttpServer())
      .get(`/ai-data-pack/exports/${job.jobId}/artifacts/artifact-denied/download`)
      .set(
        authHeaders({
          profile,
          permissions: [
            ...DIRECTOR_PERMISSIONS,
            profile === "system_internal_worker"
              ? AI_DATA_PACK_PROFILE_PERMISSION.system_internal_worker
              : "",
          ].filter(Boolean),
        }),
      )
      .expect(statusCode as number);
  });

  it("rejects forbidden download query fields before reading the artifact", async () => {
    await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-QUERY/artifacts/artifact-query/download")
      .query({ includeRaw: "true", downloadToken: "secret" })
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(400);

    expect(exportJobs.findExportJobById).not.toHaveBeenCalledWith("JOB-QUERY");
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: "invalid_request_rejected" }),
    );
  });

  it("returns 409 when artifact checksum metadata does not match storage", async () => {
    const storageKey = "JOB-CHECKSUM/director_data_pack.json";
    const stored = writeStoredArtifact(
      artifactRoot,
      storageKey,
      JSON.stringify({ ok: true }),
    );
    const job = makeJob({
      jobId: "JOB-CHECKSUM",
      exportMode: "cached_export",
      syncPolicy: "export_cached",
      cachedExport: true,
      artifacts: [
        {
          artifactId: "artifact-checksum",
          packType: "director_data_pack",
          format: "json",
          fileName: "director_data_pack.json",
          storageKey,
          artifactChecksum: "0".repeat(64),
          dataContentChecksum: "data-checksum",
          fileSizeBytes: stored.fileSizeBytes,
          createdAt: new Date("2026-06-12T00:00:00.000Z"),
          cachedExport: true,
        },
      ],
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-CHECKSUM/artifacts/artifact-checksum/download")
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(409);

    expect(JSON.stringify(response.body)).not.toMatch(
      /storageKey|storageLocation|artifactStoragePath|downloadToken|publicUrl|JOB-CHECKSUM\/director_data_pack/i,
    );
    expect(auditModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ event: "artifact_download_failed" }),
    );
  });

  it("keeps investor role status-only across public export endpoints", async () => {
    const job = makeJob({
      jobId: "JOB-INVESTOR",
      requestedByUserId: "investor-1",
      redactionProfile: "investor_redacted",
      sectionAccessProfile: "investor_redacted",
      packTypes: ["marketer_data_pack"],
    });
    jobs.set(job.jobId, job);
    const investorHeaders = authHeaders({
      userId: "investor-1",
      role: "investor",
      profile: "investor_redacted",
      permissions: [],
    });

    const status = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-INVESTOR/status")
      .set(investorHeaders)
      .expect(200);
    expect(status.body.responseRedaction).toEqual(
      expect.objectContaining({
        isRedacted: true,
        redactionProfile: "investor_redacted",
        manifestOnly: true,
      }),
    );

    await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-INVESTOR")
      .set(investorHeaders)
      .expect(403);
    await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-INVESTOR/sync-summary")
      .set(investorHeaders)
      .expect(403);
  });

  it.each([
    "manager_marketer",
    "investor_redacted",
    "external_consultant_redacted",
    "reviewer_partial",
    "unassigned_reviewer",
  ])("denies sync summary to default-denied profile %s", async (profile) => {
    const job = makeJob({
      jobId: `JOB-${profile}`,
      requestedByUserId: "profile-owner",
      redactionProfile: "director_full",
      sectionAccessProfile: "director_full",
      manifest: manifest(`JOB-${profile}`),
      sourceSyncPreparation: sourceSyncPreparation(),
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get(`/ai-data-pack/exports/${job.jobId}/sync-summary`)
      .set(
        authHeaders({
          userId: "profile-owner",
          profile,
          permissions: [
            AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION,
            profile in AI_DATA_PACK_PROFILE_PERMISSION
              ? AI_DATA_PACK_PROFILE_PERMISSION[
                  profile as keyof typeof AI_DATA_PACK_PROFILE_PERMISSION
                ]
              : "",
          ].filter(Boolean),
        }),
      )
      .expect(403);
    expect(JSON.stringify(response.body)).not.toMatch(/google_ads|sourceKey/i);
  });

  it("denies detail without leaking audit existence", async () => {
    const job = makeJob({
      jobId: "JOB-AUDIT-HIDDEN",
      requestedByUserId: "owner-audit",
      redactionProfile: "director_full",
      sectionAccessProfile: "director_full",
      auditEvents: [{ event: "secret_audit", reason: "internal-only" }],
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-AUDIT-HIDDEN")
      .set(
        authHeaders({
          userId: "stranger-audit",
          role: "employee",
          profile: "manager_marketer",
          permissions: [
            AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
            AI_DATA_PACK_PROFILE_PERMISSION.manager_marketer,
          ],
        }),
      )
      .expect(404);

    expect(JSON.stringify(response.body)).not.toMatch(
      /sanitizedAuditSummary|secret_audit|internal-only/i,
    );
  });

  it("returns sanitized sync summary only for permitted profile", async () => {
    const job = makeJob({
      jobId: "JOB-SYNC",
      requestedByUserId: "director-1",
      redactionProfile: "director_full",
      sectionAccessProfile: "director_full",
      manifest: manifest("JOB-SYNC"),
      sourceSyncPreparation: sourceSyncPreparation(),
      providerSyncAttempted: true,
    });
    jobs.set(job.jobId, job);

    const response = await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-SYNC/sync-summary")
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(200);

    expect(response.body.sourceSyncSummary[0]).toEqual(
      expect.objectContaining({
        sourceKey: "google_ads",
        freshnessStatus: "fresh",
        coverageStatus: "covered",
        sourceImpactStatus: "fresh_covered",
        adapterAttempted: true,
        providerSyncAttempted: true,
        sanitizedErrorCategories: expect.arrayContaining(["oauth_error"]),
      }),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /rawProviderResponse|requestedCustomerCount|selectedCustomerCount|"token"|secret|authorization/i,
    );
  });

  it("rejects forbidden public create fields before lifecycle delegation", async () => {
    for (const [key, value] of Object.entries({
      providerCredentials: { clientSecret: "secret" },
      gaql: "select campaign.id",
      actionPlan: { mutate: true },
      approvalPayload: {},
      dryRun: true,
      liveExecution: true,
      openaiUpload: {},
      downloadNow: true,
      publicUrl: "https://example.test/export.zip",
      artifactStoragePath: "ai-data-pack/JOB/export.zip",
      roleOverride: "director",
      redactionOverride: "director_full",
      downloadToken: "secret",
      artifactBytes: "abc",
    })) {
      await request(app.getHttpServer())
        .post("/ai-data-pack/exports")
        .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
        .send(officialBody({ [key]: value, idempotencyKey: `bad-${key}` }))
        .expect(400);
    }

    expect(exportJobs.createCachedExport).not.toHaveBeenCalled();
    expect(exportJobs.createOfficialPartialExportInternal).not.toHaveBeenCalled();
  });

  it("does not expose tokens, artifact bytes, public URLs, or storage paths in create/status/detail", async () => {
    const createResponse = await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .send(officialBody({ idempotencyKey: "safe-response" }))
      .expect(201);

    const statusResponse = await request(app.getHttpServer())
      .get(`/ai-data-pack/exports/${createResponse.body.jobId}/status`)
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(200);

    const detailResponse = await request(app.getHttpServer())
      .get(`/ai-data-pack/exports/${createResponse.body.jobId}`)
      .set(authHeaders({ permissions: DIRECTOR_PERMISSIONS }))
      .expect(200);

    for (const body of [
      createResponse.body,
      statusResponse.body,
      detailResponse.body,
    ]) {
      expect(body.responseRedaction).toEqual(
        expect.objectContaining({ isRedacted: true, manifestOnly: true }),
      );
      expect(body.allowedNextActions || []).not.toEqual(
        expect.arrayContaining([
          "download",
          "upload_to_openai",
          "import_action",
          "dry_run",
          "execute_live",
        ]),
      );
      expect(JSON.stringify(body)).not.toMatch(
        /downloadToken|artifactBytes|publicUrl|storageKey|storageLocation|artifactStoragePath|ai-data-pack\/JOB|https?:\/\//i,
      );
    }
  });

  it("defines only the direct artifact download route and leaves legacy GET exports unchanged", () => {
    const endpointControllerSource = readFileSync(
      join(__dirname, "export-job-endpoint.controller.ts"),
      "utf8",
    );
    const legacyControllerSource = readFileSync(
      join(__dirname, "..", "ai-data-pack.controller.ts"),
      "utf8",
    );
    expect(endpointControllerSource).toContain(
      ':jobId/artifacts/:artifactId/download',
    );
    expect(endpointControllerSource).not.toMatch(/download-token|downloadToken/i);
    expect(endpointControllerSource).not.toMatch(/download-token|downloadNow/i);
    expect(endpointControllerSource).not.toMatch(/@Post\([^)]*download/i);
    expect(legacyControllerSource).not.toContain("ExportJobEndpointController");
    expect(legacyControllerSource).not.toContain("AiDataPackExportJobService");
    expect(legacyControllerSource).not.toContain("createCachedExport");
  });

  it("does not import provider mutation, validateOnly, OpenAI upload, or action import dependencies", () => {
    const sources = [
      readFileSync(join(__dirname, "export-job-endpoint.controller.ts"), "utf8"),
      readFileSync(join(__dirname, "export-job-endpoint.service.ts"), "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(
      /GoogleAds.*Mutat|ProviderValidationService|OpenAIConfigService|ActionImport|ExecutionService|upload_to_openai|import_action|execute_live|provider mutation route/i,
    );
  });

  it("denies system internal worker profile from public human endpoints even with explicit permissions", async () => {
    const allPermissions = [
      ...DIRECTOR_PERMISSIONS,
      AI_DATA_PACK_PROFILE_PERMISSION.system_internal_worker,
    ];
    await request(app.getHttpServer())
      .post("/ai-data-pack/exports")
      .set(
        authHeaders({
          profile: "system_internal_worker",
          permissions: allPermissions,
        }),
      )
      .send(
        officialBody({
          redactionProfile: "system_internal_worker",
          sectionAccessProfile: "system_internal_worker",
          idempotencyKey: "system-denied-create",
        }),
      )
      .expect(403);

    const job = makeJob({
      jobId: "JOB-SYSTEM-DENIED",
      requestedByUserId: "director-1",
      redactionProfile: "director_full",
      sectionAccessProfile: "director_full",
    });
    jobs.set(job.jobId, job);
    await request(app.getHttpServer())
      .get("/ai-data-pack/exports/JOB-SYSTEM-DENIED/status")
      .set(
        authHeaders({
          profile: "system_internal_worker",
          permissions: allPermissions,
        }),
      )
      .expect(403);
  });
});

describe("ExportEndpointAuditService persistence", () => {
  it("persists jobless denied audit with sanitized fields only when a sink exists", async () => {
    const model = { create: jest.fn().mockResolvedValue({}) };
    const service = new ExportEndpointAuditService(model as any);

    await service.recordPersistent({
      event: "export_create_denied",
      actorId: "actor-1",
      reason:
        "Authorization=Bearer secret https://provider.test/raw director@example.com",
      details: {
        permissionChecked: AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
        providerCredentials: { clientSecret: "secret" },
        rawProviderResponse: { token: "secret" },
        stack: "stack trace",
      },
    });

    expect(service.persistentAuditConfigured()).toBe(true);
    const audit = model.create.mock.calls[0][0];
    expect(audit).toEqual(
      expect.objectContaining({
        event: "export_create_denied",
        actorId: "actor-1",
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      }),
    );
    expect(JSON.stringify(audit)).not.toMatch(
      /Bearer secret|provider\.test|director@example\.com|clientSecret|rawProviderResponse|stack trace/i,
    );
  });
});

describe("ExportEndpointRateLimitService hardening", () => {
  it("keeps official create limit stricter than cached/partial", async () => {
    const service = new ExportEndpointRateLimitService(undefined, {
      get: (key: string) =>
        key === "AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PER_ACTOR"
          ? 2
          : undefined,
    } as any);
    const official = {
      actorId: "director-rate",
      mode: "official_export" as const,
      dateFrom: "2026-06-01",
      dateTo: "2026-06-01",
      packTypes: ["director_data_pack"] as any,
      formats: ["json"] as any,
    };
    await service.assertCreateAllowed(official);
    await service.assertCreateAllowed(official);
    await expect(service.assertCreateAllowed(official)).rejects.toThrow(
      "rate limit",
    );
  });

  it("limits status polling per actor/job and sync-summary more strictly", async () => {
    const service = new ExportEndpointRateLimitService(undefined, {
      get: (key: string) => {
        if (key === "AI_DATA_PACK_EXPORT_STATUS_POLL_PER_ACTOR_JOB") return 3;
        if (key === "AI_DATA_PACK_EXPORT_SYNC_SUMMARY_PER_ACTOR_JOB") return 1;
        return undefined;
      },
    } as any);

    await service.assertStatusPollAllowed("actor-1", "JOB-1");
    await service.assertStatusPollAllowed("actor-1", "JOB-1");
    await service.assertSyncSummaryAllowed("actor-1", "JOB-1");
    await expect(
      service.assertSyncSummaryAllowed("actor-1", "JOB-1"),
    ).rejects.toThrow("rate limit");
  });

  it("throttles repeated denial and enforces date/pack/format bounds", async () => {
    const service = new ExportEndpointRateLimitService(undefined, {
      get: (key: string) =>
        key === "AI_DATA_PACK_EXPORT_DENIAL_PER_ACTOR" ? 1 : undefined,
    } as any);

    await service.assertDenialAllowed("actor-denial");
    await expect(service.assertDenialAllowed("actor-denial")).rejects.toThrow(
      "rate limit",
    );
    await expect(
      service.assertCreateAllowed({
        actorId: "actor-bounds",
        mode: "cached_export",
        dateFrom: "2026-01-01",
        dateTo: "2026-02-15",
        packTypes: ["director_data_pack"] as any,
        formats: ["json"] as any,
      }),
    ).rejects.toThrow("Date range");
    await expect(
      service.assertCreateAllowed({
        actorId: "actor-formats",
        mode: "cached_export",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-01",
        packTypes: ["director_data_pack"] as any,
        formats: ["json", "xlsx", "csv"] as any,
      }),
    ).rejects.toThrow("Too many formats");
  });

  it("throttles idempotency replay by actor and key", async () => {
    const service = new ExportEndpointRateLimitService(undefined, {
      get: (key: string) =>
        key === "AI_DATA_PACK_EXPORT_IDEMPOTENCY_REPLAY_PER_ACTOR_KEY"
          ? 1
          : undefined,
    } as any);

    await service.assertIdempotencyReplayAllowed("actor-idem", "idem-key");
    await expect(
      service.assertIdempotencyReplayAllowed("actor-idem", "idem-key"),
    ).rejects.toThrow("rate limit");
  });

  it("throttles artifact downloads per actor/job/artifact and enforces max file size", async () => {
    const service = new ExportEndpointRateLimitService(undefined, {
      get: (key: string) => {
        if (key === "AI_DATA_PACK_EXPORT_DOWNLOAD_PER_ACTOR") return 1;
        if (key === "AI_DATA_PACK_EXPORT_MAX_DOWNLOAD_FILE_SIZE_BYTES") return 8;
        return undefined;
      },
    } as any);

    await service.assertDownloadAllowed({
      actorId: "actor-download",
      jobId: "JOB-DOWNLOAD",
      artifactId: "artifact-download",
    });
    await expect(
      service.assertDownloadAllowed({
        actorId: "actor-download",
        jobId: "JOB-DOWNLOAD",
        artifactId: "artifact-download",
      }),
    ).rejects.toThrow("rate limit");
    expect(() => service.assertDownloadFileSizeAllowed(9)).toThrow(
      "download limit",
    );
  });

  it("uses CacheManager buckets when a shared cache is configured", async () => {
    const store = new Map<string, unknown>();
    const cache = {
      get: jest.fn(async (key: string) => store.get(key)),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
    };
    const service = new ExportEndpointRateLimitService(cache as any, {
      get: (key: string) =>
        key === "AI_DATA_PACK_EXPORT_STATUS_POLL_PER_ACTOR_JOB" ? 1 : undefined,
    } as any);

    await service.assertStatusPollAllowed("actor-cache", "JOB-CACHE");
    await expect(
      service.assertStatusPollAllowed("actor-cache", "JOB-CACHE"),
    ).rejects.toThrow("rate limit");
    expect(cache.get).toHaveBeenCalled();
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining("ai-data-pack:export-rate-limit:status"),
      expect.objectContaining({ count: 2 }),
      60_000,
    );
  });
});

function authHeaders(input: {
  userId?: string;
  role?: string;
  profile?: string;
  sectionProfile?: string;
  permissions: string[];
}): Record<string, string> {
  return {
    "x-test-user-id": input.userId || "director-1",
    "x-test-role": input.role || "director",
    "x-test-profile": input.profile || "director_full",
    "x-test-section-profile":
      input.sectionProfile || input.profile || "director_full",
    "x-test-permissions": input.permissions.join(","),
  };
}

function writeStoredArtifact(
  artifactRoot: string,
  storageKey: string,
  content: string | Buffer,
): { artifactChecksum: string; fileSizeBytes: number } {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const filePath = join(artifactRoot, ...storageKey.split(/[\\/]/));
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, buffer);
  return {
    artifactChecksum: createHash("sha256").update(buffer).digest("hex"),
    fileSizeBytes: buffer.length,
  };
}

function makeJob(overrides: Record<string, any> = {}) {
  return {
    jobId: "JOB-1",
    exportMode: "official_export",
    syncPolicy: "sync_required",
    cachedExport: false,
    providerSyncAttempted: false,
    freshnessGateEvaluated: true,
    liveExecution: false,
    status: "completed",
    reportDate: "2026-06-12",
    packTypes: ["director_data_pack"],
    formats: ["json"],
    requestedByUserId: "director-1",
    requestedByRole: "director",
    requestedByDisplay: "Director",
    requestedAt: new Date("2026-06-12T00:00:00.000Z"),
    createdAt: new Date("2026-06-12T00:00:00.000Z"),
    updatedAt: new Date("2026-06-12T00:00:00.000Z"),
    completedAt: new Date("2026-06-12T00:00:00.000Z"),
    policyVersion: OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
    idempotencyKey: "idempotency",
    artifacts: [],
    redactionProfile: "director_full",
    sectionAccessProfile: "director_full",
    sourceSyncPreparation: sourceSyncPreparation(),
    decisionGates: sourceSyncPreparation().decisionGates,
    manifest: undefined,
    warnings: [],
    blockingReasons: [],
    auditEvents: [],
    ...overrides,
  };
}
