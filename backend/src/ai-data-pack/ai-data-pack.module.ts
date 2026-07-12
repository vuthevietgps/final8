import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiTokenModule } from "../api-token/api-token.module";
import { FinanceModule } from "../finance/finance.module";
import { AdGroup, AdGroupSchema } from "../ad-group/schemas/ad-group.schema";
import {
  AdvertisingCost,
  AdvertisingCostSchema,
} from "../advertising-cost/schemas/advertising-cost.schema";
import {
  AvailableFundSnapshot,
  AvailableFundSnapshotSchema,
} from "../finance/schemas/available-fund-snapshot.schema";
import {
  CashflowSummarySnapshot,
  CashflowSummarySnapshotSchema,
} from "../finance/schemas/cashflow-summary-snapshot.schema";
import {
  InventorySummary,
  InventorySummarySchema,
} from "../inventory/schemas/inventory-summary.schema";
import { Product, ProductSchema } from "../product/schemas/product.schema";
import {
  SupplierPayable,
  SupplierPayableSchema,
} from "../supplier-payable/schemas/supplier-payable.schema";
import {
  SupplierQuote,
  SupplierQuoteSchema,
} from "../supplier-quote/schemas/supplier-quote.schema";
import {
  TestOrder2,
  TestOrder2Schema,
} from "../test-order2/schemas/test-order2.schema";
import { User, UserSchema } from "../user/user.schema";
import { AdsAutomationDecisionDraftApprovalDecisionAuditRepository } from "./ads-automation-decision-draft-approval-decision-audit.repository";
import { AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService } from "./ads-automation-decision-draft-approval-decision-audit-readback.service";
import { AdsAutomationDecisionDraftApprovalDecisionMutationService } from "./ads-automation-decision-draft-approval-decision-mutation.service";
import { AdsAutomationDecisionDraftApprovalRepository } from "./ads-automation-decision-draft-approval.repository";
import { AdsAutomationDecisionDraftApprovalQueueService } from "./ads-automation-decision-draft-approval-queue.service";
import { AdsAutomationDecisionDraftPreviewService } from "./ads-automation-decision-draft-preview.service";
import { AdsAutomationFinalGateReviewExportService } from "./ads-automation-final-gate-review-export.service";
import { AdsAutomationFinalGoNoGoGateService } from "./ads-automation-final-go-no-go-gate.service";
import { AdsAutomationFoundationAcceptanceMatrixService } from "./ads-automation-foundation-acceptance-matrix.service";
import { AdsAutomationGoogleAdsDryRunReconciliationService } from "./ads-automation-google-ads-dry-run-reconciliation.service";
import { AdsAutomationGoogleAdsMockImportDemoService } from "./ads-automation-google-ads-mock-import-demo.service";
import { AdsAutomationApprovalEvidenceIndexService } from "./ads-automation-approval-evidence-index.service";
import { AdsAutomationApprovalEvidenceReviewExportService } from "./ads-automation-approval-evidence-review-export.service";
import { AdsAutomationApprovalEvidenceReviewerDocsService } from "./ads-automation-approval-evidence-reviewer-docs.service";
import { AdsAutomationApprovalPreflightReviewExportService } from "./ads-automation-approval-preflight-review-export.service";
import { AdsAutomationDecisionFoundationReviewExportService } from "./ads-automation-decision-foundation-review-export.service";
import { AdsAutomationDecisionFoundationReviewerDocsService } from "./ads-automation-decision-foundation-reviewer-docs.service";
import { AdsAutomationDecisionFoundationSnapshotService } from "./ads-automation-decision-foundation-snapshot.service";
import { AdsAutomationDecisionService } from "./ads-automation-decision.service";
import { AdsAutomationApiReadinessGapReportService } from "./ads-automation-api-readiness-gap-report.service";
import { AdsAutomationLossLimitPolicyService } from "./ads-automation-loss-limit-policy.service";
import { AdsAutomationMonitoringIncidentReadinessService } from "./ads-automation-monitoring-incident-readiness.service";
import { AdsAutomationMonitoringTelemetryReadModelRepository } from "./ads-automation-monitoring-telemetry-read-model.repository";
import { AdsAutomationMonitoringTelemetryReadModelService } from "./ads-automation-monitoring-telemetry-read-model.service";
import { AdsAutomationManagerAccountControlPlaneService } from "./ads-automation-manager-account-control-plane.service";
import { AdsAutomationProviderAccountReadinessService } from "./ads-automation-provider-account-readiness.service";
import { AdsAutomationReadonlyPlatformImportReadinessService } from "./ads-automation-readonly-platform-import-readiness.service";
import { AdsAutomationPlatformSourceSyncStatusService } from "./ads-automation-platform-source-sync-status.service";
import { AdsAutomationSourceReadinessReviewExportService } from "./ads-automation-source-readiness-review-export.service";
import { AdsAutomationPolicyDecisionAuditLinkageService } from "./ads-automation-policy-decision-audit-linkage.service";
import { AdsAutomationProductionReadinessBridgeService } from "./ads-automation-production-readiness-bridge.service";
import { AdsAutomationCredentialVaultOnboardingService } from "./ads-automation-credential-vault-onboarding.service";
import { AdsAutomationSmallCapApprovalPreflightLinkageService } from "./ads-automation-small-cap-approval-preflight-linkage.service";
import { AdsAutomationSmallCapReadinessSimulatorService } from "./ads-automation-small-cap-readiness-simulator.service";
import { AdsAutomationDecisionMongoReadModelRepository } from "./ads-automation-decision-mongo-read-model.repository";
import { AdsAutomationDecisionReadModelQueryService } from "./ads-automation-decision-read-model-query.service";
import { AdsAutomationDecisionSourceAdapterService } from "./ads-automation-decision-source-adapter.service";
import { AdsAutomationErpSourceImportReadinessService } from "./ads-automation-erp-source-import-readiness.service";
import { AdsAutomationErpSourceProjectionRepository } from "./ads-automation-erp-source-projection.repository";
import { AdsAutomationExecutionPreflightDryRunReadbackService } from "./ads-automation-execution-preflight-dry-run-readback.service";
import { AdsAutomationExecutionPreflightDryRunRepository } from "./ads-automation-execution-preflight-dry-run.repository";
import { AdsAutomationExecutionPreflightDryRunService } from "./ads-automation-execution-preflight-dry-run.service";
import { AdsAutomationPendingErpActionNormalizerService } from "./ads-automation-pending-erp-action-normalizer.service";
import { AdsAutomationPolicyDecisionEvidenceReadbackService } from "./ads-automation-policy-decision-evidence-readback.service";
import { AdsAutomationPolicyDecisionEvidenceRepository } from "./ads-automation-policy-decision-evidence.repository";
import { AdsAutomationProviderValidateOnlyPlannerService } from "./ads-automation-provider-validate-only-planner.service";
import { AdsAutomationValidateOnlyEvidenceReadbackService } from "./ads-automation-validate-only-evidence-readback.service";
import { AdsAutomationValidateOnlyEvidenceRepository } from "./ads-automation-validate-only-evidence.repository";
import { AiDataPackController } from "./ai-data-pack.controller";
import { DataPackMetadataService } from "./data-pack-metadata.service";
import { DataQualityReportService } from "./data-quality-report.service";
import { DecisionHistoryExportService } from "./decision-history-export.service";
import { DirectorDataPackService } from "./director-data-pack.service";
import { JsonExporterService } from "./export/json-exporter.service";
import { XlsxExporterService } from "./export/xlsx-exporter.service";
import { ExportEndpointAuditService } from "./audit/export-endpoint-audit.service";
import {
  AiDataPackEndpointAudit,
  AiDataPackEndpointAuditSchema,
} from "./audit/export-endpoint-audit.schema";
import { ExportJobArtifactService } from "./export-jobs/export-job-artifact.service";
import { ExportJobEndpointController } from "./export-jobs/export-job-endpoint.controller";
import { ExportJobEndpointService } from "./export-jobs/export-job-endpoint.service";
import { ExportEndpointRateLimitService } from "./export-jobs/export-endpoint-rate-limit.service";
import { ExportJobResponseRedactorService } from "./export-jobs/export-job-response-redactor.service";
import { ExportEndpointObservabilityService } from "./observability/export-endpoint-observability.service";
import {
  AiDataPackExportJob,
  AiDataPackExportJobSchema,
} from "./export-jobs/export-job.schema";
import { AiDataPackExportJobService } from "./export-jobs/export-job.service";
import { MappingReportService } from "./mapping-report.service";
import { MarketerDataPackService } from "./marketer-data-pack.service";
import { AdsPerformanceQuery } from "./queries/ads-performance.query";
import { CustomerLtvQuery } from "./queries/customer-ltv.query";
import { FinanceDataQuery } from "./queries/finance-data.query";
import { LeadFunnelQuery } from "./queries/lead-funnel.query";
import { OperationsCapacityQuery } from "./queries/operations-capacity.query";
import { OrderProfitQuery } from "./queries/order-profit.query";
import { ExportEndpointPolicyService } from "./rbac/export-endpoint-policy.service";
import { ExportRbacPolicyService } from "./rbac/export-rbac-policy.service";
import { ExportRedactionProfileService } from "./redaction/export-redaction-profile.service";
import { CoverageGateService } from "./source-registry/coverage-gate.service";
import { DbWatermarkService } from "./source-registry/db-watermark.service";
import { FreshnessGateService } from "./source-registry/freshness-gate.service";
import { SourceRegistryService } from "./source-registry/source-registry.service";
import { SourceSyncOrchestratorService } from "./source-sync/source-sync-orchestrator.service";
import { SourceSyncPolicyService } from "./source-sync/source-sync-policy.service";
import {
  AiDataPackAdsAutomationPendingApproval,
  AiDataPackAdsAutomationPendingApprovalSchema,
} from "./schemas/ads-automation-decision-draft-approval.schema";
import {
  AiDataPackAdsAutomationDecisionAuditRecord,
  AiDataPackAdsAutomationDecisionAuditRecordSchema,
} from "./schemas/ads-automation-decision-draft-approval-decision-audit.schema";
import {
  AiDataPackAdsAutomationExecutionPreflightDryRun,
  AiDataPackAdsAutomationExecutionPreflightDryRunSchema,
} from "./schemas/ads-automation-execution-preflight-dry-run.schema";
import {
  AiDataPackAdsAutomationPolicyDecisionEvidence,
  AiDataPackAdsAutomationPolicyDecisionEvidenceSchema,
} from "./schemas/ads-automation-policy-decision-evidence.schema";
import {
  AiDataPackAdsAutomationValidateOnlyEvidence,
  AiDataPackAdsAutomationValidateOnlyEvidenceSchema,
} from "./schemas/ads-automation-validate-only-evidence.schema";
import {
  THRESHOLD_SOURCE_RECORDS,
  THRESHOLD_SOURCE_RECORDS_TOKEN,
} from "./threshold-registry/threshold-source.config";
import { ThresholdSourceResolver } from "./threshold-registry/threshold-source.resolver";

