import { Inject, Injectable, Optional } from '@nestjs/common';
import { THRESHOLD_SOURCE_RECORDS, THRESHOLD_SOURCE_RECORDS_TOKEN } from './threshold-source.config';
import {
  ResolveManyThresholdsInput,
  ResolvedThresholdMetadata,
  ResolvedThresholdSummary,
  ResolveThresholdInput,
  ThresholdFallbackBehavior,
  ThresholdSourceRecord,
} from './threshold-source.contract';
import { validateThresholdSourceRecords } from './threshold-source.validator';

@Injectable()
export class ThresholdSourceResolver {
  private readonly records: readonly ThresholdSourceRecord[];

  constructor(
    @Optional()
    @Inject(THRESHOLD_SOURCE_RECORDS_TOKEN)
    records: readonly ThresholdSourceRecord[] = THRESHOLD_SOURCE_RECORDS,
  ) {
    validateThresholdSourceRecords(records);
    this.records = [...records];
  }

  resolve(input: ResolveThresholdInput): ResolvedThresholdMetadata {
    const asOfDate = this.normalizeDate(input.asOfDate);
    const matchingRecords = this.records.filter((record) =>
      record.finding_key === input.findingKey && record.threshold_key === input.thresholdKey,
    );
    const activeRecord = matchingRecords.find((record) => this.isActive(record, asOfDate));

    if (!activeRecord) {
      return this.missingResolution(input, input.fallbackBehavior || 'no_row');
    }

    if (activeRecord.approval_status !== 'approved' && activeRecord.approval_status !== 'not_applicable') {
      return this.inactiveApprovalResolution(activeRecord);
    }

    return {
      threshold_source_key: activeRecord.threshold_key,
      threshold_source_type: activeRecord.source_type,
      threshold_source_version_or_effective_date: activeRecord.effective_from,
      threshold_source_approval_status: activeRecord.approval_status,
      threshold_source_owner: activeRecord.business_owner,
      threshold_source_default_used: false,
      threshold_value: activeRecord.value,
      threshold_unit: activeRecord.unit,
      data_quality_reason: `Threshold source ${activeRecord.threshold_key} resolved with ${activeRecord.data_quality_status_impact} data-quality impact.`,
      confidence_reason: `Threshold source ${activeRecord.threshold_key} has ${activeRecord.confidence_impact} confidence impact; source evidence still controls final row confidence.`,
      missing_or_weak_fields: [],
      semantic_notes: activeRecord.semantic_notes || [],
      should_emit_row: true,
    };
  }

  resolveMany(input: ResolveManyThresholdsInput): ResolvedThresholdSummary {
    const resolutions = input.thresholdKeys.map((thresholdKey) =>
      this.resolve({
        findingKey: input.findingKey,
        thresholdKey,
        asOfDate: input.asOfDate,
        fallbackBehavior: 'emit_with_downgrade',
      }),
    );

    return {
      threshold_source_key: this.joinUnique(resolutions.map((item) => item.threshold_source_key)),
      threshold_source_type: this.joinUnique(resolutions.map((item) => item.threshold_source_type)),
      threshold_source_version_or_effective_date: this.joinUnique(resolutions.map((item) => item.threshold_source_version_or_effective_date)),
      threshold_source_approval_status: this.joinUnique(resolutions.map((item) => item.threshold_source_approval_status)),
      threshold_source_owner: this.joinUnique(resolutions.map((item) => item.threshold_source_owner)),
      threshold_source_default_used: resolutions.some((item) => item.threshold_source_default_used),
      threshold_unit: this.joinUnique(resolutions.map((item) => item.threshold_unit)),
      data_quality_reason: this.joinUnique(resolutions.map((item) => item.data_quality_reason)),
      confidence_reason: this.joinUnique(resolutions.map((item) => item.confidence_reason)),
      missing_or_weak_fields: this.unique(resolutions.flatMap((item) => item.missing_or_weak_fields)),
      semantic_notes: this.unique(resolutions.flatMap((item) => item.semantic_notes)),
      should_emit_row: resolutions.every((item) => item.should_emit_row),
    };
  }

  private missingResolution(
    input: ResolveThresholdInput,
    fallbackBehavior: ThresholdFallbackBehavior,
  ): ResolvedThresholdMetadata {
    const useDefault = fallbackBehavior === 'use_documented_default';
    return {
      threshold_source_key: input.thresholdKey,
      threshold_source_type: 'missing',
      threshold_source_version_or_effective_date: null,
      threshold_source_approval_status: 'missing',
      threshold_source_owner: null,
      threshold_source_default_used: useDefault,
      threshold_value: useDefault ? input.defaultValue ?? null : null,
      threshold_unit: useDefault ? input.defaultUnit ?? null : null,
      data_quality_reason: `Threshold source ${input.thresholdKey} is missing; fallback_behavior=${fallbackBehavior}.`,
      confidence_reason: `Missing threshold source ${input.thresholdKey} prevents high confidence.`,
      missing_or_weak_fields: [input.thresholdKey],
      semantic_notes: [],
      should_emit_row: fallbackBehavior !== 'no_row',
    };
  }

  private inactiveApprovalResolution(record: ThresholdSourceRecord): ResolvedThresholdMetadata {
    const shouldEmit = record.fallback_behavior !== 'no_row';
    return {
      threshold_source_key: record.threshold_key,
      threshold_source_type: record.source_type,
      threshold_source_version_or_effective_date: record.effective_from,
      threshold_source_approval_status: record.approval_status,
      threshold_source_owner: record.business_owner,
      threshold_source_default_used: false,
      threshold_value: null,
      threshold_unit: record.unit,
      data_quality_reason: `Threshold source ${record.threshold_key} is ${record.approval_status}; fallback_behavior=${record.fallback_behavior}.`,
      confidence_reason: `Unapproved threshold source ${record.threshold_key} is conservative and cannot increase confidence.`,
      missing_or_weak_fields: [record.threshold_key],
      semantic_notes: record.semantic_notes || [],
      should_emit_row: shouldEmit,
    };
  }

  private normalizeDate(input?: Date | string): Date {
    if (input instanceof Date) {
      return input;
    }
    const timestamp = input ? Date.parse(input) : Date.now();
    return Number.isFinite(timestamp) ? new Date(timestamp) : new Date();
  }

  private isActive(record: ThresholdSourceRecord, asOfDate: Date): boolean {
    const effectiveFrom = record.effective_from ? Date.parse(record.effective_from) : null;
    const effectiveTo = record.effective_to ? Date.parse(record.effective_to) : null;
    const asOfTime = asOfDate.getTime();
    return (effectiveFrom === null || effectiveFrom <= asOfTime)
      && (effectiveTo === null || effectiveTo > asOfTime);
  }

  private joinUnique(values: Array<string | null>): string {
    return this.unique(values.filter((value): value is string => Boolean(value))).join('; ');
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => typeof value === 'string' && value.trim().length > 0)));
  }
}
