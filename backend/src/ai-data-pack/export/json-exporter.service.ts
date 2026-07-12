import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { redactDataPack } from "../utils/redaction.util";

interface ChecksumMetadata {
  runtime_export_checksum?: string;
  data_content_checksum?: string;
}

@Injectable()
export class JsonExporterService {
  stableStringify(value: unknown): string {
    return JSON.stringify(this.sort(redactDataPack(value)), null, 2);
  }

  checksum(value: unknown): string {
    return createHash("sha256")
      .update(this.stableStringify(value))
      .digest("hex");
  }

  attachChecksums<TMetadata extends object, T extends { metadata: TMetadata }>(
    value: T,
  ): T & { metadata: TMetadata & ChecksumMetadata } {
    const metadata = value.metadata as TMetadata & ChecksumMetadata;
    delete metadata.runtime_export_checksum;
    delete metadata.data_content_checksum;
    metadata.data_content_checksum = this.checksum(
      this.normalizeContent(value),
    );
    metadata.runtime_export_checksum = this.checksum(value);
    return value as T & { metadata: TMetadata & ChecksumMetadata };
  }

  dataContentChecksum(value: unknown): string {
    return this.checksum(this.normalizeContent(value));
  }

  private normalizeContent(value: any, key = ""): any {
    if (Array.isArray(value))
      return value.map((item) => this.normalizeContent(item, key));
    if (!value || typeof value !== "object" || value instanceof Date) {
      if (
        typeof value === "string" &&
        ["date", "lowPointDate"].includes(key) &&
        /^\d{4}-\d{2}-\d{2}T/.test(value)
      ) {
        return value.slice(0, 10);
      }
      return value;
    }
    return Object.keys(value)
      .sort()
      .reduce(
        (result, childKey) => {
          if (
            [
              "exported_at",
              "generated_at",
              "generatedAt",
              "calculatedAt",
              "freshness_at",
              "runtime_export_checksum",
              "data_content_checksum",
              "request_id",
              "requestId",
              "export_job_id",
              "export_mode",
              "cached_export",
              "sync_policy",
              "provider_sync_attempted",
              "freshness_gate_evaluated",
              "live_execution",
            ].includes(childKey)
          )
            return result;
          result[childKey] = this.normalizeContent(value[childKey], childKey);
          return result;
        },
        {} as Record<string, unknown>,
      );
  }

  private sort(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.sort(item));
    if (!value || typeof value !== "object" || value instanceof Date)
      return value;
    return Object.keys(value)
      .sort()
      .reduce(
        (result, key) => {
          result[key] = this.sort(value[key]);
          return result;
        },
        {} as Record<string, unknown>,
      );
  }
}
