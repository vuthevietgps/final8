import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReadStream } from "fs";
import { JsonExporterService } from "../export/json-exporter.service";
import { ExportEndpointRequestContext } from "../audit/export-endpoint-request-context";
import {
  ExportEndpointAuditEventName,
  ExportEndpointAuditService,
} from "../audit/export-endpoint-audit.service";
import { ExportEndpointObservabilityService } from "../observability/export-endpoint-observability.service";
import {
  ExportEndpointPolicyDecision,
  ExportEndpointPolicyService,
} from "../rbac/export-endpoint-policy.service";
import { ExportRedactionProfileService } from "../redaction/export-redaction-profile.service";
import { AiDataPackExportJob } from "./export-job.schema";
import { AiDataPackExportJobService } from "./export-job.service";
import {
  AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_FORMATS,
  AI_DATA_PACK_EXPORT_MODES,
  AiDataPackExportFormat,
  AiDataPackExportMode,
  AiDataPackExportRequester,
  AiDataPackRedactionProfile,
  CACHED_EXPORT_MODE,
  CACHED_EXPORT_PACK_TYPES,
  CACHED_EXPORT_POLICY_VERSION,
  CachedExportPackType,
  ExportJobArtifactRecord,
  OFFICIAL_EXPORT_MODE,
  OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION,
  OfficialPartialExportMode,
  PARTIAL_EXPORT_MODE,
} from "./export-job.types";
import { ExportEndpointRateLimitService } from "./export-endpoint-rate-limit.service";
import { ExportJobArtifactService } from "./export-job-artifact.service";
import { ExportJobResponseRedactorService } from "./export-job-response-redactor.service";

interface NormalizedPublicCreateRequest {
  exportMode: AiDataPackExportMode;
  reportDate: string;
  dateFrom: string;
  dateTo: string;
  packTypes: CachedExportPackType[];
  formats: AiDataPackExportFormat[];
  redactionProfile: AiDataPackRedactionProfile;
  sectionAccessProfile: string;
  sourceScope: {
    sourceKeys?: string[];
    googleAdsCustomerIds?: string[];
  };
  googleAdsCustomerIds: string[];
  allowDowngradeToPartial: boolean;
  idempotencyKey: string;
  policyVersion: string;
  publicIdempotencyKey: string;
}

export interface AiDataPackArtifactDownloadResponse {
  stream: ReadStream;
  jobId: string;
  artifactId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  checksum: string;
  redactionProfile: string;
  release: () => void;
  complete: () => Promise<void>;
  fail: (reason: unknown) => Promise<void>;
}

const ALLOWED_PUBLIC_CREATE_KEYS = new Set([
  "exportMode",
  "reportDate",
  "dateFrom",
  "dateTo",
  "packTypes",
  "formats",
  "redactionProfile",
  "sectionAccessProfile",
  "sourceScope",
  "googleAdsCustomerIds",
  "allowDowngradeToPartial",
  "idempotencyKey",
  "policyVersion",
]);

const ALLOWED_SOURCE_SCOPE_KEYS = new Set([
  "sourceKeys",
  "googleAdsCustomerIds",
]);

const FORBIDDEN_PUBLIC_CREATE_KEYS = new Set([
  "accesstoken",
  "actionplan",
  "approvalpayload",
  "artifactbytes",
  "artifactstoragepath",
  "authorization",
  "clientsecret",
  "credentials",
  "developertoken",
  "downloadnow",
  "downloadtoken",
  "dryrun",
  "gaql",
  "liveexecution",
  "openaiupload",
  "openaiuploadpayload",
  "providercredentials",
  "providermutation",
  "providerquery",
  "providerheaders",
  "publicurl",
  "rawproviderquery",
  "rawproviderrequest",
  "rawproviderresponse",
  "redactionoverride",
  "refreshtoken",
  "roleoverride",
  "storagelocation",
  "validateonly",
]);

const FORBIDDEN_PUBLIC_DOWNLOAD_KEYS = new Set([
  ...FORBIDDEN_PUBLIC_CREATE_KEYS,
  "artifact",
  "artifactid",
  "checksumoverride",
  "contentoverride",
  "directdownload",
  "download",
  "downloadurl",
  "file",
  "includeinternal",
  "includemanifest",
  "includeraw",
  "internal",
  "manifest",
  "manifestonly",
  "path",
  "raw",
  "rawartifact",
  "rawbytes",
  "redactionprofile",
  "streamraw",
]);

