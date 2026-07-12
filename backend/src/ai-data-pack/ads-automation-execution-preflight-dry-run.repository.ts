import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS,
  AdsAutomationExecutionIdentifierSnapshot,
  AdsAutomationExecutionPreflightDryRunPersistResult,
  AdsAutomationExecutionPreflightDryRunRecord,
} from './contracts/ads-automation-execution-preflight-dry-run.contract';
import type { AdsAutomationDecisionDraftPendingApprovalRecord } from './contracts/ads-automation-decision-draft-approval.contract';
import {
  AiDataPackAdsAutomationExecutionPreflightDryRun,
  AiDataPackAdsAutomationExecutionPreflightDryRunDocument,
} from './schemas/ads-automation-execution-preflight-dry-run.schema';

@Injectable()
export class AdsAutomationExecutionPreflightDryRunRepository {
  constructor(
    @InjectModel(AiDataPackAdsAutomationExecutionPreflightDryRun.name)
    private readonly preflightModel: Model<AiDataPackAdsAutomationExecutionPreflightDryRunDocument>,
  ) {}

  async createManyIdempotent(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
  ): Promise<AdsAutomationExecutionPreflightDryRunPersistResult> {
    const persistable = records.map((record) => this.toPersistableRecord(record));
    if (!persistable.length) {
      return {
        records: [],
        created: 0,
        reused: 0,
        createdExecutionRecordIds: [],
        createdIdempotencyKeys: [],
        reusedExecutionRecordIds: [],
        reusedIdempotencyKeys: [],
      };
    }

    const existing = await this.findExistingByIdentities(persistable);
    const persistedByInputKey = new Map<string, AdsAutomationExecutionPreflightDryRunRecord>();
    const createdExecutionRecordIds: string[] = [];
    const createdIdempotencyKeys: string[] = [];
    const reusedExecutionRecordIds: string[] = [];
    const reusedIdempotencyKeys: string[] = [];
    let created = 0;
    let reused = 0;

    for (const record of persistable) {
      const existingRecord = existing.get(record.execution_record_id) || existing.get(record.idempotency_key);
      if (existingRecord) {
        persistedByInputKey.set(this.inputKey(record), existingRecord);
        reusedExecutionRecordIds.push(existingRecord.execution_record_id);
        reusedIdempotencyKeys.push(existingRecord.idempotency_key);
        reused += 1;
        continue;
      }

      try {
        const doc = await this.preflightModel.create(record);
        const createdRecord = this.toRecord(this.toObject(doc));
        persistedByInputKey.set(this.inputKey(record), createdRecord);
        existing.set(createdRecord.execution_record_id, createdRecord);
        existing.set(createdRecord.idempotency_key, createdRecord);
        createdExecutionRecordIds.push(createdRecord.execution_record_id);
        createdIdempotencyKeys.push(createdRecord.idempotency_key);
        created += 1;
      } catch (error: any) {
        if (error?.code !== 11000) {
          throw error;
        }
        const raceRecord = await this.findByExecutionRecordId(record.execution_record_id)
          || await this.findByIdempotencyKey(record.idempotency_key);
        if (!raceRecord) {
          throw new BadRequestException(`duplicate execution preflight record rejected: ${this.duplicateKey(error)}`);
        }
        persistedByInputKey.set(this.inputKey(record), raceRecord);
        existing.set(raceRecord.execution_record_id, raceRecord);
        existing.set(raceRecord.idempotency_key, raceRecord);
        reusedExecutionRecordIds.push(raceRecord.execution_record_id);
        reusedIdempotencyKeys.push(raceRecord.idempotency_key);
        reused += 1;
      }
    }

    return {
      records: persistable
        .map((record) => persistedByInputKey.get(this.inputKey(record)))
        .filter((record): record is AdsAutomationExecutionPreflightDryRunRecord => Boolean(record)),
      created,
      reused,
      createdExecutionRecordIds,
      createdIdempotencyKeys,
      reusedExecutionRecordIds,
      reusedIdempotencyKeys,
    };
  }

  async findByExecutionRecordId(
    executionRecordId: string,
  ): Promise<AdsAutomationExecutionPreflightDryRunRecord | null> {
    const normalizedExecutionRecordId = this.text(executionRecordId);
    if (!normalizedExecutionRecordId) return null;

    const row = await this.preflightModel
      .findOne({ execution_record_id: normalizedExecutionRecordId }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationExecutionPreflightDryRunRecord[]> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) return [];

    const rows = await this.preflightModel
      .find({ approval_id: normalizedApprovalId }, { _id: 0, __v: 0 })
      .sort({ createdAt: -1, execution_record_id: 1 })
      .lean()
      .exec();

    return rows.map((row: any) => this.toRecord(row));
  }

