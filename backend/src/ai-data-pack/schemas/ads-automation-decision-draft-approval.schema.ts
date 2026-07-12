import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type {
  AdsAutomationDecisionDraftActionType,
  AdsAutomationDecisionDraftFamily,
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from '../contracts/ads-automation-decision-draft-preview.contract';
import type {
  AdsAutomationDecisionDraftApprovalStatus,
  AdsAutomationDecisionDraftApprovalStorage,
} from '../contracts/ads-automation-decision-draft-approval.contract';
import type {
  SourceSyncDecisionEvidence,
  SourceSyncDecisionGates,
} from '../source-sync/source-sync-result.types';

export type AiDataPackAdsAutomationPendingApprovalDocument =
  HydratedDocument<AiDataPackAdsAutomationPendingApproval>;

@Schema({
  collection: 'ai_data_pack_ads_automation_pending_approvals',
  timestamps: false,
})
export class AiDataPackAdsAutomationPendingApproval {
  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  approval_id!: string;

  @Prop({ required: true, type: String, trim: true })
  source_schema_version!: AdsAutomationDecisionDraftPreviewResponse['schemaVersion'];

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

  @Prop({
    required: true,
    type: String,
    enum: ['pending_approval', 'approved', 'rejected'],
    trim: true,
    index: true,
    default: 'pending_approval',
  })
  status!: AdsAutomationDecisionDraftApprovalStatus;

  @Prop({ required: true, type: Boolean, default: true, immutable: true })
  approval_required!: true;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  execution_allowed_now!: false;

  @Prop({ required: true, type: Boolean })
  validate_only_required!: boolean;

  @Prop({ required: true, type: Boolean })
  future_provider_validateOnly_required!: boolean;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  provider_api_called!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  google_ads_api_called!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  live_ads_execution_used!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  erp_mutation_used!: false;

  @Prop({ required: true, type: Boolean, default: false, immutable: true })
  payment_mutation_used!: false;

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
  typedPayload!: Record<string, unknown>;

  @Prop({ type: [Object], default: [] })
  source_evidence_references!: AdsAutomationDecisionDraftPreview['source_evidence_references'];

  @Prop({ type: [Object], default: [] })
  sourceSyncDecisionEvidence!: SourceSyncDecisionEvidence[];

  @Prop({ type: Object, default: null })
  sourceSyncDecisionGates!: Partial<SourceSyncDecisionGates> | null;

  @Prop({ type: [String], default: [] })
  blockers!: string[];

  @Prop({ type: [String], default: [] })
  missing_data_blockers!: string[];

  @Prop({ required: true, type: String, trim: true, unique: true, index: true })
  idempotency_key!: string;

  @Prop({ required: true, type: String, trim: true })
  rationale!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  createdAt!: string;

  @Prop({ required: true, type: String, trim: true, index: true })
  persistedAt!: string;
}

export const AiDataPackAdsAutomationPendingApprovalSchema =
  SchemaFactory.createForClass(AiDataPackAdsAutomationPendingApproval);

AiDataPackAdsAutomationPendingApprovalSchema.index(
  { status: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_pending_status_created' },
);
AiDataPackAdsAutomationPendingApprovalSchema.index(
  { action_family: 1, action_type: 1, createdAt: -1 },
  { name: 'idx_ai_data_pack_ads_pending_action_created' },
);
