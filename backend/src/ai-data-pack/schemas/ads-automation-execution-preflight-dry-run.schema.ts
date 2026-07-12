import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
} from '../contracts/ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationDecisionDraftApprovalStatus,
  AdsAutomationDecisionDraftApprovalStorage,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from '../contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationExecutionDryRunRecordStatus,
  AdsAutomationExecutionPreflightGateClosure,
  AdsAutomationExecutionIdentifierSnapshot,
  AdsAutomationExecutionPolicyDecision,
  AdsAutomationExecutionPreflightDryRunRecord,
  AdsAutomationExecutionPreflightGate,
  AdsAutomationExecutionPreflightNextAction,
  AdsAutomationExecutionPreflightStatus,
} from '../contracts/ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationProviderValidateOnlyActionPlan } from '../contracts/ads-automation-provider-validate-only.contract';

export type AiDataPackAdsAutomationExecutionPreflightDryRunDocument =
  HydratedDocument<AiDataPackAdsAutomationExecutionPreflightDryRun>;

@Schema({
  collection: 'ai_data_pack_ads_automation_execution_preflight_dry_runs',
  timestamps: false,
})
export class AiDataPackAdsAutomationExecutionPreflightDryRun {
  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  execution_record_id!: string;

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  idempotency_key!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  approval_id!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  source_draft_id!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  source_decision_id!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  action_type!: AdsAutomationDecisionDraftActionType;

  @Prop({ required: true, type: String, trim: true, index: true })
  action_family!: AdsAutomationDecisionDraftFamily;

  @Prop({ required: true, type: String, trim: true, index: true })
  provider!: AdsAutomationDecisionDraftPreview['provider'];

  @Prop({ required: true, type: String, trim: true })
  resource_type!: AdsAutomationDecisionDraftPreview['resource_type'];

  @Prop({ required: true, type: String, trim: true, index: true })
  entity_type!: AdsAutomationDecisionDraftPreview['entity_type'];

  @Prop({ required: true, type: String, trim: true, index: true })
  entity_id!: string;

  @Prop({ type: String, trim: true, index: true, default: null })
  accountId!: string | null;

  @Prop({ type: String, trim: true, default: null })
  platform!: string | null;

  @Prop({ required: true, type: String, trim: true, index: true })
  approval_status!: AdsAutomationDecisionDraftApprovalStatus;

  @Prop({ type: String, trim: true, index: true, default: null })
  approval_decision_audit_id!: string | null;

  @Prop({ required: true, type: Boolean, default: false })
  approval_decision_audit_persisted!: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  source_readiness_safe!: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  kill_switch_active!: boolean;

  @Prop({ type: String, trim: true, default: null })
  kill_switch_reason!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  validateOnly_validation_id!: string | null;

  @Prop({ required: true, type: Boolean, default: false })
  validateOnly_evidence_persisted!: boolean;

  @Prop({ required: true, type: String, trim: true, index: true })
  validateOnly_status!: AdsAutomationProviderValidateOnlyActionPlan['status'] | 'missing';

  @Prop({ type: String, trim: true, index: true, default: null })
  policy_decision_id!: string | null;

  @Prop({ required: true, type: Boolean, default: false })
  policy_decision_evidence_persisted!: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  policy_allowed!: boolean;

  @Prop({ required: true, type: Boolean, default: false })
  google_ads_production_enabled!: boolean;

  @Prop({ required: true, type: String, trim: true, index: true })
  preflight_status!: AdsAutomationExecutionPreflightStatus;

  @Prop({ required: true, type: String, trim: true, index: true })
  dry_run_record_status!: AdsAutomationExecutionDryRunRecordStatus;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  future_live_execution_allowed!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  execution_allowed_now!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  provider_api_called!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  google_ads_api_called!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  validateOnly_called!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  live_ads_execution_used!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  erp_mutation_used!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  payment_mutation_used!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  direct_google_ads_api_call!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  provider_mutation_used!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  live_path_implemented!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  campaignBudgetId_fallback_used!: false;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  preflight_record_persisted!: true;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  persistence_used!: true;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  durable_storage_used!: true;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  erp_local_persistence_used!: true;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  provider_persistence_used!: false;

  @Prop({ required: true, type: String, trim: true, default: 'erp_local_mongo' })
  storage!: AdsAutomationDecisionDraftApprovalStorage;

  @Prop({ required: true, type: Object })
  requested_change!: Record<string, unknown>;

  @Prop({ required: true, type: Object })
  identifiers!: AdsAutomationExecutionIdentifierSnapshot;

  @Prop({ type: [Object], default: [] })
  gates!: AdsAutomationExecutionPreflightGate[];

  @Prop({ type: Object, default: null })
  execution_gate_closure!: AdsAutomationExecutionPreflightGateClosure | null;

  @Prop({ type: [String], default: [] })
  blockers!: string[];

  @Prop({ required: true, type: String, trim: true })
  next_required_action!: AdsAutomationExecutionPreflightNextAction;

  @Prop({ required: true, type: Object })
  source_pending_approval!: AdsAutomationDecisionDraftPendingApprovalRecord;

  @Prop({ type: Object, default: null })
  source_validateOnly_plan!: AdsAutomationProviderValidateOnlyActionPlan | null;

  @Prop({ type: Object, default: null })
  policy_decision!: AdsAutomationExecutionPolicyDecision | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  requestedByUserId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  requestedByRole!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  requestId!: string | null;

  @Prop({ required: true, type: String, trim: true, index: true })
  createdAt!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  persistedAt!: string;
}

export const AiDataPackAdsAutomationExecutionPreflightDryRunSchema =
  SchemaFactory.createForClass(AiDataPackAdsAutomationExecutionPreflightDryRun);

AiDataPackAdsAutomationExecutionPreflightDryRunSchema.index(
  { execution_record_id: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_exec_preflight_record_id' },
);
AiDataPackAdsAutomationExecutionPreflightDryRunSchema.index(
  { idempotency_key: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_exec_preflight_idempotency' },
);
AiDataPackAdsAutomationExecutionPreflightDryRunSchema.index(
  { approval_id: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_exec_preflight_approval_created' },
);
AiDataPackAdsAutomationExecutionPreflightDryRunSchema.index(
  { policy_decision_id: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_exec_preflight_policy_decision_created' },
);
AiDataPackAdsAutomationExecutionPreflightDryRunSchema.index(
  { validateOnly_validation_id: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_exec_preflight_validate_only_created' },
);
AiDataPackAdsAutomationExecutionPreflightDryRunSchema.index(
  { action_family: 1, action_type: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_exec_preflight_action_created' },
);
