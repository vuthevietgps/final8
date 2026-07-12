import { Injectable } from "@nestjs/common";
import { sanitizeExportJobError } from "./export-job-error.util";
import { AiDataPackExportJob } from "./export-job.schema";
import {
  AiDataPackExportAuditEvent,
  AiDataPackRedactionProfile,
  CACHED_EXPORT_MODE,
} from "./export-job.types";

type PublicRedactionProfile =
  | AiDataPackRedactionProfile
  | "unassigned_reviewer"
  | "unknown";

interface ExportJobWithTimestamps extends AiDataPackExportJob {
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

const COMMON_OMITTED_SECTIONS = [
  "artifact_bytes",
  "artifact_storage_paths",
  "download_tokens",
  "public_urls",
  "raw_provider_payloads",
  "raw_provider_queries",
  "credentials",
  "row_level_data",
];

const PROFILE_OMITTED_SECTIONS: Record<string, string[]> = {
  director_full: [],
  director_redacted: ["pii", "employee_sensitive"],
  manager_marketer: [
    "financial_sensitive",
    "employee_sensitive",
    "supplier_sensitive",
    "sync_detail",
    "audit_detail",
  ],
  finance_operator: ["pii", "employee_sensitive", "marketing_raw_sync"],
  reviewer_partial: [
    "pii",
    "financial_sensitive",
    "employee_sensitive",
    "supplier_sensitive",
    "sync_detail",
    "audit_detail",
  ],
  investor_redacted: ["pii", "employee_sensitive", "supplier_sensitive"],
  external_consultant_redacted: [
    "pii",
    "financial_sensitive",
    "employee_sensitive",
    "supplier_sensitive",
    "sync_detail",
    "audit_detail",
  ],
  system_internal_worker: ["public_endpoint_access"],
  unassigned_reviewer: ["all_job_specific_sections"],
  unknown: ["profile_specific_sections"],
};

const FORBIDDEN_RESPONSE_KEYS = new Set([
  "access_token",
  "accessToken",
  "actionPlan",
  "approvalPayload",
  "artifactBytes",
  "artifactStoragePath",
  "authorization",
  "client_secret",
  "clientSecret",
  "credentials",
  "developer_token",
  "developerToken",
  "downloadNow",
  "downloadPolicy",
  "downloadToken",
  "fileName",
  "gaql",
  "headers",
  "openaiUpload",
  "providerCredentials",
  "providerQuery",
  "publicUrl",
  "rawError",
  "rawProviderError",
  "rawProviderQuery",
  "rawProviderRequest",
  "rawProviderResponse",
  "refresh_token",
  "refreshToken",
  "request",
  "response",
  "stack",
  "storageKey",
  "storageLocation",
  "token",
  "validateOnly",
]);

@Injectable()
export class ExportJobResponseRedactorService {
  toCreateSummary(
    job: AiDataPackExportJob,
    profile: PublicRedactionProfile,
  ): Record<string, unknown> {
    return this.stripForbidden({
      ...this.statusFields(job as ExportJobWithTimestamps, profile),
      allowedNextActions: this.allowedNextActions(job),
    }) as Record<string, unknown>;
  }

  toStatus(
    job: AiDataPackExportJob,
    profile: PublicRedactionProfile,
  ): Record<string, unknown> {
    return this.stripForbidden(
      this.statusFields(job as ExportJobWithTimestamps, profile),
    ) as Record<string, unknown>;
  }

  toDetail(input: {
    job: AiDataPackExportJob;
    profile: PublicRedactionProfile;
    includeAuditSummary: boolean;
  }): Record<string, unknown> {
    const job = input.job as ExportJobWithTimestamps;
    return this.stripForbidden({
      jobId: job.jobId,
      exportMode: job.exportMode,
      syncPolicy: job.syncPolicy,
      status: job.status,
      policyVersion: job.policyVersion,
      redactionProfile: job.redactionProfile || input.profile,
      sectionAccessProfile: job.sectionAccessProfile || null,
      manifestSummary: this.manifestSummary(job),
      sanitizedAuditSummary: this.auditSummary(
        job.auditEvents,
        input.includeAuditSummary,
      ),
      warnings: this.sanitizeReasons(job.warnings || []),
      blockingReasons: this.sanitizeReasons(job.blockingReasons || []),
      allowedNextActions: this.allowedNextActions(job),
      responseRedaction: this.responseRedaction(
        job.redactionProfile || input.profile,
      ),
    }) as Record<string, unknown>;
  }

