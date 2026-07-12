import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { RequirePermissions } from "../auth/decorators/auth.decorator";
import { JwtAuthGuard, RolesGuard } from "../auth/guards/auth.guard";
import { SecretRedactionInterceptor } from "../common/interceptors/secret-redaction.interceptor";
import { AdsAutomationDecisionDraftApprovalDecisionMutationService } from "./ads-automation-decision-draft-approval-decision-mutation.service";
import { AdsAutomationDecisionDraftApprovalQueueService } from "./ads-automation-decision-draft-approval-queue.service";
import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationDecisionFoundationReviewExportService } from "./ads-automation-decision-foundation-review-export.service";
import { AdsAutomationDecisionFoundationReviewerDocsService } from "./ads-automation-decision-foundation-reviewer-docs.service";
import { AdsAutomationDecisionFoundationSnapshotService } from "./ads-automation-decision-foundation-snapshot.service";
import { AdsAutomationApiReadinessGapReportService } from "./ads-automation-api-readiness-gap-report.service";
import { AdsAutomationLossLimitPolicyService } from "./ads-automation-loss-limit-policy.service";
import { ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE } from "./ads-automation-loss-limit-policy.fixture";
import { AdsAutomationMonitoringIncidentReadinessService } from "./ads-automation-monitoring-incident-readiness.service";
import { ADS_AUTOMATION_MONITORING_INCIDENT_READINESS_FIXTURE } from "./ads-automation-monitoring-incident-readiness.fixture";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import { ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE } from "./ads-automation-readonly-platform-import-readiness.fixture";
import { AdsAutomationSourceReadinessReviewExportService } from "./ads-automation-source-readiness-review-export.service";
import { ADS_AUTOMATION_SOURCE_READINESS_REVIEW_EXPORT_FIXTURE } from "./ads-automation-source-readiness-review-export.fixture";
import { AdsAutomationErpSourceImportReadinessService } from "./ads-automation-erp-source-import-readiness.service";
import { AdsAutomationApprovalPreflightReviewExportService } from "./ads-automation-approval-preflight-review-export.service";
import { ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE } from "./ads-automation-approval-preflight-review-export.fixture";
import { AdsAutomationProviderAccountReadinessService } from "./ads-automation-provider-account-readiness.service";
import { ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE } from "./ads-automation-provider-account-readiness.fixture";
import { AdsAutomationManagerAccountControlPlaneService } from "./ads-automation-manager-account-control-plane.service";
import { ADS_AUTOMATION_MANAGER_ACCOUNT_CONTROL_PLANE_FIXTURE } from "./ads-automation-manager-account-control-plane.fixture";
import { AdsAutomationFinalGateReviewExportService } from "./ads-automation-final-gate-review-export.service";
import { ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE } from "./ads-automation-final-gate-review-export.fixture";
import { AdsAutomationProductionReadinessBridgeService } from "./ads-automation-production-readiness-bridge.service";
import { ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE } from "./ads-automation-production-readiness-bridge.fixture";
import { AdsAutomationCredentialVaultOnboardingService } from "./ads-automation-credential-vault-onboarding.service";
import { ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE } from "./ads-automation-credential-vault-onboarding.fixture";
import { AdsAutomationSmallCapApprovalPreflightLinkageService } from "./ads-automation-small-cap-approval-preflight-linkage.service";
import { AdsAutomationSmallCapReadinessSimulatorService } from "./ads-automation-small-cap-readiness-simulator.service";
import { ADS_AUTOMATION_SMALL_CAP_READINESS_SIMULATOR_FIXTURE } from "./ads-automation-small-cap-readiness-simulator.fixture";
import { AdsAutomationPlatformSourceSyncStatusService } from "./ads-automation-platform-source-sync-status.service";
import { AdsAutomationApprovalEvidenceIndexService } from "./ads-automation-approval-evidence-index.service";
import { AdsAutomationApprovalEvidenceReviewExportService } from "./ads-automation-approval-evidence-review-export.service";
import { AdsAutomationApprovalEvidenceReviewerDocsService } from "./ads-automation-approval-evidence-reviewer-docs.service";
import { AdsAutomationPolicyDecisionAuditLinkageService } from "./ads-automation-policy-decision-audit-linkage.service";
import { AdsAutomationDecisionMongoReadModelRepository } from "./ads-automation-decision-mongo-read-model.repository";
import { AdsAutomationDecisionReadModelQueryService } from "./ads-automation-decision-read-model-query.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationExecutionPreflightDryRunReadbackService } from "./ads-automation-execution-preflight-dry-run-readback.service";
import { AdsAutomationExecutionPreflightDryRunService } from "./ads-automation-execution-preflight-dry-run.service";
import { AdsAutomationPolicyDecisionEvidenceReadbackService } from "./ads-automation-policy-decision-evidence-readback.service";
import { AdsAutomationValidateOnlyEvidenceReadbackService } from "./ads-automation-validate-only-evidence-readback.service";
import {
  AdsAutomationDecisionSnapshot,
  AdsAutomationDecisionSnapshotInput,
} from "./contracts/ads-automation-decision.contract";
import {
  AdsAutomationDecisionFoundationReadModelReviewExportResponse,
  AdsAutomationDecisionFoundationReadModelReviewerDocsResponse,
  AdsAutomationDecisionFoundationReadModelSnapshotResponse,
  AdsAutomationDecisionFoundationSnapshotInput,
  AdsAutomationDecisionFoundationSnapshotResponse,
} from "./contracts/ads-automation-decision-foundation-snapshot.contract";
import { ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE } from "./ads-automation-decision-foundation-snapshot.fixture";
import {
  AdsAutomationApprovalEvidenceIndexResponse,
  AdsAutomationApprovalEvidenceReviewExportResponse,
  AdsAutomationApprovalEvidenceReviewerDocsResponse,
} from "./contracts/ads-automation-approval-evidence-index.contract";
import {
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewResponse,
  AdsAutomationDecisionDraftApprovalDecisionMutationResponse,
  AdsAutomationDecisionDraftApprovalDecisionValidationResponse,
  AdsAutomationDecisionDraftApprovalImportResponse,
  AdsAutomationDecisionDraftApprovalReadModelResponse,
  AdsAutomationDecisionDraftApprovalReadinessResponse,
  AdsAutomationDecisionDraftApprovalReadRecordResponse,
} from "./contracts/ads-automation-decision-draft-approval.contract";
import { AdsAutomationDecisionDraftPreviewResponse } from "./contracts/ads-automation-decision-draft-preview.contract";
import { AdsAutomationApiReadinessGapReportResponse } from "./contracts/ads-automation-api-readiness-gap-report.contract";
import {
  AdsAutomationLossLimitPolicyInput,
  AdsAutomationLossLimitPolicyResponse,
} from "./contracts/ads-automation-loss-limit-policy.contract";
import { AdsAutomationMonitoringIncidentReadinessResponse } from "./contracts/ads-automation-monitoring-incident-readiness.contract";
import { AdsAutomationReadonlyPlatformImportReadinessResponse } from "./contracts/ads-automation-readonly-platform-import-readiness.contract";
import { AdsAutomationSourceReadinessReviewExportResponse } from "./contracts/ads-automation-source-readiness-review-export.contract";
import { AdsAutomationApprovalPreflightReviewExportResponse } from "./contracts/ads-automation-approval-preflight-review-export.contract";
import { AdsAutomationProviderAccountReadinessResponse } from "./contracts/ads-automation-provider-account-readiness.contract";
import { AdsAutomationManagerAccountControlPlaneResponse } from "./contracts/ads-automation-manager-account-control-plane.contract";
import { AdsAutomationProductionReadinessBridgeResponse } from "./contracts/ads-automation-production-readiness-bridge.contract";
import { AdsAutomationFinalGateReviewExportResponse } from "./contracts/ads-automation-final-gate-review-export.contract";
import { AdsAutomationCredentialVaultOnboardingResponse } from "./contracts/ads-automation-credential-vault-onboarding.contract";
import { AdsAutomationSmallCapApprovalPreflightLinkageResponse } from "./contracts/ads-automation-small-cap-approval-preflight-linkage.contract";
import { AdsAutomationSmallCapReadinessSimulatorResponse } from "./contracts/ads-automation-small-cap-readiness-simulator.contract";
import {
  AdsAutomationDecisionReadModelQuery,
  AdsAutomationDecisionReadModelSnapshotResponse,
} from "./contracts/ads-automation-decision-read-model-query.contract";
import {
  AdsAutomationPlatformSourceSyncStatusResponse,
  AdsAutomationPlatformSourceSyncStatusSourceKey,
} from "./contracts/ads-automation-platform-source-sync-status.contract";
import {
  AdsAutomationExecutionPreflightDryRunResponse,
  AdsAutomationExecutionPreflightRecordHistoryResponse,
  AdsAutomationExecutionPreflightRecordReadbackResponse,
} from "./contracts/ads-automation-execution-preflight-dry-run.contract";
import {
  AdsAutomationPolicyDecisionEvidenceHistoryResponse,
  AdsAutomationPolicyDecisionEvidenceReadbackResponse,
} from "./contracts/ads-automation-policy-decision-evidence.contract";
import { AdsAutomationPolicyDecisionAuditLinkageResponse } from "./contracts/ads-automation-policy-decision-audit-linkage.contract";
import {
  AdsAutomationValidateOnlyEvidenceHistoryResponse,
  AdsAutomationValidateOnlyEvidenceReadbackResponse,
} from "./contracts/ads-automation-validate-only-evidence.contract";
import { AdsAutomationDecisionSourceKey } from "./contracts/ads-automation-decision-source-adapter.contract";
import { DataQualityReportService } from "./data-quality-report.service";
import { DecisionHistoryExportService } from "./decision-history-export.service";
import { DirectorDataPackService } from "./director-data-pack.service";
import { JsonExporterService } from "./export/json-exporter.service";
import { XlsxExporterService } from "./export/xlsx-exporter.service";
import { MappingReportService } from "./mapping-report.service";
import { MarketerDataPackService } from "./marketer-data-pack.service";
import { SourceSyncOrchestratorService } from "./source-sync/source-sync-orchestrator.service";
import type { SourceSyncPreparationResult } from "./source-sync/source-sync-result.types";

