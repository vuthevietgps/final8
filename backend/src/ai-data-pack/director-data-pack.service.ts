import { Injectable } from '@nestjs/common';
import { DIRECTOR_XLSX_SHEETS, DirectorDataPack, PackSection } from './contracts/director-data-pack.contract';
import { DataSourceFreshness, missingQuality, SectionQuality } from './contracts/metadata.contract';
import { DataPackMetadataService } from './data-pack-metadata.service';
import { DataQualityReportService } from './data-quality-report.service';
import { DecisionHistoryExportService } from './decision-history-export.service';
import { ERP_FIELD_ALIASES } from './aliases/erp-field-alias.registry';
import { MappingReportService } from './mapping-report.service';
import { AdsPerformanceQuery } from './queries/ads-performance.query';
import { CustomerLtvQuery } from './queries/customer-ltv.query';
import { FinanceDataQuery } from './queries/finance-data.query';
import { LeadFunnelQuery } from './queries/lead-funnel.query';
import { OperationsCapacityQuery } from './queries/operations-capacity.query';
import { OrderProfitQuery } from './queries/order-profit.query';
import { CHATGPT_WEB_READING_RULES } from './rules/chatgpt-web-reading-rules';
import { CHATGPT_WEB_RESEARCH_RULES } from './rules/chatgpt-web-research-rules';
import { JsonExporterService } from './export/json-exporter.service';

@Injectable()
export class DirectorDataPackService {
  constructor(
    private readonly metadataService: DataPackMetadataService,
    private readonly finance: FinanceDataQuery,
    private readonly orders: OrderProfitQuery,
    private readonly leads: LeadFunnelQuery,
    private readonly ads: AdsPerformanceQuery,
    private readonly ltv: CustomerLtvQuery,
    private readonly operations: OperationsCapacityQuery,
    private readonly dataQuality: DataQualityReportService,
    private readonly mapping: MappingReportService,
    private readonly history: DecisionHistoryExportService,
    private readonly json: JsonExporterService,
  ) {}

  async build(date: string, format: 'json' | 'xlsx' = 'json', generatedBy?: unknown): Promise<DirectorDataPack> {
    const [finance, orders, leads, ads, ltv, operations, quality, mapping, history] = await Promise.all([
      this.finance.get(date),
      this.orders.get(date),
      this.leads.get(date),
      this.ads.get(date),
      this.ltv.get(),
      this.operations.get(),
      this.dataQuality.build(date, format, generatedBy),
      this.mapping.build(date, format, generatedBy),
      this.history.build(date, date, format, generatedBy),
    ]);
    const metadata = this.metadataService.create('director', date, format, generatedBy);
    metadata.data_sources = [
      this.source('finance', 'finance', finance.quality),
      this.source('orders', 'orders', orders.quality),
      this.source('marketing_leads', 'crm', leads.quality),
      this.source('ads', 'ads', ads.quality),
      this.source('operations', 'operations', operations.quality),
    ];
    const staticQuality = this.quality('AI Data Pack static V1 contract', 'high', 'ok', 'yes');
    const sections = {
      '00_README': this.section([
        { field: 'data_pack_name', value: 'Director Data Pack V1' },
        { field: 'schema_version', value: '1.0' },
        { field: 'report_date', value: date },
        { field: 'intended_reader', value: 'Director and ChatGPT Web' },
        { field: 'analysis_goal', value: 'Daily management analysis using read-only ERP data' },
        { field: 'do_not_execute_actions', value: true },
        { field: 'read_order', value: DIRECTOR_XLSX_SHEETS.join(' -> ') },
      ], staticQuality),
      '01_metadata': this.section(metadata, staticQuality),
      '02_chatgpt_web_reading_rules': this.section(CHATGPT_WEB_READING_RULES, staticQuality),
      '03_chatgpt_web_research_rules': this.section(CHATGPT_WEB_RESEARCH_RULES, staticQuality),
      '04_director_manual_inputs': this.section(finance.director_manual_inputs, {
        ...finance.quality,
        data_quality_status: finance.director_manual_inputs.length ? 'partial' : 'missing',
        confidence: 'low',
        can_use_for_decision: finance.director_manual_inputs.length ? 'cautious' : 'no',
        warning: [...finance.quality.warning, 'SystemSettings is only a V1 manual-input alias; no dedicated approved/versioned model exists.'],
        data_state: finance.director_manual_inputs.length ? 'available' : 'not_configured',
        empty_reason: finance.director_manual_inputs.length ? null : 'not_configured',
      }),
      '05_financial_context': this.section(finance.financial_context, finance.quality),
      '06_financing_context': this.section(finance.financing_context, finance.quality),
      '07_cashflow_scenarios': this.section(finance.cashflow_scenarios, finance.quality),
      '08_business_summary': this.section(orders.business_summary, orders.quality),
      '09_marketing_profitability': this.section(ads.metrics, ads.quality),
      '10_service_group_performance': this.section(orders.service_group_performance, orders.quality),
      '11_product_variant_performance': this.section(orders.product_variant_performance, orders.quality),
      '12_unit_economics': this.section(orders.unit_economics, orders.quality),
      '13_ltv_summary': this.section(ltv.ltv_summary, ltv.quality),
      '14_sales_funnel': this.section(leads.sales_funnel, leads.quality),
      '15_sales_team': this.section(leads.sales_team, leads.quality),
      '16_operation_capacity': this.section({ operation_capacity: operations }, operations.quality),
      '17_decision_history': this.section(history, history.quality as any),
      '18_alerts': this.section(finance.alerts, finance.quality),
      '19_data_quality': this.section(quality, quality.quality),
      '20_mapping_report': this.section(mapping, mapping.quality),
      '21_decision_options': this.section([], missingQuality('decision options', ['approved_business_targets', 'protected_and_test_allowlists'], 'No cross-domain decision option contract is populated in V1.', 'schema_only')),
      '22_permission_risk_limits': this.section([
        { rule: 'read_only_export', enabled: true },
        { rule: 'action_file_import', enabled: false },
        { rule: 'generic_dry_run', enabled: false },
        { rule: 'live_execution', enabled: false },
        { rule: 'openai_integration', enabled: false },
      ], staticQuality),
      '23_external_market_summary': this.section([], missingQuality('external market research', ['researched_sources'], 'ERP does not research the web in the read-only export layer.', 'schema_only')),
      '24_field_aliases': this.section(ERP_FIELD_ALIASES, staticQuality),
    } as Record<(typeof DIRECTOR_XLSX_SHEETS)[number], PackSection>;
    return this.json.attachChecksums({ metadata, sections });
  }

  private section<T>(data: T, quality: SectionQuality): PackSection<T> {
    return { data, quality };
  }

  private quality(source: string, confidence: 'high' | 'medium' | 'low', status: 'ok' | 'partial' | 'weak' | 'missing' | 'stale', use: 'yes' | 'cautious' | 'no'): SectionQuality {
    return {
      source,
      source_table_or_service: null,
      freshness_at: null,
      period: 'current',
      calculation_method: 'Static contract',
      data_quality_status: status,
      confidence,
      missing_fields: [],
      warning: [],
      can_use_for_decision: use,
      data_state: 'available',
      empty_reason: null,
    };
  }

  private source(name: string, domain: DataSourceFreshness['domain'], quality: SectionQuality): DataSourceFreshness {
    return {
      source_name: name,
      domain,
      source_table_or_service: quality.source_table_or_service,
      freshness_at: quality.freshness_at,
      freshness_status: quality.freshness_at ? 'ok' : 'unknown',
      confidence: quality.confidence,
      note: quality.warning.join('; '),
    };
  }
}
