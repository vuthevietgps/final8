import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  AdsAutomationPolicyDecisionEvidenceInput,
  AdsAutomationPolicyDecisionEvidencePersistResult,
  AdsAutomationPolicyDecisionEvidenceRecord,
} from './contracts/ads-automation-policy-decision-evidence.contract';
import {
  AiDataPackAdsAutomationPolicyDecisionEvidence,
  AiDataPackAdsAutomationPolicyDecisionEvidenceDocument,
} from './schemas/ads-automation-policy-decision-evidence.schema';

@Injectable()
export class AdsAutomationPolicyDecisionEvidenceRepository {
  constructor(
    @InjectModel(AiDataPackAdsAutomationPolicyDecisionEvidence.name)
    private readonly policyDecisionModel: Model<AiDataPackAdsAutomationPolicyDecisionEvidenceDocument>,
  ) {}

  async createManyIdempotent(
    decisions: AdsAutomationPolicyDecisionEvidenceInput[],
    context: {
      requestId?: string | null;
      requestedByUserId?: string | null;
      requestedByRole?: string | null;
      createdAt?: string | null;
    } = {},
  ): Promise<AdsAutomationPolicyDecisionEvidencePersistResult> {
    const persistable = decisions.map((decision) => this.toPersistableRecord(decision, context));
    if (!persistable.length) {
      return { records: [], created: 0, reused: 0 };
    }

    const existing = await this.findExistingByIdentities(persistable);
    const persistedByInputKey = new Map<string, AdsAutomationPolicyDecisionEvidenceRecord>();
    let created = 0;
    let reused = 0;

    for (const record of persistable) {
      const existingRecord = existing.get(record.policy_decision_id) || existing.get(record.idempotency_key);
      if (existingRecord) {
        persistedByInputKey.set(this.inputKey(record), existingRecord);
        reused += 1;
        continue;
      }

      try {
        const doc = await this.policyDecisionModel.create(record);
        const createdRecord = this.toRecord(this.toObject(doc));
        persistedByInputKey.set(this.inputKey(record), createdRecord);
        existing.set(createdRecord.policy_decision_id, createdRecord);
        existing.set(createdRecord.idempotency_key, createdRecord);
        created += 1;
      } catch (error: any) {
        if (error?.code !== 11000) {
          throw error;
        }
        const raceRecord = await this.findByPolicyDecisionId(record.policy_decision_id)
          || await this.findByIdempotencyKey(record.idempotency_key);
        if (!raceRecord) {
          throw new BadRequestException(`duplicate policy decision evidence rejected: ${this.duplicateKey(error)}`);
        }
        persistedByInputKey.set(this.inputKey(record), raceRecord);
        existing.set(raceRecord.policy_decision_id, raceRecord);
        existing.set(raceRecord.idempotency_key, raceRecord);
        reused += 1;
      }
    }

    return {
      records: persistable
        .map((record) => persistedByInputKey.get(this.inputKey(record)))
        .filter((record): record is AdsAutomationPolicyDecisionEvidenceRecord => Boolean(record)),
      created,
      reused,
    };
  }

  toPersistableRecord(
    input: AdsAutomationPolicyDecisionEvidenceInput,
    context: {
      requestId?: string | null;
      requestedByUserId?: string | null;
      requestedByRole?: string | null;
      createdAt?: string | null;
    } = {},
  ): AdsAutomationPolicyDecisionEvidenceRecord {
    this.assertInput(input);
    const approvalId = this.requiredText(input.approval_id, 'approval_id');
    const requestId = this.nullableText(input.requestId ?? context.requestId);
    const createdAt = this.isoText(context.createdAt || input.evaluatedAt);
    const evaluatedAt = this.nullableIsoText(input.evaluatedAt) || createdAt;
    const policyDecisionId = this.text(input.policy_decision_id)
      || `ADSPOLICY-${this.safeKey(approvalId)}-${this.safeKey(requestId || evaluatedAt)}`;
    const idempotencyKey = [
      'ads-policy-decision',
      this.safeKey(approvalId),
      this.safeKey(requestId || policyDecisionId),
    ].join(':');

    return {
      schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
      policy_decision_id: policyDecisionId,
      idempotency_key: idempotencyKey,
      approval_id: approvalId,
      policy_allowed: input.policy_allowed === true,
      policy_source: this.nullableText(input.policy_source),
      blockers: this.arrayText(input.blockers),
      evaluatedAt,
      policy_decision_record_persisted: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      live_path_implemented: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      requestedByUserId: this.nullableText(input.requestedByUserId ?? context.requestedByUserId),
      requestedByRole: this.nullableText(input.requestedByRole ?? context.requestedByRole),
      requestId,
      createdAt,
      persistedAt: new Date().toISOString(),
    };
  }

