import { BadRequestException } from '@nestjs/common';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
import { AdsAutomationProviderValidateOnlyPlannerService } from './ads-automation-provider-validate-only-planner.service';
import type {
  AdsAutomationDecisionDraftPreview,
  AdsAutomationDecisionDraftPreviewResponse,
} from './contracts/ads-automation-decision-draft-preview.contract';
import type { AdsAutomationPendingErpActionNormalizationResponse } from './contracts/ads-automation-pending-erp-action.contract';

const evidenceWindow = { from: '2026-06-21', to: '2026-07-04', days: 14 };

function budgetDraft(overrides: Partial<AdsAutomationDecisionDraftPreview> = {}): AdsAutomationDecisionDraftPreview {
  return {
    draft_id: 'ADSDRAFT-20260704-update_campaign_budget-2001',
    source_decision_id: 'DEC-scale_amount-2001',
    source_decision_type: 'scale_amount',
    action_type: 'update_campaign_budget',
    action_family: 'provider_google_ads',
    provider: 'google',
    resource_type: 'campaign_budget',
    entity_type: 'ad_group',
    entity_id: '2001',
    platform: 'google',
    accountId: '1234567890',
    productId: 'P_SCALE',
    supplierId: null,
    status: 'pending_approval_preview',
    approval_required: true,
    execution_allowed_now: false,
    validate_only_required: true,
    future_provider_validateOnly_required: true,
    provider_api_called: false,
    google_ads_api_called: false,
    live_ads_execution_used: false,
    persistence_used: false,
    typedPayload: {
      customerId: '1234567890',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: '3001',
      campaignBudgetResourceName: 'customers/1234567890/campaignBudgets/3001',
      dailyBudget: 1200000,
      currentBudgetVnd: 1000000,
      increasePercent: 20,
    },
    source_evidence_references: [{
      decision_id: 'DEC-scale_amount-2001',
      decision_type: 'scale_amount',
      evidence_window: evidenceWindow,
      evidence_metrics: { orders: 12, netProfitAfterAdsVnd: 700000 },
      rationale: 'Profitable Google ad group can scale within ERP cash policy.',
      idempotency_key: 'ads-decision:2026-07-04:scale_amount:2001',
      rollback_plan: 'Restore previous campaign budget.',
    }],
    blockers: [],
    missing_data_blockers: [],
    disallowed_actions: ['delete_product', 'provider_delete', 'auto_publish'],
    idempotency_key: 'ads-draft:2026-07-04:update_campaign_budget:2001',
    rationale: 'Budget increase is capped by ERP policy and still requires approval.',
    ...overrides,
  };
}

function providerDraft(
  actionType: 'pause_campaign' | 'pause_ad_group',
  overrides: Partial<AdsAutomationDecisionDraftPreview> = {},
): AdsAutomationDecisionDraftPreview {
  return {
    ...budgetDraft({
      draft_id: `ADSDRAFT-20260704-${actionType}-entity`,
      source_decision_id: `DEC-${actionType}-entity`,
      source_decision_type: 'campaign_or_ad_group_pause',
      action_type: actionType,
      resource_type: actionType === 'pause_campaign' ? 'campaign' : 'ad_group',
      entity_type: actionType === 'pause_campaign' ? 'campaign' : 'ad_group',
      entity_id: actionType === 'pause_campaign' ? '1001' : '2001',
      typedPayload: actionType === 'pause_campaign'
        ? {
          customerId: '1234567890',
          campaignId: '1001',
          targetStatus: 'PAUSED',
        }
        : {
          customerId: '1234567890',
          campaignId: '1001',
          adGroupId: '2001',
          targetStatus: 'PAUSED',
        },
      idempotency_key: `ads-draft:2026-07-04:${actionType}:entity`,
      rationale: `${actionType} requires validate-only evidence before any future approval can execute.`,
    }),
    ...overrides,
  };
}

