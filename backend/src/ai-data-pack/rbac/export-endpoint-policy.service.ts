import { Injectable } from "@nestjs/common";
import { getPermissionsForRole } from "../../auth/role-permissions";
import { AiDataPackExportJob } from "../export-jobs/export-job.schema";
import {
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
  AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
  AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
  AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION,
  AiDataPackExportMode,
  AiDataPackExportRequester,
  AiDataPackRedactionProfile,
  CACHED_EXPORT_MODE,
  ExportJobArtifactRecord,
  OFFICIAL_EXPORT_MODE,
  PARTIAL_EXPORT_MODE,
} from "../export-jobs/export-job.types";
import { ExportRedactionProfileService } from "../redaction/export-redaction-profile.service";

export interface ExportEndpointPolicyDecision {
  allowed: boolean;
  statusCode: 403 | 404;
  reason: string;
  requiredPermissions: string[];
  actorPermissions: string[];
}

export type ExportEndpointActorProfile =
  | AiDataPackRedactionProfile
  | "unassigned_reviewer"
  | "unknown";

export const AI_DATA_PACK_PROFILE_PERMISSION: Record<
  AiDataPackRedactionProfile,
  string
> = {
  director_full: "ai-data-pack.profile.director-full",
  director_redacted: "ai-data-pack.profile.director-redacted",
  manager_marketer: "ai-data-pack.profile.manager-marketer",
  finance_operator: "ai-data-pack.profile.finance-operator",
  reviewer_partial: "ai-data-pack.profile.reviewer-partial",
  investor_redacted: "ai-data-pack.profile.investor-redacted",
  external_consultant_redacted:
    "ai-data-pack.profile.external-consultant-redacted",
  system_internal_worker: "ai-data-pack.profile.system-internal-worker",
};

const CREATE_PERMISSION_BY_MODE: Record<AiDataPackExportMode, string> = {
  [CACHED_EXPORT_MODE]: AI_DATA_PACK_EXPORT_CACHED_CREATE_PERMISSION,
  [OFFICIAL_EXPORT_MODE]: AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  [PARTIAL_EXPORT_MODE]: AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
};

const DOWNLOAD_PERMISSION_BY_MODE: Record<AiDataPackExportMode, string> = {
  [CACHED_EXPORT_MODE]: AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_CACHED_PERMISSION,
  [OFFICIAL_EXPORT_MODE]:
    AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_OFFICIAL_PERMISSION,
  [PARTIAL_EXPORT_MODE]:
    AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PARTIAL_PERMISSION,
};

const SYNC_SUMMARY_DEFAULT_DENIED_PROFILES = new Set<string>([
  "manager_marketer",
  "investor_redacted",
  "external_consultant_redacted",
  "reviewer_partial",
  "unassigned_reviewer",
]);

@Injectable()
export class ExportEndpointPolicyService {
  constructor(private readonly profiles: ExportRedactionProfileService) {}

  evaluateCreate(input: {
    mode: AiDataPackExportMode;
    requester?: AiDataPackExportRequester | string;
    redactionProfile?: unknown;
    sectionAccessProfile?: unknown;
    packTypes?: unknown[];
  }): ExportEndpointPolicyDecision {
    const actorPermissions = this.permissions(input.requester);
    const createPermission = CREATE_PERMISSION_BY_MODE[input.mode];
    const requiredPermissions = createPermission ? [createPermission] : [];

    if (!createPermission) {
      return this.deny(
        "unsupported_export_mode",
        requiredPermissions,
        actorPermissions,
      );
    }
    if (!this.profiles.isSupported(input.redactionProfile)) {
      return this.deny(
        "redaction_profile_missing_or_unsupported",
        requiredPermissions,
        actorPermissions,
      );
    }

    const profilePermission =
      AI_DATA_PACK_PROFILE_PERMISSION[input.redactionProfile];
    const fullRequiredPermissions = [createPermission, profilePermission];
    if (!this.safeSectionAccessProfile(input.sectionAccessProfile)) {
      return this.deny(
        "section_access_profile_missing_or_invalid",
        fullRequiredPermissions,
        actorPermissions,
      );
    }

    const actorProfile = this.profile(input.requester);
    if (
      actorProfile !== "unknown" &&
      actorProfile !== "director_full" &&
      actorProfile !== input.redactionProfile
    ) {
      return this.deny(
        "redaction_profile_mismatch",
        fullRequiredPermissions,
        actorPermissions,
      );
    }
    if (input.redactionProfile === "system_internal_worker") {
      return this.deny(
        "system_worker_public_create_denied",
        fullRequiredPermissions,
        actorPermissions,
      );
    }
    if (
      input.redactionProfile === "investor_redacted" &&
      (input.packTypes || []).includes("director_data_pack")
    ) {
      return this.deny(
        "investor_full_pack_denied",
        fullRequiredPermissions,
        actorPermissions,
      );
    }

    const missing = fullRequiredPermissions.filter(
      (permission) => !actorPermissions.includes(permission),
    );
    if (missing.length) {
      return this.deny(
        `missing_permission:${missing.sort().join(",")}`,
        fullRequiredPermissions,
        actorPermissions,
      );
    }

    return this.allow(fullRequiredPermissions, actorPermissions);
  }

