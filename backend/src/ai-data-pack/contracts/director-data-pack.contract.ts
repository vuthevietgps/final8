import { AiDataPackMetadata, SectionQuality } from './metadata.contract';

export const DIRECTOR_XLSX_SHEETS = [
  '00_README',
  '01_metadata',
  '02_chatgpt_web_reading_rules',
  '03_chatgpt_web_research_rules',
  '04_director_manual_inputs',
  '05_financial_context',
  '06_financing_context',
  '07_cashflow_scenarios',
  '08_business_summary',
  '09_marketing_profitability',
  '10_service_group_performance',
  '11_product_variant_performance',
  '12_unit_economics',
  '13_ltv_summary',
  '14_sales_funnel',
  '15_sales_team',
  '16_operation_capacity',
  '17_decision_history',
  '18_alerts',
  '19_data_quality',
  '20_mapping_report',
  '21_decision_options',
  '22_permission_risk_limits',
  '23_external_market_summary',
  '24_field_aliases',
] as const;

export type DirectorSheetName = (typeof DIRECTOR_XLSX_SHEETS)[number];

export interface PackSection<T = unknown> {
  data: T;
  quality: SectionQuality;
}

export interface DirectorDataPack {
  metadata: AiDataPackMetadata;
  sections: Record<DirectorSheetName, PackSection>;
}

