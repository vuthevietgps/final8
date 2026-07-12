export type ConfidenceLevel = "high" | "medium" | "low";
export type DataQualityStatus = "ok" | "partial" | "weak" | "missing" | "stale";
export type DecisionUse = "yes" | "cautious" | "no";
export type DataState =
  | "zero_value"
  | "missing"
  | "not_applicable"
  | "not_synced"
  | "not_configured"
  | "no_records_for_report_date"
  | "weak_mapping"
  | "estimated"
  | "realized"
  | "available"
  | "schema_only";
export type EmptyReason = Exclude<
  DataState,
  "zero_value" | "estimated" | "realized" | "available"
>;

export interface SectionQuality {
  source: string;
  source_table_or_service: string | null;
  freshness_at: string | null;
  period:
    | "yesterday"
    | "last_3d"
    | "last_7d"
    | "last_30d"
    | "last_90d"
    | "custom"
    | "current";
  calculation_method: string | null;
  data_quality_status: DataQualityStatus;
  confidence: ConfidenceLevel;
  missing_fields: string[];
  warning: string[];
  can_use_for_decision: DecisionUse;
  data_state?: DataState;
  empty_reason?: EmptyReason | null;
}

export interface DataSourceFreshness {
  source_name: string;
  domain:
    | "finance"
    | "orders"
    | "ads"
    | "crm"
    | "sales"
    | "operations"
    | "manual"
    | "external";
  source_table_or_service: string | null;
  freshness_at: string | null;
  freshness_status: "ok" | "stale" | "unknown" | "missing";
  confidence: ConfidenceLevel;
  note?: string;
}

export interface AiDataPackMetadata {
  data_pack_id: string;
  data_pack_type:
    | "director"
    | "marketer"
    | "data_quality"
    | "mapping_report"
    | "decision_history";
  schema_version: "1.0";
  report_date: string;
  date_range?: { from: string; to: string };
  exported_at: string;
  timezone: string;
  currency: string;
  company_id: string | null;
  company_name: string | null;
  generated_by_user_id: string | null;
  generated_by_role: string | null;
  generated_by_display: string | null;
  export_format: "json" | "xlsx";
  data_sources: DataSourceFreshness[];
  warnings: string[];
  runtime_export_checksum?: string;
  data_content_checksum?: string;
  export_job_id?: string;
  export_mode?: "cached_export";
  cached_export?: true;
  sync_policy?: "export_cached";
  provider_sync_attempted?: false;
  freshness_gate_evaluated?: false;
  live_execution?: false;
}

export function missingQuality(
  source: string,
  missingFields: string[],
  warning: string,
  emptyReason: EmptyReason = "missing",
): SectionQuality {
  return {
    source,
    source_table_or_service: null,
    freshness_at: null,
    period: "current",
    calculation_method: null,
    data_quality_status: "missing",
    confidence: "low",
    missing_fields: missingFields,
    warning: [warning],
    can_use_for_decision: "no",
    data_state: emptyReason,
    empty_reason: emptyReason,
  };
}