  evaluateStatusRead(input: {
    job: AiDataPackExportJob;
    requester?: AiDataPackExportRequester | string;
  }): ExportEndpointPolicyDecision {
    return this.evaluateJobRead({
      job: input.job,
      requester: input.requester,
      requiredPermission: AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
      endpoint: "status",
    });
  }

  evaluateDetailRead(input: {
    job: AiDataPackExportJob;
    requester?: AiDataPackExportRequester | string;
    includeAuditSummary?: boolean;
  }): ExportEndpointPolicyDecision {
    const actorPermissions = this.permissions(input.requester);
    const requiredPermissions = [
      AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
      ...(input.includeAuditSummary
        ? [AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION]
        : []),
    ];
    const actorProfile = this.profile(input.requester);
    if (actorProfile === "investor_redacted") {
      return this.deny(
        "investor_detail_default_denied_status_only",
        requiredPermissions,
        actorPermissions,
      );
    }
    return this.evaluateJobRead({
      job: input.job,
      requester: input.requester,
      requiredPermission: AI_DATA_PACK_EXPORT_STATUS_READ_PERMISSION,
      extraRequiredPermissions: input.includeAuditSummary
        ? [AI_DATA_PACK_EXPORT_AUDIT_READ_PERMISSION]
        : [],
      endpoint: "detail",
      requiredPermissions,
    });
  }

  evaluateSyncSummaryRead(input: {
    job: AiDataPackExportJob;
    requester?: AiDataPackExportRequester | string;
  }): ExportEndpointPolicyDecision {
    const actorProfile = this.profile(input.requester);
    const actorPermissions = this.permissions(input.requester);
    const requiredPermissions = [AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION];
    if (
      ![OFFICIAL_EXPORT_MODE, PARTIAL_EXPORT_MODE].includes(
        input.job.exportMode as any,
      )
    ) {
      return this.deny(
        "sync_summary_only_available_for_official_or_partial",
        requiredPermissions,
        actorPermissions,
      );
    }
    if (SYNC_SUMMARY_DEFAULT_DENIED_PROFILES.has(actorProfile)) {
      return this.deny(
        "sync_summary_profile_default_denied",
        requiredPermissions,
        actorPermissions,
      );
    }

    return this.evaluateJobRead({
      job: input.job,
      requester: input.requester,
      requiredPermission: AI_DATA_PACK_EXPORT_SYNC_DETAIL_READ_PERMISSION,
      endpoint: "sync-summary",
    });
  }

