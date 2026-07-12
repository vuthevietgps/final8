import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type {
  AdsAutomationValidateOnlyEvidenceInput,
  AdsAutomationValidateOnlyEvidencePersistResult,
  AdsAutomationValidateOnlyEvidenceRecord,
} from './contracts/ads-automation-validate-only-evidence.contract';
import type {
  AdsAutomationProviderValidateOnlyActionPlan,
  AdsAutomationProviderValidateOnlyBoundaryEvidence,
  AdsAutomationProviderValidateOnlyRequestRecord,
  AdsAutomationProviderValidateOnlyResultRecord,
} from './contracts/ads-automation-provider-validate-only.contract';
import {
  AiDataPackAdsAutomationValidateOnlyEvidence,
  AiDataPackAdsAutomationValidateOnlyEvidenceDocument,
} from './schemas/ads-automation-validate-only-evidence.schema';

@Injectable()
export class AdsAutomationValidateOnlyEvidenceRepository {
  constructor(
    @InjectModel(AiDataPackAdsAutomationValidateOnlyEvidence.name)
    private readonly validateOnlyModel: Model<AiDataPackAdsAutomationValidateOnlyEvidenceDocument>,
  ) {}

  async createManyIdempotent(
    plans: AdsAutomationValidateOnlyEvidenceInput[],
    context: {
      requestId?: string | null;
      requestedByUserId?: string | null;
      requestedByRole?: string | null;
      createdAt?: string | null;
    } = {},
  ): Promise<AdsAutomationValidateOnlyEvidencePersistResult> {
    const persistable = plans.map((plan) => this.toPersistableRecord(plan, context));
    if (!persistable.length) {
      return { records: [], created: 0, reused: 0 };
    }

    const existing = await this.findExistingByIdentities(persistable);
    const persistedByInputKey = new Map<string, AdsAutomationValidateOnlyEvidenceRecord>();
    let created = 0;
    let reused = 0;

    for (const record of persistable) {
      const existingRecord = existing.get(record.validation_id) || existing.get(record.idempotency_key);
      if (existingRecord) {
        persistedByInputKey.set(this.inputKey(record), existingRecord);
        reused += 1;
        continue;
      }

      try {
        const doc = await this.validateOnlyModel.create(record);
        const createdRecord = this.toRecord(this.toObject(doc));
        persistedByInputKey.set(this.inputKey(record), createdRecord);
        existing.set(createdRecord.validation_id, createdRecord);
        existing.set(createdRecord.idempotency_key, createdRecord);
        created += 1;
      } catch (error: any) {
        if (error?.code !== 11000) {
          throw error;
        }
        const raceRecord = await this.findByValidationId(record.validation_id)
          || await this.findByIdempotencyKey(record.idempotency_key);
        if (!raceRecord) {
          throw new BadRequestException(`duplicate validate-only evidence rejected: ${this.duplicateKey(error)}`);
        }
        persistedByInputKey.set(this.inputKey(record), raceRecord);
        existing.set(raceRecord.validation_id, raceRecord);
        existing.set(raceRecord.idempotency_key, raceRecord);
        reused += 1;
      }
    }

    return {
      records: persistable
        .map((record) => persistedByInputKey.get(this.inputKey(record)))
        .filter((record): record is AdsAutomationValidateOnlyEvidenceRecord => Boolean(record)),
      created,
      reused,
    };
  }