  toPersistableRecord(
    record: AdsAutomationExecutionPreflightDryRunRecord,
  ): AdsAutomationExecutionPreflightDryRunRecord {
    this.assertRecord(record);
    const createdAt = this.isoText(record.createdAt);
    const persistedAt = new Date().toISOString();

    return {
      ...this.cloneJson(record),
      execution_record_id: this.requiredText(record.execution_record_id, 'execution_record_id'),
      idempotency_key: this.requiredText(record.idempotency_key, 'idempotency_key'),
      approval_id: this.requiredText(record.approval_id, 'approval_id'),
      source_draft_id: this.requiredText(record.source_draft_id, 'source_draft_id'),
      source_decision_id: this.requiredText(record.source_decision_id, 'source_decision_id'),
      entity_id: this.requiredText(record.entity_id, 'entity_id'),
      accountId: this.nullableText(record.accountId),
      platform: this.nullableText(record.platform),
      approval_decision_audit_id: this.nullableText(record.approval_decision_audit_id),
      approval_decision_audit_persisted: record.approval_decision_audit_persisted === true,
      source_readiness_safe: record.source_readiness_safe === true,
      kill_switch_active: record.kill_switch_active === true,
      kill_switch_reason: this.nullableText(record.kill_switch_reason),
      validateOnly_validation_id: this.nullableText(record.validateOnly_validation_id),
      validateOnly_evidence_persisted: record.validateOnly_evidence_persisted === true,
      policy_decision_id: this.nullableText(record.policy_decision_id),
      policy_decision_evidence_persisted: record.policy_decision_evidence_persisted === true,
      policy_allowed: record.policy_allowed === true,
      google_ads_production_enabled: record.google_ads_production_enabled === true,
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
      campaignBudgetId_fallback_used: false,
      preflight_record_persisted: true,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      requested_change: this.cloneJson(record.requested_change || {}),
      identifiers: this.cloneJson(record.identifiers) as AdsAutomationExecutionIdentifierSnapshot,
      gates: Array.isArray(record.gates) ? this.cloneJson(record.gates) : [],
      execution_gate_closure: record.execution_gate_closure ? this.cloneJson(record.execution_gate_closure) : null,
      blockers: this.arrayText(record.blockers),
      source_pending_approval: this.cloneJson(record.source_pending_approval) as AdsAutomationDecisionDraftPendingApprovalRecord,
      source_validateOnly_plan: record.source_validateOnly_plan ? this.cloneJson(record.source_validateOnly_plan) : null,
      policy_decision: record.policy_decision ? this.cloneJson(record.policy_decision) : null,
      requestedByUserId: this.nullableText(record.requestedByUserId),
      requestedByRole: this.nullableText(record.requestedByRole),
      requestId: this.nullableText(record.requestId),
      createdAt,
      persistedAt,
    };
  }

