import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Types } from 'mongoose';
import { ERP_FIELD_ALIASES, mapLoanStatus } from './aliases/erp-field-alias.registry';
import { DIRECTOR_XLSX_SHEETS } from './contracts/director-data-pack.contract';
import { MARKETER_XLSX_SHEETS } from './contracts/marketer-data-pack.contract';
import { missingQuality, type ConfidenceLevel, type DataQualityStatus } from './contracts/metadata.contract';
import { DataPackMetadataService } from './data-pack-metadata.service';
import { DataQualityReportService } from './data-quality-report.service';
import { DirectorDataPackService } from './director-data-pack.service';
import { JsonExporterService } from './export/json-exporter.service';
import { XlsxExporterService } from './export/xlsx-exporter.service';
import { MappingReportService } from './mapping-report.service';
import { AdsPerformanceQuery } from './queries/ads-performance.query';
import { FinanceDataQuery } from './queries/finance-data.query';
import { OperationsCapacityQuery } from './queries/operations-capacity.query';
import { OrderProfitQuery } from './queries/order-profit.query';
import { calculateAttributionConfidence } from './utils/confidence.util';
import { redactDataPack } from './utils/redaction.util';

const quality = {
  source: 'test',
  source_table_or_service: 'test',
  freshness_at: '2026-06-12T00:00:00.000Z',
  period: 'custom' as const,
  calculation_method: 'test',
  data_quality_status: 'partial' as const,
  confidence: 'medium' as const,
  missing_fields: [],
  warning: [],
  can_use_for_decision: 'cautious' as const,
  data_state: 'available' as const,
  empty_reason: null,
};

const hardenedOperationalRiskFindings = [
  'low_inventory_best_seller',
  'supplier_cost_up',
  'overdue_dealer_receivables',
  'labor_overtime_high',
  'slow_supplier_good_cost',
];

const nonCanonicalOperationalRiskFindingAliases = [
  'low_inventory_bestseller',
  'dealer_receivable_overdue_or_risk',
  'labor_overtime_mismatch',
  'slow_supplier_better_alternative',
];

const operationalRiskCanonicalEvidenceFields = [
  'finding_key',
  'finding_label',
  'evidence_strength',
  'source_domain',
  'source_collections_or_modules',
  'time_window',
  'affected_entity_type',
  'affected_entity_id',
  'affected_entity_name_or_alias',
  'metric_name',
  'metric_value',
  'threshold_value',
  'calculation_method',
  'sample_size',
  'data_quality_status',
  'confidence',
  'recommended_advisory_language',
  'not_allowed_actions',
] as const;

const allowedOperationalRiskDataQualityStatuses = new Set<DataQualityStatus>([
  'ok',
  'partial',
  'weak',
  'missing',
  'stale',
]);

const allowedOperationalRiskConfidenceValues = new Set<ConfidenceLevel>([
  'high',
  'medium',
  'low',
]);

const operationalRiskDowngradeContextFields = [
  'missing_or_weak_fields',
  'blocking_reason_if_any',
  'inventory_semantics_data_quality_notes',
  'receivable_semantics_note',
  'available_quantity_assumption',
] as const;

const operationalRiskThresholdMetadataFields = [
  'threshold_source_key',
  'threshold_source_type',
  'threshold_source_version_or_effective_date',
  'threshold_source_approval_status',
  'threshold_source_owner',
  'threshold_source_default_used',
  'threshold_unit',
  'weak_fields_present',
  'semantic_notes',
  'confidence_reason',
  'data_quality_reason',
] as const;

const operationalRiskSourceFreshnessValueFields = [
  'source_freshness_status',
  'source_last_observed_at',
  'source_window_from',
  'source_window_to',
  'source_record_count',
  'source_sample_size',
  'source_lineage_modules',
  'source_lineage_collections',
  'source_lineage_fields',
  'source_lineage_method',
  'source_is_derived_candidate',
  'source_derivation_notes',
  'source_confidence_reason',
] as const;

const operationalRiskSourceFreshnessNullableFields = [
  'source_missing_reason',
  'source_staleness_reason',
  'source_coverage_percent',
] as const;

const operationalRiskEvidenceDetailFields = [
  'evidence_summary',
  'evidence_rows',
  'evidence_row_count',
  'evidence_sample_limit',
  'evidence_entities',
  'evidence_time_window',
  'evidence_direct_fields',
  'evidence_derived_fields',
  'evidence_calculation_steps',
  'evidence_threshold_comparison',
  'evidence_source_freshness',
  'evidence_missing_fields',
  'evidence_verification_fields',
  'evidence_drilldown_refs',
  'recommended_manual_owner',
  'manual_review_question',
  'blocked_actions_summary',
  'top_evidence_entities',
  'evidence_missing_fields_summary',
  'evidence_drilldown_refs_summary',
] as const;

const operationalRiskEvidenceRowFields = [
  'entity_id',
  'entity_name_or_alias',
  'entity_type',
  'source_module',
  'source_collection',
  'source_row_id',
  'source_field_names',
  'raw_values_used',
  'normalized_values_used',
  'timestamp',
  'comparison_window_from',
  'comparison_window_to',
  'threshold_used',
  'threshold_source_key',
  'calculation_result',
  'calculation_step_ref',
  'reason_row_was_emitted',
  'reason_action_is_blocked',
  'drilldown_ref',
] as const;

const operationalRiskSeverityFields = [
  'severity_score',
  'severity_label',
  'severity_display_label',
  'severity_reason',
  'severity_components',
  'severity_cap_reason',
] as const;

const allowedOperationalRiskSeverityLabels = new Set([
  'RAT_TOT',
  'TOT',
  'BINH_THUONG',
  'CHU_Y',
  'NGHIEM_TRONG',
]);

const allowedSourceFreshnessStatuses = new Set([
  'fresh',
  'stale',
  'missing',
  'unknown',
  'not_configured',
  'unsupported',
]);

const expectedSourceLineageCollectionsByFinding: Record<string, readonly string[]> = {
  low_inventory_best_seller: ['inventorysummaries', 'products', 'ordertest2', 'purchaseorders', 'deliverystatuses'],
  supplier_cost_up: ['supplierquotes', 'quotes', 'products'],
  overdue_dealer_receivables: ['ordertest2', 'agentstatements', 'users'],
  labor_overtime_high: ['laborcost1', 'laborstatements', 'ordertest2', 'users'],
  slow_supplier_good_cost: ['supplierquotes', 'purchaseorders', 'products', 'inventorysummaries', 'users'],
};

const requiredThresholdKeyByFinding: Record<string, string> = {
  low_inventory_best_seller: 'low_inventory.days_of_cover_threshold',
  supplier_cost_up: 'supplier_cost.cost_increase_percent_threshold',
  overdue_dealer_receivables: 'dealer_receivable.settlement_due_date_source',
  labor_overtime_high: 'labor.overtime_hours_threshold',
  slow_supplier_good_cost: 'slow_supplier.cost_advantage_threshold',
};

const operationalRiskFindingSpecificFieldGroups: Record<string, readonly (readonly string[])[]> = {
  low_inventory_best_seller: [
    ['affected_entity_id', 'good_or_product_id', 'product_id'],
    ['current_inventory_quantity', 'stock_on_hand_if_available', 'on_hand'],
    ['sales_velocity_per_day', 'bestseller_rank'],
    ['available_quantity', 'projected_available_quantity'],
  ],
  supplier_cost_up: [
    ['supplier_id_or_alias', 'supplier_id', 'affected_entity_id'],
    ['product_id', 'good_or_product_id', 'affected_entity_name_or_alias'],
    ['current_supplier_cost_or_quote', 'current_supplier_cost'],
    ['prior_supplier_cost_or_quote', 'prior_supplier_cost'],
    ['cost_increase_percent', 'supplier_cost_growth_percent', 'metric_value'],
  ],
  overdue_dealer_receivables: [
    ['dealer_or_agent_id', 'affected_entity_id'],
    ['due_date'],
    ['days_overdue', 'aging_bucket'],
    ['overdue_balance', 'outstanding_balance'],
  ],
  labor_overtime_high: [
    ['team_or_labor_group_id', 'affected_entity_id'],
    ['current_overtime_hours'],
    ['prior_overtime_hours'],
    ['revenue_growth_percent'],
    ['labor_cost_growth_percent', 'overtime_growth_percent'],
  ],
  slow_supplier_good_cost: [
    ['supplier_id'],
    ['good_or_product_id'],
    ['current_supplier_cost'],
    ['peer_supplier_median_cost', 'peer_supplier_quote_count'],
    ['supplier_cost_advantage_percent'],
    ['current_delay_days_if_available', 'delayed_purchase_order_count'],
  ],
};

const bannedOperationalRiskEvidenceKeys = new Set([
  'action_id',
  'action_key',
  'action_type',
  'action_payload',
  'action_plan',
  'action_draft',
  'action_draft_schema',
  'action_import',
  'approval_id',
  'approval_status',
  'approval_workflow',
  'import_job_id',
  'provider',
  'provider_operation',
  'provider_payload',
  'provider_request',
  'provider_response',
  'provider_execution',
  'validateonly',
  'validate_only',
  'execute_live',
  'dry_run',
  'live',
  'live_execution',
  'mutation',
  'mutate',
  'ads_execution_plan',
  'purchase_order_action',
  'supplier_order_action',
  'inventory_action',
  'stock_action',
  'price_action',
  'cogs_action',
  'order_revenue_action',
  'cashflow_action',
  'staffing_action',
  'schedule_action',
  'payroll_action',
  'timesheet_action',
  'openai_upload',
  'openai_call',
]);

function collectBannedOperationalRiskEvidenceKeys(value: unknown, path: string[] = []): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectBannedOperationalRiskEvidenceKeys(item, [...path, String(index)]));
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) => {
    const currentPath = [...path, key];
    const match = bannedOperationalRiskEvidenceKeys.has(key.toLowerCase())
      ? [currentPath.join('.')]
      : [];
    return [
      ...match,
      ...collectBannedOperationalRiskEvidenceKeys(nested, currentPath),
    ];
  });
}

function hasOperationalRiskEvidenceValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

function hasAnyOperationalRiskEvidenceField(row: Record<string, unknown>, fieldNames: readonly string[]): boolean {
  return fieldNames.some((fieldName) => hasOperationalRiskEvidenceValue(row[fieldName]));
}

describe('AI Data Pack V1 contracts and safety', () => {
  it('keeps attribution confidence capped when only adGroupId-like evidence exists', () => {
    expect(calculateAttributionConfidence({ adGroup: true })).toBeLessThanOrEqual(0.7);
    expect(calculateAttributionConfidence({ adGroup: true })).not.toBe(1);
  });

  it('maps loan statuses without treating proposed or approved-not-disbursed as disbursed', () => {
    expect(mapLoanStatus({ status: 'draft', disbursementStatus: 'pending' })).toBe('proposed');
    expect(mapLoanStatus({ status: 'active', disbursementStatus: 'pending' })).toBe('approved_not_disbursed');
    expect(mapLoanStatus({ status: 'active', disbursementStatus: 'fully' })).toBe('disbursed');
  });

  it('uses the documented V1 service group and product variant aliases', () => {
    expect(ERP_FIELD_ALIASES).toEqual(expect.arrayContaining([
      expect.objectContaining({ standard_entity: 'service_group', erp_entity: 'ProductCategory' }),
      expect.objectContaining({ standard_entity: 'product_variant', erp_entity: 'Product' }),
    ]));
  });

  it('does not reference blocked finance functions or mock/random sources', () => {
    const source = readFileSync(join(__dirname, 'queries', 'finance-data.query.ts'), 'utf8');
    expect(source).not.toContain('computeAvailableFunds(');
    expect(source).not.toContain('getCollectedRevenueToday(');
    expect(source).not.toContain('getLoanRoomAvailable(');
    expect(source).not.toContain('cashflow-control');
    expect(source).not.toContain('data-collection.service');
    expect(source).not.toContain('Math.random');
  });

  it('redacts secrets and PII from exported structures', () => {
    const result: any = redactDataPack({
      apiKey: 'secret-key',
      receiverPhone: '0901234567',
      customerName: 'Private Person',
      nested: { authorization: 'Bearer secret' },
    });
    expect(JSON.stringify(result)).not.toContain('secret-key');
    expect(JSON.stringify(result)).not.toContain('0901234567');
    expect(JSON.stringify(result)).not.toContain('Private Person');
  });

  it('creates deterministic JSON and XLSX files with all required Director and Marketer sheets', () => {
    const json = new JsonExporterService();
    expect(json.checksum({ b: 2, a: 1 })).toBe(json.checksum({ a: 1, b: 2 }));
    const xlsx = new XlsxExporterService();
    const director = XLSX.read(xlsx.export(Object.fromEntries(DIRECTOR_XLSX_SHEETS.map((name) => [name, { data: [], quality }]))), { type: 'buffer' });
    const marketer = XLSX.read(xlsx.export(Object.fromEntries(MARKETER_XLSX_SHEETS.map((name) => [name, { data: [], quality }]))), { type: 'buffer' });
    expect(director.SheetNames).toEqual([...DIRECTOR_XLSX_SHEETS]);
    expect(marketer.SheetNames).toEqual([...MARKETER_XLSX_SHEETS]);
  });

  it('retains complete quality metadata on empty XLSX sheets', () => {
    const xlsx = new XlsxExporterService();
    const emptyQuality = {
      ...quality,
      warning: ['No provider sync was found.'],
      missing_fields: ['campaign_id'],
      data_state: 'not_synced' as const,
      empty_reason: 'not_synced' as const,
    };
    for (const sheetName of ['director_empty', 'marketer_empty']) {
      const workbook = XLSX.read(xlsx.export({ [sheetName]: { data: [], quality: emptyQuality } }), { type: 'buffer' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName]);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(expect.objectContaining({
        status: 'empty',
        data_quality_status: 'partial',
        confidence: 'medium',
        warning: 'No provider sync was found.',
        missing_fields: 'campaign_id',
        can_use_for_decision: 'cautious',
        source: 'test',
        source_table_or_service: 'test',
        freshness_at: '2026-06-12T00:00:00.000Z',
        calculation_method: 'test',
        period: 'custom',
        data_state: 'not_synced',
        value_state: 'not_synced',
        empty_reason: 'not_synced',
      }));
      expect(Object.keys(rows[0])).not.toEqual(['status']);
    }
  });

  it('normalizes generated-by metadata to safe strings or null', () => {
    const metadata = new DataPackMetadataService();
    const objectId = new Types.ObjectId();
    const normalized = metadata.create('director', '2026-06-12', 'json', {
      _id: objectId,
      role: 'director',
      fullName: 'director@example.com',
      token: 'must-not-export',
    });
    expect(normalized.generated_by_user_id).toBe(objectId.toHexString());
    expect(normalized.generated_by_role).toBe('director');
    expect(normalized.generated_by_display).toBeNull();
    expect(JSON.stringify(normalized)).not.toMatch(/buffer|must-not-export|director@example\.com/i);

    expect(metadata.create('marketer', '2026-06-12', 'json', 'user-1').generated_by_user_id).toBe('user-1');
    expect(metadata.create('mapping_report', '2026-06-12', 'json', undefined).generated_by_user_id).toBeNull();
    expect(metadata.create('decision_history', '2026-06-12', 'json', { _id: { buffer: Buffer.from('raw') } }).generated_by_user_id).toBeNull();
    expect(metadata.create('data_quality', '2026-06-12', 'json', { _id: 'Bearer secret', role: 'token', name: '0901234567' })).toEqual(expect.objectContaining({
      generated_by_user_id: null,
      generated_by_role: null,
      generated_by_display: null,
    }));
  });

  it('keeps data content checksums deterministic while preserving business timestamps', () => {
    const json = new JsonExporterService();
    const first = json.attachChecksums({
      metadata: { report_date: '2026-06-12', exported_at: '2026-06-13T01:00:00.000Z' },
      data: { amount: 100, calculatedAt: '2026-06-13T01:00:00.000Z', order_created_at: '2026-06-12T01:00:00.000Z', paid_at: '2026-06-12T02:00:00.000Z' },
    });
    const second = json.attachChecksums({
      metadata: { report_date: '2026-06-12', exported_at: '2026-06-13T02:00:00.000Z' },
      data: { amount: 100, calculatedAt: '2026-06-13T02:00:00.000Z', order_created_at: '2026-06-12T01:00:00.000Z', paid_at: '2026-06-12T02:00:00.000Z' },
    });
    const changedValue = json.attachChecksums({
      metadata: { report_date: '2026-06-12', exported_at: '2026-06-13T02:00:00.000Z' },
      data: { amount: 101, calculatedAt: '2026-06-13T02:00:00.000Z', order_created_at: '2026-06-12T01:00:00.000Z', paid_at: '2026-06-12T02:00:00.000Z' },
    });
    const changedBusinessTimestamp = json.attachChecksums({
      metadata: { report_date: '2026-06-12', exported_at: '2026-06-13T02:00:00.000Z' },
      data: { amount: 100, calculatedAt: '2026-06-13T02:00:00.000Z', order_created_at: '2026-06-12T01:00:00.000Z', paid_at: '2026-06-12T03:00:00.000Z' },
    });
    expect(first.metadata.data_content_checksum).toBe(second.metadata.data_content_checksum);
    expect(first.metadata.runtime_export_checksum).not.toBe(second.metadata.runtime_export_checksum);
    expect(first.metadata.data_content_checksum).not.toBe(changedValue.metadata.data_content_checksum);
    expect(first.metadata.data_content_checksum).not.toBe(changedBusinessTimestamp.metadata.data_content_checksum);
  });

  it('builds a Director JSON contract with every required section and rules', async () => {
    const json = new JsonExporterService();
    const metadata = new DataPackMetadataService();
    const finance = { get: jest.fn().mockResolvedValue({ financial_context: {}, financing_context: [], director_manual_inputs: [], cashflow_scenarios: [], alerts: [], quality }) };
    const orders = { get: jest.fn().mockResolvedValue({ business_summary: {}, service_group_performance: [], product_variant_performance: [], unit_economics: [], quality }) };
    const leads = { get: jest.fn().mockResolvedValue({ sales_funnel: [], sales_team: [], quality }) };
    const ads = { get: jest.fn().mockResolvedValue({ metrics: [], quality }) };
    const ltv = { get: jest.fn().mockResolvedValue({ ltv_summary: [], quality }) };
    const operations = { get: jest.fn().mockResolvedValue({ operation_capacity: [], quality }) };
    const dq = { build: jest.fn().mockResolvedValue({ metrics: [], decision_gate: {}, quality }) };
    const mapping = { build: jest.fn().mockResolvedValue({ segments: [], quality }) };
    const history = { build: jest.fn().mockResolvedValue({ decisions: [], quality }) };
    const pack = await new DirectorDataPackService(
      metadata, finance as any, orders as any, leads as any, ads as any, ltv as any,
      operations as any, dq as any, mapping as any, history as any, json,
    ).build('2026-06-12');
    expect(Object.keys(pack.sections)).toEqual([...DIRECTOR_XLSX_SHEETS]);
    expect((pack.sections['02_chatgpt_web_reading_rules'].data as any[])).toHaveLength(12);
    expect(pack.metadata.schema_version).toBe('1.0');
    expect(pack.sections['04_director_manual_inputs'].quality.data_state).toBe('not_configured');
    expect(pack.sections['04_director_manual_inputs'].quality.empty_reason).toBe('not_configured');
    expect(pack.sections['21_decision_options'].quality.data_state).toBe('schema_only');
    expect(() => JSON.parse(json.stableStringify(pack))).not.toThrow();
  });

  it('uses bank balance as canonical cash and excludes proposed/approved loans from cash_available', async () => {
    const collections: Record<string, any[]> = {
      loancontracts: [
        { _id: 'proposed', name: 'Scenario', principal: 500, status: 'draft', disbursementStatus: 'pending', disbursedAmount: 0 },
        { _id: 'approved', name: 'Approved', principal: 800, status: 'active', disbursementStatus: 'pending', disbursedAmount: 0 },
        { _id: 'disbursed', name: 'Actual', principal: 1000, status: 'active', disbursementStatus: 'fully', disbursedAmount: 1000 },
      ],
      system_settings: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const financialControl = {
      getFullMetrics: jest.fn().mockResolvedValue({
        bankBalance: 1200, freeCash: 900, committedCash: 300, survivalFloor: 200,
        adsBudgetApproved: 100, forecast7D: {}, alerts: [], calculatedAt: new Date('2026-06-12T00:00:00Z'),
        dataQuality: { status: 'ok', isDecisionLocked: false, notes: [] },
      }),
    };
    const financeService = {
      getDebtCashflowSummary: jest.fn().mockResolvedValue({ totalDebtDue14d: 0, byLoan: [], alerts: [] }),
    };
    const result = await new FinanceDataQuery(connection as any, financialControl as any, financeService as any).get('2026-06-12');
    expect(result.financial_context.cash_available).toBe(1200);
    expect(result.financial_context.expected_cash_inflow_from_approved_loans).toBe(800);
    expect(result.financing_context.find((row: any) => row.financing_id === 'proposed').status).toBe('proposed');
    expect(result.financing_context.find((row: any) => row.financing_id === 'disbursed').disbursed_amount).toBe(1000);
    expect(result.quality_dimensions.cash_balance_quality.value_state).toBe('realized');
    expect(result.quality_dimensions.cashflow_forecast_quality.value_state).toBe('estimated');
  });

  it('keeps cash quality usable but overall finance cautious when debt schedules are missing', async () => {
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => name === 'loancontracts' ? [] : [] }) }),
    };
    const financialControl = {
      getFullMetrics: jest.fn().mockResolvedValue({
        bankBalance: 0, freeCash: 0, committedCash: 0, survivalFloor: 0,
        forecast7D: null, alerts: [], calculatedAt: new Date('2026-06-12T00:00:00Z'),
        dataQuality: { status: 'ok', isDecisionLocked: false, notes: [] },
      }),
    };
    const financeService = { getDebtCashflowSummary: jest.fn().mockResolvedValue(null) };
    const result = await new FinanceDataQuery(connection as any, financialControl as any, financeService as any).get('2026-06-12');
    expect(result.quality_dimensions.cash_balance_quality).toEqual(expect.objectContaining({ status: 'ok', can_use_for_decision: 'yes', value_state: 'zero_value' }));
    expect(result.quality_dimensions.debt_schedule_quality).toEqual(expect.objectContaining({ status: 'partial', can_use_for_decision: 'cautious', value_state: 'missing' }));
    expect(result.quality_dimensions.loan_disbursement_quality.value_state).toBe('not_applicable');
    expect(result.quality_dimensions.overall_financial_context_quality).toEqual(expect.objectContaining({ status: 'partial', can_use_for_decision: 'cautious' }));
  });

  it('propagates overdue repayment warnings into cautious finance quality', async () => {
    const connection = {
      collection: () => ({ find: () => ({ toArray: async () => [] }) }),
    };
    const financialControl = {
      getFullMetrics: jest.fn().mockResolvedValue({
        bankBalance: 100, forecast7D: {}, alerts: [], calculatedAt: new Date('2026-06-12T00:00:00Z'),
        dataQuality: { status: 'ok', isDecisionLocked: false, notes: [] },
      }),
    };
    const financeService = { getDebtCashflowSummary: jest.fn().mockResolvedValue({ totalDebtDue14d: 10, byLoan: [], alerts: ['Overdue repayment detected.'] }) };
    const result = await new FinanceDataQuery(connection as any, financialControl as any, financeService as any).get('2026-06-12');
    expect(result.quality_dimensions.debt_schedule_quality.status).toBe('weak');
    expect(result.quality_dimensions.overall_financial_context_quality.can_use_for_decision).toBe('cautious');
    expect(result.quality.warning).toContain('Overdue repayment detected.');
  });

  it('distinguishes no-record, estimated and realized order profit states', async () => {
    const emptyConnection = {
      collection: () => ({ find: () => ({ toArray: async () => [] }) }),
    };
    const empty = await new OrderProfitQuery(emptyConnection as any).get('2026-06-12');
    expect(empty.quality.data_state).toBe('no_records_for_report_date');
    expect(empty.business_summary).toEqual(expect.objectContaining({
      orders: 0,
      estimated_net_profit_value_state: 'no_records_for_report_date',
      realized_net_profit_value_state: 'no_records_for_report_date',
    }));

    const rows: Record<string, any[]> = {
      ordertest2: [{ _id: 'o1', productId: 'p1', netProfit: 30, realizedNetProfit: 20, grossProfit: 40, orderDate: new Date('2026-06-12T01:00:00Z') }],
      products: [{ _id: 'p1', name: 'P1' }],
      productcategories: [],
    };
    const populatedConnection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => rows[name] || [] }) }),
    };
    const populated = await new OrderProfitQuery(populatedConnection as any).get('2026-06-12');
    expect(populated.business_summary.estimated_net_profit_value_state).toBe('estimated');
    expect(populated.business_summary.realized_net_profit_value_state).toBe('realized');
  });

  it('marks ads without a sync timestamp as not_synced', async () => {
    const connection = {
      collection: () => ({ find: () => ({ toArray: async () => [] }) }),
    };
    const ads = await new AdsPerformanceQuery(connection as any).get('2026-06-12');
    expect(ads.quality.freshness_at).toBeNull();
    expect(ads.quality.data_state).toBe('not_synced');
    expect(ads.quality.empty_reason).toBe('not_synced');
  });

  it('surfaces operational demo risk findings for Director review', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [{ productionStatus: 'pending', orderStatus: 'open', updatedAt: new Date('2026-06-12T00:00:00Z') }],
      agentstatements: [{
        agentId: 'agent-1',
        status: 'open',
        periodCollected: 9_000_000,
        closingBalance: 1_500_000,
        notes: 'DEMO_AIDP28 late_payment_agent',
        updatedAt: new Date('2026-06-12T00:00:00Z'),
      }],
      returnrequests: [{
        orderId: 'order-1',
        status: 'pending',
        reason: 'DEMO_AIDP28 high_return_product',
        updatedAt: new Date('2026-06-12T00:00:00Z'),
      }],
      inventorytransactions: [{
        productId: 'product-1',
        type: 'receive',
        purchaseOrderId: 'missing-po',
        notes: 'DEMO_AIDP28 inventory_movement_without_matching_purchase_order',
        updatedAt: new Date('2026-06-12T00:00:00Z'),
      }],
      purchaseorders: [{ _id: 'existing-po' }],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    const exported = JSON.stringify(result.operation_capacity);
    expect(exported).toContain('high_sales_late_payment_agent');
    expect(exported).toContain('return_rate_above_policy_for_single_offer');
    expect(exported).toContain('inventory_movement_without_matching_purchase_order');
  });

  it('keeps hardened operational risk findings read-only on the evidence schema contract', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [
        { _id: 'order-low-1', productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-01T00:00:00Z'), isActive: true },
        { _id: 'order-low-2', productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-02T00:00:00Z'), isActive: true },
        { _id: 'order-prior-1', productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-03T00:00:00Z'), codAmount: 1_000, isActive: true },
        { _id: 'order-low-4', productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-04T00:00:00Z'), isActive: true },
        { _id: 'order-low-5', productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-05T00:00:00Z'), isActive: true },
        { _id: 'order-current-1', productId: 'product-1', quantity: 1, depositAmount: 0, codAmount: 600, manualPayment: 0, productionStatus: 'done', orderStatus: 'delivered', orderDate: new Date('2026-06-10T00:00:00Z'), isActive: true },
        { _id: 'order-current-2', productId: 'product-1', quantity: 2, depositAmount: 0, codAmount: 500, manualPayment: 0, productionStatus: 'done', orderStatus: 'delivered', orderDate: new Date('2026-06-11T00:00:00Z'), isActive: true },
        {
          _id: 'order-overdue-1',
          productId: 'product-2',
          agentId: 'agent-1',
          agentPaymentStatus: 'pending',
          agentPaymentDueDate: new Date('2026-06-01T00:00:00Z'),
          agentPaidAmount: 1_000_000,
          agentCommissionFinal: 1_200_000,
          orderDate: new Date('2026-05-10T00:00:00Z'),
          orderStatus: 'delivered',
          isActive: true,
        },
      ],
      products: [
        {
          _id: 'product-1',
          name: 'Hardened Evidence Product',
          sku: 'HE-001',
          minStock: 10,
          importPrice: 118,
          estimatedDeliveryDays: 3,
          suppliers: [{ supplierId: 'supplier-1', appliedPrice: 120, appliedAt: new Date('2026-06-10T00:00:00Z') }],
          updatedAt: new Date('2026-06-10T00:00:00Z'),
        },
        { _id: 'product-2', name: 'Receivable Product', sku: 'REC-001', minStock: 5 },
      ],
      inventorysummaries: [
        { productId: 'product-1', onHand: 6, avgCost: 119, updatedAt: new Date('2026-06-12T00:00:00Z') },
      ],
      purchaseorders: [
        {
          _id: 'po-slow-1',
          poNumber: 'PO-SLOW-1',
          supplierId: 'supplier-1',
          supplierNameSnap: 'Supplier One',
          status: 'received',
          expectedDeliveryDate: new Date('2026-06-07T00:00:00Z'),
          receivedDate: new Date('2026-06-10T00:00:00Z'),
          createdAt: new Date('2026-06-01T00:00:00Z'),
          items: [{ productId: 'product-1', quantity: 5, unitPrice: 120, quantityReceived: 5 }],
        },
      ],
      supplierquotes: [
        { _id: 'sq-current', productId: 'product-1', supplierId: 'supplier-1', price: 120, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-06-10T00:00:00Z') },
        { _id: 'sq-prior', productId: 'product-1', supplierId: 'supplier-1', price: 100, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-05-10T00:00:00Z') },
        { _id: 'sq-peer', productId: 'product-1', supplierId: 'supplier-peer', price: 160, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-06-10T00:00:00Z') },
      ],
      quotes: [
        { _id: 'dq-current', productId: 'product-1', agentId: 'dealer-1', unitPrice: 150, status: 'approved', validFrom: new Date('2026-05-20T00:00:00Z'), isActive: true },
      ],
      laborcost1: [
        { _id: 'labor-current-1', userId: 'employee-1', date: new Date('2026-06-10T00:00:00Z'), workHours: 10, cost: 1_000, sessionCount: 1 },
        { _id: 'labor-current-2', userId: 'employee-1', date: new Date('2026-06-11T00:00:00Z'), workHours: 10, cost: 1_000, sessionCount: 1 },
        { _id: 'labor-prior-1', userId: 'employee-1', date: new Date('2026-06-03T00:00:00Z'), workHours: 9, cost: 900, sessionCount: 1 },
      ],
      laborstatements: [
        { _id: 'statement-current', employeeId: 'employee-1', periodFrom: new Date('2026-06-08T00:00:00Z'), periodTo: new Date('2026-06-14T00:00:00Z'), periodCost: 2_000, totalWorkHours: 20, sessionCount: 2 },
        { _id: 'statement-prior', employeeId: 'employee-1', periodFrom: new Date('2026-06-01T00:00:00Z'), periodTo: new Date('2026-06-07T00:00:00Z'), periodCost: 900, totalWorkHours: 9, sessionCount: 1 },
      ],
      agentstatements: [{
        _id: 'agent-statement-1',
        agentId: 'agent-1',
        status: 'open',
        periodFrom: new Date('2026-05-01T00:00:00Z'),
        periodTo: new Date('2026-05-31T00:00:00Z'),
        closingBalance: 1_000_000,
        payments: [{ amount: 200_000, paidAt: new Date('2026-06-05T00:00:00Z'), createdBy: 'collector-1' }],
      }],
      users: [
        { _id: 'agent-1', fullName: 'Dealer One', role: 'external_agent', managerId: 'collector-1', isActive: true },
        { _id: 'employee-1', fullName: 'Operator One', role: 'employee', isActive: true },
        { _id: 'supplier-1', fullName: 'Supplier One', role: 'supplier', isActive: true },
      ],
      returnrequests: [],
      inventorytransactions: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    const targetedRows = result.operational_risk_findings.filter((row: any) =>
      hardenedOperationalRiskFindings.includes(row.finding_key),
    );
    const emittedFindingKeys = result.operational_risk_findings.map((row: any) => row.finding_key);

    expect(targetedRows.map((row: any) => row.finding_key)).toEqual(expect.arrayContaining(hardenedOperationalRiskFindings));
    for (const alias of nonCanonicalOperationalRiskFindingAliases) {
      expect(emittedFindingKeys).not.toContain(alias);
    }
    for (const findingKey of hardenedOperationalRiskFindings) {
      const row = targetedRows.find((item: any) => item.finding_key === findingKey);
      expect(row).toBeDefined();
      expect(row?.finding_key).toBe(findingKey);
      expect(String(row?.threshold_source_key)).toContain(requiredThresholdKeyByFinding[findingKey]);
    }
    for (const row of targetedRows) {
      const typedRow = row as Record<string, unknown>;
      const findingSpecificFieldGroups = operationalRiskFindingSpecificFieldGroups[row.finding_key] || [];

      for (const fieldName of operationalRiskCanonicalEvidenceFields) {
        expect(row).toHaveProperty(fieldName);
        expect(hasOperationalRiskEvidenceValue(row[fieldName])).toBe(true);
      }
      for (const fieldName of operationalRiskThresholdMetadataFields) {
        expect(row).toHaveProperty(fieldName);
        expect(hasOperationalRiskEvidenceValue(row[fieldName])).toBe(true);
      }
      for (const fieldName of operationalRiskSourceFreshnessValueFields) {
        expect(row).toHaveProperty(fieldName);
        expect(hasOperationalRiskEvidenceValue(row[fieldName])).toBe(true);
      }
      for (const fieldName of operationalRiskSourceFreshnessNullableFields) {
        expect(row).toHaveProperty(fieldName);
      }
      for (const fieldName of operationalRiskEvidenceDetailFields) {
        expect(row).toHaveProperty(fieldName);
        expect(hasOperationalRiskEvidenceValue(row[fieldName])).toBe(true);
      }
      for (const fieldName of operationalRiskSeverityFields) {
        expect(row).toHaveProperty(fieldName);
        expect(hasOperationalRiskEvidenceValue(row[fieldName])).toBe(true);
      }
      expect(allowedSourceFreshnessStatuses.has(row.source_freshness_status)).toBe(true);
      expect(row.source_is_derived_candidate).toBe(true);
      expect(row.source_lineage_modules).toEqual(expect.arrayContaining(['OperationsCapacityQuery', 'threshold-registry']));
      expect(row.source_lineage_collections).toEqual(expect.arrayContaining(expectedSourceLineageCollectionsByFinding[row.finding_key]));
      expect((row.source_lineage_fields as unknown[]).length).toBeGreaterThan(0);
      expect(String(row.threshold_source_key)).toContain(requiredThresholdKeyByFinding[row.finding_key]);
      expect(String(row.threshold_source_approval_status)).toContain('approved');
      expect(row.threshold_source_default_used).toBe(false);
      expect(allowedOperationalRiskDataQualityStatuses.has(row.data_quality_status)).toBe(true);
      expect(allowedOperationalRiskConfidenceValues.has(row.confidence)).toBe(true);
      expect(allowedOperationalRiskSeverityLabels.has(row.severity_label)).toBe(true);
      expect(typeof row.severity_score).toBe('number');
      expect(row.severity_score).toBeGreaterThanOrEqual(0);
      expect(row.severity_score).toBeLessThanOrEqual(100);
      expect(Array.isArray(row.evidence_rows)).toBe(true);
      expect(row.evidence_rows.length).toBeGreaterThan(0);
      expect(row.evidence_row_count).toBeGreaterThanOrEqual(row.evidence_rows.length);
      expect(row.evidence_sample_limit).toBeGreaterThanOrEqual(row.evidence_rows.length);
      for (const evidenceRow of row.evidence_rows as Record<string, unknown>[]) {
        for (const fieldName of operationalRiskEvidenceRowFields) {
          expect(evidenceRow).toHaveProperty(fieldName);
          if (fieldName !== 'entity_name_or_alias' && fieldName !== 'timestamp') {
            expect(hasOperationalRiskEvidenceValue(evidenceRow[fieldName])).toBe(true);
          }
        }
        expect(String(evidenceRow.drilldown_ref)).toContain(String(evidenceRow.source_collection));
        expect(String(evidenceRow.threshold_source_key)).toContain(requiredThresholdKeyByFinding[row.finding_key]);
      }
      expect(row.evidence_threshold_comparison).toEqual(expect.objectContaining({
        threshold_source_key: row.threshold_source_key,
      }));
      expect(row.evidence_source_freshness).toEqual(expect.objectContaining({
        source_freshness_status: row.source_freshness_status,
      }));
      expect(row.evidence_drilldown_refs_summary).toEqual(expect.any(String));
      expect(row.top_evidence_entities).toEqual(expect.any(String));
      if (row.data_quality_status !== 'ok' || row.evidence_strength === 'weak') {
        expect(hasAnyOperationalRiskEvidenceField(typedRow, operationalRiskDowngradeContextFields)).toBe(true);
      }
      for (const fieldGroup of findingSpecificFieldGroups) {
        expect(hasAnyOperationalRiskEvidenceField(typedRow, fieldGroup)).toBe(true);
      }
      expect(collectBannedOperationalRiskEvidenceKeys(row)).toEqual([]);
      expect(row.not_allowed_actions).toEqual(expect.any(String));
      expect(row.not_allowed_actions).toContain('do_not_');
    }

    const json = new JsonExporterService();
    const metadata = new DataPackMetadataService();
    const finance = { get: jest.fn().mockResolvedValue({ financial_context: {}, financing_context: [], director_manual_inputs: [], cashflow_scenarios: [], alerts: [], quality }) };
    const orders = { get: jest.fn().mockResolvedValue({ business_summary: {}, service_group_performance: [], product_variant_performance: [], unit_economics: [], quality }) };
    const leads = { get: jest.fn().mockResolvedValue({ sales_funnel: [], sales_team: [], quality }) };
    const ads = { get: jest.fn().mockResolvedValue({ metrics: [], quality }) };
    const ltv = { get: jest.fn().mockResolvedValue({ ltv_summary: [], quality }) };
    const operations = { get: jest.fn().mockResolvedValue(result) };
    const dq = { build: jest.fn().mockResolvedValue({ metrics: [], decision_gate: {}, quality }) };
    const mapping = { build: jest.fn().mockResolvedValue({ segments: [], quality }) };
    const history = { build: jest.fn().mockResolvedValue({ decisions: [], quality }) };
    const pack = await new DirectorDataPackService(
      metadata, finance as any, orders as any, leads as any, ads as any, ltv as any,
      operations as any, dq as any, mapping as any, history as any, json,
    ).build('2026-06-14');
    const sectionPathRows = (pack.sections['16_operation_capacity'].data as any)
      .operation_capacity
      .operational_risk_findings;
    const sectionTargetedRows = sectionPathRows.filter((row: any) =>
      hardenedOperationalRiskFindings.includes(row.finding_key),
    );

    expect(sectionTargetedRows.map((row: any) => row.finding_key)).toEqual(expect.arrayContaining(hardenedOperationalRiskFindings));
    expect(sectionTargetedRows).toHaveLength(targetedRows.length);
    for (const findingKey of hardenedOperationalRiskFindings) {
      const affectedIdentities = sectionTargetedRows
        .filter((row: any) => row.finding_key === findingKey)
        .map((row: any) => `${row.affected_entity_type}:${row.affected_entity_id}`);
      expect(affectedIdentities.length).toBeGreaterThan(0);
      expect(new Set(affectedIdentities).size).toBe(affectedIdentities.length);
    }

    const xlsx = new XlsxExporterService();
    const workbook = XLSX.read(xlsx.export({ '16_operation_capacity': pack.sections['16_operation_capacity'] }), { type: 'buffer' });
    const xlsxRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets['16_operation_capacity'],
      { defval: '' } as any,
    );
    expect(xlsxRows).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(xlsxRows[0], 'operation_capacity.operational_risk_findings')).toBe(true);
    expect(xlsxRows[0]['operation_capacity.operational_risk_findings.row_count']).toBeGreaterThanOrEqual(hardenedOperationalRiskFindings.length);
    const xlsxFindingKeys = String(xlsxRows[0]['operation_capacity.operational_risk_findings.finding_keys'] || '');
    for (const findingKey of hardenedOperationalRiskFindings) {
      expect(xlsxFindingKeys).toContain(findingKey);
    }
  });

  it('surfaces low-inventory bestseller rows as read-only Director evidence', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [
        { productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-01T00:00:00Z') },
        { productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-02T00:00:00Z') },
        { productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-03T00:00:00Z') },
        { productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-04T00:00:00Z') },
        { productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-05T00:00:00Z') },
        { productId: 'product-2', quantity: 2, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-05T00:00:00Z') },
      ],
      products: [
        { _id: 'product-1', name: 'Best Seller', sku: 'BS-001', minStock: 10 },
        { _id: 'product-2', name: 'Slow Seller', sku: 'SS-001', minStock: 5 },
      ],
      inventorysummaries: [
        { productId: 'product-1', onHand: 6, updatedAt: new Date('2026-06-06T00:00:00Z') },
        { productId: 'product-2', onHand: 100, updatedAt: new Date('2026-06-06T00:00:00Z') },
      ],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    const evidence = result.operational_risk_findings.find((row: any) =>
      row.finding_key === 'low_inventory_best_seller' && row.affected_entity_id === 'product-1',
    );
    expect(evidence).toEqual(expect.objectContaining({
      finding_label: 'best_selling_product_low_inventory',
      source_collections_or_modules: 'inventorysummaries, products, ordertest2, purchaseorders, deliverystatuses',
      affected_entity_id: 'product-1',
      sku: 'BS-001',
      bestseller_rank: 1,
      current_inventory_quantity: 6,
      reserved_quantity_candidate: 0,
      available_quantity: 6,
      available_quantity_formula: 'max(0, inventorysummaries.onHand - reserved_quantity_candidate)',
      reorder_threshold: 10,
      incoming_stock_quantity_candidate: 0,
      projected_available_quantity: 6,
      projected_days_of_cover: 0.6,
      recent_order_count: 5,
      recent_order_quantity: 50,
      sales_velocity_per_day: 10,
      days_of_cover: 0.6,
      metric_name: 'days_of_cover',
      data_quality_status: 'partial',
      confidence: 'medium',
      capacity_remaining: null,
    }));
    const exported = JSON.stringify(result.operation_capacity);
    expect(exported).toContain('reserved_quantity');
    expect(exported).toContain('incoming_stock_quantity');
    expect(exported).toContain('do_not_create_purchase_order');
    expect(exported).toContain('do_not_mutate_inventory');
  });

  it('upgrades low-inventory bestseller evidence with reserved and incoming read-only candidates', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [
        { productId: 'product-1', quantity: 2, productionStatus: 'done', orderStatus: 'delivered', orderDate: new Date('2026-06-01T00:00:00Z') },
        { productId: 'product-1', quantity: 2, productionStatus: 'done', orderStatus: 'delivered', orderDate: new Date('2026-06-02T00:00:00Z') },
        { productId: 'product-1', quantity: 2, productionStatus: 'pending', orderStatus: 'awaiting_tracking', orderDate: new Date('2026-06-03T00:00:00Z') },
        { productId: 'product-1', quantity: 2, productionStatus: 'pending', orderStatus: 'shipping', orderDate: new Date('2026-06-04T00:00:00Z') },
        { productId: 'product-1', quantity: 2, productionStatus: 'pending', orderStatus: 'manual_hold', orderDate: new Date('2026-06-05T00:00:00Z') },
        { productId: 'product-1', quantity: 2, productionStatus: 'done', orderStatus: 'returned', orderDate: new Date('2026-06-05T00:00:00Z') },
        { productId: 'product-1', quantity: 7, isActive: false, productionStatus: 'pending', orderStatus: 'shipping', orderDate: new Date('2026-06-05T00:00:00Z') },
        { productId: 'product-2', quantity: 20, productionStatus: 'done', orderStatus: 'delivered', orderDate: new Date('2026-06-05T00:00:00Z') },
      ],
      deliverystatuses: [
        { name: 'awaiting_tracking', isActive: true, isFinal: false, isPaymentTrigger: false, isReturnStatus: false },
        { name: 'shipping', isActive: true, isFinal: false, isPaymentTrigger: false, isReturnStatus: false },
        { name: 'delivered', isActive: true, isFinal: true, isPaymentTrigger: true, isReturnStatus: false },
        { name: 'returned', isActive: true, isFinal: true, isPaymentTrigger: true, isReturnStatus: true },
      ],
      products: [
        { _id: 'product-1', name: 'Best Seller', sku: 'BS-001', minStock: 10 },
        { _id: 'product-2', name: 'Slow Seller', sku: 'SS-001', minStock: 5 },
      ],
      inventorysummaries: [
        { productId: 'product-1', onHand: 12, updatedAt: new Date('2026-06-06T00:00:00Z') },
        { productId: 'product-2', onHand: 100, updatedAt: new Date('2026-06-06T00:00:00Z') },
      ],
      purchaseorders: [
        {
          _id: 'po-ordered',
          status: 'ordered',
          expectedDeliveryDate: new Date('2026-06-10T00:00:00Z'),
          items: [{ productId: 'product-1', quantity: 10, quantityReceived: 3 }],
        },
        {
          _id: 'po-partial',
          status: 'partially_received',
          expectedDeliveryDate: new Date('2026-06-11T00:00:00Z'),
          items: [{ productId: 'product-1', quantity: 6, quantityReceived: 1 }],
        },
        {
          _id: 'po-draft',
          status: 'draft',
          items: [{ productId: 'product-1', quantity: 50, quantityReceived: 0 }],
        },
        {
          _id: 'po-cancelled',
          status: 'cancelled',
          items: [{ productId: 'product-1', quantity: 50, quantityReceived: 0 }],
        },
        {
          _id: 'po-received',
          status: 'received',
          items: [{ productId: 'product-1', quantity: 50, quantityReceived: 50 }],
        },
        {
          _id: 'po-zero-remaining',
          status: 'ordered',
          items: [{ productId: 'product-1', quantity: 5, quantityReceived: 5 }],
        },
        {
          _id: 'po-other-product',
          status: 'ordered',
          items: [{ productId: 'product-2', quantity: 50, quantityReceived: 0 }],
        },
      ],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    const evidence = result.operational_risk_findings.find((row: any) =>
      row.finding_key === 'low_inventory_best_seller' && row.affected_entity_id === 'product-1',
    );

    expect(evidence).toEqual(expect.objectContaining({
      affected_entity_id: 'product-1',
      current_inventory_quantity: 12,
      reserved_quantity: 4,
      reserved_quantity_candidate: 4,
      reserved_quantity_source: 'order_status_derived_candidate_using_delivery_status_metadata',
      reserved_order_count: 2,
      incoming_stock_quantity: 12,
      incoming_stock_quantity_candidate: 12,
      incoming_stock_source: 'purchase_order_unreceived_quantity_candidate',
      incoming_purchase_order_count: 2,
      available_quantity: 8,
      available_quantity_formula: 'max(0, inventorysummaries.onHand - reserved_quantity_candidate)',
      projected_available_quantity: 20,
      projected_available_quantity_formula: 'max(0, inventorysummaries.onHand - reserved_quantity_candidate + incoming_stock_quantity_candidate)',
      sales_velocity_per_day: 2.4,
      days_of_cover: 3.33,
      projected_days_of_cover: 8.33,
      data_quality_status: 'partial',
      confidence: 'medium',
      evidence_note: 'low_inventory_best_seller_reserved_incoming_readonly',
      capacity_remaining: null,
    }));
    expect(evidence.reserved_statuses_included).toEqual(expect.arrayContaining(['awaiting_tracking', 'shipping']));
    expect(evidence.reserved_statuses_excluded_or_ambiguous).toEqual(expect.arrayContaining(['delivered', 'returned', 'manual_hold', 'inactive_order']));
    expect(evidence.incoming_statuses_included).toEqual(expect.arrayContaining(['ordered', 'partially_received']));
    expect(evidence.incoming_statuses_excluded_or_ambiguous).toEqual(expect.arrayContaining([
      'draft',
      'cancelled',
      'received',
      'non_positive_remaining_purchase_order_quantity',
    ]));
    expect(evidence.incoming_expected_delivery_dates).toEqual(['2026-06-10', '2026-06-11']);
    expect(evidence.inventory_semantics_data_quality_notes.join(' ')).toContain('inventorybatches.quantityRemaining is not counted as incoming stock');
    expect(evidence.not_allowed_actions).toContain('do_not_create_purchase_order');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_inventory');
  });

  it('does not create low-inventory bestseller evidence when sales velocity is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [
        { productId: 'product-1', quantity: 10, productionStatus: 'done', orderStatus: 'closed' },
      ],
      products: [
        { _id: 'product-1', name: 'Best Seller', sku: 'BS-001', minStock: 10 },
      ],
      inventorysummaries: [
        { productId: 'product-1', onHand: 2, updatedAt: new Date('2026-06-06T00:00:00Z') },
      ],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'low_inventory_best_seller')).toBe(false);
  });

  it('surfaces supplier cost increase rows as read-only Director evidence', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [
        { productId: 'product-1', quantity: 1, productionStatus: 'done', orderStatus: 'closed', orderDate: new Date('2026-06-10T00:00:00Z') },
      ],
      products: [{
        _id: 'product-1',
        name: 'Margin Pressure Product',
        sku: 'MP-001',
        importPrice: 118,
        suppliers: [{ supplierId: 'supplier-1', appliedPrice: 120, appliedAt: new Date('2026-06-10T00:00:00Z') }],
        updatedAt: new Date('2026-06-10T00:00:00Z'),
      }],
      supplierquotes: [
        { _id: 'sq-current', productId: 'product-1', supplierId: 'supplier-1', price: 120, effectiveAt: new Date('2026-06-10T00:00:00Z') },
        { _id: 'sq-prior', productId: 'product-1', supplierId: 'supplier-1', price: 100, effectiveAt: new Date('2026-05-10T00:00:00Z') },
      ],
      quotes: [
        { _id: 'dq-current', productId: 'product-1', agentId: 'dealer-1', unitPrice: 150, status: 'approved', validFrom: new Date('2026-05-20T00:00:00Z'), isActive: true },
        { _id: 'dq-prior', productId: 'product-1', agentId: 'dealer-1', unitPrice: 140, status: 'approved', validFrom: new Date('2026-04-01T00:00:00Z'), isActive: true },
      ],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    const evidence = result.operational_risk_findings.find((row: any) =>
      row.finding_key === 'supplier_cost_up' && row.affected_entity_id === 'product-1::supplier-1',
    );

    expect(evidence).toEqual(expect.objectContaining({
      finding_label: 'supplier_cost_up_15_percent_without_matching_dealer_price_update',
      source_collections_or_modules: 'supplierquotes, products, quotes',
      affected_entity_type: 'product_supplier_pair',
      affected_entity_id: 'product-1::supplier-1',
      sku: 'MP-001',
      current_supplier_cost_or_quote: 120,
      prior_supplier_cost_or_quote: 100,
      supplier_quote_effective_date: '2026-06-10',
      prior_supplier_quote_effective_date: '2026-05-10',
      product_cost_or_import_price_current: 120,
      product_cost_effective_date: '2026-06-10',
      product_cost_source: 'products.suppliers.appliedPrice',
      dealer_price_current_or_latest: 150,
      dealer_price_prior_or_effective: 140,
      dealer_price_effective_date: '2026-05-20',
      dealer_price_history_status: 'older_than_supplier_cost_increase',
      dealer_price_update_lag_days: 21,
      cost_increase_percent: 20,
      metric_name: 'cost_increase_percent',
      data_quality_status: 'partial',
      confidence: 'medium',
      evidence_note: 'supplier_cost_up_readonly',
      capacity_remaining: null,
    }));
    expect(evidence.not_allowed_actions).toContain('do_not_change_prices');
    expect(evidence.not_allowed_actions).toContain('do_not_create_supplier_actions');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_dealer_prices');
    expect(evidence.not_allowed_actions).toContain('do_not_execute_ads_actions');
  });

  it('does not create supplier cost increase evidence when prior supplier cost is absent', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [{ _id: 'product-1', name: 'Single Quote Product', sku: 'SQ-001', updatedAt: new Date('2026-06-10T00:00:00Z') }],
      supplierquotes: [
        { _id: 'sq-current', productId: 'product-1', supplierId: 'supplier-1', price: 130, effectiveAt: new Date('2026-06-10T00:00:00Z') },
      ],
      quotes: [
        { _id: 'dq-current', productId: 'product-1', agentId: 'dealer-1', unitPrice: 150, status: 'approved', validFrom: new Date('2026-05-20T00:00:00Z'), isActive: true },
      ],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'supplier_cost_up')).toBe(false);
  });

  it('downgrades supplier cost increase evidence when dealer price history is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [{
        _id: 'product-1',
        name: 'Missing Dealer Price Product',
        sku: 'MDP-001',
        importPrice: 130,
        updatedAt: new Date('2026-06-10T00:00:00Z'),
      }],
      supplierquotes: [
        { _id: 'sq-current', productId: 'product-1', supplierId: 'supplier-1', price: 130, effectiveAt: new Date('2026-06-10T00:00:00Z') },
        { _id: 'sq-prior', productId: 'product-1', supplierId: 'supplier-1', price: 100, effectiveAt: new Date('2026-05-10T00:00:00Z') },
      ],
      quotes: [],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get();
    const evidence = result.operational_risk_findings.find((row: any) => row.finding_key === 'supplier_cost_up');

    expect(evidence).toEqual(expect.objectContaining({
      affected_entity_id: 'product-1::supplier-1',
      cost_increase_percent: 30,
      dealer_price_current_or_latest: null,
      dealer_price_effective_date: null,
      dealer_price_history_status: 'missing',
      dealer_price_update_lag_days: null,
      dealer_price_quote_count: 0,
      data_quality_status: 'partial',
      confidence: 'low',
      evidence_strength: 'weak',
    }));
    expect(evidence.missing_or_weak_fields).toEqual(expect.arrayContaining([
      'supplier_quote_approval_status',
      'dealer_price_history',
      'dealer_price_effective_date',
    ]));
  });

  it('surfaces slow supplier good cost rows as read-only Director evidence', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [{
        _id: 'product-1',
        name: 'Cost Friendly Slow Item',
        sku: 'SLOW-001',
        estimatedDeliveryDays: 3,
        suppliers: [{ supplierId: 'supplier-slow', appliedPrice: 90 }],
        updatedAt: new Date('2026-06-12T00:00:00Z'),
      }],
      supplierquotes: [
        { _id: 'sq-current', productId: 'product-1', supplierId: 'supplier-slow', price: 90, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-06-01T00:00:00Z') },
        { _id: 'sq-prior', productId: 'product-1', supplierId: 'supplier-slow', price: 88, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-05-01T00:00:00Z') },
        { _id: 'sq-peer-1', productId: 'product-1', supplierId: 'supplier-fast-1', price: 110, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-06-01T00:00:00Z') },
        { _id: 'sq-peer-2', productId: 'product-1', supplierId: 'supplier-fast-2', price: 120, currency: 'VND', status: 'approved', effectiveAt: new Date('2026-06-01T00:00:00Z') },
      ],
      purchaseorders: [
        {
          _id: 'po-current-1',
          poNumber: 'PO-CURRENT-1',
          supplierId: 'supplier-slow',
          supplierNameSnap: 'Slow Cost Supplier',
          status: 'received',
          expectedDeliveryDate: new Date('2026-06-07T00:00:00Z'),
          receivedDate: new Date('2026-06-10T00:00:00Z'),
          createdAt: new Date('2026-06-01T00:00:00Z'),
          items: [{ productId: 'product-1', quantity: 5, unitPrice: 90, quantityReceived: 5 }],
        },
        {
          _id: 'po-current-2',
          poNumber: 'PO-CURRENT-2',
          supplierId: 'supplier-slow',
          supplierNameSnap: 'Slow Cost Supplier',
          status: 'received',
          expectedDeliveryDate: new Date('2026-06-09T00:00:00Z'),
          receivedDate: new Date('2026-06-12T00:00:00Z'),
          createdAt: new Date('2026-06-04T00:00:00Z'),
          items: [{ productId: 'product-1', quantity: 4, unitPrice: 90, quantityReceived: 4 }],
        },
        {
          _id: 'po-prior-1',
          poNumber: 'PO-PRIOR-1',
          supplierId: 'supplier-slow',
          supplierNameSnap: 'Slow Cost Supplier',
          status: 'received',
          expectedDeliveryDate: new Date('2026-05-10T00:00:00Z'),
          receivedDate: new Date('2026-05-10T00:00:00Z'),
          createdAt: new Date('2026-05-05T00:00:00Z'),
          items: [{ productId: 'product-1', quantity: 3, unitPrice: 88, quantityReceived: 3 }],
        },
      ],
      inventorysummaries: [{ productId: 'product-1', onHand: 12, avgCost: 91, updatedAt: new Date('2026-06-12T00:00:00Z') }],
      users: [{ _id: 'supplier-slow', fullName: 'Slow Cost Supplier', role: 'supplier' }],
      quotes: [],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    const evidence = result.operational_risk_findings.find((row: any) => row.finding_key === 'slow_supplier_good_cost');

    expect(evidence).toEqual(expect.objectContaining({
      finding_label: 'supplier_has_good_cost_but_slow_reliability',
      source_collections_or_modules: 'supplierquotes, purchaseorders, products, inventorysummaries, users',
      affected_entity_type: 'product_supplier_pair',
      affected_entity_id: 'product-1::supplier-slow',
      supplier_id: 'supplier-slow',
      supplier_alias: 'Slow Cost Supplier',
      good_or_product_id: 'product-1',
      good_or_product_alias: 'Cost Friendly Slow Item',
      sku_or_variant_if_available: 'SLOW-001',
      current_supplier_cost: 90,
      prior_supplier_cost: 88,
      supplier_cost_growth_percent: 2.27,
      supplier_cost_advantage_percent: 21.74,
      peer_supplier_median_cost: 115,
      peer_supplier_quote_count: 2,
      currency: 'VND',
      current_lead_time_days_if_available: 8.5,
      prior_lead_time_days_if_available: 5,
      lead_time_growth_percent_if_available: 70,
      current_delay_days_if_available: 3,
      prior_delay_days_if_available: 0,
      fulfilled_purchase_order_count: 2,
      delayed_purchase_order_count: 2,
      current_quantity_received: 9,
      current_purchase_cost: 810,
      current_average_purchase_unit_cost: 90,
      stock_on_hand_if_available: 12,
      inventory_avg_cost_if_available: 91,
      incoming_quantity_if_available: 0,
      metric_name: 'cost_advantage_with_delivery_delay',
      metric_value: 21.74,
      sample_size: 2,
      data_quality_status: 'partial',
      confidence: 'medium',
      evidence_strength: 'medium',
      evidence_note: 'slow_supplier_good_cost_readonly',
      capacity_remaining: null,
    }));
    expect(evidence.purchase_order_ids_sample).toEqual(['po-current-1', 'po-current-2']);
    expect(evidence.not_allowed_actions).toContain('do_not_create_purchase_order');
    expect(evidence.not_allowed_actions).toContain('do_not_change_supplier_order');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_inventory');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_supplier_cost');
    expect(evidence.not_allowed_actions).toContain('do_not_execute_ads_actions');
    expect(JSON.stringify(evidence)).not.toMatch(/action_id|provider_operation|execute_live|dry_run/i);
  });

  it('does not create slow supplier good cost evidence when product mapping is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [],
      supplierquotes: [
        { productId: 'missing-product', supplierId: 'supplier-slow', price: 90, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
        { productId: 'missing-product', supplierId: 'supplier-fast', price: 120, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
      ],
      purchaseorders: [{
        supplierId: 'supplier-slow',
        status: 'received',
        expectedDeliveryDate: new Date('2026-06-07T00:00:00Z'),
        receivedDate: new Date('2026-06-10T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        items: [{ productId: 'missing-product', quantity: 5, unitPrice: 90, quantityReceived: 5 }],
      }],
      inventorysummaries: [],
      users: [],
      quotes: [],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'slow_supplier_good_cost')).toBe(false);
  });

  it('does not create slow supplier good cost evidence when peer supplier cost source is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [{ _id: 'product-1', name: 'Mapped Product', sku: 'MP-001', estimatedDeliveryDays: 3 }],
      supplierquotes: [
        { productId: 'product-1', supplierId: 'supplier-slow', price: 90, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
      ],
      purchaseorders: [{
        supplierId: 'supplier-slow',
        status: 'received',
        expectedDeliveryDate: new Date('2026-06-07T00:00:00Z'),
        receivedDate: new Date('2026-06-10T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        items: [{ productId: 'product-1', quantity: 5, unitPrice: 90, quantityReceived: 5 }],
      }],
      inventorysummaries: [],
      users: [],
      quotes: [],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'slow_supplier_good_cost')).toBe(false);
  });

  it('does not create slow supplier good cost evidence when slow delivery signal is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [{ _id: 'product-1', name: 'Fast Product', sku: 'FAST-001', estimatedDeliveryDays: 5 }],
      supplierquotes: [
        { productId: 'product-1', supplierId: 'supplier-fast-cost', price: 90, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
        { productId: 'product-1', supplierId: 'supplier-peer', price: 120, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
      ],
      purchaseorders: [{
        supplierId: 'supplier-fast-cost',
        status: 'received',
        expectedDeliveryDate: new Date('2026-06-10T00:00:00Z'),
        receivedDate: new Date('2026-06-10T00:00:00Z'),
        createdAt: new Date('2026-06-08T00:00:00Z'),
        items: [{ productId: 'product-1', quantity: 5, unitPrice: 90, quantityReceived: 5 }],
      }],
      inventorysummaries: [],
      users: [],
      quotes: [],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'slow_supplier_good_cost')).toBe(false);
  });

  it('downgrades slow supplier good cost evidence when thresholds and acceptance status are incomplete', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [],
      products: [{ _id: 'product-1', name: 'Incomplete Supplier Product', sku: 'ISP-001' }],
      supplierquotes: [
        { productId: 'product-1', supplierId: 'supplier-slow', price: 90, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
        { productId: 'product-1', supplierId: 'supplier-peer', price: 120, currency: 'VND', effectiveAt: new Date('2026-06-01T00:00:00Z') },
      ],
      purchaseorders: [{
        _id: 'po-current-1',
        supplierId: 'supplier-slow',
        status: 'received',
        expectedDeliveryDate: new Date('2026-06-07T00:00:00Z'),
        receivedDate: new Date('2026-06-10T00:00:00Z'),
        createdAt: new Date('2026-06-01T00:00:00Z'),
        items: [{ productId: 'product-1', quantity: 5, unitPrice: 90, quantityReceived: 5 }],
      }],
      inventorysummaries: [],
      users: [],
      quotes: [],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      deliverystatuses: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    const evidence = result.operational_risk_findings.find((row: any) => row.finding_key === 'slow_supplier_good_cost');

    expect(evidence).toEqual(expect.objectContaining({
      affected_entity_id: 'product-1::supplier-slow',
      confidence: 'low',
      evidence_strength: 'weak',
      data_quality_status: 'partial',
      current_delay_days_if_available: 3,
      fulfilled_purchase_order_count: 1,
      accepted_quote_count: 0,
    }));
    expect(evidence.missing_or_weak_fields).toEqual(expect.arrayContaining([
      'supplier_quote_approval_status',
      'accepted_quote_count',
      'product_estimated_delivery_days',
      'prior_period_fulfilled_po_sample',
      'delivery_quality_notes',
      'supplier_reliability_score',
      'variant_level_supplier_mapping',
      'margin_or_cogs_impact',
    ]));
  });

  it('surfaces overdue dealer receivable rows as read-only Director evidence with aging buckets', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [{
        _id: 'order-1',
        agentId: 'agent-1',
        agentPaymentStatus: 'pending',
        agentPaymentDueDate: new Date('2026-06-01T00:00:00Z'),
        agentPaidAmount: 1_000_000,
        agentCommissionFinal: 1_200_000,
        orderDate: new Date('2026-05-10T00:00:00Z'),
        orderStatus: 'delivered',
        isActive: true,
      }],
      agentstatements: [{
        _id: 'statement-1',
        agentId: 'agent-1',
        status: 'open',
        periodFrom: new Date('2026-05-01T00:00:00Z'),
        periodTo: new Date('2026-05-31T00:00:00Z'),
        closingBalance: 1_000_000,
        payments: [{ amount: 200_000, paidAt: new Date('2026-06-05T00:00:00Z'), createdBy: 'collector-1' }],
        notes: 'DEMO_AIDP41 late_payment_agent',
      }],
      users: [{ _id: 'agent-1', fullName: 'Dealer One', role: 'external_agent', managerId: 'collector-1', isActive: true }],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    const evidence = result.operational_risk_findings.find((row: any) =>
      row.finding_key === 'overdue_dealer_receivables' && row.invoice_or_order_id === 'order-1',
    );

    expect(evidence).toEqual(expect.objectContaining({
      finding_label: 'overdue_dealer_receivables_for_high_revenue_agent',
      source_collections_or_modules: 'ordertest2, agentstatements, users',
      affected_entity_type: 'dealer_or_agent',
      affected_entity_id: 'agent-1',
      dealer_or_agent_id: 'agent-1',
      dealer_or_agent_alias: 'Dealer One',
      outstanding_balance: 1_000_000,
      overdue_balance: 1_000_000,
      due_date: '2026-06-01',
      days_overdue: 13,
      aging_bucket: '8_14',
      last_payment_date: '2026-06-05',
      last_payment_amount: 200_000,
      original_invoice_or_order_amount: 1_200_000,
      paid_amount: 0,
      invoice_or_order_id: 'order-1',
      collection_owner: 'collector-1',
      payment_terms_or_threshold_source: 'ordertest2.agentPaymentDueDate; overdue when due_date < as_of_report_date',
      linked_statement_count: 1,
      metric_name: 'overdue_balance_by_aging_bucket',
      metric_value: 1_000_000,
      data_quality_status: 'partial',
      confidence: 'medium',
      evidence_note: 'overdue_dealer_receivables_readonly',
      capacity_remaining: null,
    }));
    expect(evidence.not_allowed_actions).toContain('do_not_create_collection_action');
    expect(evidence.not_allowed_actions).toContain('do_not_block_agent');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_cashflow');
    expect(evidence.receivable_semantics_note).toContain('settlement-pressure evidence');
  });

  it('does not create overdue dealer receivable evidence when due date is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [{
        _id: 'order-1',
        agentId: 'agent-1',
        agentPaymentStatus: 'pending',
        agentPaidAmount: 1_000_000,
        orderDate: new Date('2026-05-10T00:00:00Z'),
        isActive: true,
      }],
      agentstatements: [],
      users: [{ _id: 'agent-1', fullName: 'Dealer One', role: 'external_agent' }],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'overdue_dealer_receivables')).toBe(false);
  });

  it('does not create overdue dealer receivable evidence when outstanding balance is missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [{
        _id: 'order-1',
        agentId: 'agent-1',
        agentPaymentStatus: 'pending',
        agentPaymentDueDate: new Date('2026-06-01T00:00:00Z'),
        orderDate: new Date('2026-05-10T00:00:00Z'),
        isActive: true,
      }],
      agentstatements: [],
      users: [{ _id: 'agent-1', fullName: 'Dealer One', role: 'external_agent' }],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'overdue_dealer_receivables')).toBe(false);
  });

  it('downgrades overdue dealer receivable evidence when owner and last payment are missing', async () => {
    const collections: Record<string, any[]> = {
      ordertest2: [{
        _id: 'order-1',
        agentId: 'agent-1',
        agentPaymentStatus: 'pending',
        agentPaymentDueDate: new Date('2026-05-01T00:00:00Z'),
        agentPaidAmount: 900_000,
        orderDate: new Date('2026-04-10T00:00:00Z'),
        isActive: true,
      }],
      agentstatements: [],
      users: [{ _id: 'agent-1', fullName: 'Dealer One', role: 'external_agent', isActive: true }],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    const evidence = result.operational_risk_findings.find((row: any) => row.finding_key === 'overdue_dealer_receivables');

    expect(evidence).toEqual(expect.objectContaining({
      affected_entity_id: 'agent-1',
      overdue_balance: 900_000,
      days_overdue: 44,
      aging_bucket: '31_plus',
      last_payment_date: null,
      last_payment_amount: null,
      collection_owner: null,
      linked_statement_count: 0,
      confidence: 'low',
      evidence_strength: 'weak',
    }));
    expect(evidence.missing_or_weak_fields).toEqual(expect.arrayContaining([
      'last_payment_date',
      'collection_owner',
      'agent_statement_linkage',
    ]));
  });

  it('surfaces labor overtime rows as read-only Director evidence with revenue comparison', async () => {
    const collections: Record<string, any[]> = {
      laborcost1: [
        { _id: 'labor-current-1', userId: 'employee-1', date: new Date('2026-06-10T00:00:00Z'), workHours: 10, cost: 1_000, sessionCount: 1 },
        { _id: 'labor-current-2', userId: 'employee-1', date: new Date('2026-06-11T00:00:00Z'), workHours: 10, cost: 1_000, sessionCount: 1 },
        { _id: 'labor-prior-1', userId: 'employee-1', date: new Date('2026-06-03T00:00:00Z'), workHours: 9, cost: 900, sessionCount: 1 },
      ],
      laborstatements: [
        {
          _id: 'statement-current',
          employeeId: 'employee-1',
          periodFrom: new Date('2026-06-08T00:00:00Z'),
          periodTo: new Date('2026-06-14T00:00:00Z'),
          periodCost: 2_000,
          totalWorkHours: 20,
          sessionCount: 2,
        },
        {
          _id: 'statement-prior',
          employeeId: 'employee-1',
          periodFrom: new Date('2026-06-01T00:00:00Z'),
          periodTo: new Date('2026-06-07T00:00:00Z'),
          periodCost: 900,
          totalWorkHours: 9,
          sessionCount: 1,
        },
      ],
      ordertest2: [
        { _id: 'order-current-1', orderDate: new Date('2026-06-10T00:00:00Z'), quantity: 1, depositAmount: 0, codAmount: 600, manualPayment: 0, productionStatus: 'done', orderStatus: 'delivered', isActive: true },
        { _id: 'order-current-2', orderDate: new Date('2026-06-11T00:00:00Z'), quantity: 2, depositAmount: 0, codAmount: 500, manualPayment: 0, productionStatus: 'done', orderStatus: 'delivered', isActive: true },
        { _id: 'order-prior-1', orderDate: new Date('2026-06-03T00:00:00Z'), quantity: 1, depositAmount: 0, codAmount: 1_000, manualPayment: 0, productionStatus: 'done', orderStatus: 'delivered', isActive: true },
      ],
      users: [{ _id: 'employee-1', fullName: 'Operator One', role: 'employee', isActive: true }],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    const evidence = result.operational_risk_findings.find((row: any) => row.finding_key === 'labor_overtime_high');

    expect(evidence).toEqual(expect.objectContaining({
      finding_label: 'labor_overtime_high_without_matching_revenue_growth',
      source_collections_or_modules: 'laborcost1, laborstatements, ordertest2, users',
      affected_entity_type: 'team_or_period',
      affected_entity_id: 'employee-1',
      team_or_labor_group_id: 'employee-1',
      team_or_labor_group_alias: 'Operator One',
      current_overtime_hours: 4,
      prior_overtime_hours: 1,
      overtime_growth_percent: 300,
      current_labor_cost: 2_000,
      prior_labor_cost: 900,
      labor_cost_growth_percent: 122.22,
      current_revenue: 1_100,
      prior_revenue: 1_000,
      revenue_growth_percent: 10,
      workload_or_order_count_current: 2,
      workload_or_order_count_prior: 1,
      workload_quantity_current: 3,
      workload_quantity_prior: 1,
      current_labor_session_count: 2,
      prior_labor_session_count: 1,
      current_labor_statement_count: 1,
      prior_labor_statement_count: 1,
      metric_name: 'overtime_hours_growth_vs_revenue_growth',
      metric_value: 290,
      data_quality_status: 'partial',
      confidence: 'low',
      evidence_note: 'labor_overtime_high_readonly',
      capacity_remaining: null,
    }));
    expect(evidence.missing_or_weak_fields).toEqual(expect.arrayContaining([
      'canonical_overtime_policy_threshold',
      'sla_or_deadline_pressure',
      'staff_capacity',
      'team_mapping',
    ]));
    expect(evidence.not_allowed_actions).toContain('do_not_change_staffing');
    expect(evidence.not_allowed_actions).toContain('do_not_create_schedule_action');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_payroll');
    expect(evidence.not_allowed_actions).toContain('do_not_mutate_timesheets');
  });

  it('does not create labor overtime evidence when revenue comparison period is missing', async () => {
    const collections: Record<string, any[]> = {
      laborcost1: [
        { userId: 'employee-1', date: new Date('2026-06-10T00:00:00Z'), workHours: 10, cost: 1_000, sessionCount: 1 },
        { userId: 'employee-1', date: new Date('2026-06-03T00:00:00Z'), workHours: 9, cost: 900, sessionCount: 1 },
      ],
      ordertest2: [
        { orderDate: new Date('2026-06-10T00:00:00Z'), quantity: 1, codAmount: 1_000, isActive: true },
      ],
      laborstatements: [],
      users: [{ _id: 'employee-1', fullName: 'Operator One' }],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'labor_overtime_high')).toBe(false);
  });

  it('does not create labor overtime evidence when overtime hours are missing', async () => {
    const collections: Record<string, any[]> = {
      laborcost1: [
        { userId: 'employee-1', date: new Date('2026-06-10T00:00:00Z'), workHours: 8, cost: 800, sessionCount: 1 },
        { userId: 'employee-1', date: new Date('2026-06-03T00:00:00Z'), workHours: 8, cost: 800, sessionCount: 1 },
      ],
      ordertest2: [
        { orderDate: new Date('2026-06-10T00:00:00Z'), quantity: 1, codAmount: 1_000, isActive: true },
        { orderDate: new Date('2026-06-03T00:00:00Z'), quantity: 1, codAmount: 1_000, isActive: true },
      ],
      laborstatements: [],
      users: [{ _id: 'employee-1', fullName: 'Operator One' }],
      agentstatements: [],
      returnrequests: [],
      inventorytransactions: [],
      purchaseorders: [],
      inventorysummaries: [],
      products: [],
      deliverystatuses: [],
      supplierquotes: [],
      quotes: [],
    };
    const connection = {
      collection: (name: string) => ({ find: () => ({ toArray: async () => collections[name] || [] }) }),
    };
    const result = await new OperationsCapacityQuery(connection as any).get('2026-06-14T00:00:00.000Z');
    expect(result.operational_risk_findings.some((row: any) => row.finding_key === 'labor_overtime_high')).toBe(false);
  });

  it('supports explicit not_applicable and schema_only empty reasons', () => {
    expect(missingQuality('test', [], 'Not applicable.', 'not_applicable')).toEqual(expect.objectContaining({
      data_state: 'not_applicable',
      empty_reason: 'not_applicable',
    }));
    expect(missingQuality('test', [], 'Schema only.', 'schema_only')).toEqual(expect.objectContaining({
      data_state: 'schema_only',
      empty_reason: 'schema_only',
    }));
  });

  it('builds required Data Quality metrics and permanently blocks phase-2 live capabilities', async () => {
    const metadata = new DataPackMetadataService();
    const orders = { get: jest.fn().mockResolvedValue({ orders: [{ productId: 'p1', grossProfit: 1, netProfit: 1 }], quality }) };
    const leads = { get: jest.fn().mockResolvedValue({ leads: [{ sourcePlatform: 'google', campaignId: 'c1', orderId: 'o1' }], quality }) };
    const ads = { get: jest.fn().mockResolvedValue({
      accounts: [{}], campaigns: [{}], legacyAdGroups: [{ productCategoryId: 'sg1' }],
      syncRuns: [{ status: 'success' }], quality,
    }) };
    const report = await new DataQualityReportService(metadata, orders as any, leads as any, ads as any, new JsonExporterService()).build('2026-06-12');
    expect(report.metrics.map((item) => item.metric)).toEqual(expect.arrayContaining([
      'lead_source_mapping_rate', 'order_profit_completion_rate', 'campaign_service_mapping_rate',
      'attribution_confidence', 'estimated_vs_realized_profit_rate',
    ]));
    expect(report.decision_gate.can_import_action_file).toBe(false);
    expect(report.decision_gate.can_dry_run).toBe(false);
    expect(report.decision_gate.can_execute_live).toBe(false);
    expect(report.decision_gate.can_generate_action_draft).toBe(true);
    expect(report.decision_gate.can_recommend_ads_scale).toBe(false);
    expect(report.decision_gate.can_use_ltv_strongly).toBe(false);
    expect(report.metrics.find((item) => item.metric === 'order_customer_mapping_rate')?.value_state).toBe('zero_value');
    expect(report.metrics.find((item) => item.metric === 'attribution_confidence')?.value_state).toBe('weak_mapping');
    expect(report.quality.data_state).toBe('weak_mapping');
  });

  it('builds the required mapping chain and keeps overall confidence below high without durable customer', async () => {
    const metadata = new DataPackMetadataService();
    const orders = { get: jest.fn().mockResolvedValue({ orders: [{ productId: 'p1', adGroupId: 'a1', grossProfit: 1, netProfit: 1 }], products: [{ categoryId: 'sg1' }] }) };
    const leads = { get: jest.fn().mockResolvedValue({ leads: [{ adGroupId: 'a1', orderId: 'o1', assignedSaleId: 's1' }] }) };
    const ads = { get: jest.fn().mockResolvedValue({
      accounts: [{}], campaigns: [{ customerId: '1' }], googleAdGroups: [{ campaignId: 'c1' }],
      ads: [], keywords: [], legacyAdGroups: [{ productCategoryId: 'sg1' }], quality,
    }) };
    const report = await new MappingReportService(metadata, orders as any, leads as any, ads as any, new JsonExporterService()).build('2026-06-12');
    expect(report.segments.map((item) => item.mapping_segment)).toEqual(expect.arrayContaining([
      'platform_account_to_campaign', 'ad_group_to_lead', 'lead_to_order',
      'order_to_customer', 'order_to_product_variant', 'product_variant_to_service_group', 'order_to_profit',
    ]));
    expect(report.overall_attribution_confidence).toBeLessThan(0.8);
    expect(report.quality.data_state).toBe('weak_mapping');
  });
});
