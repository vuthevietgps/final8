import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  AdsAutomationDecisionDraftApprovalDecisionAuditExistingIdentities,
  AdsAutomationDecisionDraftApprovalDecisionAuditIdentity,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  AdsAutomationDecisionDraftApprovalReadinessPrerequisite,
} from './contracts/ads-automation-decision-draft-approval.contract';
import {
  AiDataPackAdsAutomationDecisionAuditRecord,
  AiDataPackAdsAutomationDecisionAuditRecordDocument,
} from './schemas/ads-automation-decision-draft-approval-decision-audit.schema';

@Injectable()
export class AdsAutomationDecisionDraftApprovalDecisionAuditRepository {
  constructor(
    @InjectModel(AiDataPackAdsAutomationDecisionAuditRecord.name)
    private readonly auditModel: Model<AiDataPackAdsAutomationDecisionAuditRecordDocument>,
  ) {}

  toPersistableRecord(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  ): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
    this.assertPayload(payload);
    return this.toPersistableRecordWithStatusChange(payload, false);
  }

  toPersistableDecisionRecord(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
    statusChangePerformed: boolean,
  ): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
    this.assertDecisionPayload(payload, statusChangePerformed);
    return this.toPersistableRecordWithStatusChange(payload, statusChangePerformed);
  }

  private toPersistableRecordWithStatusChange(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
    statusChangePerformed: boolean,
  ): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
    const previewCreatedAt = this.isoText(payload.createdAt);
    const persistedAt = new Date().toISOString();
    const normalized = this.cloneJson(payload);

    return {
      ...normalized,
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
      audit_id: this.requiredText(normalized.audit_id, 'audit_id'),
      idempotency_key: this.idempotencyKey(normalized),
      approval_id: this.requiredText(normalized.approval_id, 'approval_id'),
      source_draft_id: this.requiredText(normalized.source_draft_id, 'source_draft_id'),
      source_decision_id: this.requiredText(normalized.source_decision_id, 'source_decision_id'),
      entity_id: this.requiredText(normalized.entity_id, 'entity_id'),
      accountId: this.nullableText(normalized.accountId),
      productId: this.nullableText(normalized.productId),
      supplierId: this.nullableText(normalized.supplierId),
      platform: this.nullableText(normalized.platform),
      reviewerUserId: this.nullableText(normalized.reviewerUserId),
      reviewerRole: this.nullableText(normalized.reviewerRole),
      reason: this.nullableText(normalized.reason),
      requestId: this.nullableText(normalized.requestId),
      blockers: this.arrayText(normalized.blockers),
      prerequisites: this.prerequisites(normalized.prerequisites),
      pending_approval_snapshot: this.cloneJson(normalized.pending_approval_snapshot),
      audit_record_persisted: true,
      status_change_performed: statusChangePerformed,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      source_preview_createdAt: previewCreatedAt,
      createdAt: previewCreatedAt,
      persistedAt,
    };
  }

  async findExistingAuditIdentities(
    identities: AdsAutomationDecisionDraftApprovalDecisionAuditIdentity[],
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditExistingIdentities> {
    const auditIds = this.uniqueText(identities.map((identity) => identity.audit_id));
    const idempotencyKeys = this.uniqueText(identities.map((identity) => identity.idempotency_key));
    const filters: Record<string, unknown>[] = [];
    if (auditIds.length) filters.push({ audit_id: { $in: auditIds } });
    if (idempotencyKeys.length) filters.push({ idempotency_key: { $in: idempotencyKeys } });
    if (!filters.length) {
      return { auditIds: new Set(), idempotencyKeys: new Set() };
    }

    const rows = await this.auditModel
      .find({ $or: filters }, { _id: 0, audit_id: 1, idempotency_key: 1 })
      .lean()
      .exec();

    return {
      auditIds: new Set(rows.map((row: any) => String(row.audit_id)).filter(Boolean)),
      idempotencyKeys: new Set(rows.map((row: any) => String(row.idempotency_key)).filter(Boolean)),
    };
  }

  async createFromPreview(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecord> {
    const record = this.toPersistableRecord(payload);
    return this.createPersistableRecord(record);
  }

  async createFromDecision(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
    statusChangePerformed: boolean,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecord> {
    const record = this.toPersistableDecisionRecord(payload, statusChangePerformed);
    return this.createPersistableRecord(record);
  }

  private async createPersistableRecord(
    record: AdsAutomationDecisionDraftApprovalDecisionAuditRecord,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecord> {
    const existing = await this.findExistingAuditIdentities([record]);
    if (existing.auditIds.size || existing.idempotencyKeys.size) {
      throw new BadRequestException(`duplicate audit record rejected: ${this.firstDuplicate(existing)}`);
    }

    try {
      const doc = await this.auditModel.create(record);
      return this.toRecord(this.toObject(doc));
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = error?.keyValue?.audit_id || error?.keyValue?.idempotency_key || 'unknown';
        throw new BadRequestException(`duplicate audit record rejected: ${duplicate}`);
      }
      throw error;
    }
  }

  async findByAuditId(
    auditId: string,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecord | null> {
    const normalizedAuditId = this.text(auditId);
    if (!normalizedAuditId) return null;

    const row = await this.auditModel
      .findOne({ audit_id: normalizedAuditId }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationDecisionDraftApprovalDecisionAuditRecord[]> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) return [];

    const rows = await this.auditModel
      .find({ approval_id: normalizedApprovalId }, { _id: 0, __v: 0 })
      .sort({ createdAt: -1, audit_id: 1 })
      .lean()
      .exec();

    return rows.map((row: any) => this.toRecord(row));
  }

  private toRecord(row: any): AdsAutomationDecisionDraftApprovalDecisionAuditRecord {
    return {
      schemaVersion: 'ads_automation_decision_draft_approval_decision_audit_record.v1',
      audit_id: this.requiredText(row.audit_id, 'audit_id'),
      idempotency_key: this.requiredText(row.idempotency_key, 'idempotency_key'),
      approval_id: this.requiredText(row.approval_id, 'approval_id'),
      source_draft_id: this.requiredText(row.source_draft_id, 'source_draft_id'),
      source_decision_id: this.requiredText(row.source_decision_id, 'source_decision_id'),
      action_type: row.action_type,
      action_family: row.action_family,
      provider: row.provider,
      resource_type: row.resource_type,
      entity_type: row.entity_type,
      entity_id: this.requiredText(row.entity_id, 'entity_id'),
      accountId: this.nullableText(row.accountId),
      productId: this.nullableText(row.productId),
      supplierId: this.nullableText(row.supplierId),
      platform: this.nullableText(row.platform),
      previous_status: 'pending_approval',
      proposed_status: row.proposed_status === 'approved' || row.proposed_status === 'rejected'
        ? row.proposed_status
        : null,
      decision: row.decision,
      reviewerUserId: this.nullableText(row.reviewerUserId),
      reviewerRole: this.nullableText(row.reviewerRole),
      reason: this.nullableText(row.reason),
      requestId: this.nullableText(row.requestId),
      validation_status: row.validation_status,
      prerequisites_valid: Number(row.prerequisites_valid) || 0,
      prerequisites_blocked: Number(row.prerequisites_blocked) || 0,
      blockers: this.arrayText(row.blockers),
      prerequisites: this.prerequisites(row.prerequisites),
      pending_approval_snapshot: this.cloneJson(row.pending_approval_snapshot || {}),
      audit_record_persisted: true,
      status_change_performed: Boolean(row.status_change_performed),
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      execution_allowed_now: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      source_preview_createdAt: this.isoText(row.source_preview_createdAt || row.createdAt),
      createdAt: this.isoText(row.createdAt),
      persistedAt: this.isoText(row.persistedAt),
    };
  }

  private assertPayload(payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload): void {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('decision audit record payload is required');
    }
    if (payload.schemaVersion !== 'ads_automation_decision_draft_approval_decision_audit_record.v1') {
      throw new BadRequestException('payload must use ads_automation_decision_draft_approval_decision_audit_record.v1');
    }
    if (payload.status_change_performed !== false) {
      throw new BadRequestException('decision audit payload must not include a status change');
    }
    if (
      payload.provider_api_called !== false
      || payload.google_ads_api_called !== false
      || payload.validateOnly_called !== false
      || payload.live_ads_execution_used !== false
      || payload.execution_allowed_now !== false
    ) {
      throw new BadRequestException('decision audit payload must preserve dry-run non-execution safety flags');
    }
  }

  private assertDecisionPayload(
    payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload,
    statusChangePerformed: boolean,
  ): void {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('decision audit record payload is required');
    }
    if (payload.schemaVersion !== 'ads_automation_decision_draft_approval_decision_audit_record.v1') {
      throw new BadRequestException('payload must use ads_automation_decision_draft_approval_decision_audit_record.v1');
    }
    if (payload.decision !== 'approve' && payload.decision !== 'reject') {
      throw new BadRequestException('decision audit payload must be approve or reject');
    }
    if (statusChangePerformed && payload.validation_status !== 'eligible_for_human_decision') {
      throw new BadRequestException('status-changing decision audit payload must be validation eligible');
    }
    if (statusChangePerformed && (payload.proposed_status !== 'approved' && payload.proposed_status !== 'rejected')) {
      throw new BadRequestException('status-changing decision audit payload must include a final proposed status');
    }
    if (
      payload.provider_api_called !== false
      || payload.google_ads_api_called !== false
      || payload.validateOnly_called !== false
      || payload.live_ads_execution_used !== false
      || payload.execution_allowed_now !== false
    ) {
      throw new BadRequestException('decision audit payload must preserve dry-run non-execution safety flags');
    }
  }

  private idempotencyKey(payload: AdsAutomationDecisionDraftApprovalDecisionAuditRecordPayload): string {
    return [
      'ads-decision-audit',
      this.safeKey(payload.approval_id),
      this.safeKey(payload.decision),
      this.safeKey(payload.requestId || payload.audit_id),
    ].join(':');
  }

  private firstDuplicate(existing: AdsAutomationDecisionDraftApprovalDecisionAuditExistingIdentities): string {
    return [...existing.auditIds, ...existing.idempotencyKeys].sort()[0] || 'unknown';
  }

  private toObject(doc: any): any {
    return typeof doc?.toObject === 'function' ? doc.toObject() : doc;
  }

  private prerequisites(values: unknown): AdsAutomationDecisionDraftApprovalReadinessPrerequisite[] {
    if (!Array.isArray(values)) return [];
    return values.map((item) => ({ ...(item as AdsAutomationDecisionDraftApprovalReadinessPrerequisite) }));
  }

  private uniqueText(values: unknown[]): string[] {
    return [...new Set(values.map((value) => this.text(value)).filter((value): value is string => Boolean(value)))];
  }

  private arrayText(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    return values
      .map((value) => this.text(value))
      .filter((value): value is string => Boolean(value));
  }

  private isoText(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    const text = this.text(value);
    return text || new Date(0).toISOString();
  }

  private nullableText(value: unknown): string | null {
    return this.text(value) || null;
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private safeKey(value: unknown): string {
    return String(value || 'unknown').replace(/[^a-z0-9._:-]/gi, '_').slice(0, 96);
  }
}
