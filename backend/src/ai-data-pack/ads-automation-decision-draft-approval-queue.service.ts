import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdsAutomationDecisionDraftApprovalRepository } from './ads-automation-decision-draft-approval.repository';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAction,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewResponse,
  AdsAutomationDecisionDraftApprovalDecisionValidationInput,
  AdsAutomationDecisionDraftApprovalDecisionValidationResponse,
  AdsAutomationDecisionDraftApprovalImportResponse,
  AdsAutomationDecisionDraftApprovalReadModelQuery,
  AdsAutomationDecisionDraftApprovalReadModelResponse,
  AdsAutomationDecisionDraftApprovalReadModelSafety,
  AdsAutomationDecisionDraftApprovalReadinessPrerequisite,
  AdsAutomationDecisionDraftApprovalReadinessResponse,
  AdsAutomationDecisionDraftApprovalReadRecordResponse,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './contracts/ads-automation-decision-draft-preview.contract';

const ALLOWED_ACTION_TYPES: AdsAutomationDecisionDraftActionType[] = [
  'update_campaign_budget',
  'pause_ad_group',
  'pause_campaign',
  'monitor_only',
  'supplier_sourcing',
  'product_offer_fix',
  'stop_import_review',
];

const ADS_AUTOMATION_REQUIRED_SOURCE_KEYS = [
  'google_ads',
  'advertising_costs',
  'product_mapping',
  'inventory_profit',
  'supplier_safety',
] as const;

@Injectable()
export class AdsAutomationDecisionDraftApprovalQueueService {
  constructor(
    private readonly approvalRepository: AdsAutomationDecisionDraftApprovalRepository,
  ) {}

