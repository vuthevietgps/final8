import { createHash, randomUUID } from "crypto";

export interface ExportEndpointRequestContext {
  requestId?: string;
  correlationId?: string;
  routeTemplate: string;
  method: "GET" | "POST";
  ipHash?: string;
  userAgentHash?: string;
}

export function buildExportEndpointRequestContext(
  request: unknown,
  routeTemplate: string,
  method: "GET" | "POST",
): ExportEndpointRequestContext {
  const requestObject = request as
    | {
        id?: unknown;
        ip?: unknown;
        ips?: unknown[];
        headers?: Record<string, unknown>;
        socket?: { remoteAddress?: unknown };
        connection?: { remoteAddress?: unknown };
        get?: (name: string) => unknown;
      }
    | undefined;

  const requestId =
    safeHeader(header(requestObject, "x-request-id")) ||
    safeHeader(requestObject?.id) ||
    `adp-${randomUUID()}`;
  const correlationId =
    safeHeader(header(requestObject, "x-correlation-id")) || requestId;
  const rawIp =
    firstForwardedIp(header(requestObject, "x-forwarded-for")) ||
    header(requestObject, "x-real-ip") ||
    requestObject?.ip ||
    firstArrayValue(requestObject?.ips) ||
    requestObject?.socket?.remoteAddress ||
    requestObject?.connection?.remoteAddress;
  const rawUserAgent = header(requestObject, "user-agent");

  return {
    requestId,
    correlationId,
    routeTemplate,
    method,
    ...(rawIp ? { ipHash: hashTransportValue(rawIp) } : {}),
    ...(rawUserAgent ? { userAgentHash: hashTransportValue(rawUserAgent) } : {}),
  };
}

export function hashTransportValue(value: unknown): string {
  return createHash("sha256")
    .update(String(value || "").slice(0, 1024))
    .digest("hex");
}

function header(
  request:
    | {
        headers?: Record<string, unknown>;
        get?: (name: string) => unknown;
      }
    | undefined,
  name: string,
): unknown {
  const direct = request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()];
  if (direct !== undefined) return direct;
  try {
    return request?.get?.(name);
  } catch {
    return undefined;
  }
}

function safeHeader(value: unknown): string | undefined {
  const text = firstArrayValue(value);
  if (!text) return undefined;
  const normalized = String(text).trim();
  return /^[a-zA-Z0-9._:@/-]{1,128}$/.test(normalized)
    ? normalized
    : undefined;
}

function firstArrayValue(value: unknown): string | undefined {
  const selected = Array.isArray(value) ? value[0] : value;
  const text = String(selected || "").trim();
  return text || undefined;
}

function firstForwardedIp(value: unknown): string | undefined {
  const text = firstArrayValue(value);
  if (!text) return undefined;
  return text.split(",")[0]?.trim() || undefined;
}