@Controller("ai")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(SecretRedactionInterceptor)
export class AiDataPackController {
  constructor(
    private readonly adsAutomationDecision: AdsAutomationDecisionService,
    private readonly adsAutomationDecisionFoundationSnapshot: AdsAutomationDecisionFoundationSnapshotService,
    private readonly adsAutomationDecisionFoundationReviewExport: AdsAutomationDecisionFoundationReviewExportService,
    private readonly adsAutomationDecisionFoundationReviewerDocs: AdsAutomationDecisionFoundationReviewerDocsService,
    private readonly adsAutomationApiReadinessGapReport: AdsAutomationApiReadinessGapReportService,
    private readonly adsAutomationLossLimitPolicy: AdsAutomationLossLimitPolicyService,
    private readonly adsAutomationMonitoringIncidentReadiness: AdsAutomationMonitoringIncidentReadinessService,
    private readonly readonlyPlatformImportReadiness: AdsAutomationReadonlyPlatformImportReadinessService,
    private readonly sourceReadinessReviewExport: AdsAutomationSourceReadinessReviewExportService,
    private readonly erpSourceImportReadiness: AdsAutomationErpSourceImportReadinessService,
    private readonly approvalPreflightReviewExport: AdsAutomationApprovalPreflightReviewExportService,
    private readonly providerAccountReadiness: AdsAutomationProviderAccountReadinessService,
    private readonly managerAccountControlPlane: AdsAutomationManagerAccountControlPlaneService,
    private readonly finalGateReviewExport: AdsAutomationFinalGateReviewExportService,
    private readonly productionReadinessBridge: AdsAutomationProductionReadinessBridgeService,
    private readonly credentialVaultOnboarding: AdsAutomationCredentialVaultOnboardingService,
    private readonly smallCapApprovalPreflightLinkage: AdsAutomationSmallCapApprovalPreflightLinkageService,
    private readonly smallCapReadinessSimulator: AdsAutomationSmallCapReadinessSimulatorService,
    private readonly adsAutomationDraftPreview: AdsAutomationDecisionDraftPreviewService,
    private readonly adsAutomationDraftApprovalQueue: AdsAutomationDecisionDraftApprovalQueueService,
    private readonly adsAutomationDraftApprovalDecisionMutation: AdsAutomationDecisionDraftApprovalDecisionMutationService,
    private readonly adsAutomationApprovalEvidenceIndex: AdsAutomationApprovalEvidenceIndexService,
    private readonly adsAutomationApprovalEvidenceReviewExport: AdsAutomationApprovalEvidenceReviewExportService,
    private readonly adsAutomationApprovalEvidenceReviewerDocs: AdsAutomationApprovalEvidenceReviewerDocsService,
    private readonly adsAutomationPolicyDecisionAuditLinkage: AdsAutomationPolicyDecisionAuditLinkageService,
    private readonly adsAutomationExecutionPreflightDryRun: AdsAutomationExecutionPreflightDryRunService,
    private readonly adsAutomationExecutionPreflightReadback: AdsAutomationExecutionPreflightDryRunReadbackService,
    private readonly adsAutomationPolicyDecisionEvidenceReadback: AdsAutomationPolicyDecisionEvidenceReadbackService,
    private readonly adsAutomationValidateOnlyEvidenceReadback: AdsAutomationValidateOnlyEvidenceReadbackService,
    private readonly adsAutomationReadModelRepository: AdsAutomationDecisionMongoReadModelRepository,
    private readonly adsAutomationReadModelQuery: AdsAutomationDecisionReadModelQueryService,
    private readonly platformSourceSyncStatus: AdsAutomationPlatformSourceSyncStatusService,
    private readonly sourceSyncOrchestrator: SourceSyncOrchestratorService,
    private readonly director: DirectorDataPackService,
    private readonly marketer: MarketerDataPackService,
    private readonly quality: DataQualityReportService,
    private readonly mapping: MappingReportService,
    private readonly history: DecisionHistoryExportService,
    private readonly json: JsonExporterService,
    private readonly xlsx: XlsxExporterService,
  ) {}

  @Get("director/data-pack")
  @RequirePermissions("ai-data-pack.director.read")
  async directorPack(
    @CurrentUser() user: any,
    @Query("date") date: string,
    @Query("format") format: string,
    @Res() response: Response,
  ) {
    const normalized = this.format(format);
    return this.send(
      response,
      await this.director.build(this.date(date), normalized, user),
      normalized,
      `director-data-pack-${date}`,
      true,
    );
  }

  @Get("marketer/data-pack")
  @RequirePermissions("ai-data-pack.marketer.read")
  async marketerPack(
    @CurrentUser() user: any,
    @Query("date") date: string,
    @Query("format") format: string,
    @Res() response: Response,
  ) {
    const normalized = this.format(format);
    return this.send(
      response,
      await this.marketer.build(this.date(date), normalized, user),
      normalized,
      `marketer-data-pack-${date}`,
      true,
    );
  }

  @Get("data-quality/report")
  @RequirePermissions("ai-data-pack.quality.read")
  async qualityReport(
    @CurrentUser() user: any,
    @Query("date") date: string,
    @Query("format") format: string,
    @Res() response: Response,
  ) {
    const normalized = this.format(format);
    return this.send(
      response,
      await this.quality.build(this.date(date), normalized, user),
      normalized,
      `data-quality-${date}`,
    );
  }

  @Get("mapping/report")
  @RequirePermissions("ai-data-pack.mapping.read")
  async mappingReport(
    @CurrentUser() user: any,
    @Query("date") date: string,
    @Query("format") format: string,
    @Res() response: Response,
  ) {
    const normalized = this.format(format);
    return this.send(
      response,
      await this.mapping.build(this.date(date), normalized, user),
      normalized,
      `mapping-report-${date}`,
    );
  }

  @Get("decision-history")
  @RequirePermissions("ai-data-pack.director.read")
  async decisionHistory(
    @CurrentUser() user: any,
    @Query("from") from: string,
    @Query("to") to: string,
    @Query("format") format: string,
    @Res() response: Response,
  ) {
    const normalized = this.format(format);
    const result = await this.history.build(
      this.date(from),
      this.date(to),
      normalized,
      user,
    );
    return this.send(
      response,
      result,
      normalized,
      `decision-history-${from}-${to}`,
    );
  }

