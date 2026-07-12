import { BadRequestException } from '@nestjs/common';
import { ADS_AUTOMATION_MANAGER_ACCOUNT_CONTROL_PLANE_FIXTURE } from './ads-automation-manager-account-control-plane.fixture';
import { AdsAutomationManagerAccountControlPlaneService } from './ads-automation-manager-account-control-plane.service';
import type {
  AdsAutomationManagerAccountControlPlaneInput,
} from './contracts/ads-automation-manager-account-control-plane.contract';

function fixture(
  overrides: Partial<AdsAutomationManagerAccountControlPlaneInput> = {},
): AdsAutomationManagerAccountControlPlaneInput {
  return {
    ...JSON.parse(JSON.stringify(ADS_AUTOMATION_MANAGER_ACCOUNT_CONTROL_PLANE_FIXTURE)),
    ...overrides,
  };
}

describe('AdsAutomationManagerAccountControlPlaneService', () => {
  const service = new AdsAutomationManagerAccountControlPlaneService();

  it('builds a local MCC/BM/BC manager hierarchy with redacted credential metadata and no provider calls', () => {
    const providerBoundary = {
      discover: jest.fn(),
      validateOnly: jest.fn(),
      executeLive: jest.fn(),
    };
    const result = service.build(fixture());
    const serialized = JSON.stringify(result);

    expect(providerBoundary.discover).not.toHaveBeenCalled();
    expect(providerBoundary.validateOnly).not.toHaveBeenCalled();
    expect(providerBoundary.executeLive).not.toHaveBeenCalled();
    expect(result.schemaVersion).toBe('ads_automation_manager_account_control_plane.v1');
    expect(result.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
      fixture_or_payload_only: true,
      manager_credential_metadata_only: true,
      plaintext_secrets_added: false,
      plaintext_credentials_stored: false,
      real_credential_material_present: false,
      provider_api_used: false,
      provider_api_called: false,
      google_ads_api_used: false,
      google_ads_api_called: false,
      meta_api_used: false,
      meta_api_called: false,
      tiktok_api_used: false,
      tiktok_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      campaignBudgetId_no_fallback: true,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(result.summary).toEqual(expect.objectContaining({
      status: 'ready_for_future_erp_validateOnly_contract',
      manager_account_count: 3,
      child_account_count: 3,
      campaign_count: 3,
      ad_group_count: 3,
      pending_action_count: 3,
      ready_manager_count: 3,
      blocked_manager_count: 0,
      ready_pending_action_count: 3,
      blocked_pending_action_count: 0,
      monitor_only_action_count: 1,
      missing_scope_count: 0,
      missing_campaignBudgetId_count: 0,
      provider_api_called: false,
      google_ads_api_called: false,
      meta_api_called: false,
      tiktok_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
      scale_up_execution_mode: 'pending_validation',
    }));
    expect(result.managerAccounts.map((manager) => manager.managerAccountType)).toEqual([
      'google_ads_mcc',
      'meta_business_manager',
      'tiktok_business_center',
    ]);
    expect(result.managerAccounts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'google_ads',
        managerAccountType: 'google_ads_mcc',
        credentialReadiness: expect.objectContaining({
          status: 'ready',
          secret_reference_handle: 'erp-vault://ads/google_ads_mcc/demo-***-metadata',
          plaintextCredentialFieldCount: 0,
          real_credential_material_present: false,
        }),
      }),
      expect.objectContaining({ managerAccountType: 'meta_business_manager' }),
      expect.objectContaining({ managerAccountType: 'tiktok_business_center' }),
    ]));
    expect(result.adapterBoundaries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provider: 'google_ads',
        managerAccountType: 'google_ads_mcc',
        boundaryMode: 'erp_owned_contract_only',
        discoveryImportMode: 'mock_fixture_only',
        supportedMvpActions: expect.arrayContaining([
          'update_campaign_budget',
          'pause_campaign',
          'pause_ad_group',
          'monitor_only',
          'supplier_sourcing',
          'product_offer_fix',
          'stop_import_review',
        ]),
        blockedCapabilities: expect.arrayContaining([
          'delete',
          'Performance Max',
          'Shopping',
          'Display',
          'YouTube',
        ]),
        provider_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
      }),
    ]));
    expect(result.futureControlIntent).toEqual(expect.objectContaining({
      erp_only_future_caller: true,
      manager_credential_controls_only_authorized_children: true,
      provider_discovery_import_validate_execute_adapter_boundary_only: true,
      codex_runner_must_not_receive_credentials: true,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(serialized).not.toContain('BLOCKED_REDACTED_TEST_VALUE');
  });

  it('blocks missing manager credential readiness, missing scopes, plaintext metadata, and child-account eligibility gaps', () => {
    const base = fixture();
    base.managerAccounts[0] = {
      ...base.managerAccounts[0],
      credentialMetadata: {
        credentialReferenceId: 'credref-demo-gads-mcc-001',
        secret_reference_handle: 'not-redacted',
        credentialStatus: 'ready',
        grantedScopes: ['ads.readonly'],
        plaintextCredentialFieldNames: ['refresh_token'],
      },
      childAccounts: [{
        ...base.managerAccounts[0].childAccounts![0],
        authorizedUnderManager: false,
        approvedForReadOnlyImport: false,
        approvedForFutureProviderActions: false,
        active: false,
        syncStatus: 'stale',
      }],
    };

    const result = service.build(base);
    const googleManager = result.managerAccounts.find((manager) =>
      manager.managerAccountType === 'google_ads_mcc')!;
    const googleAction = result.pendingActions.find((action) =>
      action.actionId === 'MGR-ACTION-GADS-BUDGET-001')!;

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      missing_scope_count: 3,
      plaintext_credential_metadata_rejected_count: 1,
      blocked_manager_count: 1,
      blocked_child_account_count: 1,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(googleManager.credentialReadiness).toEqual(expect.objectContaining({
      status: 'plaintext_rejected',
      missingScopes: expect.arrayContaining([
        'ads.manage_budgets',
        'ads.pause',
        'ads.validate_only',
      ]),
      plaintextCredentialFieldCount: 1,
      metadataOnly: true,
    }));
    expect(googleManager.blockers).toEqual(expect.arrayContaining([
      'credential_readiness.plaintext_rejected',
      'permission_scope.ads.manage_budgets_missing',
      'permission_scope.ads.pause_missing',
      'permission_scope.ads.validate_only_missing',
      'child_account.not_authorized_under_manager',
      'child_account.readonly_import_not_approved',
      'child_account.future_provider_actions_not_approved',
      'child_account.child_account_not_active',
      'child_account.sync_status.stale',
    ]));
    expect(googleAction.status).toBe('blocked_before_provider_boundary');
    expect(googleAction.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'manager_credential_readiness',
        status: 'blocked',
      }),
      expect.objectContaining({
        key: 'child_account_eligibility',
        status: 'blocked',
      }),
      expect.objectContaining({
        key: 'required_scopes',
        blockers: expect.arrayContaining([
          'permission_scope.ads.manage_budgets_missing',
          'permission_scope.ads.pause_missing',
          'permission_scope.ads.validate_only_missing',
        ]),
      }),
    ]));
  });

  it('requires campaignBudgetId evidence and never falls back to campaignId or adGroupId', () => {
    const base = fixture();
    base.managerAccounts[0].childAccounts![0].campaigns![0] = {
      ...base.managerAccounts[0].childAccounts![0].campaigns![0],
      campaignBudgetEvidence: {
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
        evidenceSource: 'missing',
      },
    };
    base.pendingActions[0] = {
      ...base.pendingActions[0],
      campaignBudgetId: null,
      campaignId: 'demo-gads-campaign-scale-001',
      adGroupId: 'demo-gads-adgroup-cooker-001',
    };

    const result = service.build(base);
    const action = result.pendingActions[0];

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      missing_campaignBudgetId_count: expect.any(Number),
      scale_up_execution_mode: 'monitor_only',
    }));
    expect(action).toEqual(expect.objectContaining({
      campaignId: 'demo-gads-campaign-scale-001',
      adGroupId: 'demo-gads-adgroup-cooker-001',
      campaignBudgetId: null,
      status: 'blocked_before_provider_boundary',
      campaignBudgetIdNoFallback: true,
      monitorOnlyDowngradeRequired: true,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(action.blockers).toEqual(expect.arrayContaining([
      'campaign.campaignBudgetId_missing_no_fallback',
      'campaignBudgetId_missing_no_fallback',
      'campaignBudgetId_evidence_missing_no_fallback',
    ]));
    expect(action.campaignBudgetId).not.toBe('demo-gads-campaign-scale-001');
    expect(action.campaignBudgetId).not.toBe('demo-gads-adgroup-cooker-001');
  });

  it('downgrades scale-up to monitor-only when cashflow, margin, stock, supplier, refund, freshness, or loss limits are unsafe', () => {
    const base = fixture();
    base.pendingActions[0] = {
      ...base.pendingActions[0],
      businessSafety: {
        cashflowSafe: false,
        grossMarginSafe: false,
        contributionProfitSafe: false,
        stockCoverageSafe: false,
        supplierReliabilitySafe: false,
        fulfillmentCapacitySafe: false,
        refundRiskSafe: false,
        dataFreshnessSafe: false,
        dailyLossLimitSafe: false,
        monthlyLossLimitSafe: false,
      },
    };

    const result = service.build(base);
    const action = result.pendingActions[0];

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(action.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'cashflow_first_safety',
        status: 'blocked',
        blockers: expect.arrayContaining([
          'cashflow_safe_missing_or_unsafe',
          'gross_margin_safe_missing_or_unsafe',
          'contribution_profit_safe_missing_or_unsafe',
          'stock_coverage_safe_missing_or_unsafe',
          'supplier_reliability_safe_missing_or_unsafe',
          'fulfillment_capacity_safe_missing_or_unsafe',
          'refund_risk_safe_missing_or_unsafe',
          'data_freshness_safe_missing_or_unsafe',
          'daily_loss_limit_safe_missing_or_unsafe',
          'monthly_loss_limit_safe_missing_or_unsafe',
        ]),
      }),
    ]));
    expect(action.status).toBe('blocked_before_provider_boundary');
    expect(action.monitorOnlyDowngradeRequired).toBe(true);
  });

  it('blocks unsupported destructive and non-MVP provider capabilities before any provider boundary', () => {
    const base = fixture({
      pendingActions: [{
        ...fixture().pendingActions[0],
        actionId: 'MGR-ACTION-DELETE-PMAX-001',
        actionType: 'delete_performance_max_campaign',
        channel: 'shopping',
      }],
    });

    const result = service.build(base);
    const action = result.pendingActions[0];

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      blocked_pending_action_count: 1,
      provider_api_called: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
    }));
    expect(action).toEqual(expect.objectContaining({
      status: 'blocked_before_provider_boundary',
      allowedMvpAction: false,
      providerApiRequired: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(action.blockers).toEqual(expect.arrayContaining([
      'capability.unsupported_action.delete_performance_max_campaign',
      'capability.delete_blocked',
      'capability.performance_max_blocked',
      'capability.unsupported_channel.shopping',
    ]));
  });

  it('rejects actual plaintext credential keys instead of serializing them', () => {
    const base = fixture();
    base.managerAccounts[0] = {
      ...base.managerAccounts[0],
      credentialMetadata: {
        ...base.managerAccounts[0].credentialMetadata,
        refresh_token: 'BLOCKED_REDACTED_TEST_VALUE',
      } as any,
    };

    expect(() => service.build(base)).toThrow(BadRequestException);
  });
});
