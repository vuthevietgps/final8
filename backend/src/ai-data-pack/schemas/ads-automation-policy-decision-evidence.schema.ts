import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { AdsAutomationDecisionDraftApprovalStorage } from '../contracts/ads-automation-decision-draft-approval.contract';

export type AiDataPackAdsAutomationPolicyDecisionEvidenceDocument =
  HydratedDocument<AiDataPackAdsAutomationPolicyDecisionEvidence>;

@Schema({
  collection: 'ai_data_pack_ads_automation_policy_decision_evidence',
  timestamps: false,
})
export class AiDataPackAdsAutomationPolicyDecisionEvidence {
  @Prop({ required: true, type: String, trim: true })
  schemaVersion!: 'ads_automation_execution_policy_decision_evidence.v1';

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  policy_decision_id!: string;

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  idempotency_key!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  approval_id!: string;

  @Prop({ required: true, type: Boolean, default: false })
  policy_allowed!: boolean;

  @Prop({ type: String, trim: true, index: true, default: null })
  policy_source!: string | null;

  @Prop({ type: [String], default: [] })
  blockers!: string[];

  @Prop({ type: String, trim: true, index: true, default: null })
  evaluatedAt!: string | null;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  policy_decision_record_persisted!: true;

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

export const AiDataPackAdsAutomationPolicyDecisionEvidenceSchema =
  SchemaFactory.createForClass(AiDataPackAdsAutomationPolicyDecisionEvidence);

AiDataPackAdsAutomationPolicyDecisionEvidenceSchema.index(
  { policy_decision_id: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_policy_decision_id' },
);
AiDataPackAdsAutomationPolicyDecisionEvidenceSchema.index(
  { idempotency_key: 1 },
  { unique: true, name: 'uq_ai_data_pack_ads_policy_decision_idempotency' },
);
AiDataPackAdsAutomationPolicyDecisionEvidenceSchema.index(
  { approval_id: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_policy_decision_approval_created' },
);
AiDataPackAdsAutomationPolicyDecisionEvidenceSchema.index(
  { policy_source: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_policy_decision_source_created' },
);
