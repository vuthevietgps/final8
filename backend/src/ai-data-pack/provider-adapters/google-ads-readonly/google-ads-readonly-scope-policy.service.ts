import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  AdAccount,
  AdAccountDocument,
} from "../../../ad-account/schemas/ad-account.schema";
import { GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION } from "../provider-adapter.tokens";
import {
  GoogleAdsReadOnlySyncInput,
  GoogleAdsReadonlyCustomerScope,
  NormalizedGoogleAdsReadOnlySyncInput,
} from "./google-ads-readonly-adapter.types";
import { GoogleAdsReadonlyAdapterError } from "./google-ads-readonly-error.util";
import { GoogleAdsReadonlySyncPolicyService } from "./google-ads-readonly-sync-policy.service";

const FORBIDDEN_INPUT_KEYS = new Set([
  "credential",
  "credentials",
  "clientsecret",
  "refreshtoken",
  "developertoken",
  "accesstoken",
  "authorization",
  "url",
  "origin",
  "path",
  "method",
  "query",
  "gaql",
  "actionplan",
  "mutation",
  "mutationoperation",
  "operations",
]);

@Injectable()
export class GoogleAdsReadonlyScopePolicyService {
  constructor(
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    private readonly syncPolicy: GoogleAdsReadonlySyncPolicyService,
  ) {}

  async validate(
    input: GoogleAdsReadOnlySyncInput,
    now = new Date(),
  ): Promise<NormalizedGoogleAdsReadOnlySyncInput> {
    this.assertNoForbiddenInput(input);
    this.assertText(input?.exportJobId, "exportJobId");
    this.assertText(input?.correlationId, "correlationId");
    this.assertText(input?.policyVersion, "policyVersion");
    if (input?.sourceKey !== "google_ads") {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Read-only adapter sourceKey must be google_ads.",
      );
    }
    if (!["sync_required", "sync_if_stale"].includes(input?.syncPolicy)) {
      throw new GoogleAdsReadonlyAdapterError(
        "policy_denied",
        "Read-only sync policy is not allowed.",
      );
    }
    this.assertText(input?.internalRequester?.id, "internalRequester.id");
    if (!["internal_job", "service"].includes(input?.internalRequester?.type)) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Internal requester type is not allowed.",
      );
    }
    if (
      !input?.internalRequester?.permissions?.includes(
        GOOGLE_ADS_READONLY_SYNC_EXECUTE_PERMISSION,
      )
    ) {
      throw new GoogleAdsReadonlyAdapterError(
        "permission_denied",
        "Internal requester is not permitted to execute read-only sync.",
      );
    }

    const reportDate = this.isoDate(input.reportDate, "reportDate");
    const dateFrom = this.isoDate(input.dateFrom || reportDate, "dateFrom");
    const dateTo = this.isoDate(input.dateTo || reportDate, "dateTo");
    this.assertDateRange(dateFrom, dateTo);
    const customerIds = this.customerIds(input.customerIds);
    const customerScopes = await this.approvedCustomerScopes(customerIds);

    return {
      ...input,
      reportDate,
      dateFrom,
      dateTo,
      customerIds,
      customerScopes,
      effectiveDeadlineAt: this.syncPolicy.effectiveDeadline(
        input.absoluteDeadlineAt,
        now,
      ),
    };
  }

  private assertNoForbiddenInput(value: unknown): void {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalized = key.replace(/[_-]/g, "").toLowerCase();
      if (FORBIDDEN_INPUT_KEYS.has(normalized)) {
        throw new GoogleAdsReadonlyAdapterError(
          "policy_denied",
          "Read-only sync input contains a forbidden field.",
        );
      }
      this.assertNoForbiddenInput(item);
    }
  }

  private customerIds(values: unknown): string[] {
    if (!Array.isArray(values) || !values.length) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "At least one approved customer ID is required.",
      );
    }
    const ids = values.map((value) => String(value || "").trim());
    if (ids.some((value) => !/^\d{10}$/.test(value))) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Customer IDs must be normalized Google Ads IDs.",
      );
    }
    if (new Set(ids).size !== ids.length) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Duplicate customer IDs are not allowed.",
      );
    }
    return ids;
  }

  private async approvedCustomerScopes(
    requestedIds: string[],
  ): Promise<GoogleAdsReadonlyCustomerScope[]> {
    const accounts: any[] = await this.adAccountModel
      .find({ accountType: "google" })
      .select("accountId loginCustomerId isActive")
      .lean();
    const byCustomerId = new Map<string, any>();
    for (const account of accounts) {
      const customerId = String(account.accountId || "").replace(/\D/g, "");
      if (customerId && requestedIds.includes(customerId)) {
        if (byCustomerId.has(customerId)) {
          throw new GoogleAdsReadonlyAdapterError(
            "invalid_scope",
            "Customer scope is ambiguous.",
          );
        }
        byCustomerId.set(customerId, account);
      }
    }

    return requestedIds.map((customerId) => {
      const account = byCustomerId.get(customerId);
      if (!account || account.isActive !== true) {
        throw new GoogleAdsReadonlyAdapterError(
          "invalid_scope",
          "Customer scope is unknown, inactive, or unapproved.",
        );
      }
      const loginCustomerId = account.loginCustomerId
        ? String(account.loginCustomerId).replace(/\D/g, "")
        : undefined;
      if (
        account.loginCustomerId &&
        (!loginCustomerId || !/^\d{10}$/.test(loginCustomerId))
      ) {
        throw new GoogleAdsReadonlyAdapterError(
          "invalid_scope",
          "Login customer scope is malformed or mismatched.",
        );
      }
      return { customerId, loginCustomerId };
    });
  }

  private assertDateRange(dateFrom: string, dateTo: string): void {
    const from = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
    const to = new Date(`${dateTo}T00:00:00.000Z`).getTime();
    if (from > to) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "dateFrom must not be after dateTo.",
      );
    }
    const days = Math.floor((to - from) / 86_400_000) + 1;
    if (days > this.syncPolicy.config.maxRangeDays) {
      throw new GoogleAdsReadonlyAdapterError(
        "policy_denied",
        "Read-only sync date range exceeds policy.",
      );
    }
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        `${field} must use YYYY-MM-DD.`,
      );
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        `${field} is invalid.`,
      );
    }
    return text;
  }

  private assertText(value: unknown, field: string): void {
    if (!String(value || "").trim()) {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        `${field} is required.`,
      );
    }
  }
}