  toSyncSummary(
    job: AiDataPackExportJob,
    profile: PublicRedactionProfile,
  ): Record<string, unknown> {
    const sourceDecisions = this.sourceDecisions(job).map((decision) => {
      const impact = decision.sourceImpact || {};
      const adapterSummary = decision.adapterResultSummary || {};
      return {
        sourceKey: this.safeSourceKey(decision.sourceKey),
        freshnessStatus: this.safeEnum(impact.freshnessStatus),
        coverageStatus: this.safeEnum(impact.coverageStatus),
        sourceImpactStatus: this.safeEnum(impact.status),
        adapterAttempted: [
          "called_adapter",
          "adapter_failed",
          "adapter_scope_denied",
        ].includes(String(decision.adapterDecision || "")),
        providerSyncAttempted:
          typeof adapterSummary.providerSyncAttempted === "boolean"
            ? adapterSummary.providerSyncAttempted
            : Boolean(job.providerSyncAttempted),
        sanitizedErrorCategories: this.sanitizedErrorCategories(decision),
        postAssessment: {
          canUseForDecision: this.safeEnum(impact.canUseForDecision),
          canUseForAdsAutomationDecision:
            impact.canUseForAdsAutomationDecision === true,
          reportDate: this.safeEnum(
            decision.decisionEvidence?.reportDate || impact.reportDate,
          ),
          lastSuccessfulSyncAt: this.safeEnum(
            decision.decisionEvidence?.lastSuccessfulSyncAt ||
              impact.lastSuccessfulSyncAt,
          ),
          latestRecordDate: this.safeEnum(
            decision.decisionEvidence?.latestRecordDate ||
              impact.latestRecordDate,
          ),
          blockingReason: this.safeEnum(
            decision.decisionEvidence?.blockingReason ||
              impact.blockingReason,
          ),
          warningCount: (decision.warnings || []).length,
          blockingReasonCount: (decision.blockingReasons || []).length,
        },
        decisionGateImpact: this.decisionGateSummary(job),
      };
    });

    return this.stripForbidden({
      jobId: job.jobId,
      exportMode: job.exportMode,
      syncPolicy: job.syncPolicy,
      status: job.status,
      redactionProfile: job.redactionProfile || profile,
      sourceSyncSummary: sourceDecisions,
      responseRedaction: this.responseRedaction(job.redactionProfile || profile),
    }) as Record<string, unknown>;
  }

  private statusFields(
    job: ExportJobWithTimestamps,
    profile: PublicRedactionProfile,
  ): Record<string, unknown> {
    return {
      jobId: job.jobId,
      exportMode: job.exportMode,
      syncPolicy: job.syncPolicy,
      status: job.status,
      createdAt: this.iso(job.createdAt || job.requestedAt),
      updatedAt: this.iso(job.updatedAt || job.completedAt || job.requestedAt),
      completedAt: this.iso(job.completedAt),
      redactionProfile: job.redactionProfile || profile,
      packTypes: job.packTypes,
      formats: job.formats,
      sourceImpactSummary: this.sourceImpactSummary(job),
      decisionGateSummary: this.decisionGateSummary(job),
      warnings: this.sanitizeReasons(job.warnings || []),
      blockingReasons: this.sanitizeReasons(job.blockingReasons || []),
      artifactManifestSummary: this.manifestSummary(job),
      allowedNextActions: this.allowedNextActions(job),
      omittedSections: this.omittedSections(job.redactionProfile || profile),
      responseRedaction: this.responseRedaction(job.redactionProfile || profile),
    };
  }