  async findByPolicyDecisionId(
    policyDecisionId: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceRecord | null> {
    const normalizedPolicyDecisionId = this.text(policyDecisionId);
    if (!normalizedPolicyDecisionId) return null;

    const row = await this.policyDecisionModel
      .findOne({ policy_decision_id: normalizedPolicyDecisionId }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  async findByPolicyDecisionIds(
    policyDecisionIds: string[],
  ): Promise<AdsAutomationPolicyDecisionEvidenceRecord[]> {
    const ids = this.uniqueText(policyDecisionIds);
    if (!ids.length) return [];

    const rows = await this.policyDecisionModel
      .find({ policy_decision_id: { $in: ids } }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return rows.map((row: any) => this.toRecord(row));
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceRecord[]> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) return [];

    const rows = await this.policyDecisionModel
      .find({ approval_id: normalizedApprovalId }, { _id: 0, __v: 0 })
      .sort({ createdAt: -1, policy_decision_id: 1 })
      .lean()
      .exec();

    return rows.map((row: any) => this.toRecord(row));
  }

  private async findExistingByIdentities(
    records: AdsAutomationPolicyDecisionEvidenceRecord[],
  ): Promise<Map<string, AdsAutomationPolicyDecisionEvidenceRecord>> {
    const policyDecisionIds = this.uniqueText(records.map((record) => record.policy_decision_id));
    const idempotencyKeys = this.uniqueText(records.map((record) => record.idempotency_key));
    const filters: Record<string, unknown>[] = [];
    if (policyDecisionIds.length) filters.push({ policy_decision_id: { $in: policyDecisionIds } });
    if (idempotencyKeys.length) filters.push({ idempotency_key: { $in: idempotencyKeys } });
    if (!filters.length) return new Map();

    const rows = await this.policyDecisionModel
      .find({ $or: filters }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    const existing = new Map<string, AdsAutomationPolicyDecisionEvidenceRecord>();
    for (const row of rows) {
      const record = this.toRecord(row);
      existing.set(record.policy_decision_id, record);
      existing.set(record.idempotency_key, record);
    }
    return existing;
  }

  private async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AdsAutomationPolicyDecisionEvidenceRecord | null> {
    const normalizedIdempotencyKey = this.text(idempotencyKey);
    if (!normalizedIdempotencyKey) return null;

    const row = await this.policyDecisionModel
      .findOne({ idempotency_key: normalizedIdempotencyKey }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  private toRecord(row: any): AdsAutomationPolicyDecisionEvidenceRecord {
    return {
      schemaVersion: 'ads_automation_execution_policy_decision_evidence.v1',
      policy_decision_id: this.requiredText(row.policy_decision_id, 'policy_decision_id'),
      idempotency_key: this.requiredText(row.idempotency_key, 'idempotency_key'),
      approval_id: this.requiredText(row.approval_id, 'approval_id'),
      policy_allowed: row.policy_allowed === true,
      policy_source: this.nullableText(row.policy_source),
      blockers: this.arrayText(row.blockers),
      evaluatedAt: this.nullableIsoText(row.evaluatedAt),
      policy_decision_record_persisted: true,
      future_live_execution_allowed: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      live_path_implemented: false,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      requestedByUserId: this.nullableText(row.requestedByUserId),
      requestedByRole: this.nullableText(row.requestedByRole),
      requestId: this.nullableText(row.requestId),
      createdAt: this.isoText(row.createdAt),
      persistedAt: this.isoText(row.persistedAt),
    };
  }

  private assertInput(input: AdsAutomationPolicyDecisionEvidenceInput): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('policy decision evidence input is required');
    }
    const raw = input as any;
    if (
      raw.future_live_execution_allowed === true
      || raw.execution_allowed_now === true
      || raw.provider_api_called === true
      || raw.google_ads_api_called === true
      || raw.validateOnly_called === true
      || raw.live_ads_execution_used === true
      || raw.erp_mutation_used === true
      || raw.payment_mutation_used === true
      || raw.direct_google_ads_api_call === true
      || raw.provider_mutation_used === true
      || raw.live_path_implemented === true
    ) {
      throw new BadRequestException('policy decision evidence must preserve local dry-run non-execution safety flags');
    }
  }

  private duplicateKey(error: any): string {
    return error?.keyValue?.policy_decision_id || error?.keyValue?.idempotency_key || 'unknown';
  }

  private inputKey(record: AdsAutomationPolicyDecisionEvidenceRecord): string {
    return `${record.policy_decision_id}\n${record.idempotency_key}`;
  }

  private toObject(doc: any): any {
    return typeof doc?.toObject === 'function' ? doc.toObject() : doc;
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

  private nullableIsoText(value: unknown): string | null {
    const text = this.text(value);
    if (!text) return null;
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toISOString();
  }

  private isoText(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    const text = this.text(value);
    if (!text) return new Date().toISOString();
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? text : date.toISOString();
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

  private safeKey(value: unknown): string {
    return String(value || 'unknown').replace(/[^a-z0-9._:-]/gi, '_').slice(0, 96);
  }
}
