import { Inject, Injectable } from "@nestjs/common";
import {
  AiDataPackProviderReadOnlyAdapter,
  ProviderReadOnlyAssessmentInput,
  SourceCoverageAssessment,
  SourceFreshnessAssessment,
} from "../provider-readonly-adapter.types";
import {
  GOOGLE_ADS_READONLY_AUDIT_PORT,
  GOOGLE_ADS_READONLY_ASSESSMENT_PORT,
  GOOGLE_ADS_READONLY_DISTRIBUTED_LOCK_PORT,
  GOOGLE_ADS_READONLY_SYNC_PORT,
} from "../provider-adapter.tokens";
import {
  GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST,
  assertGoogleAdsReadonlyLocalWriteTarget,
} from "./google-ads-readonly-local-write-allowlist";
import {
  GoogleAdsReadOnlySyncInput,
  GoogleAdsReadonlyAssessmentPort,
  GoogleAdsReadonlyAuditPort,
  GoogleAdsReadonlyDistributedLockPort,
  GoogleAdsReadonlySyncPort,
  ProviderReadOnlySyncResult,
} from "./google-ads-readonly-adapter.types";
import {
  GoogleAdsReadonlyAdapterError,
  sanitizeGoogleAdsReadonlyError,
} from "./google-ads-readonly-error.util";
import { GoogleAdsReadonlyScopePolicyService } from "./google-ads-readonly-scope-policy.service";
import { GoogleAdsReadonlySyncPolicyService } from "./google-ads-readonly-sync-policy.service";
import {
  GoogleAdsReadonlyWriteTelemetrySummary,
  summarizeGoogleAdsReadonlyWriteTelemetry,
} from "./google-ads-readonly-write-telemetry";

@Injectable()
export class GoogleAdsReadonlyAdapterService implements AiDataPackProviderReadOnlyAdapter<
  GoogleAdsReadOnlySyncInput,
  ProviderReadOnlySyncResult
