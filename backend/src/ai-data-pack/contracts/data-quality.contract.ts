import { AiDataPackMetadata, DataState, SectionQuality } from './metadata.contract';

export interface DataQualityMetric {
  metric: string;
  value: number | null;
  unit: 'percent' | 'hours' | 'score';
  status: 'ok' | 'warning' | 'blocked' | 'missing';
  threshold: number | null;
  numerator: number | null;
  denominator: number | null;
  warning: string | null;
  value_state: DataState;
}

export interface DecisionGate {
  can_conclude_profit: boolean;
  can_use_ltv_strongly: boolean;
  can_recommend_ads_scale: boolean;
  can_generate_action_draft: boolean;
  can_import_action_file: false;
  can_dry_run: false;
  can_execute_live: false;
  blocking_reasons: string[];
  warnings: string[];
}

export interface DataQualityReport {
  metadata: AiDataPackMetadata;
  metrics: DataQualityMetric[];
  decision_gate: DecisionGate;
  quality: SectionQuality;
}
