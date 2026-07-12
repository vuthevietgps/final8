import { Inject, Injectable, Optional } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { GOOGLE_ADS_READONLY_POLICY_CONFIG } from "../provider-adapter.tokens";
import {
  GoogleAdsReadonlyAdapterPolicyConfig,
  GoogleAdsReadonlyLockDescriptor,
  NormalizedGoogleAdsReadOnlySyncInput,
} from "./google-ads-readonly-adapter.types";
import {
  GoogleAdsReadonlyAdapterError,
  classifyGoogleAdsReadonlyError,
} from "./google-ads-readonly-error.util";

export const DEFAULT_GOOGLE_ADS_READONLY_POLICY: GoogleAdsReadonlyAdapterPolicyConfig =
  Object.freeze({
    connectionTimeoutMs: 5_000,
    requestTimeoutMs: 30_000,
    totalDeadlineMs: 180_000,
    maxRetriesAfterFirstAttempt: 2,
    maxRangeDays: 31,
    maxConcurrentCustomers: 2,
    retryBaseDelayMs: 250,
    lockTtlMs: 210_000,
  });

@Injectable()
export class GoogleAdsReadonlySyncPolicyService {
  readonly config: GoogleAdsReadonlyAdapterPolicyConfig;

  constructor(
    @Optional()
    @Inject(GOOGLE_ADS_READONLY_POLICY_CONFIG)
    configured?: Partial<GoogleAdsReadonlyAdapterPolicyConfig>,
  ) {
    this.config = {
      ...DEFAULT_GOOGLE_ADS_READONLY_POLICY,
      ...(configured || {}),
    };
    if (this.config.lockTtlMs <= this.config.totalDeadlineMs) {
      throw new Error(
        "Google Ads read-only lock TTL must exceed total deadline.",
      );
    }
  }

  effectiveDeadline(absoluteDeadlineAt: string, now = new Date()): string {
    const requested = new Date(absoluteDeadlineAt);
    if (
      Number.isNaN(requested.getTime()) ||
      requested.getTime() <= now.getTime()
    ) {
      throw new GoogleAdsReadonlyAdapterError(
        "policy_denied",
        "Read-only sync deadline is invalid or expired.",
      );
    }
    return new Date(
      Math.min(
        requested.getTime(),
        now.getTime() + this.config.totalDeadlineMs,
      ),
    ).toISOString();
  }

  buildLockDescriptor(
    input: Pick<
      NormalizedGoogleAdsReadOnlySyncInput,
      "customerIds" | "dateFrom" | "dateTo" | "exportJobId"
    >,
  ): GoogleAdsReadonlyLockDescriptor {
    const scopeHash = createHash("sha256")
      .update(
        JSON.stringify({
          customerIds: [...input.customerIds].sort(),
          dateFrom: input.dateFrom,
          dateTo: input.dateTo,
        }),
      )
      .digest("hex");
    return {
      key: `google_ads:${scopeHash}:${input.dateFrom}:${input.dateTo}`,
      owner: `${input.exportJobId}:${randomUUID()}`,
      ttlMs: this.config.lockTtlMs,
      scopeHash,
      exportJobId: input.exportJobId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    };
  }

  async executeWithRetry<T>(
    operation: (attempt: number) => Promise<T>,
    effectiveDeadlineAt: string,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now: () => number = () => Date.now(),
  ): Promise<{
    value: T;
    attemptCount: number;
    retryClassifications: string[];
  }> {
    const deadline = new Date(effectiveDeadlineAt).getTime();
    const maxAttempts = 1 + this.config.maxRetriesAfterFirstAttempt;
    const retryClassifications: string[] = [];
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (now() >= deadline) {
        throw new GoogleAdsReadonlyAdapterError(
          "provider_timeout",
          "Read-only sync total deadline exceeded.",
          false,
        );
      }
      try {
        return {
          value: await operation(attempt),
          attemptCount: attempt,
          retryClassifications,
        };
      } catch (error) {
        lastError = error;
        const classification = classifyGoogleAdsReadonlyError(error);
        if (!classification.retryable || attempt >= maxAttempts) throw error;
        retryClassifications.push(classification.category);
        const delay = this.config.retryBaseDelayMs * 2 ** (attempt - 1);
        if (now() + delay >= deadline) {
          throw new GoogleAdsReadonlyAdapterError(
            "provider_timeout",
            "Read-only sync retry would exceed total deadline.",
            false,
          );
        }
        await sleep(delay);
      }
    }
    throw lastError;
  }
}
