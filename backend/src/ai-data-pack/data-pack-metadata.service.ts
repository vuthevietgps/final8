import { Injectable } from "@nestjs/common";
import { AiDataPackMetadata } from "./contracts/metadata.contract";

@Injectable()
export class DataPackMetadataService {
  create(
    type: AiDataPackMetadata["data_pack_type"],
    reportDate: string,
    format: "json" | "xlsx",
    generatedBy?: unknown,
  ): AiDataPackMetadata {
    const actor = this.actor(generatedBy);
    return {
      data_pack_id: `${type}-${reportDate}`,
      data_pack_type: type,
      schema_version: "1.0",
      report_date: reportDate,
      exported_at: new Date().toISOString(),
      timezone: "Asia/Ho_Chi_Minh",
      currency: "VND",
      company_id: null,
      company_name: null,
      generated_by_user_id: actor.id,
      generated_by_role: actor.role,
      generated_by_display: actor.display,
      export_format: format,
      data_sources: [],
      warnings: [
        "company_id and company_name are not configured in a canonical source.",
      ],
    };
  }

  normalizeActor(value: unknown): {
    id: string | null;
    role: string | null;
    display: string | null;
  } {
    return this.actor(value);
  }

  private actor(value: unknown): {
    id: string | null;
    role: string | null;
    display: string | null;
  } {
    if (!value) return { id: null, role: null, display: null };
    if (typeof value === "string")
      return { id: this.safeString(value), role: null, display: null };
    if (typeof value !== "object")
      return { id: String(value), role: null, display: null };
    const actor = value as Record<string, unknown>;
    return {
      id: this.safeString(actor.id ?? actor._id ?? actor.sub),
      role: this.safeString(actor.role),
      display: this.safeString(actor.fullName ?? actor.name ?? actor.display),
    };
  }

  private safeString(value: unknown): string | null {
    if (value === null || value === undefined || value === "") return null;
    if (Buffer.isBuffer(value)) return this.safeScalar(value.toString("hex"));
    if (typeof value === "object") {
      const candidate = value as { toHexString?: unknown };
      if (typeof candidate.toHexString !== "function") return null;
      try {
        return this.safeScalar(candidate.toHexString());
      } catch {
        return null;
      }
    }
    return this.safeScalar(String(value));
  }

  private safeScalar(value: unknown): string | null {
    const result = String(value || "").trim();
    if (!result) return null;
    const compact = result.replace(/[\s().-]/g, "");
    if (
      result.includes("@") ||
      /^\+?\d{9,15}$/.test(compact) ||
      /\b(secret|token|password|credential)\b/i.test(result) ||
      /(api[_-]?key|client[_-]?secret|private[_-]?key|bearer\s+)/i.test(result)
    )
      return null;
    return result;
  }
}