> {
  readonly sourceKey = "google_ads" as const;
  readonly mode = "read_only" as const;
  readonly supportsSourceRegistry = true as const;

  constructor(
    @Inject(GOOGLE_ADS_READONLY_SYNC_PORT)
    private readonly syncPort: GoogleAdsReadonlySyncPort,
    private readonly scopePolicy: GoogleAdsReadonlyScopePolicyService,
    private readonly syncPolicy: GoogleAdsReadonlySyncPolicyService,
    @Inject(GOOGLE_ADS_READONLY_ASSESSMENT_PORT)
    private readonly assessmentPort: GoogleAdsReadonlyAssessmentPort,
    @Inject(GOOGLE_ADS_READONLY_DISTRIBUTED_LOCK_PORT)
    private readonly lockPort: GoogleAdsReadonlyDistributedLockPort,
    @Inject(GOOGLE_ADS_READONLY_AUDIT_PORT)
    private readonly auditPort: GoogleAdsReadonlyAuditPort,
  ) {
    for (const target of GOOGLE_ADS_READONLY_LOCAL_WRITE_ALLOWLIST) {
      assertGoogleAdsReadonlyLocalWriteTarget(target);
    }
  }

  async assessLocalFreshness(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceFreshnessAssessment> {
    return this.assess(input);
  }

  async assessCoverage(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceCoverageAssessment> {
    return this.assess(input);
  }

  async syncReadOnly(
    input: GoogleAdsReadOnlySyncInput,
  ): Promise<ProviderReadOnlySyncResult> {
    const started = new Date();
    let normalized: Awaited<
      ReturnType<GoogleAdsReadonlyScopePolicyService["validate"]>
    >;
    try {
      normalized = await this.scopePolicy.validate(input, started);
    } catch (error) {
      const sanitized = sanitizeGoogleAdsReadonlyError(error);
      throw new GoogleAdsReadonlyAdapterError(
        sanitized.category,
        sanitized.message,
        false,
      );
    }

    let preSyncAssessment: SourceFreshnessAssessment | undefined;
    if (normalized.syncPolicy === "sync_if_stale") {
      preSyncAssessment = await this.assess({
        sourceKey: "google_ads",
        reportDate: normalized.reportDate,
        now: started,
      });
      if (
        preSyncAssessment.freshnessStatus === "fresh" &&
        ["covered", "not_applicable"].includes(preSyncAssessment.coverageStatus)
      ) {
        return this.persistResult(
          this.result({
            input: normalized,
            started,
            status: "skipped_fresh_enough",
            providerSyncAttempted: false,
            attemptCount: 0,
            retryClassifications: [],
            counts: {},
            errors: [],
            warnings: [],
            lockAcquired: false,
            localWriteTargets: ["ai_data_pack_source_sync_audits"],
            postSyncAssessment: preSyncAssessment,
          }),
          preSyncAssessment,
        );
      }
    }

    const descriptor = this.syncPolicy.buildLockDescriptor(normalized);
    if (!this.lockPort || this.lockPort.runtime !== "implemented_mongo") {
      throw new GoogleAdsReadonlyAdapterError(
        "lock_unavailable",
        "Mongo distributed lock runtime is not configured.",
      );
    }
    let lease;
    try {
      lease = await this.lockPort.acquire(descriptor);
    } catch (error) {
      const sanitized = sanitizeGoogleAdsReadonlyError(error);
      throw new GoogleAdsReadonlyAdapterError(
        "lock_unavailable",
        sanitized.message,
      );
    }
    if (!lease.acquired || !lease.ownerToken) {
      return this.persistResult(
        this.result({
          input: normalized,
          started,
          status: "skipped_locked",
          providerSyncAttempted: false,
          attemptCount: 0,
          retryClassifications: [],
          counts: {},
          errors: [],
          warnings: ["equivalent_sync_lock_not_acquired"],
          lockAcquired: false,
          lockDescriptor: descriptor,
          reusedSyncRunId: lease.reusedSyncRunId,
          localWriteTargets: ["ai_data_pack_source_sync_audits"],
        }),
        preSyncAssessment,
      );
    }

    let providerSyncAttempted = false;
    let attemptCount = 0;
    try {
      const executed = await this.syncPolicy.executeWithRetry(
        async (attempt) => {
          providerSyncAttempted = true;
          attemptCount = attempt;
          return this.syncPort.sync({
            customerIds: normalized.customerIds,
            dateFrom: normalized.dateFrom,
            dateTo: normalized.dateTo,
            absoluteDeadlineAt: normalized.effectiveDeadlineAt,
          });
        },
        normalized.effectiveDeadlineAt,
      );
      const sync = executed.value;
      const writeTelemetrySummary = this.validatedWriteTelemetry(
        sync.writeTelemetry,
      );
      const postSyncAssessment = this.assessmentPort
        ? await this.assess({
            sourceKey: "google_ads",
            reportDate: normalized.reportDate,
          })
        : undefined;
      return await this.persistResult(
        this.result({
          input: normalized,
          started,
          status: sync.status,
          providerSyncAttempted,
          attemptCount: executed.attemptCount,
          retryClassifications: executed.retryClassifications,
          syncRunId: sync.runId,
          counts: sync.counts,
          errors: sync.errors.map((error) => ({
            ...sanitizeGoogleAdsReadonlyError(
              new Error(error.message),
              executed.attemptCount,
              normalized.customerIds.includes(error.customerId || "")
                ? error.customerId
                : undefined,
            ),
            step: error.step,
          })),
          warnings: [],
          lockAcquired: true,
          lockDescriptor: descriptor,
          localWriteTargets: [
            ...writeTelemetrySummary.targets,
            "ai_data_pack_source_sync_audits",
          ],
          writeTelemetrySummary,
          postSyncAssessment,
        }),
        preSyncAssessment,
      );
    } catch (error) {
      return await this.persistResult(
        this.result({
          input: normalized,
          started,
          status: "failed",
          providerSyncAttempted,
          attemptCount,
          retryClassifications: [],
          counts: {},
          errors: [sanitizeGoogleAdsReadonlyError(error)],
          warnings: [],
          lockAcquired: true,
          lockDescriptor: descriptor,
          localWriteTargets: ["ai_data_pack_source_sync_audits"],
        }),
        preSyncAssessment,
      );
    } finally {
      try {
        await this.lockPort.release({
          key: descriptor.key,
          owner: descriptor.owner,
          ownerToken: lease.ownerToken,
        });
      } catch (error) {
        const sanitized = sanitizeGoogleAdsReadonlyError(error);
        throw new GoogleAdsReadonlyAdapterError(
          "lock_unavailable",
          sanitized.message,
        );
      }
    }
  }

  private async assess(
    input: ProviderReadOnlyAssessmentInput,
  ): Promise<SourceFreshnessAssessment> {
    if (input.sourceKey !== "google_ads") {
      throw new GoogleAdsReadonlyAdapterError(
        "invalid_scope",
        "Assessment sourceKey must be google_ads.",
      );
    }
    if (!this.assessmentPort) {
      throw new GoogleAdsReadonlyAdapterError(
        "not_configured",
        "DB-only assessment port is not configured.",
      );
    }
    let result;
    try {
      result = await this.assessmentPort.assess({
        reportDate: input.reportDate,
        sourceKeys: ["google_ads"],
        now: input.now,
      });
    } catch (error) {
      const sanitized = sanitizeGoogleAdsReadonlyError(error);
      throw new GoogleAdsReadonlyAdapterError(
        sanitized.category,
        sanitized.message,
      );
    }
    const assessment = result.assessments.find(
      (candidate) => candidate.sourceKey === "google_ads",
    );
    if (!assessment) {
      throw new GoogleAdsReadonlyAdapterError(
        "not_configured",
        "Google Ads DB-only assessment is unavailable.",
      );
    }
    return assessment;
  }

  private result(input: {
    input: Awaited<ReturnType<GoogleAdsReadonlyScopePolicyService["validate"]>>;
    started: Date;
    status: ProviderReadOnlySyncResult["status"];
    providerSyncAttempted: boolean;
    attemptCount: number;
    retryClassifications: string[];
    syncRunId?: string;
    counts: Record<string, number>;
    errors: ProviderReadOnlySyncResult["errors"];
    warnings: string[];
    lockAcquired: boolean;
    localWriteTargets: readonly string[];
    writeTelemetrySummary?: GoogleAdsReadonlyWriteTelemetrySummary;
    lockDescriptor?: ReturnType<
      GoogleAdsReadonlySyncPolicyService["buildLockDescriptor"]
    >;
    reusedSyncRunId?: string;
    postSyncAssessment?: ProviderReadOnlySyncResult["postSyncAssessment"];
  }): ProviderReadOnlySyncResult {
    const completed = new Date();
    const lockDescriptor =
      input.lockDescriptor || this.syncPolicy.buildLockDescriptor(input.input);
    return {
      sourceKey: "google_ads",
      mode: "read_only",
      exportJobId: input.input.exportJobId,
      correlationId: input.input.correlationId,
      policyVersion: input.input.policyVersion,
      status: input.status,
      providerSyncAttempted: input.providerSyncAttempted,
      mutationAttempted: false,
      syncRunId: input.syncRunId,
      requestedCustomerIds: [...input.input.customerIds],
      selectedCustomerIds: [...input.input.customerIds],
      dateFrom: input.input.dateFrom,
      dateTo: input.input.dateTo,
      startedAt: input.started.toISOString(),
      completedAt: completed.toISOString(),
      durationMs: Math.max(0, completed.getTime() - input.started.getTime()),
      attemptCount: input.attemptCount,
      retryClassifications: [...input.retryClassifications],
      counts: { ...input.counts },
      localWriteTargets: [...input.localWriteTargets],
      writeTelemetrySummary: input.writeTelemetrySummary,
      lock: {
        distributedLockRuntime: "implemented_mongo",
        key: lockDescriptor.key,
        owner: lockDescriptor.owner,
        scopeHash: lockDescriptor.scopeHash,
        acquired: input.lockAcquired,
        reusedSyncRunId: input.reusedSyncRunId,
      },
      errors: input.errors,
      warnings: input.warnings,
      postSyncAssessment: input.postSyncAssessment,
      canImportActionFile: false,
      canDryRun: false,
      canExecuteLive: false,
    };
  }

  private validatedWriteTelemetry(
    telemetry: Parameters<typeof summarizeGoogleAdsReadonlyWriteTelemetry>[0],
  ): GoogleAdsReadonlyWriteTelemetrySummary {
    try {
      const summary = summarizeGoogleAdsReadonlyWriteTelemetry(telemetry || []);
      for (const target of summary.targets) {
        assertGoogleAdsReadonlyLocalWriteTarget(target);
      }
      return summary;
    } catch {
      throw new GoogleAdsReadonlyAdapterError(
        "local_persistence_failed",
        "Read-only sync reported missing or forbidden local write telemetry.",
      );
    }
  }

  private async persistResult(
    result: ProviderReadOnlySyncResult,
    preAssessment?: SourceFreshnessAssessment,
  ): Promise<ProviderReadOnlySyncResult> {
    if (!this.auditPort) {
      throw new GoogleAdsReadonlyAdapterError(
        "local_persistence_failed",
        "Source sync audit persistence is not configured.",
      );
    }
    await this.auditPort.persist({
      result,
      preAssessmentRef: this.assessmentRef(preAssessment),
      postAssessmentRef: this.assessmentRef(result.postSyncAssessment),
    });
    return result;
  }

  private assessmentRef(
    assessment: SourceFreshnessAssessment | undefined,
  ): string | undefined {
    return assessment
      ? `${assessment.sourceKey}:${assessment.freshnessStatus}:${assessment.coverageStatus}`
      : undefined;
  }
}
