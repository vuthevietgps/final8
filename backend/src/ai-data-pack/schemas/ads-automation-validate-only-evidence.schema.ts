import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { AdsAutomationDecisionDraftApprovalStorage } from '../contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyError,
  AdsAutomationProviderValidateOnlyStatus,
} from '../contracts/ads-automation-provider-validate-only.contract';
import type { AdsAutomationPendingErpActionRecord } from '../contracts/ads-automation-pending-erp-action.contract';

export type AiDataPackAdsAutomationValidateOnlyEvidenceDocument =
  HydratedDocument<AiDataPackAdsAutomationValidateOnlyEvidence>;

@Schema({
  collection: 'ai_data_pack_ads_automation_validate_only_evidence',
  timestamps: false,
})
export class AiDataPackAdsAutomationValidateOnlyEvidence {
  @Prop({ required: true, type: String, trim: true })
  schemaVersion!: 'ads_automation_validate_only_evidence.v1';

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  validation_id!: string;

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  idempotency_key!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  pending_action_id!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  approval_id!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  source_pending_action_status!: AdsAutomationProviderValidateOnlyActionPlan['source_pending_action_status'];

  @Prop({ required: true, type: String, trim: true, index: true })
  action_type!: AdsAutomationProviderValidateOnlyActionPlan['action_type'];

  @Prop({ required: true, type: String, trim: true, index: true })
  action_family!: AdsAutomationProviderValidateOnlyActionPlan['action_family'];

  @Prop({ required: true, type: String, trim: true, index: true })
  provider!: AdsAutomationProviderValidateOnlyActionPlan['provider'];

  @Prop({ required: true, type: String, trim: true })
  resource_type!: AdsAutomationProviderValidateOnlyActionPlan['resource_type'];

  @Prop({ required: true, type: String, trim: true, index: true })
  entity_type!: AdsAutomationProviderValidateOnlyActionPlan['entity_type'];

  @Prop({ required: true, type: String, trim: true, index: true })
  entity_id!: string;

  @Prop({ type: String, trim: true, index: true, default: null })
  customerId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  campaignId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  adGroupId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  campaignBudgetId!: string | null;

  @Prop({ type: String, trim: true, default: null })
  campaignBudgetResourceName!: string | null;

  @Prop({ required: true, type: Object })
  requested_change!: Record<string, unknown>;

  @Prop({ required: true, type: String, trim: true, index: true })
  status!: AdsAutomationProviderValidateOnlyStatus;

  @Prop({ required: true, type: String, trim: true, index: true })
  providerValidationStatus!: AdsAutomationProviderValidateOnlyActionPlan['providerValidationStatus'];

  @Prop({ type: String, trim: true, default: null })
  providerRequestId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  providerValidatedAt!: string | null;

  @Prop({ type: [Object], default: [] })
  providerValidationErrors!: AdsAutomationProviderValidateOnlyError[];

  @Prop({ required: true, type: Object })
  before_state_snapshot!: AdsAutomationProviderValidateOnlyActionPlan['before_state_snapshot'];

  @Prop({ type: Object, default: null })
  validateOnly_request!: AdsAutomationProviderValidateOnlyActionPlan['validateOnly_request'] | null;

  @Prop({ type: Object, default: null })
  validateOnly_result!: AdsAutomationProviderValidateOnlyActionPlan['validateOnly_result'] | null;

  @Prop({ required: true, type: Object })
  provider_boundary_evidence!: AdsAutomationProviderValidateOnlyActionPlan['provider_boundary_evidence'];

  @Prop({ type: [String], default: [] })
  blockers!: string[];

  @Prop({ required: true, type: Boolean, default: false })
  approval_can_be_considered_executable!: boolean;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  executable_now!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  execution_allowed_now!: false;

  @Prop({ required: true, type: Boolean, default: true })
  validate_only_required_before_execution!: boolean;

  @Prop({ required: true, type: String, trim: true })
  next_required_action!: AdsAutomationProviderValidateOnlyActionPlan['next_required_action'];

  @Prop({ required: true, type: Object })
  source_pending_action!: AdsAutomationPendingErpActionRecord;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  validateOnly_evidence_persisted!: true;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  future_live_execution_allowed!: false;

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

export const AiDataPackAdsAutomationValidateOnlyEvidenceSchema =
  SchemaFactory.createForClass(AiDataPackAdsAutomationValidateOnlyEvidence);

AiDataPackAdsAutomationValidateOnlyEvidenceSchema.index(
  { validation_id: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_validate_only_validation_id' },
);
AiDataPackAdsAutomationValidateOnlyEvidenceSchema.index(
  { idempotency_key: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_validate_only_idempotency' },
);
AiDataPackAdsAutomationValidateOnlyEvidenceSchema.index(
  { approval_id: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_validate_only_approval_created' },
);
AiDataPackAdsAutomationValidateOnlyEvidenceSchema.index(
  { status: 1, providerValidationStatus: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_validate_only_status_created' },
);
