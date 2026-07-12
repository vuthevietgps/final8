import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Model } from "mongoose";
import { DataPackMetadataService } from "../data-pack-metadata.service";
import { DataQualityReportService } from "../data-quality-report.service";
import { DirectorDataPackService } from "../director-data-pack.service";
import { JsonExporterService } from "../export/json-exporter.service";
import { XlsxExporterService } from "../export/xlsx-exporter.service";
import { MappingReportService } from "../mapping-report.service";
import { MarketerDataPackService } from "../marketer-data-pack.service";
import { ExportRbacPolicyService } from "../rbac/export-rbac-policy.service";
import {
  ExportRedactionProfileResolution,
  ExportRedactionProfileService,
} from "../redaction/export-redaction-profile.service";
import { SourceSyncOrchestratorService } from "../source-sync/source-sync-orchestrator.service";
import {
  SourceSyncPreparationInput,
  SourceSyncPreparationResult,
} from "../source-sync/source-sync-result.types";
import { ExportJobArtifactService } from "./export-job-artifact.service";
import { sanitizeExportJobError } from "./export-job-error.util";
import {
  AiDataPackExportJob,
  AiDataPackExportJobDocument,
} from "./export-job.schema";
import {
  AI_DATA_PACK_EXPORT_FORMATS,
  AiDataPackExportAuditEvent,
  AiDataPackExportFormat,
  AiDataPackExportJobStatus,
  AiDataPackExportRequester,
  AiDataPackExportSyncPolicy,
  AiDataPackRedactionProfile,
  CACHED_EXPORT_MODE,
  CACHED_EXPORT_PACK_TYPES,
  CACHED_EXPORT_POLICY_VERSION,
  CACHED_EXPORT_SYNC_POLICY,
  CachedExportMetadata,
  CachedExportPackType,
  CreateCachedExportJobRequest,
  CreateOfficialPartialExportInternalRequest,
  ExportJobArtifactRecord,
  InternalExportArtifactManifest,
  OFFICIAL_EXPORT_MODE,
  OFFICIAL_EXPORT_SYNC_POLICY,
  OfficialPartialExportMode,
  PARTIAL_EXPORT_MODE,
  PARTIAL_EXPORT_SYNC_POLICY,
} from "./export-job.types";

interface NormalizedOfficialPartialExportRequest {
  mode: OfficialPartialExportMode;
  syncPolicy: AiDataPackExportSyncPolicy;
  reportDate: string;
  dateFrom: string;
  dateTo: string;
  packTypes: CachedExportPackType[];
  formats: AiDataPackExportFormat[];
  requester?: AiDataPackExportRequester | string;
  requestedBy?: unknown;
  redactionProfile?: AiDataPackRedactionProfile;
  sectionAccessProfile?: string;
  policyVersion: string;
  suppliedIdempotencyKey: string;
  idempotencyKey: string;
  sourceKeys?: string[];
  googleAdsCustomerIds: string[];
  allowDowngradeToPartial: boolean;
}

const OFFICIAL_PARTIAL_TRANSITIONS: Record<
  AiDataPackExportJobStatus,
  readonly AiDataPackExportJobStatus[]
> = {
  pending: ["exporting", "failed"],
  requested: ["pre_assessing", "blocked", "failed", "expired"],
  pre_assessing: ["syncing_sources", "blocked", "failed", "expired"],
  syncing_sources: ["post_assessing", "blocked", "failed", "expired"],
  post_assessing: ["snapshotting", "blocked", "failed", "expired"],
  snapshotting: ["exporting", "blocked", "failed", "expired"],
  exporting: ["completed", "completed_with_warnings", "failed", "expired"],
  completed: [],
  completed_with_warnings: [],
  blocked: [],
  failed: [],
  expired: [],
};

const FORBIDDEN_INTERNAL_EXPORT_INPUT_KEYS = new Set([
  "access_token",
  "accessToken",
  "actionPlan",
  "approval",
  "approvalPayload",
  "authorization",
  "client_secret",
  "clientSecret",
  "credential",
  "credentials",
  "developer_token",
  "developerToken",
  "dryRun",
  "gaql",
  "live",
  "liveExecution",
  "openaiPayload",
  "openAIUpload",
  "openaiUpload",
  "providerCredentials",
  "providerMutation",
  "providerQuery",
  "rawProviderQuery",
  "refresh_token",
  "refreshToken",
  "uploadPayload",
  "validateOnly",
]);

const OFFICIAL_PARTIAL_RENDERED_JSON_FORMATS = new Set<AiDataPackExportFormat>([
  "json",
]);

@Injectable()
export class AiDataPackExportJobService {
  constructor(
    @InjectModel(AiDataPackExportJob.name)
    private readonly jobModel: Model<AiDataPackExportJobDocument>,
    private readonly director: DirectorDataPackService,
    private readonly marketer: MarketerDataPackService,
    private readonly quality: DataQualityReportService,
    private readonly mapping: MappingReportService,
    private readonly metadata: DataPackMetadataService,
    private readonly json: JsonExporterService,
    private readonly xlsx: XlsxExporterService,
    private readonly artifacts: ExportJobArtifactService,
    private readonly rbac: ExportRbacPolicyService,
    private readonly redactionProfiles: ExportRedactionProfileService,
    @Optional()
    private readonly sourceSyncOrchestrator?: SourceSyncOrchestratorService,
  ) {}