  private async findExistingByIdentities(
    records: AdsAutomationExecutionPreflightDryRunRecord[],
  ): Promise<Map<string, AdsAutomationExecutionPreflightDryRunRecord>> {
    const executionRecordIds = this.uniqueText(records.map((record) => record.execution_record_id));
    const idempotencyKeys = this.uniqueText(records.map((record) => record.idempotency_key));
    const filters: Record<string, unknown>[] = [];
    if (executionRecordIds.length) filters.push({ execution_record_id: { $in: executionRecordIds } });
    if (idempotencyKeys.length) filters.push({ idempotency_key: { $in: idempotencyKeys } });
    if (!filters.length) return new Map();

    const rows = await this.preflightModel
      .find({ $or: filters }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    const existing = new Map<string, AdsAutomationExecutionPreflightDryRunRecord>();
    for (const row of rows) {
      const record = this.toRecord(row);
      existing.set(record.execution_record_id, record);
      existing.set(record.idempotency_key, record);
    }
    return existing;
  }

  private async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AdsAutomationExecutionPreflightDryRunRecord | null> {
    const normalizedIdempotencyKey = this.text(idempotencyKey);
    if (!normalizedIdempotencyKey) return null;

    const row = await this.preflightModel
      .findOne({ idempotency_key: normalizedIdempotencyKey }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  private toRecord(row: any): AdsAutomationExecutionPreflightDryRunRecord {
    return {
      execution_record_id: this.requiredText(row.execution_record_id, 'execution_record_id'),
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
      platform: this.nullableText(row.platform),
      approval_status: row.approval_status,
      approval_decision_audit_id: this.nullableText(row.approval_decision_audit_id),
      approval_decision_audit_persisted: row.approval_decision_audit_persisted === true,
      source_readiness_safe: row.source_readiness_safe === true,
      kill_switch_active: row.kill_switch_active === true,
      kill_switch_reason: this.nullableText(row.kill_switch_reason),
      validateOnly_validation_id: this.nullableText(row.validateOnly_validation_id),
      validateOnly_evidence_persisted: row.validateOnly_evidence_persisted === true,
      validateOnly_status: row.validateOnly_status || 'missing',
      policy_decision_id: this.nullableText(row.policy_decision_id),
      policy_decision_evidence_persisted: row.policy_decision_evidence_persisted === true,
      policy_allowed: row.policy_allowed === true,
      google_ads_production_enabled: row.google_ads_production_enabled === true,
      preflight_status: row.preflight_status,
      dry_run_record_status: 'recorded_local_only',
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
      campaignBudgetId_fallback_used: false,
      preflight_record_persisted: true,
      persistence_used: true,
      durable_storage_used: true,
      erp_local_persistence_used: true,
      provider_persistence_used: false,
      storage: 'erp_local_mongo',
      requested_change: this.cloneJson(row.requested_change || {}),
      identifiers: this.cloneJson(row.identifiers || {}),
      gates: Array.isArray(row.gates) ? this.cloneJson(row.gates) : [],
      execution_gate_closure: row.execution_gate_closure ? this.cloneJson(row.execution_gate_closure) : null,
      blockers: this.arrayText(row.blockers),
      next_required_action: row.next_required_action,
      source_pending_approval: this.cloneJson(row.source_pending_approval || {}),
      source_validateOnly_plan: row.source_validateOnly_plan ? this.cloneJson(row.source_validateOnly_plan) : null,
      policy_decision: row.policy_decision ? this.cloneJson(row.policy_decision) : null,
      requestedByUserId: this.nullableText(row.requestedByUserId),
      requestedByRole: this.nullableText(row.requestedByRole),
      requestId: this.nullableText(row.requestId),
      createdAt: this.isoText(row.createdAt),
      persistedAt: this.isoText(row.persistedAt),
    };
  }

  private assertRecord(record: AdsAutomationExecutionPreflightDryRunRecord): void {
    if (!record || typeof record !== 'object') {
      throw new BadRequestException('execution preflight dry-run record is required');
    }
    if (!ADS_AUTOMATION_EXECUTION_PREFLIGHT_SUPPORTED_ACTIONS.includes(record.action_type as any)) {
      throw new BadRequestException('execution preflight persistence supports update_campaign_budget, pause_campaign, and pause_ad_group only');
    }
    if (
      record.future_live_execution_allowed !== false
      || record.execution_allowed_now !== false
      || record.provider_api_called !== false
      || record.google_ads_api_called !== false
      || record.validateOnly_called !== false
      || record.live_ads_execution_used !== false
      || record.erp_mutation_used !== false
      || record.payment_mutation_used !== false
      || record.direct_google_ads_api_call !== false
      || record.provider_mutation_used !== false
      || record.live_path_implemented !== false
      || record.campaignBudgetId_fallback_used !== false
      || (
        record.execution_gate_closure
        && (
          record.execution_gate_closure.future_live_execution_allowed !== false
          || record.execution_gate_closure.execution_allowed_now !== false
          || record.execution_gate_closure.production_ready !== false
          || record.execution_gate_closure.provider_api_called !== false
          || record.execution_gate_closure.google_ads_api_called !== false
          || record.execution_gate_closure.validateOnly_called !== false
          || record.execution_gate_closure.live_ads_execution_used !== false
        )
      )
    ) {
      throw new BadRequestException('execution preflight record must preserve local dry-run non-execution safety flags');
    }
  }

  private duplicateKey(error: any): string {
    return error?.keyValue?.execution_record_id || error?.keyValue?.idempotency_key || 'unknown';
  }

  private inputKey(record: AdsAutomationExecutionPreflightDryRunRecord): string {
    return `${record.execution_record_id}\n${record.idempotency_key}`;
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
}
