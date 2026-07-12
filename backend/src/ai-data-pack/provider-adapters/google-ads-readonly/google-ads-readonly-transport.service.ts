import { Inject, Injectable } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";
import { ApiTokenService } from "../../../api-token/api-token.service";
import {
  GOOGLE_ADS_READONLY_HTTP_CLIENT,
  GOOGLE_ADS_READONLY_POLICY_CONFIG,
} from "../provider-adapter.tokens";
import { GoogleAdsReadonlyAdapterPolicyConfig } from "./google-ads-readonly-adapter.types";
import {
  GoogleAdsReadonlyAdapterError,
  sanitizeGoogleAdsReadonlyError,
} from "./google-ads-readonly-error.util";
import {
  GoogleAdsReadonlyQueryTemplateId,
  buildGoogleAdsReadonlyQuery,
} from "./google-ads-readonly-query-templates";
import { DEFAULT_GOOGLE_ADS_READONLY_POLICY } from "./google-ads-readonly-sync-policy.service";
import {
  GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST,
  assertGoogleAdsReadonlyTransport,
} from "./google-ads-readonly-transport-allowlist";

export interface GoogleAdsReadonlyTransportInput {
  customerId: string;
  loginCustomerId?: string;
  credentialReferenceId?: string;
  allowedCustomerIds: readonly string[];
  templateId: GoogleAdsReadonlyQueryTemplateId;
  dateFrom?: string;
  dateTo?: string;
  absoluteDeadlineAt: string;
}

@Injectable()
export class GoogleAdsReadonlyTransportService {
  constructor(
    @Inject(GOOGLE_ADS_READONLY_HTTP_CLIENT)
    private readonly http: AxiosInstance,
    @Inject(GOOGLE_ADS_READONLY_POLICY_CONFIG)
    private readonly policy: GoogleAdsReadonlyAdapterPolicyConfig,
    private readonly apiTokenService: ApiTokenService,
  ) {}

  async searchStream(input: GoogleAdsReadonlyTransportInput): Promise<any[]> {
    this.assertNoCallerTransport(input);
    if (!input.allowedCustomerIds.includes(input.customerId)) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Provider customer scope is not allowed.",
      );
    }
    let query: string;
    try {
      query = buildGoogleAdsReadonlyQuery(input);
    } catch (error) {
      const sanitized = sanitizeGoogleAdsReadonlyError(error);
      throw new GoogleAdsReadonlyAdapterError(
        "provider_query_invalid",
        sanitized.message,
        false,
      );
    }
    const config = await this.apiTokenService.getGoogleAdsRuntimeConfig({
      customerId: input.customerId,
      loginCustomerId: input.loginCustomerId || "",
      credentialReferenceId: input.credentialReferenceId,
    });
    const apiVersion = String(config.apiVersion || "");
    if (!/^v\d+$/.test(apiVersion)) {
      throw new GoogleAdsReadonlyAdapterError(
        "provider_version_unsupported",
        "Google Ads API version is not allowed.",
      );
    }
    const configuredLoginCustomerId = this.normalizedId(config.loginCustomerId);
    if (
      configuredLoginCustomerId &&
      configuredLoginCustomerId !== this.normalizedId(input.loginCustomerId)
    ) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Login customer scope does not match runtime configuration.",
      );
    }
    if (!config.developerToken || !config.refreshToken) {
      throw new GoogleAdsReadonlyAdapterError(
        "not_configured",
        "Google Ads read-only credentials are not configured.",
      );
    }
    const accessToken =
      await this.apiTokenService.getGoogleAdsAccessToken(config);
    if (!accessToken) {
      throw new GoogleAdsReadonlyAdapterError(
        "auth_failed",
        "Google Ads access token is unavailable.",
      );
    }

    const path = `/${apiVersion}/customers/${input.customerId}/googleAds:searchStream`;
    assertGoogleAdsReadonlyTransport(
      {
        origin: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
        method: "POST",
        path,
        querySource: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.querySource,
      },
      input.allowedCustomerIds,
    );
    const remaining = new Date(input.absoluteDeadlineAt).getTime() - Date.now();
    const timeout = Math.min(this.policy.requestTimeoutMs, remaining);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new GoogleAdsReadonlyAdapterError(
        "provider_timeout",
        "Read-only transport deadline expired.",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.http.request({
        baseURL: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
        url: path,
        method: "POST",
        data: { query },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": config.developerToken,
          "Content-Type": "application/json",
          ...(configuredLoginCustomerId
            ? { "login-customer-id": configuredLoginCustomerId }
            : {}),
        },
        timeout,
        signal: controller.signal,
      });
      const streams = Array.isArray(response.data) ? response.data : [];
      return streams.flatMap((stream: any) =>
        Array.isArray(stream?.results) ? stream.results : [],
      );
    } catch (error) {
      const sanitized = sanitizeGoogleAdsReadonlyError(error);
      throw new GoogleAdsReadonlyAdapterError(
        sanitized.category,
        sanitized.message,
        sanitized.retryable,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private assertNoCallerTransport(input: unknown): void {
    const forbidden = new Set([
      "url",
      "origin",
      "path",
      "method",
      "query",
      "gaql",
      "headers",
      "credential",
      "credentials",
      "accesstoken",
      "refreshtoken",
      "developertoken",
      "validateonly",
      "mutation",
      "operations",
    ]);
    for (const key of Object.keys((input || {}) as Record<string, unknown>)) {
      if (forbidden.has(key.replace(/[_-]/g, "").toLowerCase())) {
        throw new GoogleAdsReadonlyAdapterError(
          "policy_denied",
          "Caller-supplied provider transport is forbidden.",
        );
      }
    }
  }

  private normalizedId(value: unknown): string {
    return String(value || "").replace(/\D/g, "");
  }
}

export function createDefaultGoogleAdsReadonlyTransportService(
  apiTokenService: ApiTokenService,
): GoogleAdsReadonlyTransportService {
  return new GoogleAdsReadonlyTransportService(
    axios.create({
      baseURL: GOOGLE_ADS_READONLY_TRANSPORT_ALLOWLIST.origin,
      timeout: DEFAULT_GOOGLE_ADS_READONLY_POLICY.requestTimeoutMs,
    }),
    DEFAULT_GOOGLE_ADS_READONLY_POLICY,
    apiTokenService,
  );
}
