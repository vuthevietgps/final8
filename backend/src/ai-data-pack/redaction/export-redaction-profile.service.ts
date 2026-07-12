import { Injectable } from "@nestjs/common";
import {
  AI_DATA_PACK_REDACTION_PROFILES,
  AiDataPackArtifactRendering,
  AiDataPackRedactionProfile,
  AiDataPackRedactionRuntime,
} from "../export-jobs/export-job.types";

export interface ExportRedactionProfileResolution {
  profile: AiDataPackRedactionProfile;
  redactionRuntime: AiDataPackRedactionRuntime;
  artifactRendering: AiDataPackArtifactRendering;
  containsPii: boolean;
  containsFinancialSensitive: boolean;
  containsEmployeeSensitive: boolean;
  containsSupplierSensitive: boolean;
  warnings: string[];
}

const PROFILE_SENSITIVITY: Record<
  AiDataPackRedactionProfile,
  Omit<
    ExportRedactionProfileResolution,
    "profile" | "redactionRuntime" | "artifactRendering" | "warnings"
  >
> = {
  director_full: {
    containsPii: true,
    containsFinancialSensitive: true,
    containsEmployeeSensitive: true,
    containsSupplierSensitive: true,
  },
  director_redacted: {
    containsPii: false,
    containsFinancialSensitive: true,
    containsEmployeeSensitive: false,
    containsSupplierSensitive: false,
  },
  manager_marketer: {
    containsPii: false,
    containsFinancialSensitive: false,
    containsEmployeeSensitive: false,
    containsSupplierSensitive: false,
  },
  finance_operator: {
    containsPii: false,
    containsFinancialSensitive: true,
    containsEmployeeSensitive: false,
    containsSupplierSensitive: true,
  },
  reviewer_partial: {
    containsPii: false,
    containsFinancialSensitive: false,
    containsEmployeeSensitive: false,
    containsSupplierSensitive: false,
  },
  investor_redacted: {
    containsPii: false,
    containsFinancialSensitive: true,
    containsEmployeeSensitive: false,
    containsSupplierSensitive: false,
  },
  external_consultant_redacted: {
    containsPii: false,
    containsFinancialSensitive: false,
    containsEmployeeSensitive: false,
    containsSupplierSensitive: false,
  },
  system_internal_worker: {
    containsPii: true,
    containsFinancialSensitive: true,
    containsEmployeeSensitive: true,
    containsSupplierSensitive: true,
  },
};

@Injectable()
export class ExportRedactionProfileService {
  isSupported(value: unknown): value is AiDataPackRedactionProfile {
    return AI_DATA_PACK_REDACTION_PROFILES.includes(
      value as AiDataPackRedactionProfile,
    );
  }

  resolve(
    profile: AiDataPackRedactionProfile,
  ): ExportRedactionProfileResolution {
    return {
      profile,
      redactionRuntime: "manifest_only",
      artifactRendering: "deferred",
      ...PROFILE_SENSITIVITY[profile],
      warnings: [
        "artifact_rendering=deferred",
        "redaction_runtime=manifest_only",
      ],
    };
  }
}