@Module({
  imports: [
    ApiTokenModule,
    FinanceModule,
    MongooseModule.forFeature([
      { name: AiDataPackExportJob.name, schema: AiDataPackExportJobSchema },
      {
        name: AiDataPackAdsAutomationPendingApproval.name,
        schema: AiDataPackAdsAutomationPendingApprovalSchema,
      },
      {
        name: AiDataPackAdsAutomationDecisionAuditRecord.name,
        schema: AiDataPackAdsAutomationDecisionAuditRecordSchema,
      },
      {
        name: AiDataPackAdsAutomationExecutionPreflightDryRun.name,
        schema: AiDataPackAdsAutomationExecutionPreflightDryRunSchema,
      },
      {
        name: AiDataPackAdsAutomationPolicyDecisionEvidence.name,
        schema: AiDataPackAdsAutomationPolicyDecisionEvidenceSchema,
      },
      {
        name: AiDataPackAdsAutomationValidateOnlyEvidence.name,
        schema: AiDataPackAdsAutomationValidateOnlyEvidenceSchema,
      },
      {
        name: AiDataPackEndpointAudit.name,
        schema: AiDataPackEndpointAuditSchema,
      },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: AdGroup.name, schema: AdGroupSchema },
      { name: AdvertisingCost.name, schema: AdvertisingCostSchema },
      { name: Product.name, schema: ProductSchema },
      { name: InventorySummary.name, schema: InventorySummarySchema },
      { name: SupplierQuote.name, schema: SupplierQuoteSchema },
      { name: SupplierPayable.name, schema: SupplierPayableSchema },
      { name: User.name, schema: UserSchema },
      {
        name: AvailableFundSnapshot.name,
        schema: AvailableFundSnapshotSchema,
      },
      {
        name: CashflowSummarySnapshot.name,
        schema: CashflowSummarySnapshotSchema,
      },
    ]),
  ],
  controllers: [AiDataPackController, ExportJobEndpointController],
  providers: [
    DataPackMetadataService,
    JsonExporterService,
    XlsxExporterService,
    ExportJobArtifactService,
    ExportEndpointAuditService,
    ExportEndpointObservabilityService,
    ExportEndpointPolicyService,
    ExportEndpointRateLimitService,
    ExportJobResponseRedactorService,
    ExportJobEndpointService,
    ExportRedactionProfileService,
    ExportRbacPolicyService,
    AiDataPackExportJobService,
    FinanceDataQuery,
    OrderProfitQuery,
    CustomerLtvQuery,
    LeadFunnelQuery,
    AdsPerformanceQuery,
    OperationsCapacityQuery,
    SourceRegistryService,
    DbWatermarkService,
    CoverageGateService,
    FreshnessGateService,
    SourceSyncPolicyService,
    SourceSyncOrchestratorService,
    {
      provide: THRESHOLD_SOURCE_RECORDS_TOKEN,
      useValue: THRESHOLD_SOURCE_RECORDS,
    },
    ThresholdSourceResolver,
    AdsAutomationDecisionDraftApprovalDecisionAuditRepository,
    AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService,
    AdsAutomationDecisionDraftApprovalDecisionMutationService,
    AdsAutomationDecisionDraftApprovalRepository,
    AdsAutomationDecisionDraftApprovalQueueService,
    AdsAutomationDecisionDraftPreviewService,
    AdsAutomationFinalGateReviewExportService,
    AdsAutomationFinalGoNoGoGateService,
    AdsAutomationFoundationAcceptanceMatrixService,
    AdsAutomationGoogleAdsDryRunReconciliationService,
    AdsAutomationGoogleAdsMockImportDemoService,
    AdsAutomationApprovalEvidenceIndexService,
    AdsAutomationApprovalEvidenceReviewExportService,
    AdsAutomationApprovalEvidenceReviewerDocsService,
    AdsAutomationApprovalPreflightReviewExportService,
    AdsAutomationDecisionFoundationReviewExportService,
    AdsAutomationDecisionFoundationReviewerDocsService,
    AdsAutomationDecisionFoundationSnapshotService,
    AdsAutomationDecisionService,
    AdsAutomationApiReadinessGapReportService,
    AdsAutomationLossLimitPolicyService,
    AdsAutomationMonitoringIncidentReadinessService,
    AdsAutomationMonitoringTelemetryReadModelRepository,
    AdsAutomationMonitoringTelemetryReadModelService,
    AdsAutomationManagerAccountControlPlaneService,
    AdsAutomationProviderAccountReadinessService,
    AdsAutomationReadonlyPlatformImportReadinessService,
    AdsAutomationPlatformSourceSyncStatusService,
    AdsAutomationSourceReadinessReviewExportService,
    AdsAutomationPolicyDecisionAuditLinkageService,
    AdsAutomationProductionReadinessBridgeService,
    AdsAutomationCredentialVaultOnboardingService,
    AdsAutomationSmallCapApprovalPreflightLinkageService,
    AdsAutomationSmallCapReadinessSimulatorService,
    AdsAutomationDecisionMongoReadModelRepository,
    AdsAutomationDecisionReadModelQueryService,
    AdsAutomationDecisionSourceAdapterService,
    AdsAutomationErpSourceImportReadinessService,
    AdsAutomationErpSourceProjectionRepository,
    AdsAutomationExecutionPreflightDryRunReadbackService,
    AdsAutomationExecutionPreflightDryRunRepository,
    AdsAutomationExecutionPreflightDryRunService,
    AdsAutomationPendingErpActionNormalizerService,
    AdsAutomationPolicyDecisionEvidenceReadbackService,
    AdsAutomationPolicyDecisionEvidenceRepository,
    AdsAutomationProviderValidateOnlyPlannerService,
    AdsAutomationValidateOnlyEvidenceReadbackService,
    AdsAutomationValidateOnlyEvidenceRepository,
    DataQualityReportService,
    MappingReportService,
    DecisionHistoryExportService,
    DirectorDataPackService,
    MarketerDataPackService,
  ],
  exports: [
    DirectorDataPackService,
    MarketerDataPackService,
    DataQualityReportService,
    MappingReportService,
    DecisionHistoryExportService,
    AiDataPackExportJobService,
    SourceRegistryService,
    FreshnessGateService,
    SourceSyncOrchestratorService,
    AdsAutomationDecisionDraftApprovalDecisionAuditRepository,
    AdsAutomationDecisionDraftApprovalDecisionAuditReadbackService,
    AdsAutomationDecisionDraftApprovalDecisionMutationService,
    AdsAutomationDecisionDraftApprovalRepository,
    AdsAutomationDecisionDraftApprovalQueueService,
    AdsAutomationDecisionDraftPreviewService,
    AdsAutomationFinalGateReviewExportService,
    AdsAutomationFinalGoNoGoGateService,
    AdsAutomationFoundationAcceptanceMatrixService,
    AdsAutomationGoogleAdsDryRunReconciliationService,
    AdsAutomationGoogleAdsMockImportDemoService,
    AdsAutomationApprovalEvidenceIndexService,
    AdsAutomationApprovalEvidenceReviewExportService,
    AdsAutomationApprovalEvidenceReviewerDocsService,
    AdsAutomationApprovalPreflightReviewExportService,
    AdsAutomationDecisionFoundationReviewExportService,
    AdsAutomationDecisionFoundationReviewerDocsService,
    AdsAutomationDecisionFoundationSnapshotService,
    AdsAutomationDecisionService,
    AdsAutomationApiReadinessGapReportService,
    AdsAutomationLossLimitPolicyService,
    AdsAutomationMonitoringIncidentReadinessService,
    AdsAutomationMonitoringTelemetryReadModelRepository,
    AdsAutomationMonitoringTelemetryReadModelService,
    AdsAutomationManagerAccountControlPlaneService,
    AdsAutomationProviderAccountReadinessService,
    AdsAutomationReadonlyPlatformImportReadinessService,
    AdsAutomationPlatformSourceSyncStatusService,
    AdsAutomationSourceReadinessReviewExportService,
    AdsAutomationPolicyDecisionAuditLinkageService,
    AdsAutomationProductionReadinessBridgeService,
    AdsAutomationCredentialVaultOnboardingService,
    AdsAutomationSmallCapApprovalPreflightLinkageService,
    AdsAutomationSmallCapReadinessSimulatorService,
    AdsAutomationDecisionMongoReadModelRepository,
    AdsAutomationDecisionReadModelQueryService,
    AdsAutomationDecisionSourceAdapterService,
    AdsAutomationErpSourceImportReadinessService,
    AdsAutomationErpSourceProjectionRepository,
    AdsAutomationExecutionPreflightDryRunReadbackService,
    AdsAutomationExecutionPreflightDryRunRepository,
    AdsAutomationExecutionPreflightDryRunService,
    AdsAutomationPendingErpActionNormalizerService,
    AdsAutomationPolicyDecisionEvidenceReadbackService,
    AdsAutomationPolicyDecisionEvidenceRepository,
    AdsAutomationProviderValidateOnlyPlannerService,
    AdsAutomationValidateOnlyEvidenceReadbackService,
    AdsAutomationValidateOnlyEvidenceRepository,
  ],
})
export class AiDataPackModule {}
