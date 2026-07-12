import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
  AdsAutomationDecisionDraftApprovalReadModelQuery,
  AdsAutomationDecisionDraftPendingApprovalRecord,
} from './contracts/ads-automation-decision-draft-approval.contract';
import {
  AiDataPackAdsAutomationPendingApproval,
  AiDataPackAdsAutomationPendingApprovalDocument,
} from './schemas/ads-automation-decision-draft-approval.schema';

@Injectable()
export class AdsAutomationDecisionDraftApprovalRepository {
  constructor(
    @InjectModel(AiDataPackAdsAutomationPendingApproval.name)
    private readonly approvalModel: Model<AiDataPackAdsAutomationPendingApprovalDocument>,
  ) {}

  async findExistingIdempotencyKeys(idempotencyKeys: string[]): Promise<Set<string>> {
    const keys = [...new Set((idempotencyKeys || []).map((key) => this.text(key)).filter(Boolean))];
    if (!keys.length) return new Set();

    const rows = await this.approvalModel
      .find({ idempotency_key: { $in: keys } }, { _id: 0, idempotency_key: 1 })
      .lean()
      .exec();

    return new Set(rows.map((row) => String(row.idempotency_key)));
  }

  async createMany(
    records: AdsAutomationDecisionDraftPendingApprovalRecord[],
  ): Promise<AdsAutomationDecisionDraftPendingApprovalRecord[]> {
    if (!records.length) return [];

    try {
      const docs = await this.approvalModel.insertMany(records, { ordered: true });
      return docs.map((doc) => this.toRecord(doc.toObject()));
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate =
          error?.keyValue?.idempotency_key ||
          error?.keyValue?.approval_id ||
          'unknown';
        throw new BadRequestException(`duplicate idempotency_key rejected: ${duplicate}`);
      }
      throw error;
    }
  }

  async listPendingApprovals(
    query: AdsAutomationDecisionDraftApprovalReadModelQuery,
  ): Promise<AdsAutomationDecisionDraftPendingApprovalRecord[]> {
    const rows = await this.approvalModel
      .find(this.toFilter(query), { _id: 0, __v: 0 })
      .sort({ createdAt: -1, approval_id: 1 })
      .lean()
      .exec();

    return rows.map((row) => this.toRecord(row));
  }

  async countPendingApprovals(): Promise<number> {
    return this.approvalModel.countDocuments({ status: 'pending_approval' }).exec();
  }

  async findByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationDecisionDraftPendingApprovalRecord | null> {
    const row = await this.approvalModel
      .findOne({ approval_id: approvalId, status: 'pending_approval' }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  async findByApprovalIds(
    approvalIds: string[],
  ): Promise<AdsAutomationDecisionDraftPendingApprovalRecord[]> {
    const ids = [...new Set((approvalIds || []).map((id) => this.text(id)).filter(Boolean) as string[])];
    if (!ids.length) return [];

    const rows = await this.approvalModel
      .find({ approval_id: { $in: ids } }, { _id: 0, __v: 0 })
      .lean()
      .exec();
    const recordsById = new Map(rows.map((row: any) => {
      const record = this.toRecord(row);
      return [record.approval_id, record];
    }));

    return ids
      .map((id) => recordsById.get(id))
      .filter((record): record is AdsAutomationDecisionDraftPendingApprovalRecord => Boolean(record));
  }

  async transitionPendingApprovalStatus(
    approvalId: string,
    status: AdsAutomationDecisionDraftApprovalFinalDecisionStatus,
  ): Promise<AdsAutomationDecisionDraftPendingApprovalRecord | null> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) return null;

    const row = await this.approvalModel
      .findOneAndUpdate(
        { approval_id: normalizedApprovalId, status: 'pending_approval' },
        { $set: { status } },
        { new: true, projection: { _id: 0, __v: 0 } },
      )
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  private toFilter(query: AdsAutomationDecisionDraftApprovalReadModelQuery): Record<string, unknown> {
    const filter: Record<string, unknown> = { status: 'pending_approval' };
    for (const field of ['action_type', 'action_family', 'provider', 'accountId', 'productId', 'supplierId'] as const) {
      const value = this.text(query[field]);
      if (value) filter[field] = value;
    }
    return filter;
  }

  private toRecord(row: any): AdsAutomationDecisionDraftPendingApprovalRecord {
    return {
      approval_id: String(row.approval_id),
      source_schema_version: row.source_schema_version,
      source_draft_id: String(row.source_draft_id),
      source_decision_id: String(row.source_decision_id),
      action_type: row.action_type,
      action_family: row.action_family,
      provider: row.provider,
      resource_type: row.resource_type,
      entity_type: row.entity_type,
      entity_id: String(row.entity_id),
      accountId: this.nullableText(row.accountId),
      productId: this.nullableText(row.productId),
      supplierId: this.nullableText(row.supplierId),
      platform: this.nullableText(row.platform),
      status: row.status === 'approved' || row.status === 'rejected'
        ? row.status
        : 'pending_approval',
      approval_required: true,
      execution_allowed_now: false,
      validate_only_required: Boolean(row.validate_only_required),
      future_provider_validateOnly_required: Boolean(row.future_provider_validateOnly_required),
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
      typedPayload: row.typedPayload || {},
      source_evidence_references: Array.isArray(row.source_evidence_references)
        ? row.source_evidence_references
        : [],
      sourceSyncDecisionEvidence: Array.isArray(row.sourceSyncDecisionEvidence)
        ? row.sourceSyncDecisionEvidence
        : [],
      sourceSyncDecisionGates: row.sourceSyncDecisionGates
        && typeof row.sourceSyncDecisionGates === 'object'
        && !Array.isArray(row.sourceSyncDecisionGates)
        ? row.sourceSyncDecisionGates
        : null,
      blockers: Array.isArray(row.blockers) ? row.blockers : [],
      missing_data_blockers: Array.isArray(row.missing_data_blockers)
        ? row.missing_data_blockers
        : [],
      idempotency_key: String(row.idempotency_key),
      rationale: String(row.rationale || ''),
      createdAt: this.isoText(row.createdAt),
      persistedAt: this.isoText(row.persistedAt),
    };
  }

  private isoText(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    const text = this.text(value);
    return text || new Date(0).toISOString();
  }

  private nullableText(value: unknown): string | null {
    return this.text(value) || null;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }
}
