import { Injectable } from "@nestjs/common";
import { ExportRedactionProfileService } from "../redaction/export-redaction-profile.service";
import {
  AI_DATA_PACK_EXPORT_DOWNLOAD_PERMISSION,
  AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION,
  AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION,
  AiDataPackExportRequester,
  AiDataPackRedactionProfile,
  OfficialPartialExportMode,
  OFFICIAL_EXPORT_MODE,
} from "../export-jobs/export-job.types";

export interface ExportRbacCreateDecision {
  allowed: boolean;
  reason?: string;
  requiredPermissions: string[];
  actorPermissions: string[];
}

const PROFILE_PERMISSION: Record<AiDataPackRedactionProfile, string> = {
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

@Injectable()
export class ExportRbacPolicyService {
  constructor(private readonly profiles: ExportRedactionProfileService) {}

  evaluateCreate(input: {
    mode: OfficialPartialExportMode;
    requester?: AiDataPackExportRequester | string;
    redactionProfile?: unknown;
    sectionAccessProfile?: unknown;
  }): ExportRbacCreateDecision {
    const actorPermissions = this.permissions(input.requester);
    const createPermission =
      input.mode === OFFICIAL_EXPORT_MODE
        ? AI_DATA_PACK_EXPORT_OFFICIAL_CREATE_PERMISSION
        : AI_DATA_PACK_EXPORT_PARTIAL_CREATE_PERMISSION;

    if (!this.profiles.isSupported(input.redactionProfile)) {
      return {
        allowed: false,
        reason: "redaction_profile_missing_or_unsupported",
        requiredPermissions: [createPermission],
        actorPermissions,
      };
    }

    const profilePermission = PROFILE_PERMISSION[input.redactionProfile];
    const requiredPermissions = [createPermission, profilePermission];
    if (!this.safeSectionAccessProfile(input.sectionAccessProfile)) {
      return {
        allowed: false,
        reason: "section_access_profile_missing_or_invalid",
        requiredPermissions,
        actorPermissions,
      };
    }

    const missing = requiredPermissions.filter(
      (permission) => !actorPermissions.includes(permission),
    );
    if (missing.length) {
      return {
        allowed: false,
        reason: `missing_permission:${missing.sort().join(",")}`,
        requiredPermissions,
        actorPermissions,
      };
    }

    return {
      allowed: true,
      requiredPermissions,
      actorPermissions,
    };
  }

  canDownload(input: {
    requester?: AiDataPackExportRequester | string;
    redactionProfile?: unknown;
  }): boolean {
    if (input.redactionProfile === "system_internal_worker") return false;
    return this.permissions(input.requester).includes(
      AI_DATA_PACK_EXPORT_DOWNLOAD_PERMISSION,
    );
  }

  profilePermission(profile: AiDataPackRedactionProfile): string {
    return PROFILE_PERMISSION[profile];
  }

  private permissions(
    requester?: AiDataPackExportRequester | string,
  ): string[] {
    if (!requester || typeof requester === "string") return [];
    const raw = requester.permissions;
    if (!Array.isArray(raw)) return [];
    return [
      ...new Set(
        raw
          .map((permission) => String(permission || "").trim())
          .filter((permission) => /^[a-z0-9._:-]{1,128}$/i.test(permission)),
      ),
    ].sort();
  }

  private safeSectionAccessProfile(value: unknown): value is string {
    const text = String(value || "").trim();
    return /^[a-z0-9._:-]{1,64}$/i.test(text);
  }
}
