import { redactSecretString } from "../../../common/utils/secret-redaction.util";
import {
  GoogleAdsReadonlyError,
  GoogleAdsReadonlyErrorCategory,
} from "./google-ads-readonly-adapter.types";

const REDACTED = "[REDACTED]";

export class GoogleAdsReadonlyAdapterError extends Error {
  constructor(
    readonly category: GoogleAdsReadonlyErrorCategory,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GoogleAdsReadonlyAdapterError";
  }
}

export function classifyGoogleAdsReadonlyError(
  error: unknown,
): Pick<GoogleAdsReadonlyError, "category" | "retryable"> {
  if (error instanceof GoogleAdsReadonlyAdapterError) {
    return { category: error.category, retryable: error.retryable };
  }

  const value = error as {
    code?: unknown;
    status?: unknown;
    response?: { status?: unknown; data?: { error?: { status?: unknown } } };
  };
  const status = Number(value?.response?.status ?? value?.status);
  const code = String(
    value?.response?.data?.error?.status || value?.code || "",
  ).toUpperCase();

  if (status === 429 || code === "RESOURCE_EXHAUSTED") {
    return { category: "rate_limited", retryable: true };
  }
  if (status === 401 || code === "UNAUTHENTICATED") {
    return { category: "auth_failed", retryable: false };
  }
  if (status === 403 || code === "PERMISSION_DENIED") {
    return { category: "permission_denied", retryable: false };
  }
  if (status === 408 || ["ETIMEDOUT", "ECONNABORTED"].includes(code)) {
    return { category: "provider_timeout", retryable: true };
  }
  if (status >= 500 && status <= 599) {
    return { category: "provider_transient", retryable: true };
  }
  if (["INVALID_ARGUMENT", "QUERY_ERROR"].includes(code)) {
    return { category: "provider_query_invalid", retryable: false };
  }
  if (["UNIMPLEMENTED", "VERSION_NOT_SUPPORTED"].includes(code)) {
    return { category: "provider_version_unsupported", retryable: false };
  }
  return { category: "unexpected", retryable: false };
}

export function sanitizeGoogleAdsReadonlyError(
  error: unknown,
  attempt?: number,
  allowedCustomerId?: string,
): GoogleAdsReadonlyError {
  const classified = classifyGoogleAdsReadonlyError(error);
  const rawMessage =
    error instanceof Error && error.message
      ? error.message
      : "Google Ads read-only adapter failed.";
  const message = redactSecretString(rawMessage)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/(?<!\d)(?:\+?\d[\d\s().-]{7,}\d)(?!\d)/g, REDACTED)
    .replace(/https?:\/\/[^\s,;]+/gi, "[REDACTED_URL]")
    .slice(0, 300);

  return {
    ...classified,
    message: message || "Google Ads read-only adapter failed.",
    attempt,
    customerId: allowedCustomerId,
  };
}
