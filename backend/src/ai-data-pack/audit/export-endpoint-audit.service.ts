import { Injectable, Optional } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Model } from "mongoose";
import { redactSecrets } from "../../common/utils/secret-redaction.util";
import { sanitizeExportJobError } from "../export-jobs/export-job-error.util";
import {
  AiDataPackExportAuditEvent,
  AiDataPackExportJobStatus,
} from "../export-jobs/export-job.types";
import {
  AiDataPackEndpointAudit,
  AiDataPackEndpointAuditDocument,
} from "./export-endpoint-audit.schema";

export type ExportEndpointAuditEventName =
  | "export_create_requested"
  | "export_create_denied"
  | "export_create_accepted"
  | "export_status_viewed"
  | "export_status_denied"
  | "export_detail_viewed"
  | "export_detail_denied"
  | "sync_summary_viewed"
  | "sync_summary_denied"
  | "artifact_download_requested"
  | "artifact_download_denied"
  | "artifact_download_started"
  | "artifact_download_completed"
  | "artifact_download_failed"
  | "rbac_denied"
  | "redaction_profile_applied"
  | "idempotent_request_reused"
  | "invalid_request_rejected"
  | "rate_limited";

export interface ExportEndpointAuditInput {
  event: ExportEndpointAuditEventName;
  actorId?: string | null;
  jobId?: string | null;
  status?: AiDataPackExportJobStatus;
  reason?: unknown;
  details?: Record<string, unknown>;
  requestContext?: {
    requestId?: string;
    correlationId?: string;
    routeTemplate?: string;
    method?: string;
    ipHash?: string;
    userAgentHash?: string;
  };
}

const FORBIDDEN_AUDIT_DETAIL_KEYS = new Set([
  "access_token",
  "accessToken",
  "actionPlan",
  "approvalPayload",
  "artifactBytes",
  "artifactStoragePath",
  "authorization",
  "client_secret",
  "clientSecret",
  "credential",
  "credentials",
  "developer_token",
  "developerToken",
  "downloadNow",
  "downloadToken",
  "gaql",
  "headers",
  "body",
  "cookie",
  "cookies",
  "oauth",
  "openaiUpload",
  "rawHeaders",
  "rawIp",
  "rawUserAgent",
  "remoteAddress",
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
export class ExportEndpointAuditService {
  private readonly events: AiDataPackExportAuditEvent[] = [];

  constructor(
    @Optional()
    @InjectModel(AiDataPackEndpointAudit.name)
    private readonly auditModel?: Model<AiDataPackEndpointAuditDocument>,
  ) {}

  record(input: ExportEndpointAuditInput): AiDataPackExportAuditEvent {
    const event = this.toJobAuditEvent(input);
    this.remember(event);
    void this.persistEvent(event);
    return event;
  }

  async recordPersistent(
    input: ExportEndpointAuditInput,
  ): Promise<AiDataPackExportAuditEvent> {
    const event = this.toJobAuditEvent(input);
    this.remember(event);
    await this.persistEvent(event);
    return event;
  }

  toJobAuditEvent(input: ExportEndpointAuditInput): AiDataPackExportAuditEvent {
    return {
      event: input.event,
      status: input.status,
      at: new Date(),
      actorId: this.safeId(input.actorId),
      reason:
        input.reason === undefined
          ? undefined
          : sanitizeExportJobError({
              code: "endpoint_audit",
              message: String(input.reason),
            }).message,
      details: this.sanitizeDetails({
        ...(input.details || {}),
        ...(input.requestContext || {}),
        ...(input.jobId ? { jobId: input.jobId } : {}),
      }),
    };
  }

  list(): AiDataPackExportAuditEvent[] {
    return this.events.map((event) => ({ ...event }));
  }

  persistentAuditConfigured(): boolean {
    return Boolean(this.auditModel);
  }

  private remember(event: AiDataPackExportAuditEvent): void {
    this.events.push(event);
    if (this.events.length > 5000) this.events.shift();
  }

  private async persistEvent(event: AiDataPackExportAuditEvent): Promise<void> {
    if (!this.auditModel) return;
    try {
      await this.auditModel.create({
        auditId: `ADPEA-${randomUUID()}`,
        event: event.event,
        actorId: event.actorId ?? null,
        jobId:
          typeof event.details?.jobId === "string"
            ? event.details.jobId
            : undefined,
        status: event.status,
        reason: event.reason,
        requestId: this.detailString(event.details?.requestId),
        correlationId: this.detailString(event.details?.correlationId),
        routeTemplate: this.detailString(event.details?.routeTemplate),
        method: this.detailString(event.details?.method),
        ipHash: this.detailString(event.details?.ipHash),
        userAgentHash: this.detailString(event.details?.userAgentHash),
        details: event.details,
        canImportActionFile: false,
        canDryRun: false,
        canExecuteLive: false,
      });
    } catch {
      // Endpoint audit must not change caller behavior; job-known audit still
      // appends to the export job separately.
    }
  }

  private safeId(value: unknown): string | null {
    const text = String(value || "").trim();
    return /^[a-zA-Z0-9._:@-]{1,128}$/.test(text) ? text : null;
  }

  private detailString(value: unknown): string | undefined {
    const text = String(value || "").trim();
    return /^[a-zA-Z0-9._:@/-]{1,256}$/.test(text) ? text : undefined;
  }

  private sanitizeDetails(value: unknown): Record<string, unknown> | undefined {
    const sanitized = this.sanitizeValue(redactSecrets(value));
    if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
      return undefined;
    }
    return sanitized as Record<string, unknown>;
  }

  private sanitizeValue(value: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof value === "string") {
      return sanitizeExportJobError({
        code: "endpoint_audit",
        message: value,
      }).message;
    }
    if (typeof value !== "object" || value === null) return value;
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return "[REDACTED_BUFFER]";
    if (seen.has(value)) return "[REDACTED_CIRCULAR]";
    seen.add(value);

    if (Array.isArray(value)) {
      return value.slice(0, 25).map((item) => this.sanitizeValue(item, seen));
    }

    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_AUDIT_DETAIL_KEYS.has(key)) {
        continue;
      }
      if (this.isSafeAuditMetadataKey(key)) {
        const safe = this.detailString(child);
        if (safe !== undefined) output[key] = safe;
        continue;
      }
      output[key] = this.sanitizeValue(child, seen);
    }
    return output;
  }

  private isSafeAuditMetadataKey(key: string): boolean {
    return [
      "requestId",
      "correlationId",
      "routeTemplate",
      "method",
      "ipHash",
      "userAgentHash",
    ].includes(key);
  }
}