  async createCachedExport(
    request: CreateCachedExportJobRequest,
  ): Promise<AiDataPackExportJob> {
    const normalized = this.normalizeRequest(request);
    const actor = this.metadata.normalizeActor(request.requestedBy);
    if (!actor.id)
      throw new BadRequestException("requestedBy must contain a safe user id.");

    const publicIdempotencyScope = this.cachedPublicIdempotencyScope(request);
    const idempotencyKey = this.json.checksum({
      reportDate: normalized.reportDate,
      packTypes: normalized.packTypes,
      formats: normalized.formats,
      exportMode: CACHED_EXPORT_MODE,
      syncPolicy: CACHED_EXPORT_SYNC_POLICY,
      policyVersion: normalized.policyVersion,
      requestedByUserId: actor.id,
      ...publicIdempotencyScope,
    });
    const existing = await this.findActive(idempotencyKey);
    if (existing) return existing;

    const requestedAt = new Date();
    const jobId = `AIDP-${requestedAt
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)}-${randomUUID().slice(0, 8)}`;
    try {
      await this.jobModel.create({
        jobId,
        exportMode: CACHED_EXPORT_MODE,
        syncPolicy: CACHED_EXPORT_SYNC_POLICY,
        cachedExport: true,
        providerSyncAttempted: false,
        freshnessGateEvaluated: false,
        liveExecution: false,
        status: "pending",
        reportDate: normalized.reportDate,
        packTypes: normalized.packTypes,
        formats: normalized.formats,
        requestedByUserId: actor.id,
        requestedByRole: actor.role || undefined,
        requestedByDisplay: actor.display || undefined,
        requestedAt,
        policyVersion: normalized.policyVersion,
        idempotencyKey,
        activeIdempotencyKey: idempotencyKey,
        artifacts: [],
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const raced = await this.findActive(idempotencyKey);
        if (raced) return raced;
        throw new ConflictException(
          "An equivalent cached export job is already active.",
        );
      }
      throw error;
    }

    await this.jobModel
      .updateOne(
        { jobId, activeIdempotencyKey: idempotencyKey },
        { $set: { status: "exporting", startedAt: new Date() } },
      )
      .exec();

    try {
      for (const packType of normalized.packTypes) {
        for (const format of normalized.formats) {
          const pack = await this.buildPack(
            packType,
            normalized.reportDate,
            format,
            actor,
          );
          this.decorateCachedMetadata(pack, jobId);
          this.json.attachChecksums(pack);
          const content = this.render(packType, format, pack);
          const artifact = await this.artifacts.writeArtifact({
            jobId,
            packType,
            format,
            content,
            dataContentChecksum: pack.metadata?.data_content_checksum,
          });
          await this.jobModel
            .updateOne({ jobId }, { $push: { artifacts: artifact } })
            .exec();
        }
      }
      await this.jobModel
        .updateOne(
          { jobId },
          {
            $set: { status: "completed", completedAt: new Date() },
            $unset: { activeIdempotencyKey: "" },
          },
        )
        .exec();
    } catch (error) {
      const sanitized = sanitizeExportJobError(error);
      await this.jobModel
        .updateOne(
          { jobId },
          {
            $set: {
              status: "failed",
              failedAt: new Date(),
              errorCategory: sanitized.category,
              sanitizedErrorMessage: sanitized.message,
            },
            $unset: { activeIdempotencyKey: "" },
          },
        )
        .exec();
    }

    const result = await this.findByJobId(jobId);
    if (!result)
      throw new ConflictException("Cached export job result is unavailable.");
    return result;
  }

  async createOfficialPartialExportInternal(
    request: CreateOfficialPartialExportInternalRequest,
  ): Promise<AiDataPackExportJob> {
    const normalized = this.normalizeOfficialPartialRequest(request);
    const actorInput = request.requester ?? request.requestedBy;
    const actor = this.metadata.normalizeActor(actorInput);
    if (!actor.id) {
      throw new BadRequestException(
        "requester/requestedBy must contain a safe user id.",
      );
    }

    const existing = await this.findActive(normalized.idempotencyKey);
    if (existing) return existing;

    const requestedAt = new Date();
    const jobId = `AIDP-${requestedAt
      .toISOString()
      .replace(/[-:.TZ]/g, "")
      .slice(0, 14)}-${randomUUID().slice(0, 8)}`;
    const initialAudit = this.auditEvent("export_requested", "requested", {
      actorId: actor.id,
      details: {
        exportMode: normalized.mode,
        syncPolicy: normalized.syncPolicy,
        redactionProfile: normalized.redactionProfile || null,
        sectionAccessProfile: normalized.sectionAccessProfile || null,
      },
    });

    try {
      await this.jobModel.create({
        jobId,
        exportMode: normalized.mode,
        syncPolicy: normalized.syncPolicy,
        cachedExport: false,
        providerSyncAttempted: false,
        freshnessGateEvaluated: false,
        liveExecution: false,
        status: "requested",
        reportDate: normalized.reportDate,
        packTypes: normalized.packTypes,
        formats: normalized.formats,
        requestedByUserId: actor.id,
        requestedByRole: actor.role || undefined,
        requestedByDisplay: actor.display || undefined,
        requestedAt,
        policyVersion: normalized.policyVersion,
        idempotencyKey: normalized.idempotencyKey,
        activeIdempotencyKey: normalized.idempotencyKey,
        artifacts: [],
        redactionProfile: normalized.redactionProfile,
        sectionAccessProfile: normalized.sectionAccessProfile,
        warnings: [],
        blockingReasons: [],
        auditEvents: [initialAudit],
      });
    } catch (error: any) {
      if (error?.code === 11000) {
        const raced = await this.findActive(normalized.idempotencyKey);
        if (raced) return raced;
        throw new ConflictException(
          "An equivalent official/partial export job is already active.",
        );
      }
      throw error;
    }

    let currentStatus: AiDataPackExportJobStatus = "requested";
    const transition = async (
      to: AiDataPackExportJobStatus,
      set: Record<string, unknown> = {},
      auditEvent?: AiDataPackExportAuditEvent,
    ) => {
      this.assertOfficialPartialTransition(currentStatus, to);
      currentStatus = to;
      await this.jobModel
        .updateOne(
          { jobId },
          {
            $set: { ...set, status: to },
            ...(auditEvent ? { $push: { auditEvents: auditEvent } } : {}),
          },
        )
        .exec();
    };

    const rbacDecision = this.rbac.evaluateCreate({
      mode: normalized.mode,
      requester: this.requesterForPolicy(request),
      redactionProfile: normalized.redactionProfile,
      sectionAccessProfile: normalized.sectionAccessProfile,
    });
    if (!rbacDecision.allowed) {
      const reason = this.sanitizeReason(rbacDecision.reason || "rbac_denied");
      await transition(
        "blocked",
        {
          errorCategory: "rbac_denied",
          sanitizedErrorMessage: reason,
          blockingReasons: [reason],
          warnings: [],
        },
        this.auditEvent("rbac_denied", "blocked", {
          actorId: actor.id,
          reason,
          details: {
            requiredPermissions: rbacDecision.requiredPermissions,
          },
        }),
      );
      await this.clearActiveIdempotency(jobId);
      const denied = await this.findByJobId(jobId);
      if (!denied)
        throw new ConflictException("Export job result is unavailable.");
      return denied;
    }

    try {
      const redaction = this.redactionProfiles.resolve(
        normalized.redactionProfile!,
      );

      await transition(
        "pre_assessing",
        { startedAt: new Date() },
        this.auditEvent("pre_assessment_started", "pre_assessing", {
          actorId: actor.id,
        }),
      );
      await transition(
        "syncing_sources",
        {},
        this.auditEvent("source_sync_started", "syncing_sources", {
          actorId: actor.id,
          details: { syncPolicy: normalized.syncPolicy },
        }),
      );

      const sourcePreparation = await this.prepareSourcesForExportJob({
        exportJobId: jobId,
        correlationId: jobId,
        policyVersion: normalized.policyVersion,
        reportDate: normalized.reportDate,
        dateFrom: normalized.dateFrom,
        dateTo: normalized.dateTo,
        packTypes: normalized.packTypes,
        sourceKeys: normalized.sourceKeys,
        customerIds: normalized.googleAdsCustomerIds,
        syncPolicy: normalized.syncPolicy,
      });
      await this.appendAudit(
        jobId,
        this.auditEvent("source_sync_completed", "syncing_sources", {
          actorId: actor.id,
          details: {
            providerSyncAttempted: sourcePreparation.providerSyncAttempted,
            warningCount: sourcePreparation.warnings.length,
            blockingReasonCount: sourcePreparation.blockingReasons.length,
          },
        }),
      );

      const sourceWarnings = this.sanitizeReasons(sourcePreparation.warnings);
      const sourceBlockingReasons = this.sanitizeReasons(
        sourcePreparation.blockingReasons,
      );
      await transition(
        "post_assessing",
        {
          sourceSyncPreparation:
            this.safeSourceSyncPreparation(sourcePreparation),
          providerSyncAttempted: sourcePreparation.providerSyncAttempted,
          freshnessGateEvaluated: true,
          decisionGates: sourcePreparation.decisionGates,
          warnings: sourceWarnings,
          blockingReasons: sourceBlockingReasons,
        },
        this.auditEvent("post_assessment_completed", "post_assessing", {
          actorId: actor.id,
          details: {
            hasBlockingReasons: sourceBlockingReasons.length > 0,
          },
        }),
      );

      if (
        normalized.mode === OFFICIAL_EXPORT_MODE &&
        sourceBlockingReasons.length &&
        !normalized.allowDowngradeToPartial
      ) {
        const reason = this.sanitizeReason(sourceBlockingReasons.join("; "));
        await transition(
          "blocked",
          {
            errorCategory: "source_assessment_blocked",
            sanitizedErrorMessage: reason,
            blockingReasons: sourceBlockingReasons,
            warnings: sourceWarnings,
          },
          this.auditEvent("export_blocked", "blocked", {
            actorId: actor.id,
            reason,
          }),
        );
        await this.clearActiveIdempotency(jobId);
        const blocked = await this.findByJobId(jobId);
        if (!blocked)
          throw new ConflictException("Export job result is unavailable.");
        return blocked;
      }

      let effectiveMode = normalized.mode;
      let downgradedFromExportMode: OfficialPartialExportMode | undefined;
      const finalWarnings = [...sourceWarnings];
      let finalBlockingReasons = sourceBlockingReasons;
      if (
        normalized.mode === OFFICIAL_EXPORT_MODE &&
        sourceBlockingReasons.length &&
        normalized.allowDowngradeToPartial
      ) {
        effectiveMode = PARTIAL_EXPORT_MODE;
        downgradedFromExportMode = OFFICIAL_EXPORT_MODE;
        finalWarnings.push(
          ...sourceBlockingReasons.map(
            (reason) => `official_export_downgraded:${reason}`,
          ),
        );
        await this.appendAudit(
          jobId,
          this.auditEvent("export_downgraded", "post_assessing", {
            actorId: actor.id,
            reason: "official_export_downgraded_to_partial",
          }),
        );
      } else if (normalized.mode === PARTIAL_EXPORT_MODE) {
        finalWarnings.push(
          ...sourceBlockingReasons.map(
            (reason) => `partial_source_limited:${reason}`,
          ),
        );
        finalBlockingReasons = [];
      }

      await transition("snapshotting", {
        warnings: [...new Set(finalWarnings)],
        blockingReasons: finalBlockingReasons,
      });

      const manifest = this.buildInternalManifest({
        jobId,
        exportMode: effectiveMode,
        syncPolicy: normalized.syncPolicy,
        policyVersion: normalized.policyVersion,
        reportDate: normalized.reportDate,
        dateFrom: normalized.dateFrom,
        dateTo: normalized.dateTo,
        packTypes: normalized.packTypes,
        formats: normalized.formats,
        redactionProfile: normalized.redactionProfile!,
        sectionAccessProfile: normalized.sectionAccessProfile!,
        sourcePreparation,
        warnings: [...new Set([...finalWarnings, ...redaction.warnings])],
        blockingReasons: finalBlockingReasons,
        redaction,
      });

      await transition("exporting", {
        exportMode: effectiveMode,
        downgradedFromExportMode,
        manifest,
        redactionRuntime: manifest.redactionRuntime,
        artifactRendering: manifest.artifactRendering,
        warnings: manifest.warnings,
        blockingReasons: manifest.blockingReasons,
      });

      const renderResult = await this.renderOfficialPartialArtifacts({
        jobId,
        exportMode: effectiveMode,
        syncPolicy: normalized.syncPolicy,
        reportDate: normalized.reportDate,
        dateFrom: normalized.dateFrom,
        dateTo: normalized.dateTo,
        packTypes: normalized.packTypes,
        formats: normalized.formats,
        actor,
        redactionProfile: normalized.redactionProfile!,
        sectionAccessProfile: normalized.sectionAccessProfile!,
        policyVersion: normalized.policyVersion,
        sourcePreparation,
        manifest,
      });
      const finalManifest = this.withRenderedArtifactManifest(
        manifest,
        renderResult.renderedArtifacts,
        renderResult.unsupportedFormats,
        renderResult.warnings,
      );
      const completedWarnings = finalManifest.warnings;
      await this.jobModel
        .updateOne(
          { jobId },
          {
            $set: {
              manifest: finalManifest,
              redactionRuntime: finalManifest.redactionRuntime,
              artifactRendering: finalManifest.artifactRendering,
              warnings: completedWarnings,
              blockingReasons: finalManifest.blockingReasons,
            },
          },
        )
        .exec();

      const terminalStatus: AiDataPackExportJobStatus = completedWarnings.length
        ? "completed_with_warnings"
        : "completed";
      await transition(terminalStatus, {
        completedAt: new Date(),
      });
      await this.clearActiveIdempotency(jobId);
    } catch (error) {
      const sanitized = sanitizeExportJobError(error);
      if (OFFICIAL_PARTIAL_TRANSITIONS[currentStatus].includes("failed")) {
        await transition("failed", {
          failedAt: new Date(),
          errorCategory: sanitized.category,
          sanitizedErrorMessage: sanitized.message,
        });
      }
      await this.clearActiveIdempotency(jobId);
    }

    const result = await this.findByJobId(jobId);
    if (!result)
      throw new ConflictException("Export job result is unavailable.");
    return result;
  }

  findExportJobById(jobId: string): Promise<AiDataPackExportJob | null> {
    return this.findByJobId(jobId);
  }

  appendEndpointAudit(
    jobId: string,
    event: AiDataPackExportAuditEvent,
  ): Promise<unknown> {
    return this.appendAudit(jobId, event);
  }

  prepareSourcesForExportJob(
    input: SourceSyncPreparationInput,
  ): Promise<SourceSyncPreparationResult> {
    if (!this.sourceSyncOrchestrator) {
      throw new ConflictException(
        "Source sync orchestrator is not configured for this module.",
      );
    }
    return this.sourceSyncOrchestrator.prepareSourcesForExportJob(input);
  }

  private async renderOfficialPartialArtifacts(input: {
    jobId: string;
    exportMode: OfficialPartialExportMode;
    syncPolicy: AiDataPackExportSyncPolicy;
    reportDate: string;
    dateFrom: string;
    dateTo: string;
    packTypes: CachedExportPackType[];
    formats: AiDataPackExportFormat[];
    actor: { id: string | null; role: string | null; display: string | null };
    redactionProfile: AiDataPackRedactionProfile;
    sectionAccessProfile: string;
    policyVersion: string;
    sourcePreparation: SourceSyncPreparationResult;
    manifest: InternalExportArtifactManifest;
  }): Promise<{
    renderedArtifacts: ExportJobArtifactRecord[];
    unsupportedFormats: AiDataPackExportFormat[];
    warnings: string[];
  }> {
    const renderedArtifacts: ExportJobArtifactRecord[] = [];
    const unsupportedFormats: AiDataPackExportFormat[] = [];
    const warnings: string[] = [];

    for (const format of input.formats) {
      if (!OFFICIAL_PARTIAL_RENDERED_JSON_FORMATS.has(format)) {
        unsupportedFormats.push(format);
        const reason = `artifact_render_skipped_not_supported:${format}`;
        warnings.push(reason);
        await this.appendAudit(
          input.jobId,
          this.auditEvent("artifact_render_skipped_not_supported", "exporting", {
            actorId: input.actor.id,
            reason,
            details: {
              exportMode: input.exportMode,
              format,
              redactionProfile: input.redactionProfile,
            },
          }),
        );
      }
    }

    for (const packType of input.packTypes) {
      const format: AiDataPackExportFormat = "json";
      if (!input.formats.includes(format)) continue;
      await this.appendAudit(
        input.jobId,
        this.auditEvent("artifact_render_requested", "exporting", {
          actorId: input.actor.id,
          details: {
            exportMode: input.exportMode,
            packType,
            format,
            redactionProfile: input.redactionProfile,
          },
        }),
      );
      await this.appendAudit(
        input.jobId,
        this.auditEvent("artifact_render_started", "exporting", {
          actorId: input.actor.id,
          details: {
            exportMode: input.exportMode,
            packType,
            format,
            redactionProfile: input.redactionProfile,
          },
        }),
      );

      try {
        const pack = await this.buildPack(
          packType,
          input.reportDate,
          format,
          input.actor,
        );
        this.decorateOfficialPartialMetadata(pack, input);
        this.json.attachChecksums(pack);
        const content = this.render(packType, format, pack);
        const artifact = await this.artifacts.writeArtifact({
          jobId: input.jobId,
          packType,
          format,
          content,
          dataContentChecksum: pack.metadata?.data_content_checksum,
          cachedExport: false,
          exportMode: input.exportMode,
          redactionProfile: input.redactionProfile,
          sectionAccessProfile: input.sectionAccessProfile,
          artifactClass: "downloadable_redacted_artifact",
          redactionRuntime: "pre_rendered",
          artifactRendering: "rendered",
          downloadReady: true,
          checksumAlgorithm: "sha256",
        });
        renderedArtifacts.push(artifact);
        await this.jobModel
          .updateOne({ jobId: input.jobId }, { $push: { artifacts: artifact } })
          .exec();
        await this.appendAudit(
          input.jobId,
          this.auditEvent("artifact_render_completed", "exporting", {
            actorId: input.actor.id,
            details: {
              artifactId: artifact.artifactId,
              exportMode: input.exportMode,
              packType,
              format,
              redactionProfile: input.redactionProfile,
              fileSizeBytes: artifact.fileSizeBytes,
              checksumAlgorithm: artifact.checksumAlgorithm,
            },
          }),
        );
        await this.appendAudit(
          input.jobId,
          this.auditEvent("artifact_generated", "exporting", {
            actorId: input.actor.id,
            details: {
              artifactId: artifact.artifactId,
              artifact_rendering: "rendered",
              artifactClass: "downloadable_redacted_artifact",
            },
          }),
        );
      } catch (error) {
        const sanitized = sanitizeExportJobError(error);
        await this.markArtifactRenderFailed(
          input.jobId,
          input.manifest,
          sanitized.message,
        );
        await this.appendAudit(
          input.jobId,
          this.auditEvent("artifact_render_failed", "exporting", {
            actorId: input.actor.id,
            reason: sanitized.message,
            details: {
              exportMode: input.exportMode,
              packType,
              format,
              redactionProfile: input.redactionProfile,
            },
          }),
        );
        throw error;
      }
    }

    return {
      renderedArtifacts,
      unsupportedFormats: [...new Set(unsupportedFormats)],
      warnings: this.sanitizeReasons(warnings),
    };
  }

  private withRenderedArtifactManifest(
    manifest: InternalExportArtifactManifest,
    renderedArtifacts: ExportJobArtifactRecord[],
    unsupportedFormats: AiDataPackExportFormat[],
    renderWarnings: string[],
  ): InternalExportArtifactManifest {
    const warnings = this.sanitizeReasons([
      ...manifest.warnings.filter(
        (warning) =>
          ![
            "artifact_rendering=deferred",
            "redaction_runtime=manifest_only",
          ].includes(warning),
      ),
      ...renderWarnings,
    ]);
    if (!renderedArtifacts.length) {
      return {
        ...manifest,
        artifactClass: "manifest_only_artifact",
        downloadReady: false,
        unsupportedFormats,
        warnings,
      };
    }

    const firstArtifact = renderedArtifacts[0];
    return {
      ...manifest,
      artifactId: firstArtifact.artifactId,
      artifactChecksum: firstArtifact.artifactChecksum,
      redactionRuntime: "pre_rendered",
      artifactRendering: "rendered",
      artifactClass: "downloadable_redacted_artifact",
      downloadReady: true,
      checksumAlgorithm: "sha256",
      fileSizeBytes: firstArtifact.fileSizeBytes,
      contentType:
        firstArtifact.format === "json"
          ? "application/json"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      downloadableArtifactIds: renderedArtifacts.map(
        (artifact) => artifact.artifactId,
      ),
      renderedArtifactCount: renderedArtifacts.length,
      unsupportedFormats,
      warnings,
      downloadPolicy: "direct_authenticated_download_only",
    };
  }

  private async markArtifactRenderFailed(
    jobId: string,
    manifest: InternalExportArtifactManifest,
    reason: string,
  ): Promise<void> {
    const failedManifest: InternalExportArtifactManifest = {
      ...manifest,
      artifactRendering: "failed",
      artifactClass: "manifest_only_artifact",
      downloadReady: false,
      warnings: this.sanitizeReasons([...manifest.warnings, reason]),
    };
    await this.jobModel
      .updateOne(
        { jobId },
        {
          $set: {
            manifest: failedManifest,
            artifactRendering: "failed",
            redactionRuntime: failedManifest.redactionRuntime,
            warnings: failedManifest.warnings,
          },
        },
      )
      .exec();
  }

  private assertOfficialPartialTransition(
    from: AiDataPackExportJobStatus,
    to: AiDataPackExportJobStatus,
  ): void {
    if (!OFFICIAL_PARTIAL_TRANSITIONS[from].includes(to)) {
      throw new ConflictException(
        `Invalid official/partial export transition ${from} -> ${to}.`,
      );
    }
  }

  private auditEvent(
    event: string,
    status: AiDataPackExportJobStatus,
    options?: {
      actorId?: string | null;
      reason?: string;
      details?: Record<string, unknown>;
    },
  ): AiDataPackExportAuditEvent {
    return {
      event,
      status,
      at: new Date(),
      actorId: options?.actorId ?? null,
      reason: options?.reason ? this.sanitizeReason(options.reason) : undefined,
      details: options?.details,
    };
  }

  private appendAudit(
    jobId: string,
    event: AiDataPackExportAuditEvent,
  ): Promise<unknown> {
    return this.jobModel
      .updateOne({ jobId }, { $push: { auditEvents: event } })
      .exec();
  }

  private clearActiveIdempotency(jobId: string): Promise<unknown> {
    return this.jobModel
      .updateOne({ jobId }, { $unset: { activeIdempotencyKey: "" } })
      .exec();
  }

  private normalizeOfficialPartialRequest(
    request: CreateOfficialPartialExportInternalRequest,
  ): NormalizedOfficialPartialExportRequest {
    this.assertNoForbiddenExportInput(request);
    const mode = request?.mode;
    if (![OFFICIAL_EXPORT_MODE, PARTIAL_EXPORT_MODE].includes(mode)) {
      throw new BadRequestException(
        "mode must be official_export or partial_export.",
      );
    }
    const reportDate = this.isoDate(request.reportDate, "reportDate");
    const dateFrom = this.isoDate(request.dateFrom || reportDate, "dateFrom");
    const dateTo = this.isoDate(request.dateTo || reportDate, "dateTo");
    if (
      new Date(`${dateFrom}T00:00:00.000Z`) >
      new Date(`${dateTo}T00:00:00.000Z`)
    ) {
      throw new BadRequestException("dateFrom must not be after dateTo.");
    }
    const packTypes = [
      ...new Set(request?.packTypes || []),
    ].sort() as CachedExportPackType[];
    const formats = [
      ...new Set(request?.formats || []),
    ].sort() as AiDataPackExportFormat[];
    if (
      !packTypes.length ||
      packTypes.some((value) => !CACHED_EXPORT_PACK_TYPES.includes(value))
    ) {
      throw new BadRequestException(
        "packTypes must contain supported data pack exports.",
      );
    }
    if (
      !formats.length ||
      formats.some((value) => !AI_DATA_PACK_EXPORT_FORMATS.includes(value))
    ) {
      throw new BadRequestException("formats must contain json or xlsx.");
    }

    const policyVersion = String(request?.policyVersion || "").trim();
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(policyVersion)) {
      throw new BadRequestException("policyVersion is required and invalid.");
    }
    const suppliedIdempotencyKey = String(request?.idempotencyKey || "").trim();
    if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(suppliedIdempotencyKey)) {
      throw new BadRequestException("idempotencyKey is required and invalid.");
    }
    const sectionAccessProfile = String(
      request?.sectionAccessProfile || "",
    ).trim();
    const redactionProfile = this.redactionProfiles.isSupported(
      request?.redactionProfile,
    )
      ? request.redactionProfile
      : undefined;
    const syncPolicy =
      mode === OFFICIAL_EXPORT_MODE
        ? OFFICIAL_EXPORT_SYNC_POLICY
        : PARTIAL_EXPORT_SYNC_POLICY;
    const sourceKeys = this.safeList(request?.sourceScope?.sourceKeys);
    const googleAdsCustomerIds = this.safeList([
      ...(request?.sourceScope?.googleAdsCustomerIds || []),
      ...(request?.googleAdsCustomerIds || []),
    ]);
    const idempotencyKey = this.json.checksum({
      suppliedIdempotencyKey,
      mode,
      syncPolicy,
      reportDate,
      dateFrom,
      dateTo,
      packTypes,
      formats,
      redactionProfile: redactionProfile || null,
      sectionAccessProfile,
      policyVersion,
    });