const ARTIFACT_CONTENT_TYPE: Record<AiDataPackExportFormat, string> = {
  json: "application/json; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const DOWNLOADABLE_EXPORT_STATUSES = new Set(["completed", "completed_with_warnings"]);

@Injectable()
export class ExportJobEndpointService {
  private readonly idempotencyJobIds = new Map<string, string>();

  constructor(
    private readonly jobs: AiDataPackExportJobService,
    private readonly policy: ExportEndpointPolicyService,
    private readonly redactionProfiles: ExportRedactionProfileService,
    private readonly rateLimit: ExportEndpointRateLimitService,
    private readonly audit: ExportEndpointAuditService,
    private readonly observability: ExportEndpointObservabilityService,
    private readonly responses: ExportJobResponseRedactorService,
    private readonly artifacts: ExportJobArtifactService,
    private readonly json: JsonExporterService,
  ) {}

  async createExport(
    body: Record<string, unknown>,
    requester: AiDataPackExportRequester,
    requestContext?: ExportEndpointRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorId = this.requireActorId(requester);
    let normalized: NormalizedPublicCreateRequest;
    try {
      normalized = this.normalizeCreateRequest(body, actorId);
    } catch (error) {
      await this.recordEndpointAudit({
        event: "invalid_request_rejected",
        actorId,
        reason: error instanceof Error ? error.message : "invalid_request",
        details: { endpointName: "create" },
        requestContext,
      });
      await this.recordEndpointAudit({
        event: "export_create_denied",
        actorId,
        reason: "invalid_request_rejected",
        details: { endpointName: "create" },
        requestContext,
      });
      await this.enforceRateLimit(
        () => this.rateLimit.assertDenialAllowed(actorId),
        {
          actorId,
          reason: "invalid_request_denial_rate_limit",
          details: { endpointName: "create" },
          requestContext,
        },
      );
      throw error;
    }

    await this.recordEndpointAudit({
      event: "export_create_requested",
      actorId,
      details: {
        endpointName: "create",
        exportMode: normalized.exportMode,
        redactionProfile: normalized.redactionProfile,
        packTypes: normalized.packTypes,
        formats: normalized.formats,
      },
      requestContext,
    });
    await this.enforceRateLimit(
      () =>
        this.rateLimit.assertIdempotencyReplayAllowed(
          actorId,
          normalized.publicIdempotencyKey,
        ),
      {
        actorId,
        reason: "idempotency_replay_rate_limit",
        details: {
          endpointName: "create",
          exportMode: normalized.exportMode,
          redactionProfile: normalized.redactionProfile,
        },
        requestContext,
      },
    );
    await this.enforceRateLimit(
      () =>
        this.rateLimit.assertCreateAllowed({
          actorId,
          mode: normalized.exportMode,
          dateFrom: normalized.dateFrom,
          dateTo: normalized.dateTo,
          packTypes: normalized.packTypes,
          formats: normalized.formats,
        }),
      {
        actorId,
        reason: "create_rate_limit",
        details: {
          endpointName: "create",
          exportMode: normalized.exportMode,
          redactionProfile: normalized.redactionProfile,
        },
        requestContext,
      },
    );

    const policyDecision = this.policy.evaluateCreate({
      mode: normalized.exportMode,
      requester,
      redactionProfile: normalized.redactionProfile,
      sectionAccessProfile: normalized.sectionAccessProfile,
      packTypes: normalized.packTypes,
    });
    if (!policyDecision.allowed) {
      await this.recordDenied(
        "export_create_denied",
        policyDecision,
        actorId,
        undefined,
        {
          endpointName: "create",
          exportMode: normalized.exportMode,
          redactionProfile: normalized.redactionProfile,
        },
        requestContext,
      );
    }

    const existingJobId = this.idempotencyJobIds.get(
      normalized.publicIdempotencyKey,
    );
    if (existingJobId) {
      const existing = await this.jobs.findExportJobById(existingJobId);
      if (existing) {
        await this.appendJobAudit(existing, {
          event: "idempotent_request_reused",
          actorId,
          reason: "duplicate_public_idempotency_key",
          details: {
            endpointName: "create",
            exportMode: existing.exportMode,
            redactionProfile: existing.redactionProfile,
          },
        }, requestContext);
        return this.responses.toCreateSummary(
          existing,
          this.policy.profile(requester),
        );
      }
      this.idempotencyJobIds.delete(normalized.publicIdempotencyKey);
    }

    let releaseOfficialLock = () => undefined;
    if (normalized.exportMode === OFFICIAL_EXPORT_MODE) {
      try {
        releaseOfficialLock = this.rateLimit.markOfficialInProgress(actorId);
      } catch (error) {
        await this.recordRateLimitIfNeeded(error, {
          actorId,
          reason: "official_concurrency_rate_limit",
          details: {
            endpointName: "create",
            exportMode: normalized.exportMode,
            redactionProfile: normalized.redactionProfile,
          },
          requestContext,
        });
        throw error;
      }
    }
    try {
      const job =
        normalized.exportMode === CACHED_EXPORT_MODE
          ? await this.jobs.createCachedExport({
              reportDate: normalized.reportDate,
              packTypes: normalized.packTypes,
              formats: normalized.formats,
              requestedBy: requester,
              policyVersion: normalized.policyVersion,
              idempotencyKey: normalized.publicIdempotencyKey,
              redactionProfile: normalized.redactionProfile,
              sectionAccessProfile: normalized.sectionAccessProfile,
            } as any)
          : await this.jobs.createOfficialPartialExportInternal({
              mode: normalized.exportMode as OfficialPartialExportMode,
              reportDate: normalized.reportDate,
              dateFrom: normalized.dateFrom,
              dateTo: normalized.dateTo,
              packTypes: normalized.packTypes,
              formats: normalized.formats,
              requester: this.requesterForLifecycle(requester, actorId),
              requestedBy: requester,
              redactionProfile: normalized.redactionProfile,
              sectionAccessProfile: normalized.sectionAccessProfile,
              policyVersion: normalized.policyVersion,
              idempotencyKey: normalized.publicIdempotencyKey,
              sourceScope: normalized.sourceScope,
              googleAdsCustomerIds: normalized.googleAdsCustomerIds,
              allowDowngradeToPartial: normalized.allowDowngradeToPartial,
            });

      this.idempotencyJobIds.set(normalized.publicIdempotencyKey, job.jobId);
      await this.appendJobAudit(job, {
        event: "export_create_accepted",
        actorId,
        details: {
          endpointName: "create",
          exportMode: job.exportMode,
          redactionProfile: job.redactionProfile,
          status: job.status,
        },
      }, requestContext);
      await this.appendJobAudit(job, {
        event: "redaction_profile_applied",
        actorId,
        details: {
          endpointName: "create",
          redactionProfile: normalized.redactionProfile,
          sectionAccessProfile: normalized.sectionAccessProfile,
        },
      }, requestContext);
      return this.responses.toCreateSummary(job, this.policy.profile(requester));
    } finally {
      releaseOfficialLock();
    }
  }

  async getStatus(
    jobId: string,
    requester: AiDataPackExportRequester,
    requestContext?: ExportEndpointRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorId = this.requireActorId(requester);
    await this.enforceRateLimit(
      () => this.rateLimit.assertStatusPollAllowed(actorId, jobId),
      {
        actorId,
        jobId,
        reason: "status_poll_rate_limit",
        details: { endpointName: "status" },
        requestContext,
      },
    );
    const job = await this.loadJobOrDeny(
      jobId,
      actorId,
      "export_status_denied",
      requestContext,
      "status",
    );
    const decision = this.policy.evaluateStatusRead({ job, requester });
    if (!decision.allowed) {
      await this.recordDenied(
        "export_status_denied",
        decision,
        actorId,
        job,
        { endpointName: "status" },
        requestContext,
      );
    }
    await this.appendJobAudit(
      job,
      {
        event: "export_status_viewed",
        actorId,
        details: {
          endpointName: "status",
          exportMode: job.exportMode,
          redactionProfile: job.redactionProfile,
        },
      },
      requestContext,
    );
    return this.responses.toStatus(job, this.policy.profile(requester));
  }

  async getDetail(
    jobId: string,
    requester: AiDataPackExportRequester,
    requestContext?: ExportEndpointRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorId = this.requireActorId(requester);
    const includeAuditSummary = this.policy.hasPermission(
      requester,
      AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION,
    );
    const job = await this.loadJobOrDeny(
      jobId,
      actorId,
      "export_detail_denied",
      requestContext,
      "detail",
    );
    const decision = this.policy.evaluateDetailRead({
      job,
      requester,
      includeAuditSummary,
    });
    if (!decision.allowed) {
      await this.recordDenied(
        "export_detail_denied",
        decision,
        actorId,
        job,
        { endpointName: "detail" },
        requestContext,
      );
    }
    await this.appendJobAudit(
      job,
      {
        event: "export_detail_viewed",
        actorId,
        details: {
          endpointName: "detail",
          exportMode: job.exportMode,
          redactionProfile: job.redactionProfile,
        },
      },
      requestContext,
    );
    return this.responses.toDetail({
      job,
      profile: this.policy.profile(requester),
      includeAuditSummary,
    });
  }

  async getSyncSummary(
    jobId: string,
    requester: AiDataPackExportRequester,
    requestContext?: ExportEndpointRequestContext,
  ): Promise<Record<string, unknown>> {
    const actorId = this.requireActorId(requester);
    await this.enforceRateLimit(
      () => this.rateLimit.assertSyncSummaryAllowed(actorId, jobId),
      {
        actorId,
        jobId,
        reason: "sync_summary_rate_limit",
        details: { endpointName: "sync-summary" },
        requestContext,
      },
    );
    const job = await this.loadJobOrDeny(
      jobId,
      actorId,
      "sync_summary_denied",
      requestContext,
      "sync-summary",
    );
    const decision = this.policy.evaluateSyncSummaryRead({ job, requester });
    if (!decision.allowed) {
      await this.recordDenied(
        "sync_summary_denied",
        decision,
        actorId,
        job,
        { endpointName: "sync-summary" },
        requestContext,
      );
    }
    await this.appendJobAudit(
      job,
      {
        event: "sync_summary_viewed",
        actorId,
        details: {
          endpointName: "sync-summary",
          exportMode: job.exportMode,
          redactionProfile: job.redactionProfile,
        },
      },
      requestContext,
    );
    return this.responses.toSyncSummary(job, this.policy.profile(requester));
  }

  async downloadArtifact(
    jobId: string,
    artifactId: string,
    requester: AiDataPackExportRequester,
    query: Record<string, unknown> = {},
    requestContext?: ExportEndpointRequestContext,
  ): Promise<AiDataPackArtifactDownloadResponse> {
    const actorId = this.requireActorId(requester);
    try {
      this.assertNoForbiddenDownloadInput(query);
    } catch (error) {
      await this.recordEndpointAudit({
        event: "invalid_request_rejected",
        actorId,
        jobId,
        reason: error instanceof Error ? error.message : "invalid_request",
        details: { endpointName: "download", artifactId },
        requestContext,
      });
      await this.recordEndpointAudit({
        event: "artifact_download_denied",
        actorId,
        jobId,
        reason: "invalid_request_rejected",
        details: { endpointName: "download", artifactId },
        requestContext,
      });
      await this.enforceRateLimit(
        () => this.rateLimit.assertDenialAllowed(actorId),
        {
          actorId,
          jobId,
          reason: "invalid_request_denial_rate_limit",
          details: { endpointName: "download", artifactId },
          requestContext,
        },
      );
      throw error;
    }

    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(artifactId)) {
      await this.recordEndpointAudit({
        event: "artifact_download_denied",
        actorId,
        jobId,
        reason: "invalid_artifact_id",
        details: { endpointName: "download" },
        requestContext,
      });
      throw new NotFoundException("Export artifact not found.");
    }

    await this.recordEndpointAudit({
      event: "artifact_download_requested",
      actorId,
      jobId,
      details: { endpointName: "download", artifactId },
      requestContext,
    });
    await this.enforceRateLimit(
      () =>
        this.rateLimit.assertDownloadAllowed({
          actorId,
          jobId,
          artifactId,
        }),
      {
        actorId,
        jobId,
        reason: "download_rate_limit",
        details: { endpointName: "download", artifactId },
        requestContext,
      },
    );

    const job = await this.loadJobOrDeny(
      jobId,
      actorId,
      "artifact_download_denied",
      requestContext,
      "download",
    );
    const artifact = this.findArtifact(job, artifactId);
    if (!artifact) {
      if (this.isManifestArtifact(job, artifactId)) {
        await this.recordArtifactDownloadIssue({
          job,
          actorId,
          event: "artifact_download_denied",
          reason: "artifact_not_ready",
          artifactId,
          requestContext,
        });
        throw new ConflictException(
          "AI data pack artifact is not ready for download.",
        );
      }
      await this.recordArtifactDownloadIssue({
        job,
        actorId,
        event: "artifact_download_denied",
        reason: "artifact_not_found",
        artifactId,
        requestContext,
      });
      throw new NotFoundException("Export artifact not found.");
    }

    if (!DOWNLOADABLE_EXPORT_STATUSES.has(job.status)) {
      await this.recordArtifactDownloadIssue({
        job,
        artifact,
        actorId,
        event: "artifact_download_denied",
        reason: "export_job_not_ready",
        requestContext,
      });
      throw new ConflictException(
        "AI data pack artifact is not ready for download.",
      );
    }
    if (this.isOfficialOrPartialDeferred(job)) {
      await this.recordArtifactDownloadIssue({
        job,
        artifact,
        actorId,
        event: "artifact_download_denied",
        reason: "artifact_rendering_or_redaction_runtime_not_ready",
        requestContext,
      });
      throw new ConflictException(
        "AI data pack artifact is not ready for download.",
      );
    }
    if (this.isArtifactNotDownloadReady(artifact)) {
      await this.recordArtifactDownloadIssue({
        job,
        artifact,
        actorId,
        event: "artifact_download_denied",
        reason: "artifact_not_downloadable_redacted_ready",
        requestContext,
      });
      throw new ConflictException(
        "AI data pack artifact is not ready for download.",
      );
    }
    if (!ARTIFACT_CONTENT_TYPE[artifact.format]) {
      await this.recordArtifactDownloadIssue({
        job,
        artifact,
        actorId,
        event: "artifact_download_denied",
        reason: "artifact_format_not_downloadable",
        requestContext,
      });
      throw new ConflictException(
        "AI data pack artifact is not ready for download.",
      );
    }
    try {
      this.rateLimit.assertDownloadFileSizeAllowed(artifact.fileSizeBytes);
    } catch (error) {
      await this.recordArtifactDownloadIssue({
        job,
        artifact,
        actorId,
        event: "artifact_download_denied",
        reason: "artifact_file_size_exceeds_download_limit",
        requestContext,
      });
      throw error;
    }

    const decision = this.policy.evaluateArtifactDownload({
      job,
      artifact,
      requester,
    });
    if (!decision.allowed) {
      await this.recordDenied(
        "artifact_download_denied",
        decision,
        actorId,
        job,
        this.downloadAuditDetails(job, artifact),
        requestContext,
      );
    }

    let release = () => undefined;
    try {
      release = this.rateLimit.markDownloadInProgress(actorId);
    } catch (error) {
      await this.recordRateLimitIfNeeded(error, {
        actorId,
        jobId,
        reason: "download_concurrency_rate_limit",
        details: this.downloadAuditDetails(job, artifact),
        requestContext,
      });
      throw error;
    }

    try {
      const verified = await this.artifacts.verifyReadableArtifact({
        storageKey: artifact.storageKey,
        expectedChecksum: artifact.artifactChecksum,
        expectedSizeBytes: artifact.fileSizeBytes,
      });
      await this.appendJobAudit(
        job,
        {
          event: "artifact_download_started",
          actorId,
          details: this.downloadAuditDetails(job, artifact),
        },
        requestContext,
      );

      return {
        stream: verified.stream,
        jobId: job.jobId,
        artifactId: artifact.artifactId,
        fileName: this.downloadFileName(job, artifact),
        contentType: ARTIFACT_CONTENT_TYPE[artifact.format],
        fileSizeBytes: verified.fileSizeBytes,
        checksum: verified.checksum,
        redactionProfile: job.redactionProfile || "unknown",
        release,
        complete: () =>
          this.appendJobAudit(
            job,
            {
              event: "artifact_download_completed",
              actorId,
              details: this.downloadAuditDetails(job, artifact, {
                fileSizeBytes: verified.fileSizeBytes,
              }),
            },
            requestContext,
          ),
        fail: (reason: unknown) =>
          this.appendJobAudit(
            job,
            {
              event: "artifact_download_failed",
              actorId,
              reason:
                reason instanceof Error
                  ? reason.message
                  : "download_stream_failed",
              details: this.downloadAuditDetails(job, artifact),
            },
            requestContext,
          ),
      };
    } catch (error) {
      release();
      await this.recordArtifactDownloadIssue({
        job,
        artifact,
        actorId,
        event: "artifact_download_failed",
        reason: "artifact_integrity_or_storage_failure",
        requestContext,
      });
      throw new ConflictException(
        "AI data pack artifact is not ready for download.",
      );
    }
  }

  private normalizeCreateRequest(
    body: Record<string, unknown>,
    actorId: string,
  ): NormalizedPublicCreateRequest {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("Request body must be an object.");
    }
    this.assertNoForbiddenPublicInput(body);
    for (const key of Object.keys(body)) {
      if (!ALLOWED_PUBLIC_CREATE_KEYS.has(key)) {
        throw new BadRequestException(`${key} is not an accepted export input.`);
      }
    }
    const sourceScope =
      body.sourceScope && typeof body.sourceScope === "object"
        ? (body.sourceScope as Record<string, unknown>)
        : {};
    for (const key of Object.keys(sourceScope)) {
      if (!ALLOWED_SOURCE_SCOPE_KEYS.has(key)) {
        throw new BadRequestException(
          `sourceScope.${key} is not an accepted export input.`,
        );
      }
    }

    const exportMode = String(body.exportMode || "").trim();
    if (!AI_DATA_PACK_EXPORT_MODES.includes(exportMode as AiDataPackExportMode)) {
      throw new BadRequestException(
        "exportMode must be cached_export, official_export, or partial_export.",
      );
    }
    const reportDate = this.isoDate(body.reportDate, "reportDate");
    const dateFrom = this.isoDate(body.dateFrom || reportDate, "dateFrom");
    const dateTo = this.isoDate(body.dateTo || reportDate, "dateTo");
    if (new Date(`${dateFrom}T00:00:00Z`) > new Date(`${dateTo}T00:00:00Z`)) {
      throw new BadRequestException("dateFrom must not be after dateTo.");
    }

    const packTypes = this.safeList(body.packTypes).sort();
    if (
      !packTypes.length ||
      packTypes.some((value) => !CACHED_EXPORT_PACK_TYPES.includes(value as any))
    ) {
      throw new BadRequestException("packTypes must contain supported exports.");
    }
    const formats = this.safeList(body.formats).sort();
    if (
      !formats.length ||
      formats.some((value) => !AI_DATA_PACK_EXPORT_FORMATS.includes(value as any))
    ) {
      throw new BadRequestException("formats must contain json or xlsx.");
    }

    const redactionProfile = String(body.redactionProfile || "").trim();
    if (!this.redactionProfiles.isSupported(redactionProfile)) {
      throw new BadRequestException("redactionProfile is required and invalid.");
    }
    const sectionAccessProfile = String(body.sectionAccessProfile || "").trim();
    if (!/^[a-z0-9._:-]{1,64}$/i.test(sectionAccessProfile)) {
      throw new BadRequestException("sectionAccessProfile is required.");
    }
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(idempotencyKey)) {
      throw new BadRequestException("idempotencyKey is required and invalid.");
    }
    const policyVersion = String(body.policyVersion || "").trim();
    const expectedPolicyVersion =
      exportMode === CACHED_EXPORT_MODE
        ? CACHED_EXPORT_POLICY_VERSION
        : OFFICIAL_PARTIAL_EXPORT_POLICY_VERSION;
    if (policyVersion !== expectedPolicyVersion) {
      throw new BadRequestException("policyVersion is not recognized.");
    }

    const sourceKeys = this.safeList(sourceScope.sourceKeys).sort();
    const scopedCustomerIds = this.safeList(
      sourceScope.googleAdsCustomerIds,
    ).sort();
    const topLevelCustomerIds = this.safeList(body.googleAdsCustomerIds).sort();
    const googleAdsCustomerIds = [
      ...new Set([...scopedCustomerIds, ...topLevelCustomerIds]),
    ].sort();
    if (googleAdsCustomerIds.length && !sourceKeys.includes("google_ads")) {
      throw new BadRequestException(
        "googleAdsCustomerIds require sourceScope.sourceKeys to include google_ads.",
      );
    }

    const normalized = {
      exportMode: exportMode as AiDataPackExportMode,
      reportDate,
      dateFrom,
      dateTo,
      packTypes: packTypes as CachedExportPackType[],
      formats: formats as AiDataPackExportFormat[],
      redactionProfile: redactionProfile as AiDataPackRedactionProfile,
      sectionAccessProfile,
      sourceScope: {
        ...(sourceKeys.length ? { sourceKeys } : {}),
        ...(scopedCustomerIds.length
          ? { googleAdsCustomerIds: scopedCustomerIds }
          : {}),
      },
      googleAdsCustomerIds,
      allowDowngradeToPartial: body.allowDowngradeToPartial === true,
      idempotencyKey,
      policyVersion,
    };

    return {
      ...normalized,
      publicIdempotencyKey: this.json.checksum({
        requester: actorId,
        exportMode: normalized.exportMode,
        reportDate: normalized.reportDate,
        dateFrom: normalized.dateFrom,
        dateTo: normalized.dateTo,
        packTypes: normalized.packTypes,
        formats: normalized.formats,
        redactionProfile: normalized.redactionProfile,
        sectionAccessProfile: normalized.sectionAccessProfile,
        sourceScope: normalized.sourceScope,
        policyVersion: normalized.policyVersion,
        idempotencyKey: normalized.idempotencyKey,
      }),
    };
  }

  private assertNoForbiddenPublicInput(value: unknown, path = "input"): void {
    if (!value || typeof value !== "object" || value instanceof Date) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.assertNoForbiddenPublicInput(item, `${path}[${index}]`),
      );
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_PUBLIC_CREATE_KEYS.has(this.normalizeKey(key))) {
        throw new BadRequestException(`${path}.${key} is not accepted.`);
      }
      this.assertNoForbiddenPublicInput(child, `${path}.${key}`);
    }
  }

  private assertNoForbiddenDownloadInput(
    query: Record<string, unknown> = {},
  ): void {
    if (!query || typeof query !== "object" || Array.isArray(query)) {
      throw new BadRequestException("Download query must be an object.");
    }
    for (const key of Object.keys(query)) {
      const normalized = this.normalizeKey(key);
      if (FORBIDDEN_PUBLIC_DOWNLOAD_KEYS.has(normalized)) {
        throw new BadRequestException(`query.${key} is not accepted.`);
      }
      throw new BadRequestException(
        `query.${key} is not an accepted download input.`,
      );
    }
  }

  private findArtifact(
    job: AiDataPackExportJob,
    artifactId: string,
  ): ExportJobArtifactRecord | undefined {
    return (job.artifacts || []).find(
      (artifact) => artifact.artifactId === artifactId,
    ) as ExportJobArtifactRecord | undefined;
  }

  private isManifestArtifact(
    job: AiDataPackExportJob,
    artifactId: string,
  ): boolean {
    return Boolean(job.manifest?.artifactId === artifactId);
  }

  private isOfficialOrPartialDeferred(job: AiDataPackExportJob): boolean {
    if (
      job.exportMode !== OFFICIAL_EXPORT_MODE &&
      job.exportMode !== PARTIAL_EXPORT_MODE
    ) {
      return false;
    }
    const redactionRuntime =
      job.redactionRuntime || job.manifest?.redactionRuntime || "";
    const artifactRendering =
      job.artifactRendering || job.manifest?.artifactRendering || "";
    return redactionRuntime === "manifest_only" || artifactRendering === "deferred";
  }

  private isArtifactNotDownloadReady(artifact: ExportJobArtifactRecord): boolean {
    if (artifact.artifactClass && artifact.artifactClass !== "downloadable_redacted_artifact") {
      return true;
    }
    if (artifact.downloadReady === false) return true;
    if (artifact.redactionRuntime === "manifest_only") return true;
    if (
      artifact.artifactRendering &&
      artifact.artifactRendering !== "rendered"
    ) {
      return true;
    }
    return false;
  }

  private async recordArtifactDownloadIssue(input: {
    job: AiDataPackExportJob;
    artifact?: ExportJobArtifactRecord;
    actorId: string;
    event: ExportEndpointAuditEventName;
    reason: string;
    artifactId?: string;
    requestContext?: ExportEndpointRequestContext;
  }): Promise<void> {
    const details = this.downloadAuditDetails(input.job, input.artifact, {
      artifactId: input.artifact?.artifactId || input.artifactId,
    });
    if (input.event === "artifact_download_denied") {
      await this.enforceRateLimit(
        () => this.rateLimit.assertDenialAllowed(input.actorId),
        {
          actorId: input.actorId,
          jobId: input.job.jobId,
          reason: "download_denial_rate_limit",
          details,
          requestContext: input.requestContext,
        },
      );
    }
    await this.appendJobAudit(
      input.job,
      {
        event: input.event,
        actorId: input.actorId,
        reason: input.reason,
        details,
      },
      input.requestContext,
    );
  }

  private downloadAuditDetails(
    job: AiDataPackExportJob,
    artifact?: ExportJobArtifactRecord,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      endpointName: "download",
      exportMode: job.exportMode,
      redactionProfile: job.redactionProfile || "unknown",
      artifactId: artifact?.artifactId,
      packType: artifact?.packType,
      format: artifact?.format,
      ...extra,
    };
  }

  private downloadFileName(
    job: AiDataPackExportJob,
    artifact: ExportJobArtifactRecord,
  ): string {
    const jobId = this.safeDownloadFilePart(job.jobId, "job").slice(0, 16);
    const packType = this.safeDownloadFilePart(artifact.packType, "pack");
    const redactionProfile = this.safeDownloadFilePart(
      job.redactionProfile || "redacted",
      "redacted",
    );
    return `ai-data-pack-${jobId}-${packType}-${artifact.format}-${redactionProfile}.${artifact.format}`;
  }

  private safeDownloadFilePart(value: unknown, fallback: string): string {
    const text = String(value || "")
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    return text ? text.slice(0, 64) : fallback;
  }

  private requesterForLifecycle(
    requester: AiDataPackExportRequester,
    actorId: string,
  ): AiDataPackExportRequester {
    return {
      ...requester,
      id: actorId,
      permissions: this.policy.permissions(requester),
    };
  }

  private async loadJobOrDeny(
    jobId: string,
    actorId: string,
    event: ExportEndpointAuditEventName,
    requestContext?: ExportEndpointRequestContext,
    endpointName = "unknown",
  ): Promise<AiDataPackExportJob> {
    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(jobId)) {
      await this.recordEndpointAudit({
        event,
        actorId,
        jobId,
        reason: "invalid_job_id",
        details: { endpointName },
        requestContext,
      });
      throw new NotFoundException("Export job not found.");
    }
    const job = await this.jobs.findExportJobById(jobId);
    if (!job) {
      await this.recordEndpointAudit({
        event,
        actorId,
        jobId,
        reason: "job_not_found",
        details: { endpointName },
        requestContext,
      });
      throw new NotFoundException("Export job not found.");
    }
    return job;
  }

  private async recordDenied(
    event: ExportEndpointAuditEventName,
    decision: ExportEndpointPolicyDecision,
    actorId: string,
    job?: AiDataPackExportJob,
    details?: Record<string, unknown>,
    requestContext?: ExportEndpointRequestContext,
  ): Promise<never> {
    await this.enforceRateLimit(
      () => this.rateLimit.assertDenialAllowed(actorId),
      {
        actorId,
        jobId: job?.jobId,
        reason: "denial_rate_limit",
        details,
        requestContext,
      },
    );
    await this.recordEndpointAudit({
      event,
      actorId,
      jobId: job?.jobId,
      status: job?.status,
      reason: decision.reason,
      details: {
        requiredPermissions: decision.requiredPermissions,
        ...details,
      },
      requestContext,
    });
    await this.recordEndpointAudit({
      event: "rbac_denied",
      actorId,
      jobId: job?.jobId,
      status: job?.status,
      reason: decision.reason,
      details,
      requestContext,
    });
    if (job) {
      await this.appendJobAudit(job, {
        event,
        actorId,
        reason: decision.reason,
        details,
      }, requestContext);
    }
    if (decision.statusCode === 404) {
      throw new NotFoundException("Export job not found.");
    }
    throw new ForbiddenException("AI data pack export access denied.");
  }

  private async appendJobAudit(
    job: AiDataPackExportJob,
    input: {
      event: ExportEndpointAuditEventName;
      actorId: string;
      reason?: unknown;
      details?: Record<string, unknown>;
    },
    requestContext?: ExportEndpointRequestContext,
  ): Promise<void> {
    const event = this.audit.toJobAuditEvent({
      ...input,
      jobId: job.jobId,
      status: job.status,
      requestContext,
    });
    await this.recordEndpointAudit({
      ...input,
      jobId: job.jobId,
      status: job.status,
      requestContext,
    });
    await this.jobs.appendEndpointAudit(job.jobId, event);
  }

  private async recordEndpointAudit(input: {
    event: ExportEndpointAuditEventName;
    actorId?: string | null;
    jobId?: string | null;
    status?: any;
    reason?: unknown;
    details?: Record<string, unknown>;
    requestContext?: ExportEndpointRequestContext;
  }): Promise<void> {
    await this.audit.recordPersistent(input);
    this.observability.record({
      event: input.event,
      endpointName: input.details?.endpointName,
      exportMode: input.details?.exportMode,
      status: input.status,
      redactionProfile: input.details?.redactionProfile,
      reason: input.reason,
    });
  }

  private async enforceRateLimit(
    operation: () => Promise<void>,
    auditInput: {
      actorId: string;
      jobId?: string;
      reason: string;
      details?: Record<string, unknown>;
      requestContext?: ExportEndpointRequestContext;
    },
  ): Promise<void> {
    try {
      await operation();
    } catch (error) {
      await this.recordRateLimitIfNeeded(error, auditInput);
      throw error;
    }
  }

  private async recordRateLimitIfNeeded(
    error: unknown,
    auditInput: {
      actorId: string;
      jobId?: string;
      reason: string;
      details?: Record<string, unknown>;
      requestContext?: ExportEndpointRequestContext;
    },
  ): Promise<void> {
    if (
      error instanceof HttpException &&
      error.getStatus() === HttpStatus.TOO_MANY_REQUESTS
    ) {
      await this.recordEndpointAudit({
        event: "rate_limited",
        actorId: auditInput.actorId,
        jobId: auditInput.jobId,
        reason: auditInput.reason,
        details: auditInput.details,
        requestContext: auditInput.requestContext,
      });
    }
  }

  private requireActorId(requester: AiDataPackExportRequester): string {
    const actorId = this.policy.actorId(requester);
    if (!actorId) throw new ForbiddenException("AI data pack actor is invalid.");
    return actorId;
  }

  private safeList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value
          .map((item) => String(item || "").trim())
          .filter((item) => /^[a-zA-Z0-9._:-]{1,128}$/.test(item)),
      ),
    ];
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD.`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new BadRequestException(`${field} is invalid.`);
    }
    return text;
  }

  private normalizeKey(value: string): string {
    return value.replace(/[_-]/g, "").toLowerCase();
  }
}