  evaluateArtifactDownload(input: {
    job: AiDataPackExportJob;
    artifact: ExportJobArtifactRecord;
    requester?: AiDataPackExportRequester | string;
  }): ExportEndpointPolicyDecision {
    const actorPermissions = this.permissions(input.requester);
    const modePermission =
      DOWNLOAD_PERMISSION_BY_MODE[input.job.exportMode as AiDataPackExportMode];
    const artifactProfile = input.job.redactionProfile;
    const profilePermission =
      artifactProfile && AI_DATA_PACK_PROFILE_PERMISSION[artifactProfile];
    const requiredPermissions = [
      AI_DATA_PACK_EXPORT_ARTIFACT_DOWNLOAD_PERMISSION,
      ...(modePermission ? [modePermission] : []),
      ...(profilePermission ? [profilePermission] : []),
    ];

    if (!modePermission) {
      return this.deny(
        "unsupported_export_mode_for_artifact_download",
        requiredPermissions,
        actorPermissions,
      );
    }
    if (!profilePermission) {
      return this.deny(
        "artifact_redaction_profile_missing_or_unsupported",
        requiredPermissions,
        actorPermissions,
      );
    }

    const missing = requiredPermissions.filter(
      (permission) => !actorPermissions.includes(permission),
    );
    if (missing.length) {
      return this.deny(
        `missing_permission:${missing.sort().join(",")}`,
        requiredPermissions,
        actorPermissions,
      );
    }

    const actorProfile = this.profile(input.requester);
    if (actorProfile === "unknown") {
      return this.deny(
        "artifact_download_actor_profile_unknown",
        requiredPermissions,
        actorPermissions,
      );
    }
    if (actorProfile === "unassigned_reviewer") {
      return this.deny(
        "unassigned_reviewer_not_bound_to_artifact",
        requiredPermissions,
        actorPermissions,
        404,
      );
    }
    if (actorProfile === "system_internal_worker") {
      return this.deny(
        "system_worker_public_download_denied",
        requiredPermissions,
        actorPermissions,
      );
    }

    const hasDirectorFull = actorPermissions.includes(
      AI_DATA_PACK_PROFILE_PERMISSION.director_full,
    );
    const actorId = this.actorId(input.requester);
    if (
      !hasDirectorFull &&
      (!actorId || actorId !== input.job.requestedByUserId)
    ) {
      return this.deny(
        "artifact_not_found_for_requester",
        requiredPermissions,
        actorPermissions,
        404,
      );
    }

    if (
      !hasDirectorFull &&
      artifactProfile &&
      actorProfile !== artifactProfile
    ) {
      return this.deny(
        "artifact_redaction_profile_mismatch",
        requiredPermissions,
        actorPermissions,
      );
    }

    if (
      !hasDirectorFull &&
      input.job.sectionAccessProfile &&
      this.requesterSectionAccessProfile(input.requester) &&
      this.requesterSectionAccessProfile(input.requester) !==
        input.job.sectionAccessProfile
    ) {
      return this.deny(
        "artifact_section_access_profile_mismatch",
        requiredPermissions,
        actorPermissions,
      );
    }

    if (
      actorProfile === "investor_redacted" &&
      input.artifact.packType === "director_data_pack"
    ) {
      return this.deny(
        "investor_director_pack_download_denied",
        requiredPermissions,
        actorPermissions,
      );
    }
    if (
      actorProfile === "manager_marketer" &&
      (input.job.exportMode === OFFICIAL_EXPORT_MODE ||
        input.artifact.packType !== "marketer_data_pack")
    ) {
      return this.deny(
        "manager_marketer_download_limited_to_cached_or_partial_marketer_pack",
        requiredPermissions,
        actorPermissions,
      );
    }
    if (
      actorProfile === "reviewer_partial" &&
      input.job.exportMode !== PARTIAL_EXPORT_MODE
    ) {
      return this.deny(
        "reviewer_partial_download_limited_to_partial_exports",
        requiredPermissions,
        actorPermissions,
      );
    }

    return this.allow(requiredPermissions, actorPermissions);
  }

  hasPermission(
    requester: AiDataPackExportRequester | string | undefined,
    permission: string,
  ): boolean {
    return this.permissions(requester).includes(permission);
  }

  permissions(requester?: AiDataPackExportRequester | string): string[] {
    if (!requester || typeof requester === "string") return [];
    const explicitPermissions = this.safePermissionList(requester.permissions);
    const rolePermissions = getPermissionsForRole(String(requester.role || ""));
    return [...new Set([...rolePermissions, ...explicitPermissions])].sort();
  }

  actorId(requester?: AiDataPackExportRequester | string): string | null {
    if (!requester) return null;
    if (typeof requester === "string") return this.safeActorId(requester);
    return (
      this.safeActorId(requester.id) ||
      this.safeActorId(requester._id) ||
      this.safeActorId(requester.sub)
    );
  }

