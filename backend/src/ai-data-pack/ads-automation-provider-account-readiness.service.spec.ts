import { AdsAutomationProviderAccountReadinessService } from './ads-automation-provider-account-readiness.service';
import { ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE } from './ads-automation-provider-account-readiness.fixture';
import type {
  AdsAutomationProviderAccountReadinessInput,
} from './contracts/ads-automation-provider-account-readiness.contract';

function fixture(
  overrides: Partial<AdsAutomationProviderAccountReadinessInput> = {},
): AdsAutomationProviderAccountReadinessInput {
  return {
    ...ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE,
    accounts: ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE.accounts.map((account) => ({
      ...account,
      credentialMetadata: {
        ...account.credentialMetadata,
        grantedScopes: [...(account.credentialMetadata?.grantedScopes || [])],
        plaintextCredentialFieldNames: [...(account.credentialMetadata?.plaintextCredentialFieldNames || [])],
      },
    })),
    requestedActions: ADS_AUTOMATION_PROVIDER_ACCOUNT_READINESS_FIXTURE.requestedActions.map((action) => ({
      ...action,
    })),
    ...overrides,
  };
}

describe('AdsAutomationProviderAccountReadinessService', () => {
  const service = new AdsAutomationProviderAccountReadinessService();

  it('builds a local provider adapter registry and redacted account readiness without provider calls', () => {
    const provider = {
      validateOnly: jest.fn(),
      executeLive: jest.fn(),
      syncReadOnly: jest.fn(),
    };
    const result = service.build(fixture());
    const serialized = JSON.stringify(result);

    expect(provider.validateOnly).not.toHaveBeenCalled();
    expect(provider.executeLive).not.toHaveBeenCalled();
    expect(provider.syncReadOnly).not.toHaveBeenCalled();
    expect(result.schemaVersion).toBe('ads_automation_provider_account_readiness.v1');
    expect(result.safety).toEqual(expect.objectContaining({
      read_only: true,
      dry_run: true,
      local_only: true,
      adapter_registry_contract_only: true,
      credential_metadata_only: true,
      plaintext_credentials_stored: false,
      persistence_used: false,
      provider_api_called: false,
      provider_api_used: false,
      google_ads_api_called: false,
      google_ads_api_used: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      production_ready: false,
      campaignBudgetId_no_fallback: true,
    }));
    expect(result.summary).toEqual(expect.objectContaining({
      status: 'ready_for_local_validate_only',
      registered_adapter_count: 1,
      ready_account_count: 1,
      provider_actions_requested: 3,
      provider_actions_ready_for_future_validate_only: 3,
      provider_actions_blocked_before_boundary: 0,
      monitor_only_actions_ready: 1,
      scale_up_execution_mode: 'pending_validation',
      future_validate_only_contract_ready: true,
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(result.adapterRegistry).toEqual(expect.arrayContaining([
      expect.objectContaining({
        platform: 'google_ads',
        adapterMode: 'contract_only',
        registered: true,
        boundaryMode: 'erp_owned_contract_only',
        provider_api_called: false,
        google_ads_api_called: false,
      }),
    ]));
    expect(result.adapterRegistry.find((entry) => entry.platform === 'google_ads')?.capabilityMap)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          actionType: 'update_campaign_budget',
          supported: true,
          requiredScopes: ['ads.readonly', 'ads.validate_only', 'ads.manage_budgets'],
          supportedChannels: ['search'],
        }),
        expect.objectContaining({ actionType: 'pause_campaign', supported: true }),
        expect.objectContaining({ actionType: 'pause_ad_group', supported: true }),
        expect.objectContaining({
          actionType: 'monitor_only',
          supported: true,
          providerApiRequired: false,
        }),
      ]));
    expect(result.accounts[0].credentialReadiness).toEqual(expect.objectContaining({
      status: 'ready',
      credentialReferenceId: 'credref-google-ads-primary',
      redactedCredentialReference: 'google_ads_oauth_ref:***primary',
      metadataOnly: true,
      plaintextCredentialFieldCount: 0,
      missingScopes: [],
    }));
    expect(serialized).not.toContain('raw-refresh-token-value');
    expect(serialized).not.toContain('raw-client-secret-value');
    expect(serialized).not.toContain('raw-access-token-value');
  });

  it('blocks account/customer mapping gaps, production-enabled payloads, and plaintext credential metadata', () => {
    const result = service.build(fixture({
      accounts: [{
        ...fixture().accounts[0],
        accountId: null,
        customerId: 'bad-customer',
        erpAccountMappingId: null,
        isActive: false,
        approvedForProviderActions: false,
        approvedForReadOnlyImport: false,
        googleAdsProductionEnabled: true,
        credentialMetadata: {
          credentialReferenceId: 'credref-google-ads-primary',
          redactedCredentialReference: 'not-redacted',
          oauthConnectionStatus: 'ready',
          grantedScopes: ['ads.readonly'],
          plaintextCredentialFieldNames: ['refresh_token'],
        } as any,
      }],
    }));

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      missing_account_mapping_count: 1,
      plaintext_credential_metadata_rejected_count: 1,
      missing_scope_count: expect.any(Number),
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(result.accounts[0].blockers).toEqual(expect.arrayContaining([
      'account_mapping.accountId_missing',
      'account_mapping.customerId_missing_or_malformed',
      'account_mapping.erpAccountMappingId_missing',
      'account_mapping.account_not_active',
      'account_mapping.provider_actions_not_approved',
      'account_mapping.readonly_import_not_approved',
      'GOOGLE_ADS_PRODUCTION_ENABLED_must_be_false_or_absent',
      'credential_readiness.plaintext_rejected',
    ]));
    expect(result.requestedActions[0].blockers).toEqual(expect.arrayContaining([
      'permission_scope.ads.manage_budgets_missing',
      'permission_scope.ads.validate_only_missing',
    ]));
    expect(JSON.stringify(result)).not.toContain('raw-refresh-token-value');
  });

  it('blocks unsupported actions and unsupported channels before the provider boundary', () => {
    const result = service.build(fixture({
      requestedActions: [
        {
          ...fixture().requestedActions[0],
          actionId: 'PROVIDER-ACTION-CREATE-CAMPAIGN',
          actionType: 'create_search_campaign',
          channel: 'performance_max',
        },
      ],
    }));

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      unsupported_action_count: 1,
      unsupported_channel_count: 1,
      provider_actions_blocked_before_boundary: 1,
      scale_up_execution_mode: 'monitor_only',
      provider_api_called: false,
      google_ads_api_called: false,
      live_ads_execution_used: false,
    }));
    expect(result.requestedActions[0]).toEqual(expect.objectContaining({
      status: 'blocked_before_provider_boundary',
      blockers: expect.arrayContaining([
        'capability.unsupported_action.create_search_campaign',
        'capability.unsupported_channel.performance_max',
      ]),
      approval_can_be_considered_executable: false,
      execution_allowed_now: false,
    }));
  });

  it('downgrades increase-budget actions to monitor-only when permission scopes are missing but keeps safety actions available', () => {
    const result = service.build(fixture({
      accounts: [{
        ...fixture().accounts[0],
        credentialMetadata: {
          ...fixture().accounts[0].credentialMetadata,
          grantedScopes: ['ads.readonly'],
        },
      }],
      requestedActions: [
        fixture().requestedActions[0],
        fixture().requestedActions[1],
        fixture().requestedActions[2],
        fixture().requestedActions[3],
      ],
    }));
    const budget = result.requestedActions.find((action) => action.actionType === 'update_campaign_budget')!;
    const campaignPause = result.requestedActions.find((action) => action.actionType === 'pause_campaign')!;
    const monitorOnly = result.requestedActions.find((action) => action.actionType === 'monitor_only')!;

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      missing_scope_count: expect.any(Number),
      monitor_only_downgrade_count: 1,
      safety_actions_available: 3,
      scale_up_execution_mode: 'monitor_only',
      execution_allowed_now: false,
    }));
    expect(budget).toEqual(expect.objectContaining({
      status: 'blocked_before_provider_boundary',
      missingScopes: expect.arrayContaining(['ads.validate_only', 'ads.manage_budgets']),
      monitorOnlyDowngradeRequired: true,
      next_required_action: 'monitor_only_until_provider_readiness_resolved',
      execution_allowed_now: false,
    }));
    expect(campaignPause).toEqual(expect.objectContaining({
      status: 'blocked_before_provider_boundary',
      safetyActionCandidateAvailable: true,
      execution_allowed_now: false,
    }));
    expect(monitorOnly).toEqual(expect.objectContaining({
      status: 'ready_monitor_only',
      providerApiRequired: false,
      safetyActionCandidateAvailable: true,
      execution_allowed_now: false,
    }));
    expect(result.safetyActionAvailability).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actionType: 'pause_campaign',
        availableAsSafetyCandidate: true,
        providerReadinessRequiredBeforeProviderExecution: true,
        execution_allowed_now: false,
      }),
      expect.objectContaining({
        actionType: 'pause_ad_group',
        availableAsSafetyCandidate: true,
        providerReadinessRequiredBeforeProviderExecution: true,
        execution_allowed_now: false,
      }),
      expect.objectContaining({
        actionType: 'monitor_only',
        availableAsSafetyCandidate: true,
        providerReadinessRequiredBeforeProviderExecution: false,
        execution_allowed_now: false,
      }),
    ]));
  });

  it('requires campaignBudgetId for budget actions and never falls back to campaignId or adGroupId', () => {
    const result = service.build(fixture({
      requestedActions: [{
        ...fixture().requestedActions[0],
        campaignId: '1001',
        adGroupId: '2001',
        campaignBudgetId: null,
        campaignBudgetResourceName: null,
      }],
    }));
    const budget = result.requestedActions[0];

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      campaignBudgetId_missing_actions: 1,
      scale_up_execution_mode: 'monitor_only',
    }));
    expect(budget).toEqual(expect.objectContaining({
      campaignId: '1001',
      adGroupId: '2001',
      campaignBudgetId: null,
      blockers: expect.arrayContaining(['campaignBudgetId_missing_no_fallback']),
      campaignBudgetIdNoFallback: true,
      monitorOnlyDowngradeRequired: true,
      approval_can_be_considered_executable: false,
      execution_allowed_now: false,
    }));
    expect(budget.campaignBudgetId).not.toBe('1001');
    expect(budget.campaignBudgetId).not.toBe('2001');
  });

  it('allows reduce-budget as a safety candidate while still blocking provider execution when readiness is incomplete', () => {
    const result = service.build(fixture({
      accounts: [{
        ...fixture().accounts[0],
        approvedForProviderActions: false,
      }],
      requestedActions: [{
        ...fixture().requestedActions[0],
        currentDailyBudgetVnd: 1000000,
        requestedDailyBudgetVnd: 750000,
      }],
    }));

    expect(result.summary).toEqual(expect.objectContaining({
      status: 'blocked',
      scale_up_execution_mode: 'monitor_only',
      provider_actions_ready_for_future_validate_only: 0,
      execution_allowed_now: false,
    }));
    expect(result.requestedActions[0]).toEqual(expect.objectContaining({
      actionType: 'update_campaign_budget',
      budgetDirection: 'reduce',
      status: 'blocked_before_provider_boundary',
      safetyActionCandidateAvailable: true,
      monitorOnlyDowngradeRequired: true,
      blockers: expect.arrayContaining([
        'account.account_mapping.provider_actions_not_approved',
      ]),
      execution_allowed_now: false,
    }));
  });
});