function supplierDraft(overrides: Partial<AdsAutomationDecisionDraftPreview> = {}): AdsAutomationDecisionDraftPreview {
  return {
    ...budgetDraft({
      draft_id: 'ADSDRAFT-20260704-supplier_sourcing-SUP_SAFE',
      source_decision_id: 'DEC-supplier_gate-SUP_SAFE',
      source_decision_type: 'supplier_gate',
      action_type: 'supplier_sourcing',
      action_family: 'internal_task',
      provider: 'erp_internal',
      resource_type: 'supplier',
      entity_type: 'supplier',
      entity_id: 'SUP_SAFE',
      platform: null,
      accountId: null,
      productId: 'P_SCALE',
      supplierId: 'SUP_SAFE',
      validate_only_required: false,
      future_provider_validateOnly_required: false,
      typedPayload: {
        productId: 'P_SCALE',
        supplierId: 'SUP_SAFE',
        supplierFitScore: 42,
      },
      idempotency_key: 'ads-draft:2026-07-04:supplier_sourcing:SUP_SAFE',
      rationale: 'ERP internal supplier sourcing task only.',
    }),
    ...overrides,
  };
}

function monitorOnlyDraft(overrides: Partial<AdsAutomationDecisionDraftPreview> = {}): AdsAutomationDecisionDraftPreview {
  return {
    ...budgetDraft({
      draft_id: 'ADSDRAFT-20260704-monitor_only-2001',
      source_decision_id: 'DEC-monitor_only-2001',
      source_decision_type: 'campaign_or_ad_group_pause',
      action_type: 'monitor_only',
      action_family: 'monitoring',
      provider: 'none',
      resource_type: 'monitoring',
      entity_type: 'ad_group',
      entity_id: '2001',
      platform: 'google',
      accountId: '1234567890',
      productId: 'P_SCALE',
      supplierId: null,
      validate_only_required: false,
      future_provider_validateOnly_required: false,
      typedPayload: {
        customerId: '1234567890',
        campaignId: '1001',
        adGroupId: '2001',
        safetyAction: 'monitor_only',
        reviewAfterDays: 3,
      },
      idempotency_key: 'ads-draft:2026-07-04:monitor_only:2001',
      rationale: 'Monitor-only safety action remains visible without provider validateOnly.',
    }),
    ...overrides,
  };
}

function preview(
  drafts: AdsAutomationDecisionDraftPreview[],
  overrides: Partial<AdsAutomationDecisionDraftPreviewResponse> = {},
): AdsAutomationDecisionDraftPreviewResponse {
  return {
    schemaVersion: 'ads_automation_decision_draft_preview.v1',
    generatedAt: '2026-07-04T05:00:00.000Z',
    source: 'decision_snapshot',
    safety: {
      read_only: true,
      dry_run: true,
      persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_required_for_all_drafts: true,
      execution_allowed_now: false,
      future_provider_validateOnly_required: true,
    },
    sourceEvidence: [],
    missingFieldEvidence: [],
    queryEvidence: [],
    snapshot: {
      schemaVersion: 'ads_automation_decision_snapshot.v1',
      generatedAt: '2026-07-04T05:00:00.000Z',
      snapshotDate: '2026-07-04',
      summary: {
        categories: 7,
        decisions: drafts.length,
        scale_candidates: 1,
        pause_candidates: 2,
        product_scale_candidates: 0,
        supplier_safe_candidates: 1,
        insufficient_data_decisions: 0,
      },
    },
    summary: {
      decisions_scanned: drafts.length,
      drafts_created: drafts.length,
      blocked_drafts: 0,
      provider_action_drafts: drafts.filter((draft) => draft.action_family === 'provider_google_ads').length,
      internal_task_drafts: drafts.filter((draft) => draft.action_family === 'internal_task').length,
      monitoring_drafts: drafts.filter((draft) => draft.action_family === 'monitoring').length,
    },
    drafts,
    ...overrides,
  };
}

