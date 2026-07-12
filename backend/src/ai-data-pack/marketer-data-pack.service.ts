import { Injectable } from '@nestjs/common';
import { MarketerDataPack } from './contracts/marketer-data-pack.contract';
import { SectionQuality } from './contracts/metadata.contract';
import { DataPackMetadataService } from './data-pack-metadata.service';
import { DataQualityReportService } from './data-quality-report.service';
import { MappingReportService } from './mapping-report.service';
import { AdsPerformanceQuery } from './queries/ads-performance.query';
import { LeadFunnelQuery } from './queries/lead-funnel.query';
import { CHATGPT_WEB_READING_RULES } from './rules/chatgpt-web-reading-rules';
import { CHATGPT_WEB_RESEARCH_RULES } from './rules/chatgpt-web-research-rules';
import { JsonExporterService } from './export/json-exporter.service';

@Injectable()
export class MarketerDataPackService {
  constructor(
    private readonly metadataService: DataPackMetadataService,
    private readonly ads: AdsPerformanceQuery,
    private readonly leads: LeadFunnelQuery,
    private readonly quality: DataQualityReportService,
    private readonly mapping: MappingReportService,
    private readonly json: JsonExporterService,
  ) {}

  async build(date: string, format: 'json' | 'xlsx' = 'json', generatedBy?: unknown): Promise<MarketerDataPack> {
    const [ads, leads, quality, mapping] = await Promise.all([
      this.ads.get(date),
      this.leads.get(date),
      this.quality.build(date, format, generatedBy),
      this.mapping.build(date, format, generatedBy),
    ]);
    const metadata = this.metadataService.create('marketer', date, format, generatedBy);
    const staticQuality: SectionQuality = {
      source: 'AI Data Pack static V1 contract', source_table_or_service: null, freshness_at: null,
      period: 'current', calculation_method: 'Static contract', data_quality_status: 'ok',
      confidence: 'high', missing_fields: [], warning: [], can_use_for_decision: 'yes',
    };
    const sections: Record<string, { data: unknown; quality: SectionQuality }> = {
      '00_README': { data: [{ pack: 'Marketer Data Pack Google-focused V1', do_not_execute_actions: true }], quality: staticQuality },
      '01_metadata': { data: metadata, quality: staticQuality },
      '02_chatgpt_web_reading_rules': { data: CHATGPT_WEB_READING_RULES, quality: staticQuality },
      '03_chatgpt_web_research_rules': { data: CHATGPT_WEB_RESEARCH_RULES, quality: staticQuality },
      '04_accounts': { data: ads.accounts, quality: ads.quality },
      '05_campaigns': { data: ads.campaigns, quality: ads.quality },
      '06_ad_groups': { data: [...ads.googleAdGroups, ...ads.legacyAdGroups], quality: ads.quality },
      '07_keywords': { data: ads.keywords, quality: ads.quality },
      '08_ads_creatives': { data: ads.ads, quality: ads.quality },
      '09_daily_metrics': { data: ads.metrics, quality: ads.quality },
      '10_leads_by_source': { data: leads.leads, quality: leads.quality },
      '11_data_quality': { data: quality, quality: quality.quality },
      '12_mapping_report': { data: mapping, quality: mapping.quality },
      '13_allowed_actions': { data: [{ action: 'monitor_only', allowed: true }, { action: 'live_execution', allowed: false }], quality: staticQuality },
    };
    return this.json.attachChecksums({ metadata, sections });
  }
}
