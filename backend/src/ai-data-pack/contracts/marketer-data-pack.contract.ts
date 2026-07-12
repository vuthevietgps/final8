import { AiDataPackMetadata, SectionQuality } from './metadata.contract';

export const MARKETER_XLSX_SHEETS = [
  '00_README',
  '01_metadata',
  '02_chatgpt_web_reading_rules',
  '03_chatgpt_web_research_rules',
  '04_accounts',
  '05_campaigns',
  '06_ad_groups',
  '07_keywords',
  '08_ads_creatives',
  '09_daily_metrics',
  '10_leads_by_source',
  '11_data_quality',
  '12_mapping_report',
  '13_allowed_actions',
] as const;

export interface MarketerDataPack {
  metadata: AiDataPackMetadata;
  sections: Record<string, { data: unknown; quality: SectionQuality }>;
}