function normalizedActions(): AdsAutomationPendingErpActionNormalizationResponse {
  const normalizer = new AdsAutomationPendingErpActionNormalizerService();
  return normalizer.normalizePreview(preview([
    budgetDraft(),
    providerDraft('pause_campaign'),
    providerDraft('pause_ad_group'),
    supplierDraft(),
  ]));
}

describe('AdsAutomationProviderValidateOnlyPlannerService', () => {
  let service: AdsAutomationProviderValidateOnlyPlannerService;

  beforeEach(() => {
    service = new AdsAutomationProviderValidateOnlyPlannerService();
  });

  it('maps mocked validate-only provider statuses while preserving provider errors and disabling live execution', () => {
    const normalization = normalizedActions();
    const budget = normalization.pendingActions.find((action) => action.action_type === 'update_campaign_budget')!;
    const campaign = normalization.pendingActions.find((action) => action.action_type === 'pause_campaign')!;
    const response = service.planValidateOnlyLane(normalization, [
      {
        pending_action_id: budget.pending_action_id,
        status: 'provider_validate_passed',
        providerRequestId: 'REQ-VALIDATE-BUDGET-2001',
        providerValidatedAt: '2026-07-04T06:00:00.000Z',
        beforeStateSnapshot: {
          campaignBudgetId: '3001',
          amountVnd: 1000000,
          status: 'ENABLED',
        },
      },
      {
        approval_id: campaign.approval_id,
        status: 'provider_validate_failed',
        providerRequestId: 'REQ-VALIDATE-PAUSE-1001',
        providerValidatedAt: '2026-07-04T06:05:00.000Z',
        errors: [{
          code: 'CampaignError.CANNOT_PAUSE_REMOVED_CAMPAIGN',
          message: 'Campaign cannot be paused because the synced provider state is REMOVED.',
          fieldPath: 'mutateOperations.campaignOperation.update.status',
        }],
      },
    ]);

    expect(response.schemaVersion).toBe('ads_automation_provider_validate_only_lane.v1');
    expect(response.summary).toEqual({
      pending_actions_received: 4,
      provider_actions_received: 3,
      non_provider_actions_skipped: 1,
      validate_only_pending: 1,
      validate_only_passed: 1,
      validate_only_failed: 1,
      blocked_before_validate_only: 0,
      approval_can_be_considered_executable: 1,
      executable_now: 0,
    });
    expect(response.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      in_memory_only: true,
      persistence_used: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      production_ready: false,
      approval_can_be_considered_executable_only_after_validateOnly_passed: true,
      execution_allowed_now: false,
      provider_validateOnly_lane_mocked: true,
      no_direct_google_ads_api_call: true,
      campaignBudgetId_no_fallback: true,
    }));

    expect(response.validationPlans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        pending_action_id: budget.pending_action_id,
        action_type: 'update_campaign_budget',
        status: 'validate_only_passed',
        providerValidationStatus: 'provider_validate_passed',
        providerRequestId: 'REQ-VALIDATE-BUDGET-2001',
        providerValidationErrors: [],
        approval_can_be_considered_executable: true,
        executable_now: false,
        execution_allowed_now: false,
        next_required_action: 'continue_human_approval_flow',
        validateOnly_request: expect.objectContaining({
          schemaVersion: 'ads_automation_provider_validate_only_request.v1',
          operation_kind: 'campaign_budget_update',
          request_status: 'ready_for_future_validateOnly',
          customerId: '1234567890',
          campaignBudgetId: '3001',
          required_identifiers: ['customerId', 'campaignBudgetId'],
          missing_identifiers: [],
          raw_provider_request_included: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          execution_allowed_now: false,
        }),
        validateOnly_result: expect.objectContaining({
          schemaVersion: 'ads_automation_provider_validate_only_result.v1',
          operation_kind: 'campaign_budget_update',
          status: 'validate_only_passed',
          providerValidationStatus: 'provider_validate_passed',
          providerRequestId: 'REQ-VALIDATE-BUDGET-2001',
          providerValidationErrors: [],
          approval_can_be_considered_executable: true,
          executable_now: false,
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
        }),
        before_state_snapshot: expect.objectContaining({
          snapshot_status: 'mocked_boundary_snapshot',
          campaignBudgetId: '3001',
          snapshot: expect.objectContaining({ amountVnd: 1000000 }),
        }),
      }),
      expect.objectContaining({
        pending_action_id: campaign.pending_action_id,
        action_type: 'pause_campaign',
        status: 'validate_only_failed',
        providerValidationStatus: 'provider_validate_failed',
        providerRequestId: 'REQ-VALIDATE-PAUSE-1001',
        providerValidationErrors: [{
          code: 'CampaignError.CANNOT_PAUSE_REMOVED_CAMPAIGN',
          message: 'Campaign cannot be paused because the synced provider state is REMOVED.',
          fieldPath: 'mutateOperations.campaignOperation.update.status',
        }],
        validateOnly_request: expect.objectContaining({
          operation_kind: 'campaign_pause',
          request_status: 'ready_for_future_validateOnly',
          required_identifiers: ['customerId', 'campaignId'],
          missing_identifiers: [],
          raw_provider_request_included: false,
        }),
        validateOnly_result: expect.objectContaining({
          operation_kind: 'campaign_pause',
          status: 'validate_only_failed',
          providerValidationStatus: 'provider_validate_failed',
          providerValidationErrors: [{
            code: 'CampaignError.CANNOT_PAUSE_REMOVED_CAMPAIGN',
            message: 'Campaign cannot be paused because the synced provider state is REMOVED.',
            fieldPath: 'mutateOperations.campaignOperation.update.status',
          }],
          executable_now: false,
          execution_allowed_now: false,
        }),
        approval_can_be_considered_executable: false,
        executable_now: false,
        next_required_action: 'fix_provider_validation_errors',
      }),
      expect.objectContaining({
        action_type: 'pause_ad_group',
        status: 'validate_only_pending',
        providerValidationStatus: 'pending',
        approval_can_be_considered_executable: false,
        executable_now: false,
        next_required_action: 'run_future_erp_validateOnly',
        validateOnly_request: expect.objectContaining({
          operation_kind: 'ad_group_pause',
          request_status: 'ready_for_future_validateOnly',
          required_identifiers: ['customerId', 'adGroupId'],
          missing_identifiers: [],
        }),
        validateOnly_result: expect.objectContaining({
          operation_kind: 'ad_group_pause',
          status: 'validate_only_pending',
          providerValidationStatus: 'pending',
          providerValidationErrors: [],
        }),
      }),
      expect.objectContaining({
        action_type: 'supplier_sourcing',
        status: 'skipped_non_provider_action',
        providerValidationStatus: 'not_applicable',
        validate_only_required_before_execution: false,
        approval_can_be_considered_executable: false,
        validateOnly_request: expect.objectContaining({
          operation_kind: 'not_applicable_non_provider_action',
          request_status: 'not_applicable_non_provider_action',
          required_identifiers: [],
          missing_identifiers: [],
        }),
        validateOnly_result: expect.objectContaining({
          operation_kind: 'not_applicable_non_provider_action',
          status: 'skipped_non_provider_action',
          providerValidationStatus: 'not_applicable',
        }),
      }),
    ]));
    expect(response.validationPlans.every((plan) => plan.executable_now === false)).toBe(true);
    expect(response.validationPlans.filter((plan) => plan.approval_can_be_considered_executable))
      .toEqual([expect.objectContaining({ status: 'validate_only_passed' })]);
  });

  it('keeps provider actions non-executable before mocked validate-only evidence is supplied', () => {
    const response = service.planValidateOnlyLane(normalizedActions());
    const providerPlans = response.validationPlans.filter((plan) => plan.action_family === 'provider_google_ads');

    expect(providerPlans).toHaveLength(3);
    expect(providerPlans.every((plan) => plan.status === 'validate_only_pending')).toBe(true);
    expect(providerPlans.every((plan) => plan.providerValidationStatus === 'pending')).toBe(true);
    expect(providerPlans.every((plan) => plan.approval_can_be_considered_executable === false)).toBe(true);
    expect(providerPlans.every((plan) => plan.executable_now === false)).toBe(true);
    expect(providerPlans).toEqual(expect.arrayContaining([
      expect.objectContaining({
        before_state_snapshot: expect.objectContaining({
          snapshot_status: 'placeholder_pending_erp_synced_read',
          required_before_future_execution: true,
          source: 'erp_synced_google_ads_read_model',
        }),
        provider_boundary_evidence: expect.objectContaining({
          boundary_mode: 'erp_local_mock_only',
          status_source: 'no_mock_result',
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          direct_google_ads_api_call: false,
          operation_builder_called: false,
          raw_provider_request_included: false,
        }),
      }),
    ]));
  });

  it('declares the MVP validate-only contract for provider actions and monitor_only safety actions only', () => {
    const normalization = new AdsAutomationPendingErpActionNormalizerService().normalizePreview(preview([
      budgetDraft(),
      providerDraft('pause_campaign'),
      providerDraft('pause_ad_group'),
      monitorOnlyDraft(),
      supplierDraft(),
    ]));

    const response = service.planValidateOnlyLane(normalization);
    const byActionType = new Map(response.validationPlans.map((plan) => [plan.action_type, plan]));

    for (const actionType of ['update_campaign_budget', 'pause_campaign', 'pause_ad_group'] as const) {
      expect(byActionType.get(actionType)).toEqual(expect.objectContaining({
        action_type: actionType,
        mvp_action_contract: expect.objectContaining({
          supported_mvp_action: true,
          action_scope: 'provider_validateOnly_required',
          preflight_treatment: 'eligible_for_future_provider_preflight',
          provider_validateOnly_required_before_future_execution: true,
          monitor_only_safety_action: false,
          visible_as_safety_action: false,
          approval_required_before_execution: true,
          future_live_execution_allowed: false,
          executable_now: false,
          execution_allowed_now: false,
          provider_api_called: false,
          google_ads_api_called: false,
          validateOnly_called: false,
          live_ads_execution_used: false,
        }),
      }));
    }

    expect(byActionType.get('monitor_only')).toEqual(expect.objectContaining({
      action_type: 'monitor_only',
      status: 'skipped_non_provider_action',
      validate_only_required_before_execution: false,
      approval_can_be_considered_executable: false,
      executable_now: false,
      next_required_action: 'not_applicable_non_provider_action',
      validateOnly_request: expect.objectContaining({
        operation_kind: 'not_applicable_non_provider_action',
        request_status: 'not_applicable_non_provider_action',
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        execution_allowed_now: false,
      }),
      provider_boundary_evidence: expect.objectContaining({
        boundary_mode: 'erp_local_mock_only',
        status_source: 'non_provider_action',
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        direct_google_ads_api_call: false,
      }),
      mvp_action_contract: expect.objectContaining({
        supported_mvp_action: true,
        action_scope: 'monitor_only_safety_action',
        preflight_treatment: 'visible_non_executable_safety_action',
        provider_validateOnly_required_before_future_execution: false,
        monitor_only_safety_action: true,
        visible_as_safety_action: true,
        approval_required_before_execution: true,
        future_live_execution_allowed: false,
        executable_now: false,
        execution_allowed_now: false,
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    }));

    expect(byActionType.get('supplier_sourcing')).toEqual(expect.objectContaining({
      action_type: 'supplier_sourcing',
      status: 'skipped_non_provider_action',
      mvp_action_contract: expect.objectContaining({
        supported_mvp_action: false,
        action_scope: 'out_of_scope_non_provider_action',
        preflight_treatment: 'not_in_mvp_validateOnly_contract',
        provider_validateOnly_required_before_future_execution: false,
        monitor_only_safety_action: false,
        visible_as_safety_action: false,
        execution_allowed_now: false,
      }),
    }));
  });

  it('blocks budget validate-only planning without campaignBudgetId and never falls back to campaignId or adGroupId', () => {
    const normalization = normalizedActions();
    const budgetIndex = normalization.pendingActions.findIndex((action) => action.action_type === 'update_campaign_budget');
    normalization.pendingActions[budgetIndex] = {
      ...normalization.pendingActions[budgetIndex],
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
      campaignBudgetResourceName: null,
      identifiers: {
        ...normalization.pendingActions[budgetIndex].identifiers,
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      },
      requested_change: {
        ...normalization.pendingActions[budgetIndex].requested_change,
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      },
    };

    const response = service.planValidateOnlyLane(normalization, [{
      pending_action_id: normalization.pendingActions[budgetIndex].pending_action_id,
      status: 'provider_validate_passed',
    }]);
    const budgetPlan = response.validationPlans.find((plan) => plan.action_type === 'update_campaign_budget')!;

    expect(budgetPlan.status).toBe('blocked_before_validate_only');
    expect(budgetPlan.providerValidationStatus).toBe('pending');
    expect(budgetPlan.blockers).toEqual(expect.arrayContaining(['campaignBudgetId']));
    expect(budgetPlan.campaignId).toBe('1001');
    expect(budgetPlan.adGroupId).toBe('2001');
    expect(budgetPlan.campaignBudgetId).toBeNull();
    expect(budgetPlan.validateOnly_request).toEqual(expect.objectContaining({
      operation_kind: 'campaign_budget_update',
      request_status: 'blocked_before_validateOnly',
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
      required_identifiers: ['customerId', 'campaignBudgetId'],
      missing_identifiers: ['campaignBudgetId'],
      raw_provider_request_included: false,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      execution_allowed_now: false,
    }));
    expect(budgetPlan.validateOnly_result).toEqual(expect.objectContaining({
      operation_kind: 'campaign_budget_update',
      status: 'blocked_before_validate_only',
      providerValidationStatus: 'pending',
      approval_can_be_considered_executable: false,
      executable_now: false,
      execution_allowed_now: false,
    }));
    expect(budgetPlan.approval_can_be_considered_executable).toBe(false);
    expect(budgetPlan.executable_now).toBe(false);
    expect(response.summary.blocked_before_validate_only).toBe(1);
    expect(response.summary.approval_can_be_considered_executable).toBe(0);
  });

  it('rejects unsafe normalization safety flags and non-pending-validation records', () => {
    const normalization = normalizedActions();

    expect(() => service.planValidateOnlyLane({
      ...normalization,
      safety: {
        ...normalization.safety,
        provider_api_called: true as any,
      },
    })).toThrow('validate-only planning requires a dry-run normalization with no provider activity');

    expect(() => service.planValidateOnlyLane({
      ...normalization,
      pendingActions: [{
        ...normalization.pendingActions[0],
        status: 'validated' as any,
      }],
    })).toThrow(BadRequestException);
  });

  it('rejects duplicate or malformed mocked provider boundary results before planning', () => {
    const normalization = normalizedActions();
    const action = normalization.pendingActions[0];

    expect(() => service.planValidateOnlyLane(normalization, [{
      status: 'provider_validate_passed',
    }])).toThrow('mocked provider result requires pending_action_id or approval_id');

    expect(() => service.planValidateOnlyLane(normalization, [
      { pending_action_id: action.pending_action_id, status: 'provider_validate_passed' },
      { pending_action_id: action.pending_action_id, status: 'provider_validate_failed' },
    ])).toThrow('duplicate mocked provider result key rejected');
  });
});