  profile(
    requester?: AiDataPackExportRequester | string,
  ): ExportEndpointActorProfile {
    if (!requester || typeof requester === "string") return "unknown";
    const raw = String(requester.redactionProfile || "").trim();
    if (raw === "unassigned_reviewer") return raw;
    if (this.profiles.isSupported(raw)) return raw;

    const actorPermissions = this.permissions(requester);
    for (const [profile, permission] of Object.entries(
      AI_DATA_PACK_PROFILE_PERMISSION,
    )) {
      if (actorPermissions.includes(permission)) {
        return profile as AiDataPackRedactionProfile;
      }
    }
    return "unknown";
  }

  private evaluateJobRead(input: {
    job: AiDataPackExportJob;
    requester?: AiDataPackExportRequester | string;
    requiredPermission: string;
    extraRequiredPermissions?: string[];
    endpoint: string;
    requiredPermissions?: string[];
  }): ExportEndpointPolicyDecision {
    const actorPermissions = this.permissions(input.requester);
    const requiredPermissions =
      input.requiredPermissions ||
      [input.requiredPermission, ...(input.extraRequiredPermissions || [])];
    const missing = requiredPermissions.filter(
      (permission) => !actorPermissions.includes(permission),
    );
    if (missing.length) {
      return this.deny(
        `missing_permission:${missing.sort().join(",")}`,
        requiredPermissions,
        actorPermissions,
      );
    }

    const actorProfile = this.profile(input.requester);
    if (actorProfile === "unassigned_reviewer") {
      return this.deny(
        "unassigned_reviewer_not_bound_to_job",
        requiredPermissions,
        actorPermissions,
        404,
      );
    }
    if (actorProfile === "system_internal_worker") {
      return this.deny(
        "system_worker_public_read_denied",
        requiredPermissions,
        actorPermissions,
      );
    }

    const actorId = this.actorId(input.requester);
    const hasDirectorFull = actorPermissions.includes(
      AI_DATA_PACK_PROFILE_PERMISSION.director_full,
    );
    if (
      !hasDirectorFull &&
      (!actorId || actorId !== input.job.requestedByUserId)
    ) {
      return this.deny(
        "job_not_found_for_requester",
        requiredPermissions,
        actorPermissions,
        404,
      );
    }

    if (
      !hasDirectorFull &&
      input.job.redactionProfile &&
      actorProfile !== input.job.redactionProfile
    ) {
      return this.deny(
        "artifact_redaction_profile_mismatch",
        requiredPermissions,
        actorPermissions,
      );
    }

    return this.allow(requiredPermissions, actorPermissions);
  }

  private allow(
    requiredPermissions: string[],
    actorPermissions: string[],
  ): ExportEndpointPolicyDecision {
    return {
      allowed: true,
      statusCode: 403,
      reason: "allowed",
      requiredPermissions,
      actorPermissions,
    };
  }

  private deny(
    reason: string,
    requiredPermissions: string[],
    actorPermissions: string[],
    statusCode: 403 | 404 = 403,
  ): ExportEndpointPolicyDecision {
    return {
      allowed: false,
      statusCode,
      reason,
      requiredPermissions,
      actorPermissions,
    };
  }

  private safePermissionList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value
          .map((permission) => String(permission || "").trim())
          .filter((permission) => /^[a-z0-9._:-]{1,128}$/i.test(permission)),
      ),
    ].sort();
  }

  private safeSectionAccessProfile(value: unknown): value is string {
    const text = String(value || "").trim();
    return /^[a-z0-9._:-]{1,64}$/i.test(text);
  }

  private safeActorId(value: unknown): string | null {
    const text = String(value || "").trim();
    return /^[a-zA-Z0-9._:@-]{1,128}$/.test(text) ? text : null;
  }

  private requesterSectionAccessProfile(
    requester?: AiDataPackExportRequester | string,
  ): string | null {
    if (!requester || typeof requester === "string") return null;
    const text = String(requester.sectionAccessProfile || "").trim();
    return this.safeSectionAccessProfile(text) ? text : null;
  }
}