  private manifestSummary(job: AiDataPackExportJob): Record<string, unknown> {
    const artifactSummaries = (job.artifacts || []).map((artifact) => ({
      artifactId: artifact.artifactId,
      packType: artifact.packType,
      format: artifact.format,
      artifactChecksum: artifact.artifactChecksum,
      dataContentChecksum: artifact.dataContentChecksum || null,
      cachedExport: artifact.cachedExport,
      artifactClass: artifact.artifactClass || null,
      redactionRuntime: artifact.redactionRuntime || null,
      artifactRendering: artifact.artifactRendering || null,
      downloadReady: artifact.downloadReady === true,
      checksumAlgorithm: artifact.checksumAlgorithm || null,
      fileSizeBytes: artifact.fileSizeBytes,
      createdAt: this.iso(artifact.createdAt),
    }));
    if (job.exportMode === CACHED_EXPORT_MODE) {
      return {
        manifestOnly: artifactSummaries.length === 0,
        artifactRendering: artifactSummaries.length ? "rendered" : "deferred",
        redactionRuntime: artifactSummaries.length ? "pre_rendered" : "manifest_only",
        artifactCount: artifactSummaries.length,
        packTypes: job.packTypes,
        formats: job.formats,
        artifacts: artifactSummaries,
      };
    }

    const manifest = job.manifest;
    if (!manifest) {
      return {
        manifestOnly: true,
        artifactRendering: job.artifactRendering || "deferred",
        redactionRuntime: job.redactionRuntime || "manifest_only",
        artifactCount: 0,
        packTypes: job.packTypes,
        formats: job.formats,
      };
    }

    return {
      manifestOnly:
        artifactSummaries.length === 0 || manifest.downloadReady !== true,
      artifactId: manifest.artifactId,
      exportMode: manifest.exportMode,
      syncPolicy: manifest.syncPolicy,
      policyVersion: manifest.policyVersion,
      redactionProfile: manifest.redactionProfile,
      sectionAccessProfile: manifest.sectionAccessProfile,
      packTypes: manifest.packTypes,
      formats: manifest.formats,
      containsPii: manifest.containsPii,
      containsFinancialSensitive: manifest.containsFinancialSensitive,
      containsEmployeeSensitive: manifest.containsEmployeeSensitive,
      containsSupplierSensitive: manifest.containsSupplierSensitive,
      dataContentChecksum: manifest.dataContentChecksum,
      runtimeExportChecksum: manifest.runtimeExportChecksum,
      artifactChecksum: manifest.artifactChecksum,
      createdAt: manifest.createdAt,
      expiresAt: manifest.expiresAt,
      retentionUntil: manifest.retentionUntil,
      redactionRuntime: manifest.redactionRuntime,
      artifactRendering: manifest.artifactRendering,
      artifactClass: manifest.artifactClass || "manifest_only_artifact",
      downloadReady: manifest.downloadReady === true,
      artifactCount: artifactSummaries.length,
      renderedArtifactCount: manifest.renderedArtifactCount || 0,
      unsupportedFormats: manifest.unsupportedFormats || [],
      artifacts: artifactSummaries,
    };
  }

  private sourceImpactSummary(
    job: AiDataPackExportJob,
  ): Record<string, unknown>[] {
    const sourceImpact = this.sourceSyncPreparation(job).sourceImpact || {};
    return Object.values(sourceImpact as Record<string, any>).map((impact) => ({
      sourceKey: this.safeSourceKey(impact.sourceKey),
      freshnessStatus: this.safeEnum(impact.freshnessStatus),
      coverageStatus: this.safeEnum(impact.coverageStatus),
      sourceImpactStatus: this.safeEnum(impact.status),
      canUseForDecision: this.safeEnum(impact.canUseForDecision),
      canUseForAdsAutomationDecision:
        impact.canUseForAdsAutomationDecision === true,
      reportDate: this.safeEnum(impact.reportDate),
      latestRecordDate: this.safeEnum(impact.latestRecordDate),
      lastSuccessfulSyncAt: this.safeEnum(impact.lastSuccessfulSyncAt),
      blockingReason: this.safeEnum(impact.blockingReason),
    }));
  }

  private sourceDecisions(job: AiDataPackExportJob): any[] {
    const decisions = this.sourceSyncPreparation(job).sourceDecisions;
    return Array.isArray(decisions) ? decisions : [];
  }