    return {
      mode,
      syncPolicy,
      reportDate,
      dateFrom,
      dateTo,
      packTypes,
      formats,
      requester: request.requester,
      requestedBy: request.requestedBy,
      redactionProfile,
      sectionAccessProfile,
      policyVersion,
      suppliedIdempotencyKey,
      idempotencyKey,
      sourceKeys,
      googleAdsCustomerIds,
      allowDowngradeToPartial: request.allowDowngradeToPartial === true,
    };
  }

  private buildInternalManifest(input: {
    jobId: string;
    exportMode: OfficialPartialExportMode;
    syncPolicy: AiDataPackExportSyncPolicy;
    policyVersion: string;
    reportDate: string;
    dateFrom: string;
    dateTo: string;
    packTypes: CachedExportPackType[];
    formats: AiDataPackExportFormat[];
    redactionProfile: AiDataPackRedactionProfile;
    sectionAccessProfile: string;
    sourcePreparation: SourceSyncPreparationResult;
    warnings: string[];
    blockingReasons: string[];
    redaction: ExportRedactionProfileResolution;
  }): InternalExportArtifactManifest {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const retentionUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sourceFreshnessMetadata = Object.fromEntries(
      Object.entries(input.sourcePreparation.sourceImpact || {}).map(
        ([sourceKey, impact]) => [
          sourceKey,
          {
            status: impact.status,
            freshnessStatus: impact.freshnessStatus,
            reportDate: impact.reportDate || input.reportDate,
            latestRecordDate: impact.latestRecordDate,
            lastSuccessfulSyncAt: impact.lastSuccessfulSyncAt,
            blockingReason: impact.blockingReason || null,
            blockingReasons: impact.blockingReasons || [],
          },
        ],
      ),
    );
    const sourceCoverageMetadata = Object.fromEntries(
      Object.entries(input.sourcePreparation.sourceImpact || {}).map(
        ([sourceKey, impact]) => [
          sourceKey,
          {
            coverageStatus: impact.coverageStatus,
            reportDateRecordCount: impact.reportDateRecordCount ?? null,
            canUseForDecision: impact.canUseForDecision,
            canUseForAdsAutomationDecision:
              impact.canUseForAdsAutomationDecision === true,
          },
        ],
      ),
    );
    const warnings = this.sanitizeReasons(input.warnings);
    const blockingReasons = this.sanitizeReasons(input.blockingReasons);
    const dataContentChecksum = this.json.checksum({
      exportMode: input.exportMode,
      syncPolicy: input.syncPolicy,
      policyVersion: input.policyVersion,
      reportDate: input.reportDate,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      packTypes: input.packTypes,
      formats: input.formats,
      redactionProfile: input.redactionProfile,
      sectionAccessProfile: input.sectionAccessProfile,
      sourceFreshnessMetadata,
      sourceCoverageMetadata,
      decisionGates: input.sourcePreparation.decisionGates,
      warnings,
      blockingReasons,
    });
    const runtimeExportChecksum = this.json.checksum({
      jobId: input.jobId,
      createdAt: now.toISOString(),
      dataContentChecksum,
    });
    const artifactId = this.json
      .checksum({
        jobId: input.jobId,
        dataContentChecksum,
        runtimeExportChecksum,
        artifactRendering: input.redaction.artifactRendering,
      })
      .slice(0, 32);
    const manifestWithoutArtifactChecksum = {
      artifactId,
      exportJobId: input.jobId,
      exportMode: input.exportMode,
      syncPolicy: input.syncPolicy,
      policyVersion: input.policyVersion,
      redactionProfile: input.redactionProfile,
      sectionAccessProfile: input.sectionAccessProfile,
      packTypes: input.packTypes,
      formats: input.formats,
      rowCounts: {},
      sourceFreshnessMetadata,
      sourceCoverageMetadata,
      decisionGates: {
        ...input.sourcePreparation.decisionGates,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      },
      warnings,
      blockingReasons,
      containsPii: input.redaction.containsPii,
      containsFinancialSensitive: input.redaction.containsFinancialSensitive,
      containsEmployeeSensitive: input.redaction.containsEmployeeSensitive,
      containsSupplierSensitive: input.redaction.containsSupplierSensitive,
      dataContentChecksum,
      runtimeExportChecksum,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      retentionUntil: retentionUntil.toISOString(),
      storageLocation: `ai-data-pack/${input.jobId}/official-partial/manifest-placeholder.json`,
      downloadPolicy: "internal_only_no_public_download_endpoint",
      redactionRuntime: input.redaction.redactionRuntime,
      artifactRendering: input.redaction.artifactRendering,
    };

    return {
      ...manifestWithoutArtifactChecksum,
      artifactChecksum: this.json.checksum({
        manifest: manifestWithoutArtifactChecksum,
        artifactPlaceholder: "deferred",
      }),
    };
  }

  private safeSourceSyncPreparation(
    result: SourceSyncPreparationResult,
  ): Record<string, unknown> {
    return {
      exportJobId: result.exportJobId,
      correlationId: result.correlationId,
      policyVersion: result.policyVersion,
      reportDate: result.reportDate,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      packTypes: result.packTypes,
      syncPolicy: result.syncPolicy,
      sourceImpact: result.sourceImpact,
      decisionEvidence: result.decisionEvidence || [],
      sourceDecisions: result.sourceDecisions.map((decision) => ({
        sourceKey: decision.sourceKey,
        adapterDecision: decision.adapterDecision,
        sourceImpact: decision.sourceImpact,
        decisionEvidence: decision.decisionEvidence,
        warnings: this.sanitizeReasons(decision.warnings),
        blockingReasons: this.sanitizeReasons(decision.blockingReasons),
        adapterResultSummary: decision.adapterResultSummary,
      })),
      warnings: this.sanitizeReasons(result.warnings),
      blockingReasons: this.sanitizeReasons(result.blockingReasons),
      decisionGates: result.decisionGates,
      providerSyncAttempted: result.providerSyncAttempted,
      mutationAttempted: false,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private requesterForPolicy(
    request: CreateOfficialPartialExportInternalRequest,
  ): AiDataPackExportRequester | string | undefined {
    if (request.requester) return request.requester;
    if (request.requestedBy && typeof request.requestedBy === "object") {
      return request.requestedBy as AiDataPackExportRequester;
    }
    if (typeof request.requestedBy === "string") return request.requestedBy;
    return undefined;
  }

  private assertNoForbiddenExportInput(value: unknown, path = "input"): void {
    if (!value || typeof value !== "object" || value instanceof Date) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) =>
        this.assertNoForbiddenExportInput(item, `${path}[${index}]`),
      );
      return;
    }
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (FORBIDDEN_INTERNAL_EXPORT_INPUT_KEYS.has(key)) {
        throw new BadRequestException(
          `${path}.${key} is not accepted by internal export lifecycle input.`,
        );
      }
      this.assertNoForbiddenExportInput(child, `${path}.${key}`);
    }
  }

  private sanitizeReasons(values: unknown[]): string[] {
    return [
      ...new Set((values || []).map((value) => this.sanitizeReason(value))),
    ];
  }

  private sanitizeReason(value: unknown): string {
    return sanitizeExportJobError({
      code: "export_lifecycle",
      message: String(value || "export_lifecycle_reason"),
    }).message;
  }

  private safeList(values?: unknown[]): string[] {
    return [
      ...new Set(
        (values || [])
          .map((value) => String(value || "").trim())
          .filter((value) => /^[a-zA-Z0-9._:-]{1,128}$/.test(value)),
      ),
    ].sort();
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

  private async buildPack(
    packType: CachedExportPackType,
    reportDate: string,
    format: AiDataPackExportFormat,
    actor: { id: string | null; role: string | null; display: string | null },
  ): Promise<any> {
    switch (packType) {
      case "director_data_pack":
        return this.director.build(reportDate, format, actor);
      case "marketer_data_pack":
        return this.marketer.build(reportDate, format, actor);
      case "data_quality_report":
        return this.quality.build(reportDate, format, actor);
      case "mapping_report":
        return this.mapping.build(reportDate, format, actor);
    }
  }

  private render(
    packType: CachedExportPackType,
    format: AiDataPackExportFormat,
    pack: any,
  ): Buffer {
    if (format === "json")
      return Buffer.from(this.json.stableStringify(pack), "utf8");
    const sheets = ["director_data_pack", "marketer_data_pack"].includes(
      packType,
    )
      ? pack.sections
      : { report: pack };
    return this.xlsx.export(sheets);
  }

  private decorateCachedMetadata(pack: any, jobId: string): void {
    const cachedMetadata: CachedExportMetadata = {
      export_job_id: jobId,
      export_mode: CACHED_EXPORT_MODE,
      cached_export: true,
      sync_policy: CACHED_EXPORT_SYNC_POLICY,
      provider_sync_attempted: false,
      freshness_gate_evaluated: false,
      live_execution: false,
    };
    pack.metadata = Object.assign(pack.metadata || {}, cachedMetadata);
  }

  private decorateOfficialPartialMetadata(
    pack: any,
    input: {
      jobId: string;
      exportMode: OfficialPartialExportMode;
      syncPolicy: AiDataPackExportSyncPolicy;
      reportDate: string;
      dateFrom: string;
      dateTo: string;
      redactionProfile: AiDataPackRedactionProfile;
      sectionAccessProfile: string;
      policyVersion: string;
      sourcePreparation: SourceSyncPreparationResult;
    },
  ): void {
    pack.metadata = Object.assign(pack.metadata || {}, {
      export_job_id: input.jobId,
      export_mode: input.exportMode,
      cached_export: false,
      sync_policy: input.syncPolicy,
      provider_sync_attempted: input.sourcePreparation.providerSyncAttempted,
      freshness_gate_evaluated: true,
      live_execution: false,
      redaction_profile: input.redactionProfile,
      section_access_profile: input.sectionAccessProfile,
      policy_version: input.policyVersion,
      report_date: input.reportDate,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      artifact_class: "downloadable_redacted_artifact",
      redaction_runtime: "pre_rendered",
      artifact_rendering: "rendered",
      download_ready: true,
      can_import_action_file: false,
      can_dry_run: false,
      can_execute_live: false,
    });
  }

  private normalizeRequest(request: CreateCachedExportJobRequest): {
    reportDate: string;
    packTypes: CachedExportPackType[];
    formats: AiDataPackExportFormat[];
    policyVersion: string;
  } {
    const reportDate = String(request?.reportDate || "");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(reportDate) ||
      Number.isNaN(new Date(`${reportDate}T00:00:00Z`).getTime())
    ) {
      throw new BadRequestException("reportDate must use YYYY-MM-DD.");
    }
    const packTypes = [
      ...new Set(request?.packTypes || []),
    ].sort() as CachedExportPackType[];
    const formats = [
      ...new Set(request?.formats || []),
    ].sort() as AiDataPackExportFormat[];
    if (
      !packTypes.length ||
      packTypes.some((value) => !CACHED_EXPORT_PACK_TYPES.includes(value))
    ) {
      throw new BadRequestException(
        "packTypes must contain supported cached export packs.",
      );
    }
    if (
      !formats.length ||
      formats.some((value) => !AI_DATA_PACK_EXPORT_FORMATS.includes(value))
    ) {
      throw new BadRequestException("formats must contain json or xlsx.");
    }
    const policyVersion = String(
      request?.policyVersion || CACHED_EXPORT_POLICY_VERSION,
    ).trim();
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(policyVersion)) {
      throw new BadRequestException("policyVersion is invalid.");
    }
    return { reportDate, packTypes, formats, policyVersion };
  }

  private cachedPublicIdempotencyScope(
    request: CreateCachedExportJobRequest,
  ): Record<string, unknown> {
    const idempotencyKey = String(request?.idempotencyKey || "").trim();
    if (request?.idempotencyKey !== undefined) {
      if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(idempotencyKey)) {
        throw new BadRequestException("idempotencyKey is invalid.");
      }
    }
    const sectionAccessProfile = String(
      request?.sectionAccessProfile || "",
    ).trim();
    if (
      request?.sectionAccessProfile !== undefined &&
      !/^[a-z0-9._:-]{1,64}$/i.test(sectionAccessProfile)
    ) {
      throw new BadRequestException("sectionAccessProfile is invalid.");
    }
    return {
      ...(idempotencyKey ? { suppliedIdempotencyKey: idempotencyKey } : {}),
      ...(request?.redactionProfile
        ? { redactionProfile: request.redactionProfile }
        : {}),
      ...(sectionAccessProfile ? { sectionAccessProfile } : {}),
    };
  }

  private findActive(
    idempotencyKey: string,
  ): Promise<AiDataPackExportJob | null> {
    return this.jobModel
      .findOne({ activeIdempotencyKey: idempotencyKey })
      .lean()
      .exec() as Promise<AiDataPackExportJob | null>;
  }

  private findByJobId(jobId: string): Promise<AiDataPackExportJob | null> {
    return this.jobModel
      .findOne({ jobId })
      .lean()
      .exec() as Promise<AiDataPackExportJob | null>;
  }
}
