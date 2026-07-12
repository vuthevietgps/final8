import { Injectable, Logger } from "@nestjs/common";
import type { ExportEndpointAuditEventName } from "../audit/export-endpoint-audit.service";

export type ExportEndpointName =
  | "create"
  | "status"
  | "detail"
  | "download"
  | "sync-summary"
  | "unknown";

export interface ExportEndpointObservation {
  metricName: string;
  event: ExportEndpointAuditEventName;
  endpointName: ExportEndpointName;
  exportMode: string;
  status: string;
  redactionProfile: string;
  reasonCategory: string;
}

@Injectable()
export class ExportEndpointObservabilityService {
  private readonly logger = new Logger(ExportEndpointObservabilityService.name);
  private readonly observations: ExportEndpointObservation[] = [];

  record(input: {
    event: ExportEndpointAuditEventName;
    endpointName?: unknown;
    exportMode?: unknown;
    status?: unknown;
    redactionProfile?: unknown;
    reason?: unknown;
  }): void {
    const observation: ExportEndpointObservation = {
      metricName: this.metricName(input.event),
      event: input.event,
      endpointName: this.endpointName(input.endpointName),
      exportMode: this.boundedLabel(input.exportMode, "unknown"),
      status: this.boundedLabel(input.status, "unknown"),
      redactionProfile: this.boundedLabel(input.redactionProfile, "unknown"),
      reasonCategory: this.reasonCategory(input.reason),
    };
    this.observations.push(observation);
    if (this.observations.length > 5000) this.observations.shift();
    this.logger.log(
      JSON.stringify({
        event: "ai_data_pack_export_endpoint_observed",
        ...observation,
      }),
    );
  }

  listForTest(): ExportEndpointObservation[] {
    return this.observations.map((item) => ({ ...item }));
  }

  private metricName(event: ExportEndpointAuditEventName): string {
    switch (event) {
      case "export_create_requested":
        return "ai_data_pack_export_create_requested_total";
      case "export_create_denied":
        return "ai_data_pack_export_create_denied_total";
      case "export_status_viewed":
        return "ai_data_pack_export_status_read_total";
      case "export_detail_viewed":
        return "ai_data_pack_export_detail_read_total";
      case "sync_summary_viewed":
        return "ai_data_pack_export_sync_summary_read_total";
      case "artifact_download_requested":
        return "ai_data_pack_artifact_download_requested_total";
      case "artifact_download_denied":
        return "ai_data_pack_artifact_download_denied_total";
      case "artifact_download_started":
        return "ai_data_pack_artifact_download_started_total";
      case "artifact_download_completed":
        return "ai_data_pack_artifact_download_completed_total";
      case "artifact_download_failed":
        return "ai_data_pack_artifact_download_failed_total";
      case "rate_limited":
        return "ai_data_pack_export_rate_limited_total";
      case "redaction_profile_applied":
        return "ai_data_pack_export_redaction_applied_total";
      case "idempotent_request_reused":
        return "ai_data_pack_export_idempotency_reused_total";
      case "export_status_denied":
      case "export_detail_denied":
      case "sync_summary_denied":
      case "rbac_denied":
      case "invalid_request_rejected":
        return "ai_data_pack_export_denial_by_reason_total";
      default:
        return "ai_data_pack_export_endpoint_event_total";
    }
  }

  private endpointName(value: unknown): ExportEndpointName {
    const text = this.boundedLabel(value, "unknown");
    return ["create", "status", "detail", "download", "sync-summary"].includes(
      text,
    )
      ? (text as ExportEndpointName)
      : "unknown";
  }

  private reasonCategory(value: unknown): string {
    const text = String(value || "").toLowerCase();
    if (!text) return "none";
    if (text.includes("missing_permission")) return "missing_permission";
    if (text.includes("rate")) return "rate_limited";
    if (text.includes("invalid")) return "invalid_request";
    if (text.includes("not_found") || text.includes("not found")) {
      return "job_not_found_or_forbidden";
    }
    if (text.includes("profile")) return "profile_denied";
    if (text.includes("idempot")) return "idempotency_reused";
    return "other";
  }

  private boundedLabel(value: unknown, fallback: string): string {
    const text = String(value || "").trim();
    if (!/^[a-zA-Z0-9._:-]{1,64}$/.test(text)) return fallback;
    return text;
  }
}