  @Post("ads-automation/decision-snapshot")
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationDecisionSnapshot(
    @Body() input: AdsAutomationDecisionSnapshotInput = {},
  ) {
    return this.adsAutomationDecision.build(input || {});
  }

  @Post("ads-automation/decision-foundation-snapshot")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationDecisionFoundation(
    @Body() input: AdsAutomationDecisionFoundationSnapshotInput = {},
  ): AdsAutomationDecisionFoundationSnapshotResponse {
    return this.adsAutomationDecisionFoundationSnapshot.build(input || {});
  }

  @Post("ads-automation/decision-foundation-read-model-snapshot")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionFoundationReadModel(
    @Body() input: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionFoundationReadModelSnapshotResponse> {
    const query = this.readModelQuery(input || {});
    const readModel =
      await this.adsAutomationReadModelQuery.buildFromRepository(
        this.adsAutomationReadModelRepository,
        query,
      );

    return this.adsAutomationDecisionFoundationSnapshot.fromReadModelQueryResult(
      readModel,
      query,
    );
  }

  @Post("ads-automation/decision-foundation-read-model-review-export")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionFoundationReadModelReviewExport(
    @Body() input: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionFoundationReadModelReviewExportResponse> {
    const query = this.readModelQuery(input || {});
    const readModel =
      await this.adsAutomationReadModelQuery.buildFromRepository(
        this.adsAutomationReadModelRepository,
        query,
      );

    return this.adsAutomationDecisionFoundationReviewExport.fromReadModelQueryResult(
      readModel,
      query,
    );
  }

  @Post("ads-automation/decision-foundation-read-model-reviewer-docs")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionFoundationReadModelReviewerDocs(
    @Body() input: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionFoundationReadModelReviewerDocsResponse> {
    const query = this.readModelQuery(input || {});
    const readModel =
      await this.adsAutomationReadModelQuery.buildFromRepository(
        this.adsAutomationReadModelRepository,
        query,
      );

    return this.adsAutomationDecisionFoundationReviewerDocs.fromReadModelQueryResult(
      readModel,
      query,
    );
  }

  @Post("ads-automation/decision-read-model-snapshot")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionReadModelSnapshot(
    @Body() input: AdsAutomationDecisionReadModelQuery = {},
  ): Promise<AdsAutomationDecisionReadModelSnapshotResponse> {
    const query = this.readModelQuery(input || {});
    const readModel =
      await this.adsAutomationReadModelQuery.buildFromRepository(
        this.adsAutomationReadModelRepository,
        query,
      );
    const snapshot = this.adsAutomationDecision.build(readModel.snapshotInput);

    return {
      schemaVersion: "ads_automation_decision_read_model_snapshot.v1",
      generatedAt: snapshot.generatedAt,
      source: "mongo_read_model",
      query,
      safety: {
        read_only: true,
        dry_run: true,
        repository_read_only: true,
        provider_api_used: false,
        google_ads_api_used: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_future_actions: true,
      },
      sourceEvidence: readModel.sourceEvidence,
      missingFieldEvidence: readModel.missingFieldEvidence,
      queryEvidence: readModel.queryEvidence,
      snapshot,
    };
  }

  @Post("ads-automation/platform-source-sync-status")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationPlatformSourceSyncStatus(
    @Body() input: any = {},
  ): Promise<AdsAutomationPlatformSourceSyncStatusResponse> {
    const body = input || {};
    return this.platformSourceSyncStatus.build({
      reportDate: this.date(body.reportDate || body.snapshotDate),
      now: this.optionalDateTime(body.now, "now"),
      sourceKeys: this.optionalStringList(body.sourceKeys, "sourceKeys") as
        | AdsAutomationPlatformSourceSyncStatusSourceKey[]
        | undefined,
    });
  }

  @Post("ads-automation/platform-readonly-import-readiness")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationReadonlyPlatformImportReadiness(
    @Body() input: any = {},
  ): Promise<AdsAutomationReadonlyPlatformImportReadinessResponse> {
    const body = input || {};
    const fixture = this.readonlyImportFixture(body.fixture);
    const reportDate = this.date(
      body.reportDate || body.snapshotDate || fixture.reportDate,
    );
    const now = this.optionalDateTime(body.now || fixture.now, "now");
    const sourceSyncStatus = await this.platformSourceSyncStatus.build({
      reportDate,
      now,
      sourceKeys: this.optionalStringList(body.sourceKeys, "sourceKeys") as
        | AdsAutomationPlatformSourceSyncStatusSourceKey[]
        | undefined,
    });

    return this.readonlyPlatformImportReadiness.build({
      reportDate,
      now,
      fixtureMode:
        body.fixture === "htx_ads_readiness_demo"
          ? "htx_ads_readiness_demo"
          : "custom_local_payload",
      accounts: Array.isArray(body.accounts) ? body.accounts : fixture.accounts,
      metricRows: Array.isArray(body.metricRows)
        ? body.metricRows
        : fixture.metricRows,
      decisionReadModel: body.decisionReadModel || fixture.decisionReadModel,
      sourceSyncStatus,
      decisionSafety: body.decisionSafety || fixture.decisionSafety,
      lossLimitPolicy: this.optionalLossLimitPolicyReport(
        body,
        reportDate,
        now,
      ),
    });
  }

  @Post("ads-automation/source-readiness-review-export")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationSourceReadinessReviewExport(
    @Body() input: any = {},
  ): Promise<AdsAutomationSourceReadinessReviewExportResponse> {
    const body = input || {};
    const fixture = this.sourceReadinessReviewFixture(body.fixture);
    const fixtureMode = body.fixture === "htx_ads_source_readiness_review_demo";
    const reportDate = this.date(
      body.reportDate || body.snapshotDate || fixture.reportDate,
    );
    const now = this.optionalDateTime(body.now || fixture.now, "now");
    const sourceSyncStatus =
      this.sourceSyncStatusPayload(body.sourceSyncStatus) ||
      fixture.sourceSyncStatus ||
      (await this.platformSourceSyncStatus.build({
        reportDate,
        now,
        sourceKeys: this.optionalStringList(body.sourceKeys, "sourceKeys") as
          | AdsAutomationPlatformSourceSyncStatusSourceKey[]
          | undefined,
      }));
    const readonlyImportReadiness =
      this.readonlyImportReadinessPayload(body.readonlyImportReadiness) ||
      this.readonlyPlatformImportReadiness.build({
        reportDate,
        now,
        fixtureMode: fixtureMode
          ? "htx_ads_readiness_demo"
          : "custom_local_payload",
        accounts: Array.isArray(body.accounts)
          ? body.accounts
          : fixture.readonlyImportReadinessInput?.accounts,
        metricRows: Array.isArray(body.metricRows)
          ? body.metricRows
          : fixture.readonlyImportReadinessInput?.metricRows,
        decisionReadModel:
          body.decisionReadModel ||
          fixture.readonlyImportReadinessInput?.decisionReadModel,
        sourceSyncStatus,
        decisionSafety:
          body.decisionSafety ||
          fixture.readonlyImportReadinessInput?.decisionSafety,
        lossLimitPolicy: this.optionalLossLimitPolicyReport(
          body,
          reportDate,
          now,
        ),
      });

    return this.sourceReadinessReviewExport.build({
      reportDate,
      now,
      exportMode: fixtureMode ? "local_demo_fixture" : "local_payload",
      fixtureName: fixtureMode ? body.fixture : null,
      sourceSyncStatus,
      readonlyImportReadiness,
    });
  }

  @Post("ads-automation/erp-source-import-readiness-review-export")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationErpSourceImportReadinessReviewExport(
    @Body() input: any = {},
  ): Promise<AdsAutomationSourceReadinessReviewExportResponse> {
    const body = input || {};
    const query = this.readModelQuery(body.query || body);
    const erpReadiness = await this.erpSourceImportReadiness.build(query);

    return this.sourceReadinessReviewExport.build({
      reportDate: erpReadiness.summary.reportDate,
      now: query.now || erpReadiness.generatedAt,
      exportMode: "erp_source_import_readiness",
      sourceSyncStatus: erpReadiness.sourceSyncStatus,
      readonlyImportReadiness: erpReadiness.readonlyImportReadiness,
    });
  }

  @Post("ads-automation/approval-preflight-review-export")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationApprovalPreflightReviewExport(
    @Body() input: any = {},
  ): AdsAutomationApprovalPreflightReviewExportResponse {
    const body = input || {};
    const fixtureMode =
      body.fixture === "htx_ads_approval_preflight_review_demo";
    const fixture: any = fixtureMode
      ? ADS_AUTOMATION_APPROVAL_PREFLIGHT_REVIEW_EXPORT_FIXTURE
      : {};

    return this.approvalPreflightReviewExport.build({
      reportDate: body.reportDate || fixture.reportDate,
      now: body.now || fixture.now,
      exportMode: fixtureMode ? "local_demo_fixture" : "local_payload",
      fixtureName: fixtureMode ? body.fixture : null,
      sourceReadinessReviewExport:
        body.sourceReadinessReviewExport || fixture.sourceReadinessReviewExport,
      validateOnlyLane: body.validateOnlyLane || fixture.validateOnlyLane,
      pendingApprovals: Array.isArray(body.pendingApprovals)
        ? body.pendingApprovals
        : fixture.pendingApprovals,
      approvalDecisionAuditRecords: Array.isArray(
        body.approvalDecisionAuditRecords,
      )
        ? body.approvalDecisionAuditRecords
        : fixture.approvalDecisionAuditRecords,
      executionPreflightDryRun:
        body.executionPreflightDryRun || fixture.executionPreflightDryRun,
      monitorOnlyActions: Array.isArray(body.monitorOnlyActions)
        ? body.monitorOnlyActions
        : fixture.monitorOnlyActions,
    });
  }

  @Post("ads-automation/provider-account-readiness")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationProviderAccountReadiness(
    @Body() input: any = {},
  ): AdsAutomationProviderAccountReadinessResponse {
    const body = input || {};
    const fixture = this.providerAccountReadinessFixture(body.fixture);
    return this.providerAccountReadiness.build({
      reportDate: this.date(
        body.reportDate || body.snapshotDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(body.now || fixture.now, "now"),
      fixtureMode:
        body.fixture === "htx_ads_provider_account_readiness_demo"
          ? "htx_ads_provider_account_readiness_demo"
          : "custom_local_payload",
      accounts: Array.isArray(body.accounts) ? body.accounts : fixture.accounts,
      requestedActions: Array.isArray(body.requestedActions)
        ? body.requestedActions
        : fixture.requestedActions,
    });
  }

  @Post("ads-automation/manager-account-control-plane-readiness")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationManagerAccountControlPlaneReadiness(
    @Body() input: any = {},
  ): AdsAutomationManagerAccountControlPlaneResponse {
    const body = input || {};
    const fixture = this.managerAccountControlPlaneFixture(body.fixture);
    return this.managerAccountControlPlane.build({
      reportDate: this.date(
        body.reportDate || body.snapshotDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(body.now || fixture.now, "now"),
      fixtureMode:
        body.fixture === "htx_ads_manager_account_control_plane_demo"
          ? "htx_ads_manager_account_control_plane_demo"
          : "custom_local_payload",
      managerAccounts: Array.isArray(body.managerAccounts)
        ? body.managerAccounts
        : fixture.managerAccounts,
      pendingActions: Array.isArray(body.pendingActions)
        ? body.pendingActions
        : fixture.pendingActions,
    });
  }

  @Post("ads-automation/final-gate-review-export")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationFinalGateReviewExport(
    @Body() input: any = {},
  ): Promise<AdsAutomationFinalGateReviewExportResponse> {
    const body = input || {};
    const fixture = this.finalGateReviewExportFixture(body.fixture);
    const apiReadinessGapReportInput =
      body.apiReadinessGapReport || body.apiReadinessGapReportResponse;
    const apiReadinessGapReport = this.apiReadinessGapReportPayload(
      apiReadinessGapReportInput,
    );
    if (
      apiReadinessGapReportInput !== undefined &&
      apiReadinessGapReportInput !== null &&
      !apiReadinessGapReport
    ) {
      throw new BadRequestException(
        "apiReadinessGapReport must be ads_automation_api_readiness_gap_report.v1",
      );
    }
    return this.finalGateReviewExport.build({
      reportDate: body.reportDate || body.snapshotDate || fixture.reportDate,
      now: body.now || fixture.now,
      fixtureMode:
        body.fixture === "htx_ads_final_gate_review_demo"
          ? "htx_ads_final_gate_review_demo"
          : "custom_local_payload",
      executionPreflightResponse:
        body.executionPreflightResponse || fixture.executionPreflightResponse,
      finalGoNoGoGateResponse: body.finalGoNoGoGateResponse,
      productionReadinessBridgeInput:
        body.productionReadinessBridgeInput ||
        fixture.productionReadinessBridgeInput,
      productionReadinessBridgeResponse: body.productionReadinessBridgeResponse,
      apiReadinessGapReport,
    });
  }

  @Post("ads-automation/production-readiness-bridge")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationProductionReadinessBridge(
    @Body() input: any = {},
  ): Promise<AdsAutomationProductionReadinessBridgeResponse> {
    const body = input || {};
    const fixture = this.productionReadinessBridgeFixture(body.fixture);
    return this.productionReadinessBridge.build({
      reportDate: this.date(
        body.reportDate || body.snapshotDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(body.now || fixture.now, "now"),
      fixtureMode:
        body.fixture === "htx_ads_production_readiness_bridge_demo"
          ? "htx_ads_production_readiness_bridge_demo"
          : "custom_local_payload",
      providerMetadata: Array.isArray(body.providerMetadata)
        ? body.providerMetadata
        : fixture.providerMetadata,
    });
  }

  @Post("ads-automation/credential-vault-onboarding-readiness")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationCredentialVaultOnboardingReadiness(
    @Body() input: any = {},
  ): AdsAutomationCredentialVaultOnboardingResponse {
    const body = input || {};
    const fixture = this.credentialVaultOnboardingFixture(body.fixture);
    return this.credentialVaultOnboarding.build({
      reportDate: this.date(
        body.reportDate || body.snapshotDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(body.now || fixture.now, "now"),
      fixtureMode:
        body.fixture === "htx_ads_credential_vault_onboarding_demo"
          ? "htx_ads_credential_vault_onboarding_demo"
          : "custom_local_payload",
      providerProfiles: Array.isArray(body.providerProfiles)
        ? body.providerProfiles
        : fixture.providerProfiles,
      includeLocalEncryptionProbe:
        body.includeLocalEncryptionProbe ?? fixture.includeLocalEncryptionProbe,
    });
  }

  @Post("ads-automation/small-cap-readiness-simulator")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationSmallCapReadinessSimulator(
    @Body() input: any = {},
  ): AdsAutomationSmallCapReadinessSimulatorResponse {
    return this.buildSmallCapReadinessSimulatorResponse(input || {});
  }

  @Post("ads-automation/small-cap-approval-preflight-linkage")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationSmallCapApprovalPreflightLinkage(
    @Body() input: any = {},
  ): Promise<AdsAutomationSmallCapApprovalPreflightLinkageResponse> {
    const body = input || {};
    const simulatorResponse =
      body.simulatorResponse &&
      body.simulatorResponse.schemaVersion ===
        "ads_automation_small_cap_readiness_simulator.v1"
        ? (body.simulatorResponse as AdsAutomationSmallCapReadinessSimulatorResponse)
        : this.buildSmallCapReadinessSimulatorResponse({
            ...body,
            fixture:
              body.fixture ===
              "htx_ads_small_cap_approval_preflight_linkage_demo"
                ? "htx_ads_small_cap_readiness_demo"
                : body.fixture,
          });
    const approvalEvidenceIndexes = Array.isArray(body.approvalEvidenceIndexes)
      ? body.approvalEvidenceIndexes
      : await Promise.all(
          this.optionalStringList(body.approvalIds, "approvalIds")?.map(
            (approvalId) =>
              this.adsAutomationApprovalEvidenceIndex.buildByApprovalId(
                approvalId,
              ),
          ) || [],
        );

    return this.smallCapApprovalPreflightLinkage.build({
      reportDate: body.reportDate || simulatorResponse.reportDate,
      now: body.now,
      fixtureMode:
        body.fixture === "htx_ads_small_cap_approval_preflight_linkage_demo"
          ? "htx_ads_small_cap_approval_preflight_linkage_demo"
          : "custom_local_payload",
      simulatorResponse,
      approvalEvidenceIndexes,
    });
  }

  @Post("ads-automation/loss-limit-policy")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationLossLimitPolicyReport(
    @Body() input: any = {},
  ): AdsAutomationLossLimitPolicyResponse {
    return this.adsAutomationLossLimitPolicy.build(
      this.lossLimitPolicyInput(input || {}),
    );
  }

  @Post("ads-automation/monitoring-incident-readiness")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  adsAutomationMonitoringIncidentReadinessReport(
    @Body() input: any = {},
  ): AdsAutomationMonitoringIncidentReadinessResponse {
    const body = input || {};
    const fixture = this.monitoringIncidentFixture(body.fixture);
    return this.adsAutomationMonitoringIncidentReadiness.build({
      reportDate: this.date(
        body.reportDate || body.snapshotDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(body.now || fixture.now, "now"),
      fixtureMode:
        body.fixture === "htx_ads_monitoring_incident_demo"
          ? "htx_ads_monitoring_incident_demo"
          : "custom_local_payload",
      telemetryReadModel:
        body.telemetryReadModel || fixture.telemetryReadModel || null,
      providerRateLimits: Array.isArray(body.providerRateLimits)
        ? body.providerRateLimits
        : fixture.providerRateLimits,
      spendRateMonitors: Array.isArray(body.spendRateMonitors)
        ? body.spendRateMonitors
        : fixture.spendRateMonitors,
      providerErrorRateMonitors: Array.isArray(body.providerErrorRateMonitors)
        ? body.providerErrorRateMonitors
        : fixture.providerErrorRateMonitors,
      staleImportAlerts: Array.isArray(body.staleImportAlerts)
        ? body.staleImportAlerts
        : fixture.staleImportAlerts,
      validateOnlyPreflightAlerts: Array.isArray(
        body.validateOnlyPreflightAlerts,
      )
        ? body.validateOnlyPreflightAlerts
        : fixture.validateOnlyPreflightAlerts,
      incidents: Array.isArray(body.incidents)
        ? body.incidents
        : fixture.incidents,
      operatorAcknowledgements: Array.isArray(body.operatorAcknowledgements)
        ? body.operatorAcknowledgements
        : fixture.operatorAcknowledgements,
    });
  }

  @Post("ads-automation/api-readiness-gap-report")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationApiReadinessGapReportEndpoint(
    @Body() input: any = {},
  ): Promise<AdsAutomationApiReadinessGapReportResponse> {
    const body = input || {};
    const query = this.readModelQuery(body.query || body);
    const readModel =
      await this.adsAutomationReadModelQuery.buildFromRepository(
        this.adsAutomationReadModelRepository,
        query,
      );
    const foundationSnapshot =
      this.adsAutomationDecisionFoundationSnapshot.fromReadModelQueryResult(
        readModel,
        query,
      );
    const snapshot = this.adsAutomationDecision.build(readModel.snapshotInput);
    const sourceSyncPreparation =
      await this.prepareReadModelDraftPreviewSources(
        query,
        snapshot.snapshotDate,
      );
    const draftPreview = this.adsAutomationDraftPreview.build(snapshot, {
      source: "mongo_read_model",
      query,
      sourceEvidence: readModel.sourceEvidence,
      sourceSyncDecisionEvidence: sourceSyncPreparation.decisionEvidence,
      sourceSyncDecisionGates: sourceSyncPreparation.decisionGates,
      missingFieldEvidence: readModel.missingFieldEvidence,
      queryEvidence: readModel.queryEvidence,
    });

    if (
      body.mockedProviderResults !== undefined &&
      !Array.isArray(body.mockedProviderResults)
    ) {
      throw new BadRequestException("mockedProviderResults must be an array");
    }

    const providerAccountReadiness =
      this.optionalProviderAccountReadinessReport(
        body,
        snapshot.snapshotDate,
        query.now,
      );
    const readonlyImportReadiness = this.readonlyImportReadinessPayload(
      body.readonlyImportReadiness,
    );
    const sourceReadinessReviewExport = this.sourceReadinessReviewExportPayload(
      body.sourceReadinessReviewExport ||
        body.erpSourceImportReadinessReviewExport,
    );

    return this.adsAutomationApiReadinessGapReport.build({
      reportDate: snapshot.snapshotDate,
      foundationSnapshot,
      draftPreview,
      mockedProviderResults: body.mockedProviderResults || [],
      lossLimitPolicy: this.optionalLossLimitPolicyReport(
        body,
        snapshot.snapshotDate,
        query.now,
      ),
      providerAccountReadiness,
      readonlyImportReadiness:
        sourceReadinessReviewExport?.readonlyImportReadiness ||
        readonlyImportReadiness,
      sourceReadinessReviewExport,
    });
  }

  @Post("ads-automation/decision-draft-preview")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftPreview(
    @Body() input: any = {},
  ): Promise<AdsAutomationDecisionDraftPreviewResponse> {
    const body = input || {};
    const providedSnapshot =
      this.decisionSnapshotPayload(body) ||
      this.decisionSnapshotPayload(body.snapshot);

    if (providedSnapshot) {
      return this.adsAutomationDraftPreview.build(providedSnapshot, {
        source: "decision_snapshot",
      });
    }

    const query = this.readModelQuery(body.query || body);
    const readModel =
      await this.adsAutomationReadModelQuery.buildFromRepository(
        this.adsAutomationReadModelRepository,
        query,
      );
    const snapshot = this.adsAutomationDecision.build(readModel.snapshotInput);
    const sourceSyncPreparation =
      await this.prepareReadModelDraftPreviewSources(
        query,
        snapshot.snapshotDate,
      );

    return this.adsAutomationDraftPreview.build(snapshot, {
      source: "mongo_read_model",
      query,
      sourceEvidence: readModel.sourceEvidence,
      sourceSyncDecisionEvidence: sourceSyncPreparation.decisionEvidence,
      sourceSyncDecisionGates: sourceSyncPreparation.decisionGates,
      missingFieldEvidence: readModel.missingFieldEvidence,
      queryEvidence: readModel.queryEvidence,
    });
  }

  @Post("ads-automation/decision-draft-approval-import")
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftApprovalImport(
    @Body() input: any = {},
  ): Promise<AdsAutomationDecisionDraftApprovalImportResponse> {
    return this.adsAutomationDraftApprovalQueue.importPreview(
      this.draftPreviewPayload(input || {}),
    );
  }

  @Get("ads-automation/decision-draft-approvals")
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftApprovals(
    @Query() query: any = {},
  ): Promise<AdsAutomationDecisionDraftApprovalReadModelResponse> {
    return this.adsAutomationDraftApprovalQueue.listPendingApprovals(
      query || {},
    );
  }

  @Post("ads-automation/decision-draft-approvals/execution-preflight-dry-run")
  @HttpCode(200)
  @RequirePermissions("google-ads.approve")
  async adsAutomationDecisionDraftApprovalExecutionPreflightDryRun(
    @Body() input: any = {},
    @CurrentUser() user: any,
  ): Promise<AdsAutomationExecutionPreflightDryRunResponse> {
    const body = input || {};
    return this.adsAutomationExecutionPreflightDryRun.build({
      ...body,
      validationPlans: Array.isArray(body.validationPlans)
        ? body.validationPlans
        : Array.isArray(body.validateOnlyLane?.validationPlans)
          ? body.validateOnlyLane.validationPlans
          : [],
      validationIds: Array.isArray(body.validationIds)
        ? body.validationIds
        : Array.isArray(body.validateOnlyLane?.validationIds)
          ? body.validateOnlyLane.validationIds
          : [],
      requestedByUserId: body.requestedByUserId ?? user?.id ?? null,
      requestedByRole: body.requestedByRole ?? user?.role ?? null,
    });
  }

  @Get(
    "ads-automation/decision-draft-approvals/execution-preflight-dry-run/:executionRecordId",
  )
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationExecutionPreflightDryRunRecord(
    @Param("executionRecordId") executionRecordId: string,
  ): Promise<AdsAutomationExecutionPreflightRecordReadbackResponse> {
    return this.adsAutomationExecutionPreflightReadback.readByExecutionRecordId(
      executionRecordId,
    );
  }

  @Get(
    "ads-automation/decision-draft-approvals/:approvalId/execution-preflight-dry-run-records",
  )
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationExecutionPreflightDryRunHistory(
    @Param("approvalId") approvalId: string,
  ): Promise<AdsAutomationExecutionPreflightRecordHistoryResponse> {
    return this.adsAutomationExecutionPreflightReadback.listByApprovalId(
      approvalId,
    );
  }

  @Get("ads-automation/policy-decision-evidence/:policyDecisionId")
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationPolicyDecisionEvidence(
    @Param("policyDecisionId") policyDecisionId: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceReadbackResponse> {
    return this.adsAutomationPolicyDecisionEvidenceReadback.readByPolicyDecisionId(
      policyDecisionId,
    );
  }

  @Get(
    "ads-automation/decision-draft-approvals/:approvalId/policy-decision-evidence",
  )
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationPolicyDecisionEvidenceHistory(
    @Param("approvalId") approvalId: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceHistoryResponse> {
    return this.adsAutomationPolicyDecisionEvidenceReadback.listByApprovalId(
      approvalId,
    );
  }

  @Get("ads-automation/validate-only-evidence/:validationId")
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationValidateOnlyEvidence(
    @Param("validationId") validationId: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceReadbackResponse> {
    return this.adsAutomationValidateOnlyEvidenceReadback.readByValidationId(
      validationId,
    );
  }

  @Get(
    "ads-automation/decision-draft-approvals/:approvalId/validate-only-evidence",
  )
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationValidateOnlyEvidenceHistory(
    @Param("approvalId") approvalId: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceHistoryResponse> {
    return this.adsAutomationValidateOnlyEvidenceReadback.listByApprovalId(
      approvalId,
    );
  }

  @Get("ads-automation/decision-draft-approvals/:approvalId/evidence-index")
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationApprovalEvidenceIndexReadback(
    @Param("approvalId") approvalId: string,
  ): Promise<AdsAutomationApprovalEvidenceIndexResponse> {
    return this.adsAutomationApprovalEvidenceIndex.buildByApprovalId(
      approvalId,
    );
  }

  @Get(
    "ads-automation/decision-draft-approvals/:approvalId/evidence-index/reviewer-export",
  )
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationApprovalEvidenceReviewExportReadback(
    @Param("approvalId") approvalId: string,
    @Query("fixture") fixture?: string,
  ): Promise<AdsAutomationApprovalEvidenceReviewExportResponse> {
    return this.adsAutomationApprovalEvidenceReviewExport.buildByApprovalId(
      approvalId,
      { fixture },
    );
  }

  @Get(
    "ads-automation/decision-draft-approvals/:approvalId/evidence-index/reviewer-docs",
  )
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationApprovalEvidenceReviewerDocsReadback(
    @Param("approvalId") approvalId: string,
    @Query("fixture") fixture?: string,
  ): Promise<AdsAutomationApprovalEvidenceReviewerDocsResponse> {
    return this.adsAutomationApprovalEvidenceReviewerDocs.buildByApprovalId(
      approvalId,
      { fixture },
    );
  }

  @Post(
    "ads-automation/decision-draft-approvals/:approvalId/policy-decision-audit-linkage",
  )
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationPolicyDecisionAuditLinkageReadiness(
    @Param("approvalId") approvalId: string,
    @Body() input: any = {},
  ): Promise<AdsAutomationPolicyDecisionAuditLinkageResponse> {
    const body = input || {};
    const approvalEvidenceIndex =
      body.approvalEvidenceIndex ||
      (await this.adsAutomationApprovalEvidenceIndex.buildByApprovalId(
        approvalId,
      ));
    return this.adsAutomationPolicyDecisionAuditLinkage.build({
      approvalId,
      reportDate: body.reportDate ?? null,
      approvalEvidenceIndex,
      auditRecords: Array.isArray(body.auditRecords) ? body.auditRecords : [],
      lossLimitPolicy: body.lossLimitPolicy || null,
      monitoringReadiness: body.monitoringReadiness || null,
    });
  }

  @Post(
    "ads-automation/decision-draft-approvals/:approvalId/decision-validation",
  )
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftApprovalDecisionValidation(
    @Param("approvalId") approvalId: string,
    @Body() input: any = {},
    @CurrentUser() user: any,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionValidationResponse> {
    const body = input || {};
    return this.adsAutomationDraftApprovalQueue.validatePendingApprovalDecision(
      approvalId,
      {
        ...body,
        reviewerUserId: body.reviewerUserId ?? user?.id ?? null,
        reviewerRole: body.reviewerRole ?? user?.role ?? null,
      },
    );
  }

  @Post(
    "ads-automation/decision-draft-approvals/:approvalId/decision-audit-record-preview",
  )
  @HttpCode(200)
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftApprovalDecisionAuditRecordPreview(
    @Param("approvalId") approvalId: string,
    @Body() input: any = {},
    @CurrentUser() user: any,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewResponse> {
    const body = input || {};
    return this.adsAutomationDraftApprovalQueue.previewPendingApprovalDecisionAuditRecord(
      approvalId,
      {
        ...body,
        reviewerUserId: body.reviewerUserId ?? user?.id ?? null,
        reviewerRole: body.reviewerRole ?? user?.role ?? null,
      },
    );
  }

  @Post("ads-automation/decision-draft-approvals/:approvalId/decision")
  @HttpCode(200)
  @RequirePermissions("google-ads.approve")
  async adsAutomationDecisionDraftApprovalDecision(
    @Param("approvalId") approvalId: string,
    @Body() input: any = {},
    @CurrentUser() user: any,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionMutationResponse> {
    const body = input || {};
    return this.adsAutomationDraftApprovalDecisionMutation.decidePendingApproval(
      approvalId,
      {
        ...body,
        reviewerUserId: body.reviewerUserId ?? user?.id ?? null,
        reviewerRole: body.reviewerRole ?? user?.role ?? null,
      },
    );
  }

  @Get("ads-automation/decision-draft-approvals/:approvalId/readiness")
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftApprovalReadiness(
    @Param("approvalId") approvalId: string,
  ): Promise<AdsAutomationDecisionDraftApprovalReadinessResponse> {
    return this.adsAutomationDraftApprovalQueue.reviewPendingApprovalReadiness(
      approvalId,
    );
  }

  @Get("ads-automation/decision-draft-approvals/:approvalId")
  @RequirePermissions("ai-data-pack.marketer.read")
  async adsAutomationDecisionDraftApproval(
    @Param("approvalId") approvalId: string,
  ): Promise<AdsAutomationDecisionDraftApprovalReadRecordResponse> {
    return this.adsAutomationDraftApprovalQueue.readPendingApproval(approvalId);
  }

  private buildSmallCapReadinessSimulatorResponse(
    input: any,
  ): AdsAutomationSmallCapReadinessSimulatorResponse {
    const body = input || {};
    const fixture = this.smallCapReadinessFixture(body.fixture);
    const reportDate = this.date(
      body.reportDate || body.snapshotDate || fixture.reportDate,
    );
    const now = this.optionalDateTime(body.now || fixture.now, "now");
    const decisionInput =
      body.snapshotInput ||
      (body.fixture === "htx_ads_small_cap_readiness_demo"
        ? {
            ...ADS_AUTOMATION_DECISION_FOUNDATION_SNAPSHOT_FIXTURE,
            snapshotDate: reportDate,
          }
        : null);
    const decisionSnapshot = decisionInput
      ? this.adsAutomationDecision.build(decisionInput)
      : null;
    const foundationSnapshot =
      this.foundationSnapshotPayload(body.foundationSnapshot) ||
      (decisionSnapshot
        ? this.adsAutomationDecisionFoundationSnapshot.fromDecisionSnapshot(
            decisionSnapshot,
          )
        : null);
    const draftPreview =
      body.draftPreview &&
      body.draftPreview.schemaVersion ===
        "ads_automation_decision_draft_preview.v1"
        ? (body.draftPreview as AdsAutomationDecisionDraftPreviewResponse)
        : decisionSnapshot
          ? this.adsAutomationDraftPreview.build(decisionSnapshot, {
              source: "decision_snapshot",
            })
          : null;

    if (!foundationSnapshot || !draftPreview) {
      throw new BadRequestException(
        "foundationSnapshot and draftPreview are required unless fixture is htx_ads_small_cap_readiness_demo or snapshotInput is provided",
      );
    }

    const lossLimitPolicy =
      body.lossLimitPolicy &&
      body.lossLimitPolicy.schemaVersion ===
        "ads_automation_loss_limit_policy.v1"
        ? (body.lossLimitPolicy as AdsAutomationLossLimitPolicyResponse)
        : body.lossLimitPolicy === null
          ? null
          : this.optionalLossLimitPolicyReport(
              {
                ...body,
                lossLimitPolicyFixture:
                  body.lossLimitPolicyFixture ||
                  (body.fixture === "htx_ads_small_cap_readiness_demo"
                    ? "htx_ads_loss_policy_demo"
                    : body.lossLimitPolicyFixture),
              },
              reportDate,
              now,
            );
    const providerAccountReadiness =
      body.providerAccountReadiness &&
      body.providerAccountReadiness.schemaVersion ===
        "ads_automation_provider_account_readiness.v1"
        ? (body.providerAccountReadiness as AdsAutomationProviderAccountReadinessResponse)
        : this.optionalProviderAccountReadinessReport(
            {
              ...body,
              providerAccountReadinessFixture:
                body.providerAccountReadinessFixture ||
                (body.fixture === "htx_ads_small_cap_readiness_demo"
                  ? "htx_ads_provider_account_readiness_demo"
                  : body.providerAccountReadinessFixture),
            },
            reportDate,
            now,
          );

    return this.smallCapReadinessSimulator.build({
      reportDate,
      now,
      fixtureMode:
        body.fixture === "htx_ads_small_cap_readiness_demo"
          ? "htx_ads_small_cap_readiness_demo"
          : "custom_local_payload",
      maxSmallCapIncreaseVnd:
        body.maxSmallCapIncreaseVnd ?? fixture.maxSmallCapIncreaseVnd,
      maxSmallCapIncreasePercent:
        body.maxSmallCapIncreasePercent ?? fixture.maxSmallCapIncreasePercent,
      foundationSnapshot,
      draftPreview,
      lossLimitPolicy,
      providerAccountReadiness,
      productionReadinessBridge: body.productionReadinessBridge || null,
    });
  }

  private send(
    response: Response,
    value: any,
    format: "json" | "xlsx",
    filename: string,
    sections = false,
  ) {
    if (format === "xlsx") {
      const source = sections ? value.sections : { report: value };
      const buffer = this.xlsx.export(source);
      response.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}.xlsx"`,
      );
      return response.send(buffer);
    }
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    return response.send(this.json.stableStringify(value));
  }

  private format(value?: string): "json" | "xlsx" {
    const format = String(value || "json").toLowerCase();
    if (!["json", "xlsx"].includes(format))
      throw new BadRequestException("format must be json or xlsx");
    return format as "json" | "xlsx";
  }

  private date(value?: string): string {
    if (
      !value ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
    ) {
      throw new BadRequestException("date must use YYYY-MM-DD");
    }
    return value;
  }

  private readModelQuery(input: any): AdsAutomationDecisionReadModelQuery {
    return {
      snapshotDate: this.optionalDate(input.snapshotDate, "snapshotDate"),
      evidenceWindow: this.optionalEvidenceWindow(input.evidenceWindow),
      customerIds: this.optionalStringList(input.customerIds, "customerIds"),
      accountIds: this.optionalStringList(input.accountIds, "accountIds"),
      productIds: this.optionalStringList(input.productIds, "productIds"),
      now: this.optionalDateTime(input.now, "now"),
      maxAgeHours: this.optionalMaxAgeHours(input.maxAgeHours),
    };
  }

  private optionalEvidenceWindow(value: any) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("evidenceWindow must be an object");
    }
    const from = this.optionalDate(value.from, "evidenceWindow.from");
    const to = this.optionalDate(value.to, "evidenceWindow.to");
    const days = value.days === undefined ? undefined : Number(value.days);
    if (days !== undefined && (!Number.isFinite(days) || days < 1)) {
      throw new BadRequestException(
        "evidenceWindow.days must be a positive number",
      );
    }
    return { from, to, days };
  }

  private optionalDate(value: any, field: string): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const date = String(value);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())
    ) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    return date;
  }

  private optionalDateTime(value: any, field: string): string | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const dateTime = String(value);
    if (Number.isNaN(new Date(dateTime).getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return dateTime;
  }

  private optionalStringList(value: any, field: string): string[] | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const values = Array.isArray(value) ? value : String(value).split(",");
    const normalized = values
      .map((item) => String(item).trim())
      .filter(Boolean);
    if (!normalized.length) {
      throw new BadRequestException(`${field} must contain at least one value`);
    }
    return normalized;
  }

  private optionalMaxAgeHours(
    value: any,
  ): Partial<Record<AdsAutomationDecisionSourceKey, number>> | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== "object" || Array.isArray(value)) {
      throw new BadRequestException("maxAgeHours must be an object");
    }
    const allowed = new Set<AdsAutomationDecisionSourceKey>([
      "ads_performance",
      "campaign_budgets",
      "product_performance",
      "supplier_safety",
      "pause_review",
      "cashflow_policy",
    ]);
    const result: Partial<Record<AdsAutomationDecisionSourceKey, number>> = {};
    for (const [key, rawValue] of Object.entries(value)) {
      if (!allowed.has(key as AdsAutomationDecisionSourceKey)) {
        throw new BadRequestException(
          `maxAgeHours.${key} is not a supported source key`,
        );
      }
      const hours = Number(rawValue);
      if (!Number.isFinite(hours) || hours < 1) {
        throw new BadRequestException(
          `maxAgeHours.${key} must be a positive number`,
        );
      }
      result[key as AdsAutomationDecisionSourceKey] = hours;
    }
    return result;
  }

  private readonlyImportFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        accounts: undefined,
        metricRows: undefined,
        decisionSafety: undefined,
      };
    }
    if (fixture !== "htx_ads_readiness_demo") {
      throw new BadRequestException("fixture must be htx_ads_readiness_demo");
    }
    return ADS_AUTOMATION_READONLY_PLATFORM_IMPORT_READINESS_FIXTURE;
  }

  private sourceReadinessReviewFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        sourceSyncStatus: undefined,
        readonlyImportReadinessInput: undefined,
      };
    }
    if (fixture !== "htx_ads_source_readiness_review_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_source_readiness_review_demo",
      );
    }
    return ADS_AUTOMATION_SOURCE_READINESS_REVIEW_EXPORT_FIXTURE;
  }

  private sourceSyncStatusPayload(
    value: any,
  ): AdsAutomationPlatformSourceSyncStatusResponse | null {
    if (
      value &&
      value.schemaVersion === "ads_automation_platform_source_sync_status.v1" &&
      Array.isArray(value.decisionEvidence) &&
      Array.isArray(value.sources)
    ) {
      return value as AdsAutomationPlatformSourceSyncStatusResponse;
    }
    return null;
  }

  private readonlyImportReadinessPayload(
    value: any,
  ): AdsAutomationReadonlyPlatformImportReadinessResponse | null {
    if (
      value &&
      value.schemaVersion ===
        "ads_automation_readonly_platform_import_readiness.v1" &&
      Array.isArray(value.metricRows) &&
      value.decisionReadiness
    ) {
      return value as AdsAutomationReadonlyPlatformImportReadinessResponse;
    }
    return null;
  }

  private sourceReadinessReviewExportPayload(
    value: any,
  ): AdsAutomationSourceReadinessReviewExportResponse | null {
    if (
      value &&
      value.schemaVersion ===
        "ads_automation_source_readiness_review_export.v1" &&
      value.readonlyImportReadiness &&
      value.sourceSyncStatus &&
      value.summary
    ) {
      return value as AdsAutomationSourceReadinessReviewExportResponse;
    }
    return null;
  }

  private apiReadinessGapReportPayload(
    value: any,
  ): AdsAutomationApiReadinessGapReportResponse | null {
    if (
      value &&
      value.schemaVersion === "ads_automation_api_readiness_gap_report.v1" &&
      value.summary &&
      Array.isArray(value.stages) &&
      Array.isArray(value.sourceBlockers)
    ) {
      return value as AdsAutomationApiReadinessGapReportResponse;
    }
    return null;
  }

  private optionalLossLimitPolicyReport(
    body: any,
    reportDate: string,
    now?: string | Date,
  ): AdsAutomationLossLimitPolicyResponse | null {
    if (
      body.lossLimitPolicy &&
      body.lossLimitPolicy.schemaVersion ===
        "ads_automation_loss_limit_policy.v1"
    ) {
      return body.lossLimitPolicy as AdsAutomationLossLimitPolicyResponse;
    }
    if (!body.lossLimitPolicyFixture && !body.lossLimitPolicyInput) {
      return null;
    }
    return this.adsAutomationLossLimitPolicy.build(
      this.lossLimitPolicyInput({
        ...(body.lossLimitPolicyInput || {}),
        fixture:
          body.lossLimitPolicyFixture || body.lossLimitPolicyInput?.fixture,
        reportDate: body.lossLimitPolicyInput?.reportDate || reportDate,
        now: body.lossLimitPolicyInput?.now || now,
      }),
    );
  }

  private lossLimitPolicyInput(body: any): AdsAutomationLossLimitPolicyInput {
    const fixture = this.lossLimitPolicyFixture(body.fixture);
    return {
      reportDate: this.date(
        body.reportDate || body.snapshotDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(body.now || fixture.now, "now"),
      fixtureMode:
        body.fixture === "htx_ads_loss_policy_demo"
          ? "htx_ads_loss_policy_demo"
          : "custom_local_payload",
      action: body.action || fixture.action,
      approval: body.approval || fixture.approval,
      globalLimits: body.globalLimits || fixture.globalLimits,
      spendCaps: Array.isArray(body.spendCaps)
        ? body.spendCaps
        : fixture.spendCaps,
      economics: Array.isArray(body.economics)
        ? body.economics
        : fixture.economics,
    };
  }

  private lossLimitPolicyFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        action: undefined,
        approval: undefined,
        globalLimits: undefined,
        spendCaps: undefined,
        economics: undefined,
      };
    }
    if (fixture !== "htx_ads_loss_policy_demo") {
      throw new BadRequestException("fixture must be htx_ads_loss_policy_demo");
    }
    return ADS_AUTOMATION_LOSS_LIMIT_POLICY_FIXTURE;
  }

  private optionalProviderAccountReadinessReport(
    body: any,
    reportDate: string,
    now?: string | Date,
  ): AdsAutomationProviderAccountReadinessResponse | null {
    if (
      body.providerAccountReadiness &&
      body.providerAccountReadiness.schemaVersion ===
        "ads_automation_provider_account_readiness.v1"
    ) {
      return body.providerAccountReadiness as AdsAutomationProviderAccountReadinessResponse;
    }
    if (
      !body.providerAccountReadinessFixture &&
      !body.providerAccountReadinessInput
    ) {
      return null;
    }
    const input = body.providerAccountReadinessInput || {};
    const fixture = this.providerAccountReadinessFixture(
      body.providerAccountReadinessFixture || input.fixture,
    );
    return this.providerAccountReadiness.build({
      reportDate: this.date(
        input.reportDate || reportDate || fixture.reportDate,
      ),
      now: this.optionalDateTime(input.now || now || fixture.now, "now"),
      fixtureMode:
        (body.providerAccountReadinessFixture || input.fixture) ===
        "htx_ads_provider_account_readiness_demo"
          ? "htx_ads_provider_account_readiness_demo"
          : "custom_local_payload",
      accounts: Array.isArray(input.accounts)
        ? input.accounts
        : fixture.accounts,
      requestedActions: Array.isArray(input.requestedActions)
        ? input.requestedActions
        : fixture.requestedActions,
    });
  }

  private providerAccountReadinessFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        accounts: undefined,
        requestedActions: undefined,
      };
    }
    if (fixture !== "htx_ads_provider_account_readiness_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_provider_account_readiness_demo",
      );
    }
    return ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE;
  }

  private managerAccountControlPlaneFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        managerAccounts: undefined,
        pendingActions: undefined,
      };
    }
    if (fixture !== "htx_ads_manager_account_control_plane_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_manager_account_control_plane_demo",
      );
    }
    return ADS_AUTOMATION_MANAGER_ACCOUNT_CONTROL_PLANE_FIXTURE;
  }

  private productionReadinessBridgeFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        providerMetadata: undefined,
      };
    }
    if (fixture !== "htx_ads_production_readiness_bridge_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_production_readiness_bridge_demo",
      );
    }
    return ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE;
  }

  private finalGateReviewExportFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        executionPreflightResponse: undefined,
        productionReadinessBridgeInput: undefined,
      };
    }
    if (fixture !== "htx_ads_final_gate_review_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_final_gate_review_demo",
      );
    }
    return ADS_AUTOMATION_FINAL_GATE_REVIEW_EXPORT_FIXTURE;
  }

  private credentialVaultOnboardingFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        providerProfiles: undefined,
        includeLocalEncryptionProbe: undefined,
      };
    }
    if (fixture !== "htx_ads_credential_vault_onboarding_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_credential_vault_onboarding_demo",
      );
    }
    return ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE;
  }

  private smallCapReadinessFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        maxSmallCapIncreaseVnd: undefined,
        maxSmallCapIncreasePercent: undefined,
      };
    }
    if (fixture !== "htx_ads_small_cap_readiness_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_small_cap_readiness_demo",
      );
    }
    return ADS_AUTOMATION_SMALL_CAP_READINESS_SIMULATOR_FIXTURE;
  }

  private monitoringIncidentFixture(fixture?: string) {
    if (fixture === undefined || fixture === null || fixture === "") {
      return {
        reportDate: undefined,
        now: undefined,
        providerRateLimits: undefined,
        spendRateMonitors: undefined,
        providerErrorRateMonitors: undefined,
        staleImportAlerts: undefined,
        validateOnlyPreflightAlerts: undefined,
        incidents: undefined,
        operatorAcknowledgements: undefined,
        telemetryReadModel: undefined,
      };
    }
    if (fixture !== "htx_ads_monitoring_incident_demo") {
      throw new BadRequestException(
        "fixture must be htx_ads_monitoring_incident_demo",
      );
    }
    return ADS_AUTOMATION_MONITORING_INCIDENT_READINESS_FIXTURE;
  }

  private prepareReadModelDraftPreviewSources(
    query: AdsAutomationDecisionReadModelQuery,
    reportDate: string,
  ): Promise<
    Pick<SourceSyncPreparationResult, "decisionEvidence" | "decisionGates">
  > {
    const jobKey = `ads-draft-preview-${reportDate.replace(/-/g, "")}`;
    return this.sourceSyncOrchestrator.prepareSourcesForExportJob({
      exportJobId: jobKey,
      correlationId: jobKey,
      reportDate,
      dateFrom: query.evidenceWindow?.from || reportDate,
      dateTo: query.evidenceWindow?.to || reportDate,
      packTypes: ["marketer"],
      sourceKeys: [
        "google_ads",
        "advertising_costs",
        "product_mapping",
        "inventory_profit",
        "supplier_safety",
      ],
      syncPolicy: "export_cached",
      customerIds: query.customerIds,
      now: query.now ? new Date(query.now) : undefined,
    });
  }

  private decisionSnapshotPayload(
    value: any,
  ): AdsAutomationDecisionSnapshot | null {
    if (
      value &&
      value.schemaVersion === "ads_automation_decision_snapshot.v1" &&
      Array.isArray(value.decisions)
    ) {
      return value as AdsAutomationDecisionSnapshot;
    }
    return null;
  }

  private foundationSnapshotPayload(
    value: any,
  ): AdsAutomationDecisionFoundationSnapshotResponse | null {
    if (
      value &&
      value.schemaVersion ===
        "ads_automation_decision_foundation_snapshot.v1" &&
      value.scale_amount &&
      Array.isArray(value.evidence_links)
    ) {
      return value as AdsAutomationDecisionFoundationSnapshotResponse;
    }
    return null;
  }

  private draftPreviewPayload(
    value: any,
  ): AdsAutomationDecisionDraftPreviewResponse {
    if (
      value &&
      value.schemaVersion === "ads_automation_decision_draft_preview.v1" &&
      Array.isArray(value.drafts)
    ) {
      return value as AdsAutomationDecisionDraftPreviewResponse;
    }
    throw new BadRequestException(
      "payload must be ads_automation_decision_draft_preview.v1",
    );
  }
}
