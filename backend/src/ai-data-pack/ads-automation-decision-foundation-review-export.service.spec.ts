import {
  ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY,
  buildAdsAutomationDecisionFoundationReviewExportFixtureRows,
} from './ads-automation-decision-foundation-read-model-review-export.fixture';
import { AdsAutomationDecisionFoundationReviewExportService } from './ads-automation-decision-foundation-review-export.service';
import { AdsAutomationDecisionFoundationSnapshotService } from './ads-automation-decision-foundation-snapshot.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import type {
  AdsAutomationDecisionReadModelRepository,
} from './contracts/ads-automation-decision-read-model-query.contract';

describe('AdsAutomationDecisionFoundationReviewExportService', () => {
  const readModelQuery = new AdsAutomationDecisionReadModelQueryService(
    new AdsAutomationDecisionSourceAdapterService(),
  );
  const service = new AdsAutomationDecisionFoundationReviewExportService(
    new AdsAutomationDecisionFoundationSnapshotService(new AdsAutomationDecisionService()),
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

  async function buildExport(
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

  it('exports one stable BA reviewer artifact from the read-model foundation snapshot', async () => {
    const response = await buildExport();

    expect(response.schemaVersion).toBe('ads_automation_decision_foundation_read_model_review_export.v1');
    expect(response.exportMode).toBe('local_readback');
    expect(response.query).toEqual(ADS_AUTOMATION_DECISION_FOUNDATION_REVIEW_EXPORT_QUERY);
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      repository_read_only: true,
      read_model_query_used: true,
      foundation_snapshot_reused: true,
      reviewer_export_readback: true,
      reviewer_export_persistence_performed: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      campaignBudgetId_fallback_used: false,
    }));
    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'ready_for_review',
      export_mode: 'local_readback',
      read_model_source: 'mongo_read_model',
      source_evidence_records: 6,
      missing_field_evidence_records: 0,
      scale_ads_decision: 'increase',
      scale_candidates: 1,
      total_increase_vnd: 200000,
      campaignBudgetId_required: true,
      campaignBudgetId_fallback_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
      next_required_action: 'inspect_foundation_review_export',
    }));
    expect(response.foundationSnapshot.scale_amount.items[0].proposedValue).toEqual(expect.objectContaining({
      action: 'update_campaign_budget_draft',
      campaignBudgetId: '3001',
      proposedBudgetVnd: 1200000,
    }));
    expect(response.renderedSections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section_id: 'ba_foundation_fields',
        status: 'ready_for_review',
      }),
      expect.objectContaining({
        section_id: 'safety_gates',
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
    expect(response.markdownPreview).toContain('Ads Automation Foundation Review Export');
    expect(response.markdownPreview).toContain('Safety gates: execution_allowed_now=false');
    expect(response.routeExamples).toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: 'POST',
        path: '/ai/ads-automation/decision-foundation-read-model-review-export',
        provider_api_called: false,
        erp_mutation_used: false,
      }),
    ]));
  });

  it('renders stale source evidence as reviewer attention without provider calls', async () => {
    const response = await buildExport('stale_sources');
    const sourceEvidenceSection = response.renderedSections.find((item) => item.section_id === 'source_evidence');

    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'needs_attention',
      stale_source_evidence_records: 2,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
      next_required_action: 'resolve_missing_read_model_evidence',
    }));
    expect(response.foundationSnapshot.sourceEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        status: 'stale',
        canUseForDecision: 'cautious',
      }),
      expect.objectContaining({
        sourceKey: 'product_performance',
        status: 'stale',
        canUseForDecision: 'cautious',
      }),
    ]));
    expect(sourceEvidenceSection).toEqual(expect.objectContaining({
      status: 'attention',
      lines: expect.arrayContaining([
        expect.stringContaining('campaign_budgets: stale'),
        expect.stringContaining('product_performance: stale'),
      ]),
    }));
    expect(response.markdownPreview).toContain('campaign_budgets:stale');
    expect(response.markdownPreview).toContain('product_performance:stale');
  });

  it('renders missing campaignBudgetId evidence and states campaignId/adGroupId are not fallbacks', async () => {
    const response = await buildExport('missing_campaign_budget');
    const campaignBudgetSection = response.renderedSections.find((item) => item.section_id === 'campaign_budget_join');
    const queryEvidenceSection = response.renderedSections.find((item) => item.section_id === 'query_evidence');

    expect(response.summary).toEqual(expect.objectContaining({
      export_status: 'needs_attention',
      scale_ads_decision: 'insufficient_data',
      total_increase_vnd: 0,
      missing_query_evidence_records: 1,
      campaignBudgetId_required: true,
      campaignBudgetId_fallback_used: false,
      next_required_action: 'resolve_missing_read_model_evidence',
    }));
    expect(response.foundationSnapshot.scale_amount.items).toEqual([]);
    expect(response.foundationSnapshot.blockers.missing_fields).toContain('campaignBudgetId_or_campaignBudgetResourceName');
    expect(response.foundationSnapshot.queryEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceKey: 'campaign_budgets',
        entityId: '2001',
        status: 'missing',
        missingFields: ['campaignBudgetId_or_campaignBudgetResourceName'],
      }),
    ]));
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
    expect(response.foundationSnapshot.evidence_links.some((link) => (
      link.decision_type === 'scale_amount'
      && (link as any).campaignBudgetId === '1001'
    ))).toBe(false);
    expect(response.foundationSnapshot.evidence_links.some((link) => (
      link.decision_type === 'scale_amount'
      && (link as any).campaignBudgetId === '2001'
    ))).toBe(false);
    expect(response.markdownPreview).toContain('Campaign budget issue: missing campaignBudgetId_or_campaignBudgetResourceName for 2001');
    expect(response.markdownPreview).toContain('campaignBudgetId is required; campaignId/adGroupId are not fallback budget IDs');
  });
});