  private decisionGateSummary(job: AiDataPackExportJob): Record<string, unknown> {
    const gates = job.decisionGates || job.manifest?.decisionGates || {};
    return {
      canUseForDecision: Boolean((gates as any).canUseForDecision),
      canUseGoogleAdsDataClaim: Boolean(
        (gates as any).canUseGoogleAdsDataClaim,
      ),
      canGenerateActionDraft: Boolean((gates as any).canGenerateActionDraft),
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
      hasBlockingReasons: Boolean(job.blockingReasons?.length),
    };
  }

  private auditSummary(
    events: Record<string, unknown>[] | undefined,
    includeAuditSummary: boolean,
  ): Record<string, unknown> {
    if (!includeAuditSummary) {
      return {
        included: false,
        reason: "ai-data-pack.export.audit.read permission required",
      };
    }
    const safeEvents = (events || [])
      .slice(-10)
      .map((event) => event as Partial<AiDataPackExportAuditEvent>)
      .map((event) => ({
        event: this.safeEnum(event.event),
        status: this.safeEnum(event.status),
        at: this.iso(event.at),
        reason: event.reason ? this.sanitizeReason(event.reason) : undefined,
      }));
    const counts: Record<string, number> = {};
    for (const event of events || []) {
      const key = this.safeEnum(event.event) || "unknown";
      counts[key] = (counts[key] || 0) + 1;
    }
    return {
      included: true,
      eventCount: events?.length || 0,
      eventCounts: counts,
      recentEvents: safeEvents,
    };
  }

  private allowedNextActions(job: AiDataPackExportJob): string[] {
    const actions = ["view_status", "request_new_export"];
    if (job.status === "blocked" && job.exportMode === "official_export") {
      actions.push("request_partial_if_blocked");
    }
    return actions;
  }

  private responseRedaction(profile: string): Record<string, unknown> {
    const omittedSections = this.omittedSections(profile);
    return {
      isRedacted: true,
      redactionProfile: profile,
      omittedSections,
      reason: "public_endpoint_manifest_only_redaction",
      manifestOnly: true,
    };
  }

  private omittedSections(profile: string): string[] {
    return [
      ...new Set([
        ...COMMON_OMITTED_SECTIONS,
        ...(PROFILE_OMITTED_SECTIONS[profile] ||
          PROFILE_OMITTED_SECTIONS.unknown),
      ]),
    ].sort();
  }

  private sanitizedErrorCategories(decision: any): string[] {
    const adapterCategories = Array.isArray(
      decision?.adapterResultSummary?.errorCategories,
    )
      ? decision.adapterResultSummary.errorCategories
      : [];
    const values = [
      ...adapterCategories,
      ...(decision?.warnings || []),
      ...(decision?.blockingReasons || []),
    ];
    return [
      ...new Set(
        values.map(
          (value) =>
            sanitizeExportJobError({
              code: String(value || "source_sync_notice"),
              message: String(value || "source_sync_notice"),
            }).category,
        ),
      ),
    ].sort();
  }

  private sourceSyncPreparation(job: AiDataPackExportJob): Record<string, any> {
    return (job.sourceSyncPreparation || {}) as Record<string, any>;
  }

  private sanitizeReasons(values: unknown[]): string[] {
    return [
      ...new Set((values || []).map((value) => this.sanitizeReason(value))),
    ];
  }

  private sanitizeReason(value: unknown): string {
    return sanitizeExportJobError({
      code: "public_export_response",
      message: String(value || "export_response_notice"),
    }).message;
  }

  private safeEnum(value: unknown): string | null {
    const text = String(value || "").trim();
    if (!text) return null;
    return /^[a-zA-Z0-9._:@-]{1,128}$/.test(text)
      ? text
      : this.sanitizeReason(text);
  }

  private safeSourceKey(value: unknown): string | null {
    const text = String(value || "").trim();
    return /^[a-zA-Z0-9._:-]{1,64}$/.test(text) ? text : null;
  }

  private iso(value: unknown): string | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  private stripForbidden(value: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof value === "string") return this.sanitizeReason(value);
    if (typeof value !== "object" || value === null) return value;
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return "[REDACTED_BUFFER]";
    if (seen.has(value)) return "[REDACTED_CIRCULAR]";
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => this.stripForbidden(item, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_RESPONSE_KEYS.has(key)) continue;
      result[key] = this.stripForbidden(child, seen);
    }
    return result;
  }
}
