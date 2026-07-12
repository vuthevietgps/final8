import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAction,
  AdsAutomationDecisionDraftApprovalDecisionValidationStatus,
  AdsAutomationDecisionDraftApprovalStatus,
  AdsAutomationDecisionDraftApprovalStorage,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from '../contracts/ads-automation-decision-draft-approval.contract';
import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
} from '../contracts/ads-automation-decision-draft-preview.contract';

export type AiDataPackAdsAutomationDecisionAuditRecordDocument =
  HydratedDocument<AiDataPackAdsAutomationDecisionAuditRecord>;

@Schema({
  collection: 'ai_data_pack_ads_automation_decision_audit_records',
  timestamps: false,
})
export class AiDataPackAdsAutomationDecisionAuditRecord {
  @Prop({ required: true, type: String, trim: true })
  schemaVersion!: 'ads_automation_decision_draft_approval_decision_audit_record.v1';

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  audit_id!: string;

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

  @Prop({ type: String, trim: true, index: true, default: null })
  productId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  supplierId!: string | null;

  @Prop({ type: String, trim: true, default: null })
  platform!: string | null;

  @Prop({ required: true, type: String, trim: true, index: true })
  previous_status!: AdsAutomationDecisionDraftApprovalStatus;

  @Prop({ type: String, trim: true, index: true, default: null })
  proposed_status!: 'approved' | 'rejected' | null;

  @Prop({ required: true, type: String, trim: true, index: true })
  decision!: AdsAutomationDecisionDraftApprovalDecisionAction | 'invalid';

  @Prop({ type: String, trim: true, index: true, default: null })
  reviewerUserId!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  reviewerRole!: string | null;

  @Prop({ type: String, trim: true, default: null })
  reason!: string | null;

  @Prop({ type: String, trim: true, index: true, default: null })
  requestId!: string | null;

  @Prop({ required: true, type: String, trim: true, index: true })
  validation_status!: AdsAutomationDecisionDraftApprovalDecisionValidationStatus;

  @Prop({ required: true, type: Number, min: 0 })
  prerequisites_valid!: number;

  @Prop({ required: true, type: Number, min: 0 })
  prerequisites_blocked!: number;

  @Prop({ type: [String], default: [] })
  blockers!: string[];

  @Prop({ type: [Object], default: [] })
  prerequisites!: Array<Record<string, unknown>>;

  @Prop({ required: true, type: Object })
  pending_approval_snapshot!: AdsAutomationDecisionDraftPendingApprovalRecord;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  audit_record_persisted!: true;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  status_change_performed!: boolean;

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
  execution_allowed_now!: false;

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

  @Prop({ required: true, type: String, trim: true, index: true })
  source_preview_createdAt!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  createdAt!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  persistedAt!: string;
}

export const AiDataPackAdsAutomationDecisionAuditRecordSchema =
  SchemaFactory.createForClass(AiDataPackAdsAutomationDecisionAuditRecord);

AiDataPackAdsAutomationDecisionAuditRecordSchema.index(
  { audit_id: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_decision_audit_id' },
);
AiDataPackAdsAutomationDecisionAuditRecordSchema.index(
  { idempotency_key: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_decision_audit_idempotency' },
);
AiDataPackAdsAutomationDecisionAuditRecordSchema.index(
  { approval_id: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_decision_audit_approval_created' },
);
AiDataPackAdsAutomationDecisionAuditRecordSchema.index(
  { action_family: 1, action_type: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_decision_audit_action_created' },
);
AiDataPackAdsAutomationDecisionAuditRecordSchema.index(
  { validation_status: 1, decision: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_decision_audit_validation_created' },
);
