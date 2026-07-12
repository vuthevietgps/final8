import { redactSecretString } from "../../common/utils/secret-redaction.util";

const REDACTED = "[REDACTED]";

export function sanitizeExportJobError(error: unknown): {
  category: string;
  message: string;
} {
  const value = error as { code?: unknown; message?: unknown };
  const rawCategory = String(value?.code || "export_failed");
  const category = /^[a-z0-9_-]{1,64}$/i.test(rawCategory)
    ? rawCategory.toLowerCase()
    : "export_failed";
  const rawMessage =
    typeof value?.message === "string"
      ? value.message
      : "Cached export failed.";
  const message = redactSecretString(rawMessage)
    .replace(/((?:token|secret|password)=)[^&\s,;]+/gi, `$1${REDACTED}`)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, REDACTED)
    .replace(/https?:\/\/[^\s,;]+/gi, "[REDACTED_URL]")
    .replace(/[A-Za-z]:[\\/][^\s,;]+/g, "[REDACTED_PATH]")
    .replace(/(?:^|\s)\/(?:mnt|tmp|var|home)\/[^\s,;]+/g, " [REDACTED_PATH]")
    .slice(0, 500);
  return { category, message: message || "Cached export failed." };
}