  async importPreview(
    preview: AdsAutomationDecisionDraftPreviewResponse,
  ): Promise<AdsAutomationDecisionDraftApprovalImportResponse> {
    this.assertPreviewEnvelope(preview);
    this.assertPreviewImportGate(preview);

    const seenKeys = new Set<string>();
    const createdAt = new Date().toISOString();
    const records = preview.drafts.map((draft) => {
      this.assertImportableDraft(draft, seenKeys);
      return this.toPendingApproval(preview, draft, createdAt);
    });

    const existingKeys = await this.approvalRepository.findExistingIdempotencyKeys(
      records.map((record) => record.idempotency_key),
    );
    if (existingKeys.size) {
      throw new BadRequestException(`duplicate idempotency_key rejected: ${Array.from(existingKeys).sort()[0]}`);
    }

    const storedRecords = await this.approvalRepository.createMany(records);

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_import.v1',
      generatedAt: createdAt,
      sourcePreviewSchemaVersion: preview.schemaVersion,
      safety: {
        dry_run: true,
        in_memory_only: false,
        persistence_used: true,
        durable_storage_used: true,
        erp_local_persistence_used: true,
        provider_persistence_used: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        production_ready: false,
        approval_required_for_all_records: true,
        execution_allowed_now: false,
      },
      summary: {
        previews_received: preview.drafts.length,
        pending_approvals_created: storedRecords.length,
        provider_action_approvals: storedRecords.filter((record) => record.action_family === 'provider_google_ads').length,
        internal_task_approvals: storedRecords.filter((record) => record.action_family === 'internal_task').length,
        monitoring_approvals: storedRecords.filter((record) => record.action_family === 'monitoring').length,
        duplicates_rejected: 0,
      },
      pendingApprovals: storedRecords,
    };
  }

  async listPendingApprovals(
    input: AdsAutomationDecisionDraftApprovalReadModelQuery = {},
  ): Promise<AdsAutomationDecisionDraftApprovalReadModelResponse> {
    const query = this.readModelQuery(input || {});
    const [totalPendingApprovals, pendingApprovals] = await Promise.all([
      this.approvalRepository.countPendingApprovals(),
      this.approvalRepository.listPendingApprovals(query),
    ]);

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_queue.v1',
      generatedAt: new Date().toISOString(),
      query,
      safety: this.readOnlySafety(),
      summary: {
        total_pending_approvals: totalPendingApprovals,
        pending_approvals_listed: pendingApprovals.length,
        provider_action_approvals: pendingApprovals.filter((record) => record.action_family === 'provider_google_ads').length,
        internal_task_approvals: pendingApprovals.filter((record) => record.action_family === 'internal_task').length,
        monitoring_approvals: pendingApprovals.filter((record) => record.action_family === 'monitoring').length,
      },
      pendingApprovals,
    };
  }

  async readPendingApproval(approvalId: string): Promise<AdsAutomationDecisionDraftApprovalReadRecordResponse> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) {
      throw new BadRequestException('approvalId is required');
    }

    const pendingApproval = await this.approvalRepository.findByApprovalId(normalizedApprovalId);
    if (!pendingApproval) {
      throw new NotFoundException(`pending approval not found: ${normalizedApprovalId}`);
    }

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_record.v1',
      generatedAt: new Date().toISOString(),
      safety: this.readOnlySafety(),
      pendingApproval,
    };
  }

  async reviewPendingApprovalReadiness(
    approvalId: string,
  ): Promise<AdsAutomationDecisionDraftApprovalReadinessResponse> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) {
      throw new BadRequestException('approvalId is required');
    }

    const pendingApproval = await this.approvalRepository.findByApprovalId(normalizedApprovalId);
    if (!pendingApproval) {
      throw new NotFoundException(`pending approval not found: ${normalizedApprovalId}`);
    }

    const prerequisites = this.readinessPrerequisites(pendingApproval);
    const blockers = this.unique([
      ...this.arrayText(pendingApproval.blockers),
      ...this.arrayText(pendingApproval.missing_data_blockers),
      ...this.sourceSyncDecisionBlockers(pendingApproval),
      ...prerequisites
        .filter((item) => item.status === 'blocked')
        .map((item) => item.key),
    ]);
    const prerequisitesValid = prerequisites.filter((item) => item.status === 'valid').length;
    const prerequisitesBlocked = prerequisites.length - prerequisitesValid;

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_readiness.v1',
      generatedAt: new Date().toISOString(),
      safety: this.readOnlySafety(),
      summary: {
        readiness_status: blockers.length ? 'blocked' : 'ready_for_human_review',
        approval_required: true,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        prerequisites_valid: prerequisitesValid,
        prerequisites_blocked: prerequisitesBlocked,
        blockers_count: blockers.length,
        next_required_action: blockers.length ? 'fix_blockers_before_review' : 'human_review',
      },
      prerequisites,
      blockers,
      pendingApproval,
    };
  }

  async validatePendingApprovalDecision(
    approvalId: string,
    input: AdsAutomationDecisionDraftApprovalDecisionValidationInput = {},
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionValidationResponse> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) {
      throw new BadRequestException('approvalId is required');
    }

    const pendingApproval = await this.approvalRepository.findByApprovalId(normalizedApprovalId);
    if (!pendingApproval) {
      throw new NotFoundException(`pending approval not found: ${normalizedApprovalId}`);
    }

    const proposedAction = this.decisionAction(input?.decision);
    const normalizedDecision = {
      decision: proposedAction || 'invalid',
      reviewerUserId: this.text(input?.reviewerUserId),
      reviewerRole: this.text(input?.reviewerRole),
      reason: this.text(input?.reason),
      requestId: this.text(input?.requestId),
      would_update_status_to: proposedAction === 'approve'
        ? 'approved'
        : proposedAction === 'reject'
          ? 'rejected'
          : null,
      status_change_performed: false,
    } as const;
    const prerequisites = this.decisionValidationPrerequisites(
      pendingApproval,
      proposedAction,
      normalizedDecision,
    );
    const approvalBlockers = proposedAction === 'approve'
      ? [
        ...this.arrayText(pendingApproval.blockers),
        ...this.arrayText(pendingApproval.missing_data_blockers),
        ...this.sourceSyncDecisionBlockers(pendingApproval),
      ]
      : [];
    const blockers = this.unique([
      ...approvalBlockers,
      ...prerequisites
        .filter((item) => item.status === 'blocked')
        .map((item) => item.key),
    ]);
    const prerequisitesValid = prerequisites.filter((item) => item.status === 'valid').length;
    const prerequisitesBlocked = prerequisites.length - prerequisitesValid;
    const validationStatus = blockers.length ? 'blocked' : 'eligible_for_human_decision';

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_validation.v1',
      generatedAt: new Date().toISOString(),
      safety: this.readOnlySafety(),
      summary: {
        validation_status: validationStatus,
        proposed_decision: normalizedDecision.decision,
        approval_required: true,
        execution_allowed_now: false,
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        prerequisites_valid: prerequisitesValid,
        prerequisites_blocked: prerequisitesBlocked,
        blockers_count: blockers.length,
        next_required_action: blockers.length
          ? 'fix_blockers_before_decision'
          : proposedAction === 'approve'
            ? 'future_approve_endpoint'
            : 'future_reject_endpoint',
      },
      proposedDecision: normalizedDecision,
      prerequisites,
      blockers,
      pendingApproval,
    };
  }

  async previewPendingApprovalDecisionAuditRecord(
    approvalId: string,
    input: AdsAutomationDecisionDraftApprovalDecisionValidationInput = {},
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecordPreviewResponse> {
    const decisionValidation = await this.validatePendingApprovalDecision(approvalId, input);
    const generatedAt = new Date().toISOString();
    const pendingApproval = decisionValidation.pendingApproval;
    const proposedDecision = decisionValidation.proposedDecision;
    const auditBlockers = [...decisionValidation.blockers];
    const auditPrerequisites = decisionValidation.prerequisites.map((item) => ({ ...item }));
    const pendingApprovalSnapshot = this.cloneJson(pendingApproval);
    const auditRecordPreview: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload = {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
      audit_id: `ADSAUDIT-${this.safeKey(pendingApproval.approval_id)}-${this.safeKey(proposedDecision.decision)}-${this.safeKey(proposedDecision.requestId || generatedAt)}`,
      approval_id: pendingApproval.approval_id,
      source_draft_id: pendingApproval.source_draft_id,
      source_decision_id: pendingApproval.source_decision_id,
      action_type: pendingApproval.action_type,
      action_family: pendingApproval.action_family,
      provider: pendingApproval.provider,
      resource_type: pendingApproval.resource_type,
      entity_type: pendingApproval.entity_type,
      entity_id: pendingApproval.entity_id,
      accountId: pendingApproval.accountId,
      productId: pendingApproval.productId,
      supplierId: pendingApproval.supplierId,
      platform: pendingApproval.platform,
      previous_status: pendingApproval.status,
      proposed_status: proposedDecision.would_update_status_to,
      decision: proposedDecision.decision,
      reviewerUserId: proposedDecision.reviewerUserId,
      reviewerRole: proposedDecision.reviewerRole,
      reason: proposedDecision.reason,
      requestId: proposedDecision.requestId,
      validation_status: decisionValidation.summary.validation_status,
      prerequisites_valid: decisionValidation.summary.prerequisites_valid,
      prerequisites_blocked: decisionValidation.summary.prerequisites_blocked,
      blockers: auditBlockers,
      prerequisites: auditPrerequisites,
      pending_approval_snapshot: pendingApprovalSnapshot,
      audit_record_persisted: false,
      status_change_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
      createdAt: generatedAt,
    };

    return {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record_preview.v1',
      generatedAt,
      safety: {
        ...this.readOnlySafety(),
        audit_record_persisted: false,
        status_change_performed: false,
      },
      summary: {
        audit_preview_status: decisionValidation.blockers.length
          ? 'blocked'
          : 'ready_for_future_audit_persist',
        proposed_decision: proposedDecision.decision,
        approval_required: true,
        execution_allowed_now: false,
        audit_record_persisted: false,
        status_change_performed: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        blockers_count: decisionValidation.blockers.length,
        next_required_action: decisionValidation.summary.next_required_action,
      },
      proposedDecision: { ...proposedDecision },
      decisionValidation: {
        ...decisionValidation,
        safety: { ...decisionValidation.safety },
        summary: { ...decisionValidation.summary },
        proposedDecision: { ...decisionValidation.proposedDecision },
        prerequisites: decisionValidation.prerequisites.map((item) => ({ ...item })),
        blockers: [...decisionValidation.blockers],
        pendingApproval: this.cloneJson(pendingApproval),
      },
      auditRecordPreview,
      pendingApproval: this.cloneJson(pendingApproval),
    };
  }

  private assertPreviewEnvelope(preview: AdsAutomationDecisionDraftPreviewResponse): void {
    if (!preview || typeof preview !== 'object') {
      throw new BadRequestException('draft preview payload is required');
    }
    if (preview.schemaVersion !== 'ads_automation_decision_draft_preview.v1') {
      throw new BadRequestException('payload must use ads_automation_decision_draft_preview.v1');
    }
    if (!Array.isArray(preview.drafts)) {
      throw new BadRequestException('drafts must be an array');
    }
    if (!preview.safety || typeof preview.safety !== 'object') {
      throw new BadRequestException('draft preview safety flags are required');
    }
    if (preview.safety.approval_required_for_all_drafts !== true) {
      throw new BadRequestException('approval_required_for_all_drafts must be true');
    }
    if (preview.safety.execution_allowed_now !== false) {
      throw new BadRequestException('execution_allowed_now must be false');
    }
    if (preview.safety.provider_api_called !== false || preview.safety.google_ads_api_called !== false) {
      throw new BadRequestException('imported previews must not have provider or Google Ads API calls');
    }
    if (preview.safety.live_ads_execution_used !== false) {
      throw new BadRequestException('imported previews must not have live ads execution');
    }
    if (preview.safety.persistence_used !== false) {
      throw new BadRequestException('imported previews must not have persistence_used=true');
    }
  }

  private assertPreviewImportGate(preview: AdsAutomationDecisionDraftPreviewResponse): void {
    if (preview.sourceSyncDecisionGates?.canGenerateActionDraft !== false) {
      return;
    }

    const blockers = this.sourceSyncPreviewBlockers(preview);
    throw new BadRequestException([
      'source-sync gate does not allow pending approval import',
      blockers.length ? blockers.join(', ') : null,
    ].filter(Boolean).join(': '));
  }

  private assertImportableDraft(draft: AdsAutomationDecisionDraftPreview, seenKeys: Set<string>): void {
    if (!draft || typeof draft !== 'object') {
      throw new BadRequestException('draft entries must be objects');
    }
    if (!ALLOWED_ACTION_TYPES.includes(draft.action_type)) {
      throw new BadRequestException(`unsupported draft action_type: ${String((draft as any).action_type || '')}`);
    }
    if (draft.status !== 'pending_approval_preview') {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} is not pending approval preview`);
    }
    if (draft.approval_required !== true) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must require approval`);
    }
    if (draft.execution_allowed_now !== false) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must have execution_allowed_now=false`);
    }
    if (draft.provider_api_called !== false || draft.google_ads_api_called !== false) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must not call provider APIs`);
    }
    if (draft.live_ads_execution_used !== false || draft.persistence_used !== false) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must not execute live ads or persist externally`);
    }
    if (draft.action_family === 'provider_google_ads' && draft.future_provider_validateOnly_required !== true) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must require future provider validateOnly`);
    }
    const idempotencyKey = this.text(draft.idempotency_key);
    if (!idempotencyKey) {
      throw new BadRequestException(`draft ${draft.draft_id || '<unknown>'} must include idempotency_key`);
    }
    if (seenKeys.has(idempotencyKey)) {
      throw new BadRequestException(`duplicate idempotency_key rejected: ${idempotencyKey}`);
    }
    seenKeys.add(idempotencyKey);

    if (draft.action_type === 'update_campaign_budget') {
      const campaignBudgetId = this.text(draft.typedPayload?.campaignBudgetId);
      if (!campaignBudgetId) {
        throw new BadRequestException('update_campaign_budget requires typedPayload.campaignBudgetId');
      }
    }
    if (
      draft.action_type === 'stop_import_review'
      && (draft.typedPayload?.deleteProduct === true || draft.typedPayload?.providerDelete === true)
    ) {
      throw new BadRequestException('stop_import_review must not delete products or provider resources');
    }
  }

  private toPendingApproval(
    preview: AdsAutomationDecisionDraftPreviewResponse,
    draft: AdsAutomationDecisionDraftPreview,
    createdAt: string,
  ): AdsAutomationDecisionDraftPendingApprovalRecord {
    return {
      approval_id: `ADSAPPROVAL-${this.safeKey(draft.idempotency_key)}`,
      source_schema_version: preview.schemaVersion,
      source_draft_id: draft.draft_id,
      source_decision_id: draft.source_decision_id,
      action_type: draft.action_type,
      action_family: draft.action_family,
      provider: draft.provider,
      resource_type: draft.resource_type,
      entity_type: draft.entity_type,
      entity_id: draft.entity_id,
      accountId: draft.accountId,
      productId: draft.productId,
      supplierId: draft.supplierId,
      platform: draft.platform,
      status: 'pending_approval',
      approval_required: true,
      execution_allowed_now: false,
      validate_only_required: draft.validate_only_required,
      future_provider_validateOnly_required: draft.future_provider_validateOnly_required,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      typedPayload: draft.typedPayload,
      source_evidence_references: draft.source_evidence_references,
      sourceSyncDecisionEvidence: this.cloneJson(preview.sourceSyncDecisionEvidence || []),
      sourceSyncDecisionGates: preview.sourceSyncDecisionGates
        ? this.cloneJson(preview.sourceSyncDecisionGates)
        : null,
      blockers: draft.blockers,
      missing_data_blockers: draft.missing_data_blockers,
      idempotency_key: draft.idempotency_key,
      rationale: draft.rationale,
      createdAt,
      persistedAt: createdAt,
    };
  }

  private readModelQuery(input: AdsAutomationDecisionDraftApprovalReadModelQuery): AdsAutomationDecisionDraftApprovalReadModelQuery {
    const status = this.text(input.status);
    if (status && status !== 'pending_approval') {
      throw new BadRequestException('status must be pending_approval');
    }

    const actionType = this.text(input.action_type);
    if (actionType && !ALLOWED_ACTION_TYPES.includes(actionType as AdsAutomationDecisionDraftActionType)) {
      throw new BadRequestException(`unsupported action_type filter: ${actionType}`);
    }

    const actionFamily = this.text(input.action_family);
    const allowedActionFamilies: AdsAutomationDecisionDraftFamily[] = ['provider_google_ads', 'internal_task', 'monitoring'];
    if (actionFamily && !allowedActionFamilies.includes(actionFamily as AdsAutomationDecisionDraftFamily)) {
      throw new BadRequestException(`unsupported action_family filter: ${actionFamily}`);
    }

    const provider = this.text(input.provider);
    if (provider && !['google', 'erp_internal', 'none'].includes(provider)) {
      throw new BadRequestException(`unsupported provider filter: ${provider}`);
    }

    return {
      status: (status || undefined) as AdsAutomationDecisionDraftApprovalReadModelQuery['status'] | undefined,
      action_type: (actionType || undefined) as AdsAutomationDecisionDraftApprovalReadModelQuery['action_type'] | undefined,
      action_family: (actionFamily || undefined) as AdsAutomationDecisionDraftApprovalReadModelQuery['action_family'] | undefined,
      provider: (provider || undefined) as AdsAutomationDecisionDraftApprovalReadModelQuery['provider'] | undefined,
      accountId: this.text(input.accountId) || undefined,
      productId: this.text(input.productId) || undefined,
      supplierId: this.text(input.supplierId) || undefined,
    };
  }

  private readOnlySafety(): AdsAutomationDecisionDraftApprovalReadModelSafety {
    return {
      read_only: true,
      dry_run: true,
      in_memory_only: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_records: true,
      execution_allowed_now: false,
    };
  }

  private readinessPrerequisites(
    record: AdsAutomationDecisionDraftPendingApprovalRecord,
  ): AdsAutomationDecisionDraftApprovalReadinessPrerequisite[] {
    const prerequisites: AdsAutomationDecisionDraftApprovalReadinessPrerequisite[] = [];
    const add = (key: string, valid: boolean, detail: string) => {
      prerequisites.push({
        key,
        status: valid ? 'valid' : 'blocked',
        detail,
      });
    };

    add(
      'pending_approval_status',
      record.status === 'pending_approval',
      'Durable approval record must still be pending.',
    );
    add(
      'approval_required',
      record.approval_required === true,
      'Human approval remains required before any future action.',
    );
    add(
      'execution_allowed_now',
      record.execution_allowed_now === false,
      'Execution must remain disabled during readiness review.',
    );
    add(
      'erp_local_durable_storage',
      record.persistence_used === true
        && record.durable_storage_used === true
        && record.erp_local_persistence_used === true
        && record.provider_persistence_used === false
        && record.storage === 'erp_local_mongo',
      'Record must come from ERP-local durable storage only.',
    );
    add(
      'provider_api_called',
      record.provider_api_called === false,
      'Provider API must not have been called.',
    );
    add(
      'google_ads_api_called',
      record.google_ads_api_called === false,
      'Google Ads API must not have been called.',
    );
    add(
      'validateOnly_called',
      true,
      'Provider validateOnly is intentionally not called by this dry-run endpoint.',
    );
    add(
      'live_ads_execution_used',
      record.live_ads_execution_used === false,
      'Live ads execution must not have occurred.',
    );
    add(
      'erp_mutation_used',
      record.erp_mutation_used === false,
      'Business ERP records must not be mutated by readiness review.',
    );
    add(
      'payment_mutation_used',
      record.payment_mutation_used === false,
      'Payment records must not be mutated by readiness review.',
    );
    add(
      'supported_action_type',
      ALLOWED_ACTION_TYPES.includes(record.action_type),
      'Action type must be supported by the ERP approval queue.',
    );
    const sourceSyncBlockers = this.sourceSyncDecisionBlockers(record);
    add(
      'source_sync_decision_evidence',
      sourceSyncBlockers.length === 0,
      sourceSyncBlockers.length
        ? `Imported source-sync evidence blocks approval review: ${sourceSyncBlockers.join(', ')}.`
        : 'Imported source-sync evidence and gates do not block approval review.',
    );

    if (record.action_family === 'provider_google_ads') {
      add(
        'future_provider_validateOnly_required',
        record.future_provider_validateOnly_required === true && record.validate_only_required === true,
        'Future provider execution must require ERP-owned validateOnly before approval execution.',
      );
    }

    if (record.action_type === 'update_campaign_budget') {
      const payload = record.typedPayload || {};
      add(
        'typedPayload.customerId',
        Boolean(this.text(payload.customerId)),
        'Budget update readiness requires the Google Ads customer id.',
      );
      add(
        'typedPayload.campaignBudgetId',
        Boolean(this.text(payload.campaignBudgetId)),
        'Budget update readiness requires typedPayload.campaignBudgetId and must not fall back to campaignId or adGroupId.',
      );
      add(
        'typedPayload.dailyBudget',
        this.positiveNumber(payload.dailyBudget),
        'Budget update readiness requires a positive proposed dailyBudget.',
      );
    }

    return prerequisites;
  }

  private decisionValidationPrerequisites(
    record: AdsAutomationDecisionDraftPendingApprovalRecord,
    action: AdsAutomationDecisionDraftApprovalDecisionAction | null,
    decision: {
      reviewerUserId: string | null;
      reason: string | null;
    },
  ): AdsAutomationDecisionDraftApprovalReadinessPrerequisite[] {
    const prerequisites: AdsAutomationDecisionDraftApprovalReadinessPrerequisite[] = [];
    const add = (key: string, valid: boolean, detail: string) => {
      prerequisites.push({
        key,
        status: valid ? 'valid' : 'blocked',
        detail,
      });
    };

    add(
      'proposed_decision',
      action === 'approve' || action === 'reject',
      'Decision validation accepts only approve or reject.',
    );
    add(
      'reviewerUserId',
      Boolean(decision.reviewerUserId),
      'A human reviewer user id is required for decision validation.',
    );
    add(
      'decision.reason',
      Boolean(decision.reason),
      'A human review reason is required for decision validation.',
    );
    add(
      'status_change_performed',
      true,
      'Decision validation is a dry run and does not change approval status.',
    );

    if (action === 'approve') {
      return [
        ...prerequisites,
        ...this.readinessPrerequisites(record),
      ];
    }

    add(
      'pending_approval_status',
      record.status === 'pending_approval',
      'Durable approval record must still be pending.',
    );
    add(
      'approval_required',
      record.approval_required === true,
      'Human approval remains required before any future action.',
    );
    add(
      'execution_allowed_now',
      record.execution_allowed_now === false,
      'Execution must remain disabled during decision validation.',
    );
    add(
      'erp_local_durable_storage',
      record.persistence_used === true
        && record.durable_storage_used === true
        && record.erp_local_persistence_used === true
        && record.provider_persistence_used === false
        && record.storage === 'erp_local_mongo',
      'Record must come from ERP-local durable storage only.',
    );
    add(
      'provider_api_called',
      record.provider_api_called === false,
      'Provider API must not have been called.',
    );
    add(
      'google_ads_api_called',
      record.google_ads_api_called === false,
      'Google Ads API must not have been called.',
    );
    add(
      'validateOnly_called',
      true,
      'Provider validateOnly is intentionally not called by this dry-run endpoint.',
    );
    add(
      'live_ads_execution_used',
      record.live_ads_execution_used === false,
      'Live ads execution must not have occurred.',
    );
    add(
      'erp_mutation_used',
      record.erp_mutation_used === false,
      'Business ERP records must not be mutated by decision validation.',
    );
    add(
      'payment_mutation_used',
      record.payment_mutation_used === false,
      'Payment records must not be mutated by decision validation.',
    );

    return prerequisites;
  }

  private decisionAction(value: unknown): AdsAutomationDecisionDraftApprovalDecisionAction | null {
    const action = this.text(value)?.toLowerCase();
    if (action === 'approve' || action === 'reject') return action;
    return null;
  }

  private positiveNumber(value: unknown): boolean {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0;
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private unique(values: string[]): string[] {
    return [...new Set(values)].sort();
  }

  private sourceSyncDecisionBlockers(record: AdsAutomationDecisionDraftPendingApprovalRecord): string[] {
    const blockers: string[] = [];
    if (record.sourceSyncDecisionGates?.canGenerateActionDraft === false) {
      blockers.push('source_sync_gate_blocked_action_draft');
    }
    if (record.sourceSyncDecisionGates?.canRecommendAdsScale === false) {
      blockers.push('source_sync_gate_blocked_ads_scale_recommendation');
    }
    if (record.sourceSyncDecisionGates?.canUseGoogleAdsDataClaim === false) {
      blockers.push('source_sync_gate_blocked_google_ads_data_claim');
    }

    const evidenceBySource = new Map(
      (record.sourceSyncDecisionEvidence || [])
        .filter((evidence) => ADS_AUTOMATION_REQUIRED_SOURCE_KEYS.includes(evidence.sourceKey as any))
        .map((evidence) => [evidence.sourceKey, evidence]),
    );

    for (const sourceKey of ADS_AUTOMATION_REQUIRED_SOURCE_KEYS) {
      const evidence = evidenceBySource.get(sourceKey);
      if (!evidence) {
        blockers.push(`${sourceKey}_source_coverage_missing`);
        continue;
      }
      if (evidence.canUseForAdsAutomationDecision === true) {
        continue;
      }

      blockers.push(`${sourceKey}_not_ready_for_ads_automation_decision`);
      const blockingReason = this.text(evidence.blockingReason);
      if (blockingReason) blockers.push(blockingReason);
      blockers.push(...this.arrayText(evidence.blockingReasons));
    }

    return this.unique(blockers);
  }

  private sourceSyncPreviewBlockers(preview: AdsAutomationDecisionDraftPreviewResponse): string[] {
    const blockers: string[] = [];
    if (preview.sourceSyncDecisionGates?.canGenerateActionDraft === false) {
      blockers.push('source_sync_gate_blocked_action_draft');
    }
    if (preview.sourceSyncDecisionGates?.canRecommendAdsScale === false) {
      blockers.push('source_sync_gate_blocked_ads_scale_recommendation');
    }
    if (preview.sourceSyncDecisionGates?.canUseGoogleAdsDataClaim === false) {
      blockers.push('source_sync_gate_blocked_google_ads_data_claim');
    }

    for (const evidence of preview.sourceSyncDecisionEvidence || []) {
      if (evidence.canUseForAdsAutomationDecision === true) continue;
      const blockingReason = this.text(evidence.blockingReason);
      blockers.push(`${evidence.sourceKey}_not_ready_for_ads_automation_decision`);
      if (blockingReason) blockers.push(blockingReason);
      blockers.push(...this.arrayText(evidence.blockingReasons));
    }

    return this.unique(blockers);
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private safeKey(value: string): string {
    return String(value || 'unknown').replace(/[^a-z0-9_-]/gi, '_').slice(0, 96);
  }
}
