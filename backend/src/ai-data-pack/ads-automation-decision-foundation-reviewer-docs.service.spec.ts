import {
  ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
  buildAdsAutomationDecisionFoundationReviewExportFixtureRows,
} from './ads-automation-decision-foundation-read-model-review-export.fixture';
import { AdsAutomationDecisionFoundationReviewExportService } from './ads-automation-decision-foundation-review-export.service';
import { AdsAutomationDecisionFoundationReviewerDocsService } from './ads-automation-decision-foundation-reviewer-docs.service';
import { AdsAutomationDecisionFoundationSnapshotService } from './ads-automation-decision-foundation-snapshot.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import type {
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';

describe('AdsAutomationDecisionFoundationReviewerDocsService', () => {
  const readModelQuery = new AdsAutomationDecisionReadModelQueryService(
    new AdsAutomationDecisionSourceAdapterService(),
  );
  const service = new AdsAutomationDecisionFoundationReviewerDocsService(
    new AdsAutomationDecisionFoundationReviewExportService(
      new AdsAutomationDecisionFoundationSnapshotService(new AdsAutomationDecisionService()),
    ),
  );

  function repository(
    rows = buildAdsAutomationDecisionFoundationReviewExportFixtureRows(),
  ): AdsAutomationDecisionReadModelRepository {
    return {
      findAdGroupPerformanceRows: jest.fn().mockResolvedValue(rows.adGroups),
      findCampaignBudgetRows: jest.fn().mockResolvedValue(rows.campaignBudgets),
      findProductPerformanceRows: jest.fn().mockResolvedValue(rows.products),
      findSupplierSafetyRows: jest.fn().mockResolvedValue(rows.suppliers),
      findCashflowPolicyRow: jest.fn().mockResolvedValue(rows.policy),
      findSourceWatermarks: jest.fn().mockResolvedValue(rows.watermarks),
    };
  }

  async function buildDocs(
    scenario: Parameters<typeof buildAdsAutomationDecisionFoundationReviewExportFixtureRows>[0] = 'ready_for_review',
  ) {
    const readModel = await readModelQuery.buildFromRepository(
      repository(buildAdsAutomationDecisionFoundationReviewExportFixtureRows(scenario)),
      ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
    );
    return service.fromReadModelQueryResult(
      readModel,
      ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
    );
  }

  it('renders compact BA reviewer docs from the foundation review export without the full snapshot payload', async () => {
    const response = await buildDocs();

    expect(response.schemaVersion).toBe('ads_automation_decision_foundation_read_model_reviewer_docs.v1');
    expect(response.docsMode).toBe('local_readback_docs');
    expect((response as any).foundationSnapshot).toBeUndefined();
    expect(response.query).toEqual(ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY);
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      repository_read_only: true,
      read_model_query_used: true,
      foundation_snapshot_reused: true,
      source_review_export_reused: true,
      reviewer_export_readback: true,
      reviewer_docs_readback: true,
      reviewer_docs_persistence_performed: false,
      full_foundation_snapshot_payload_included: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      execution_allowed_now: false,
      production_ready: false,
      campaignBudgetId_fallback_used: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'ready_for_review',
      docs_mode: 'local_readback_docs',
      source_export_mode: 'local_readback',
      source_export_schema_version: 'ads_automation_decision_foundation_read_model_review_export.v1',
      source_foundation_snapshot_schema_version: 'ads_automation_decision_foundation_snapshot.v1',
      read_model_source: 'mongo_read_model',
      rendered_sections: 8,
      attention_sections: 0,
      source_evidence_records_rendered: 6,
      missing_field_evidence_records: 0,
      query_evidence_records_rendered: 5,
      missing_query_evidence_records: 0,
      campaignBudgetId_required: true,
      campaignBudgetId_fallback_used: false,
      full_foundation_snapshot_payload_included: false,
      source_review_export_reused: true,
      reviewer_docs_persistence_performed: false,
      reviewer_export_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      next_required_action: 'inspect_foundation_reviewer_docs',
    }));
    expect(response.routeExamples).toEqual(expect.arrayContaining([
      expect.objectContaining({
        label: 'Foundation reviewer docs',
        method: 'POST',
        path: '/ai/ads-automation/decision-foundation-read-model-reviewer-docs',
        provider_api_called: false,
        erp_mutation_used: false,
      }),
      expect.objectContaining({
        label: 'Foundation review export JSON',
        method: 'POST',
        path: '/ai/ads-automation/decision-foundation-read-model-review-export',
      }),
    ]));
    expect(response.renderedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section_id: 'operator_summary',
        status: 'ready_for_review',
      }),
      expect.objectContaining({
        section_id: 'safety_gates',
        status: 'passed',
        lines: expect.arrayContaining([
          'execution_allowed_now=false',
          'provider_api_called=false',
          'google_ads_api_called=false',
          'validateOnly_called=false',
          'live_ads_execution_used=false',
        ]),
      }),
      expect.objectContaining({
        section_id: 'campaign_budget_join',
        status: 'passed',
        lines: expect.arrayContaining([
          'campaignBudgetId_fallback_used=false',
        ]),
      }),
    ]));
    expect(response.markdownPreview).toContain('Ads Automation Foundation Reviewer Docs');
    expect(response.markdownPreview).toContain('Full foundationSnapshot payload included: false');
    expect(response.markdownPreview).toContain('Safety gates: execution_allowed_now=false');
    expect(response.sourceExportDigest).toEqual(expect.objectContaining({
      schemaVersion: 'ads_automation_decision_foundation_read_model_review_export.v1',
      review_export_route: '/ai/ads-automation/decision-foundation-read-model-review-export',
      foundation_snapshot_schema_version: 'ads_automation_decision_foundation_snapshot.v1',
      read_model_source: 'mongo_read_model',
      omitted_payloads: ['foundationSnapshot'],
      full_foundation_snapshot_payload_included: false,
    }));
    expect(response.sourceExportDigest.rendered_section_ids).toEqual(expect.arrayContaining([
      'operator_summary',
      'ba_foundation_fields',
      'safety_gates',
      'campaign_budget_join',
    ]));
  });

  it('surfaces stale source evidence and attention sections in the docs view without provider calls', async () => {
    const response = await buildDocs('stale_sources');
    const sourceEvidenceSection = response.renderedSections.find((item) => item.section_id === 'source_evidence');

    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'needs_attention',
      stale_source_evidence_records: 2,
      attention_sections: 2,
      attention_section_ids: expect.arrayContaining([
        'source_evidence',
        'review_checklist',
      ]),
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
      next_required_action: 'resolve_missing_read_model_evidence',
    }));
    expect(sourceEvidenceSection).toEqual(expect.objectContaining({
      status: 'attention',
      lines: expect.arrayContaining([
        expect.stringContaining('campaign_budgets: stale'),
        expect.stringContaining('product_performance: stale'),
      ]),
    }));
    expect(response.markdownPreview).toContain('Attention sections: source_evidence, review_checklist');
    expect(response.markdownPreview).toContain('Stale source evidence records: 2');
    expect(response.sourceExportDigest.summary.export_status).toBe('needs_attention');
  });

  it('surfaces missing campaignBudgetId evidence and repeats the non-fallback rule', async () => {
    const response = await buildDocs('missing_campaign_budget');
    const campaignBudgetSection = response.renderedSections.find((item) => item.section_id === 'campaign_budget_join');
    const queryEvidenceSection = response.renderedSections.find((item) => item.section_id === 'query_evidence');

    expect(response.summary).toEqual(expect.objectContaining({
      docs_status: 'needs_attention',
      missing_query_evidence_records: 1,
      campaignBudgetId_required: true,
      campaignBudgetId_fallback_used: false,
      full_foundation_snapshot_payload_included: false,
      next_required_action: 'resolve_missing_read_model_evidence',
    }));
    expect(campaignBudgetSection).toEqual(expect.objectContaining({
      status: 'attention',
      lines: expect.arrayContaining([
        expect.stringContaining('Missing campaignBudgetId_or_campaignBudgetResourceName for ad groups: 2001'),
        'campaignBudgetId is required for budget drafts; campaignId/adGroupId are not fallback budget IDs.',
        'campaignBudgetId_fallback_used=false',
      ]),
    }));
    expect(queryEvidenceSection).toEqual(expect.objectContaining({
      status: 'attention',
      lines: expect.arrayContaining([
        expect.stringContaining('campaign_budgets/ad_group/2001: missing'),
      ]),
    }));
    expect(response.markdownPreview).toContain('Campaign budget fallback used: false');
    expect(response.markdownPreview).toContain('campaignId/adGroupId are not fallback budget IDs');
    expect(response.sourceExportDigest.summary.total_increase_vnd).toBe(0);
    expect(response.sourceExportDigest.evidence_record_ids).toEqual(expect.arrayContaining([
      'campaign_budgets:ad_group:2001',
    ]));
  });
});