  toPersistableRecord(
    input: AdsAutomationValidateOnlyEvidenceInput,
    context: {
      requestId?: string | null;
      requestedByUserId?: string | null;
      requestedByRole?: string | null;
      createdAt?: string | null;
    } = {},
  ): AdsAutomationValidateOnlyEvidenceRecord {
    this.assertInput(input);
    const validationId = this.requiredText(input.validation_id, 'validation_id');
    const approvalId = this.requiredText(input.approval_id, 'approval_id');
    const requestId = this.nullableText(input.requestId ?? context.requestId);
    const createdAt = this.isoText(context.createdAt || input.providerValidatedAt);
    const idempotencyKey = [
      'ads-validate-only-evidence',
      this.safeKey(approvalId),
      this.safeKey(requestId || validationId),
    ].join(':');

    return {
      ...this.toSafeValidationPlan(input),
      schemaVersion: 'ads_automation_validate_only_evidence.v1',
      validation_id: validationId,
      idempotency_key: idempotencyKey,
      approval_id: approvalId,
      validateOnly_evidence_persisted: true,
      future_live_execution_allowed: false,
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

  async findByValidationId(
    validationId: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceRecord | null> {
    const normalizedValidationId = this.text(validationId);
    if (!normalizedValidationId) return null;

    const row = await this.validateOnlyModel
      .findOne({ validation_id: normalizedValidationId }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  async findByValidationIds(
    validationIds: string[],
  ): Promise<AdsAutomationValidateOnlyEvidenceRecord[]> {
    const ids = this.uniqueText(validationIds);
    if (!ids.length) return [];

    const rows = await this.validateOnlyModel
      .find({ validation_id: { $in: ids } }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return rows.map((row: any) => this.toRecord(row));
  }

  async listByApprovalId(
    approvalId: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceRecord[]> {
    const normalizedApprovalId = this.text(approvalId);
    if (!normalizedApprovalId) return [];

    const rows = await this.validateOnlyModel
      .find({ approval_id: normalizedApprovalId }, { _id: 0, __v: 0 })
      .sort({ createdAt: -1, validation_id: 1 })
      .lean()
      .exec();

    return rows.map((row: any) => this.toRecord(row));
  }

  private async findExistingByIdentities(
    records: AdsAutomationValidateOnlyEvidenceRecord[],
  ): Promise<Map<string, AdsAutomationValidateOnlyEvidenceRecord>> {
    const validationIds = this.uniqueText(records.map((record) => record.validation_id));
    const idempotencyKeys = this.uniqueText(records.map((record) => record.idempotency_key));
    const filters: Record<string, unknown>[] = [];
    if (validationIds.length) filters.push({ validation_id: { $in: validationIds } });
    if (idempotencyKeys.length) filters.push({ idempotency_key: { $in: idempotencyKeys } });
    if (!filters.length) return new Map();

    const rows = await this.validateOnlyModel
      .find({ $or: filters }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    const existing = new Map<string, AdsAutomationValidateOnlyEvidenceRecord>();
    for (const row of rows) {
      const record = this.toRecord(row);
      existing.set(record.validation_id, record);
      existing.set(record.idempotency_key, record);
    }
    return existing;
  }

  private async findByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<AdsAutomationValidateOnlyEvidenceRecord | null> {
    const normalizedIdempotencyKey = this.text(idempotencyKey);
    if (!normalizedIdempotencyKey) return null;

    const row = await this.validateOnlyModel
      .findOne({ idempotency_key: normalizedIdempotencyKey }, { _id: 0, __v: 0 })
      .lean()
      .exec();

    return row ? this.toRecord(row) : null;
  }

  private toRecord(row: any): AdsAutomationValidateOnlyEvidenceRecord {
    const plan = this.toSafeValidationPlan(row);
    return {
      ...plan,
      schemaVersion: 'ads_automation_validate_only_evidence.v1',
      validation_id: this.requiredText(row.validation_id, 'validation_id'),
      idempotency_key: this.requiredText(row.idempotency_key, 'idempotency_key'),
      approval_id: this.requiredText(row.approval_id, 'approval_id'),
      validateOnly_evidence_persisted: true,
      future_live_execution_allowed: false,
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

  private toSafeValidationPlan(row: any): AdsAutomationProviderValidateOnlyActionPlan {
    const boundary = this.safeBoundaryEvidence(row.provider_boundary_evidence);
    const plan: AdsAutomationProviderValidateOnlyActionPlan = {
      validation_id: this.requiredText(row.validation_id, 'validation_id'),
      pending_action_id: this.requiredText(row.pending_action_id, 'pending_action_id'),
      approval_id: this.requiredText(row.approval_id, 'approval_id'),
      source_pending_action_status: row.source_pending_action_status,
      action_type: row.action_type,
      action_family: row.action_family,
      provider: row.provider,
      resource_type: row.resource_type,
      entity_type: row.entity_type,
      entity_id: this.requiredText(row.entity_id, 'entity_id'),
      customerId: this.nullableText(row.customerId),
      campaignId: this.nullableText(row.campaignId),
      adGroupId: this.nullableText(row.adGroupId),
      campaignBudgetId: this.nullableText(row.campaignBudgetId),
      campaignBudgetResourceName: this.nullableText(row.campaignBudgetResourceName),
      requested_change: this.cloneJson(row.requested_change || {}),
      status: row.status,
      providerValidationStatus: row.providerValidationStatus,
      providerRequestId: this.nullableText(row.providerRequestId),
      providerValidatedAt: this.nullableIsoText(row.providerValidatedAt),
      providerValidationErrors: Array.isArray(row.providerValidationErrors)
        ? this.cloneJson(row.providerValidationErrors)
        : [],
      before_state_snapshot: this.cloneJson(row.before_state_snapshot || {}),
      provider_boundary_evidence: boundary,
      provider_account_readiness: row.provider_account_readiness
        ? this.cloneJson(row.provider_account_readiness)
        : null,
      blockers: this.arrayText(row.blockers),
      approval_can_be_considered_executable: row.approval_can_be_considered_executable === true,
      executable_now: false,
      execution_allowed_now: false,
      validate_only_required_before_execution: row.validate_only_required_before_execution === true,
      next_required_action: row.next_required_action,
      source_pending_action: this.cloneJson(row.source_pending_action || {}),
    };
    const validateOnlyRequest = this.safeValidateOnlyRequest(row.validateOnly_request);
    const validateOnlyResult = this.safeValidateOnlyResult(row.validateOnly_result);
    if (validateOnlyRequest) plan.validateOnly_request = validateOnlyRequest;
    if (validateOnlyResult) plan.validateOnly_result = validateOnlyResult;
    return plan;
  }

  private safeBoundaryEvidence(value: any): AdsAutomationProviderValidateOnlyBoundaryEvidence {
    const evidence = value && typeof value === 'object' ? value : {};
    return {
      boundary_mode: evidence.boundary_mode || 'erp_local_mock_only',
      status_source: evidence.status_source || 'no_mock_result',
      mocked_provider_result_used: evidence.mocked_provider_result_used === true,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      direct_google_ads_api_call: false,
      operation_builder_called: false,
      raw_provider_request_included: false,
      evidence: this.arrayText(evidence.evidence),
    };
  }

  private safeValidateOnlyRequest(value: any): AdsAutomationProviderValidateOnlyRequestRecord | undefined {
    if (!value || typeof value !== 'object') return undefined;
    return {
      ...this.cloneJson(value),
      requested_change: this.cloneJson(value.requested_change || {}),
      required_identifiers: this.arrayText(value.required_identifiers),
      missing_identifiers: this.arrayText(value.missing_identifiers),
      before_state_snapshot_required: true,
      raw_provider_request_included: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
    } as AdsAutomationProviderValidateOnlyRequestRecord;
  }

  private safeValidateOnlyResult(value: any): AdsAutomationProviderValidateOnlyResultRecord | undefined {
    if (!value || typeof value !== 'object') return undefined;
    return {
      ...this.cloneJson(value),
      providerValidationErrors: Array.isArray(value.providerValidationErrors)
        ? this.cloneJson(value.providerValidationErrors)
        : [],
      before_state_snapshot: this.cloneJson(value.before_state_snapshot || {}),
      executable_now: false,
      execution_allowed_now: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
    } as AdsAutomationProviderValidateOnlyResultRecord;
  }

  private assertInput(input: AdsAutomationValidateOnlyEvidenceInput): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('validate-only evidence input is required');
    }
    const raw = input as any;
    if (
      input.execution_allowed_now !== false
      || input.executable_now !== false
      || input.provider_boundary_evidence?.provider_api_called !== false
      || input.provider_boundary_evidence?.google_ads_api_called !== false
      || input.provider_boundary_evidence?.validateOnly_called !== false
      || input.provider_boundary_evidence?.direct_google_ads_api_call !== false
      || input.provider_boundary_evidence?.operation_builder_called !== false
      || input.provider_boundary_evidence?.raw_provider_request_included !== false
      || raw.validateOnly_request?.raw_provider_request_included === true
      || raw.validateOnly_request?.provider_api_called === true
      || raw.validateOnly_request?.google_ads_api_called === true
      || raw.validateOnly_request?.validateOnly_called === true
      || raw.validateOnly_request?.execution_allowed_now === true
      || raw.validateOnly_result?.provider_api_called === true
      || raw.validateOnly_result?.google_ads_api_called === true
      || raw.validateOnly_result?.validateOnly_called === true
      || raw.validateOnly_result?.live_ads_execution_used === true
      || raw.validateOnly_result?.execution_allowed_now === true
      || raw.validateOnly_result?.executable_now === true
      || raw.future_live_execution_allowed === true
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
      throw new BadRequestException('validate-only evidence must preserve local dry-run non-execution safety flags');
    }
  }

  private duplicateKey(error: any): string {
    return error?.keyValue?.validation_id || error?.keyValue?.idempotency_key || 'unknown';
  }

  private inputKey(record: AdsAutomationValidateOnlyEvidenceRecord): string {
    return `${record.validation_id}\n${record.idempotency_key}`;
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

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
