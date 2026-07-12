import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { randomUUID } from "crypto";
import { Model } from "mongoose";
import type {
  GoogleAdsReadonlyAuditInput,
  GoogleAdsReadonlyAuditPort,
} from "../provider-adapters/google-ads-readonly/google-ads-readonly-adapter.types";
import { sanitizeGoogleAdsReadonlyError } from "../provider-adapters/google-ads-readonly/google-ads-readonly-error.util";
import {
  AiDataPackSourceSyncAudit,
  AiDataPackSourceSyncAuditDocument,
} from "./source-sync-audit.schema";

@Injectable()
export class SourceSyncAuditService implements GoogleAdsReadonlyAuditPort {
  constructor(
    @InjectModel(AiDataPackSourceSyncAudit.name)
    private readonly auditModel: Model<AiDataPackSourceSyncAuditDocument>,
  ) {}

  async persist(
    input: GoogleAdsReadonlyAuditInput,
  ): Promise<{ auditId: string }> {
    const auditId = `ADPSSA-${randomUUID()}`;
    const customerIds = input.result.selectedCustomerIds
      .filter((customerId) => /^\d{10}$/.test(customerId))
      .slice(0, 1_000);
    const sanitizedErrors = input.result.errors.slice(0, 100).map((error) => {
      const sanitized = sanitizeGoogleAdsReadonlyError(
        new Error(error.message),
        error.attempt,
        customerIds.includes(error.customerId || "")
          ? error.customerId
          : undefined,
      );
      return {
        category: error.category || sanitized.category,
        message: sanitized.message,
        retryable: Boolean(error.retryable),
        customerId: sanitized.customerId,
        step: String(error.step || "").slice(0, 80) || undefined,
      };
    });

    await this.auditModel.create({
      auditId,
      exportJobId: input.result.exportJobId,
      correlationId: input.result.correlationId,
      sourceKey: "google_ads",
      policyVersion: input.result.policyVersion,
      scopeHash: input.result.lock.scopeHash,
      customerIds,
      dateFrom: input.result.dateFrom,
      dateTo: input.result.dateTo,
      lockKey: input.result.lock.key,
      lockOwner: input.result.lock.owner,
      lockAcquired: input.result.lock.acquired,
      attempts: input.result.attemptCount,
      retryClassifications: [...new Set(input.result.retryClassifications)],
      writeTelemetrySummary: input.result.writeTelemetrySummary
        ? {
            operationCount: input.result.writeTelemetrySummary.operationCount,
            recordCount: input.result.writeTelemetrySummary.recordCount,
            targets: [...input.result.writeTelemetrySummary.targets].slice(
              0,
              100,
            ),
            operations: { ...input.result.writeTelemetrySummary.operations },
          }
        : undefined,
      providerSyncAttempted: input.result.providerSyncAttempted,
      mutationAttempted: false,
      status: input.result.status,
      perAccountStatus: customerIds.map((customerId) => ({
        customerId,
        status: input.result.errors.some(
          (error) => error.customerId === customerId,
        )
          ? "error"
          : input.result.status,
      })),
      preAssessmentRef: input.preAssessmentRef,
      postAssessmentRef: input.postAssessmentRef,
      sanitizedErrors,
      startedAt: new Date(input.result.startedAt),
      completedAt: new Date(input.result.completedAt),
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    });
    return { auditId };
  }
}
