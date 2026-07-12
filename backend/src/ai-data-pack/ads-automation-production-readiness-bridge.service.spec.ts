import { AdsAutomationDecisionDraftPreviewService } from './ads-automation-decision-draft-preview.service';
import { AdsAutomationDecisionReadModelQueryService } from './ads-automation-decision-read-model-query.service';
import { AdsAutomationDecisionService } from './ads-automation-decision.service';
import { AdsAutomationDecisionSourceAdapterService } from './ads-automation-decision-source-adapter.service';
import { AdsAutomationFinalGoNoGoGateService } from './ads-automation-final-go-no-go-gate.service';
import { AdsAutomationFoundationAcceptanceMatrixService } from './ads-automation-foundation-acceptance-matrix.service';
import { AdsAutomationCredentialVaultOnboardingService } from './ads-automation-credential-vault-onboarding.service';
import { AdsAutomationGoogleAdsDryRunReconciliationService } from './ads-automation-google-ads-dry-run-reconciliation.service';
import { AdsAutomationGoogleAdsMockImportDemoService } from './ads-automation-google-ads-mock-import-demo.service';
import { AdsAutomationPendingErpActionNormalizerService } from './ads-automation-pending-erp-action-normalizer.service';
import { AdsAutomationProductionReadinessBridgeService } from './ads-automation-production-readiness-bridge.service';
import { ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE } from './ads-automation-production-readiness-bridge.fixture';
import { AdsAutomationProviderValidateOnlyPlannerService } from './ads-automation-provider-validate-only-planner.service';
import { AdsAutomationReadonlyPlatformImportReadinessService } from './ads-automation-readonly-platform-import-readiness.service';
import type {
  AdsAutomationProductionReadinessBridgeInput,
} from './contracts/ads-automation-production-readiness-bridge.contract';

function buildMockImportService(): AdsAutomationGoogleAdsMockImportDemoService {
  const adapter = new AdsAutomationDecisionSourceAdapterService();
  return new AdsAutomationGoogleAdsMockImportDemoService(
    new AdsAutomationReadonlyPlatformImportReadinessService(),
    new AdsAutomationDecisionReadModelQueryService(adapter),
    new AdsAutomationDecisionService(),
    new AdsAutomationDecisionDraftPreviewService(),
    new AdsAutomationPendingErpActionNormalizerService(),
    new AdsAutomationProviderValidateOnlyPlannerService(),
  );
}

function buildFinalGateService(): AdsAutomationFinalGoNoGoGateService {
  const mockImportService = buildMockImportService();
  const acceptance = new AdsAutomationFoundationAcceptanceMatrixService(
    mockImportService,
    new AdsAutomationGoogleAdsDryRunReconciliationService(mockImportService),
  );

  return new AdsAutomationFinalGoNoGoGateService(acceptance);
}

function buildService(): AdsAutomationProductionReadinessBridgeService {
  return new AdsAutomationProductionReadinessBridgeService(
    buildFinalGateService(),
    new AdsAutomationCredentialVaultOnboardingService({} as any),
  );
}

function fixture(
  overrides: Partial<AdsAutomationProductionReadinessBridgeInput> = {},
): AdsAutomationProductionReadinessBridgeInput {
  return {
    ...ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE,
    providerMetadata:
      ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE.providerMetadata?.map(
        (provider) => ({
          ...provider,
          required_scopes: [...(provider.required_scopes || [])],
          readiness_blockers: [...(provider.readiness_blockers || [])],
        }),
      ),
    ...overrides,
  };
}

describe('AdsAutomationProductionReadinessBridgeService', () => {
  it('builds the local-only production-readiness bridge with ordered redacted provider metadata', async () => {
    const result = await buildService().build(fixture());

    expect(result.schemaVersion).toBe(
      'ads_automation_production_readiness_bridge.v1',
    );
    expect(result.status).toBe('LOCAL_READINESS_BRIDGE_PASS');
    expect(result.expectedProviderOrder).toEqual([
      'google_ads_mcc',
      'meta_business_manager',
      'tiktok_business_center',
    ]);
    expect(result.providers.map((provider) => provider.provider_account_kind))
      .toEqual([
        'google_ads_mcc',
        'meta_business_manager',
        'tiktok_business_center',
      ]);
    expect(result.providerOrderValid).toBe(true);
    expect(result.bridgeBlockers).toEqual([]);
    expect(result.demoReadiness).toEqual(expect.objectContaining({
      credential_vault_onboarding_ready_demo: true,
      credential_vault_database_ready_demo: true,
      credential_vault_endpoint_added: true,
    }));
    expect(result.credentialVaultOnboarding).toEqual(expect.objectContaining({
      schemaVersion: 'ads_automation_credential_vault_onboarding.v1',
      status: 'LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY',
      providerOrderValid: true,
      providers_ready_for_local_demo: 3,
      credential_onboarding_layer_demo_ready: true,
      database_readiness_layer_demo_ready: true,
      db_schema_status: 'local_contract_ready_with_future_blockers',
    }));
    expect(result.providers[0]).toEqual(expect.objectContaining({
      sequence: 1,
      provider: 'google_ads',
      provider_account_kind: 'google_ads_mcc',
      customer_id: '1112223333',
      manager_customer_id: '1112223333',
      metadata_only: true,
      redacted_handle_only: true,
      real_credential_material_present: false,
      can_proceed_to_readonly_import: false,
      can_proceed_to_provider_validateOnly: false,
      can_proceed_to_approval: false,
      can_proceed_to_execution_preflight: false,
      can_proceed_to_live_execution: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(result.providers[1]).toEqual(expect.objectContaining({
      sequence: 2,
      provider: 'meta_ads',
      provider_account_kind: 'meta_business_manager',
      business_manager_id: 'bm_demo_111222333333333',
    }));
    expect(result.providers[2]).toEqual(expect.objectContaining({
      sequence: 3,
      provider: 'tiktok_ads',
      provider_account_kind: 'tiktok_business_center',
      business_center_id: 'bc_demo_444555666777',
    }));
    expect(result.providers.every((provider) =>
      provider.secret_reference_handle?.includes('***'),
    )).toBe(true);
  });

  it('rejects secret-like credential material fields before producing a bridge result', async () => {
    const input = fixture({
      providerMetadata: [
        {
          ...fixture().providerMetadata![0],
          client_secret: 'FORBIDDEN_TEST_VALUE',
          refreshToken: 'FORBIDDEN_TEST_VALUE',
        } as any,
        ...fixture().providerMetadata!.slice(1),
      ],
    });

    await expect(buildService().build(input)).rejects.toThrow(
      'forbidden credential metadata fields rejected',
    );
  });

  it('keeps production, execution, provider API, Google Ads API, validateOnly, and live flags false', async () => {
    const result = await buildService().build(fixture());
    const serialized = JSON.stringify(result);

    expect(result.safety).toEqual(expect.objectContaining({
      credential_metadata_only: true,
      plaintext_secrets_added: false,
      real_credential_material_present: false,
      provider_api_used: false,
      provider_api_called: false,
      google_ads_api_used: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      validate_only_provider_call_used: false,
      live_ads_execution_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(result.production_ready).toBe(false);
    expect(result.execution_allowed_now).toBe(false);
    expect(result.real_credential_material_present).toBe(false);
    expect(serialized).not.toContain('"production_ready":true');
    expect(serialized).not.toContain('"execution_allowed_now":true');
    expect(serialized).not.toContain('"provider_api_called":true');
    expect(serialized).not.toContain('"provider_api_used":true');
    expect(serialized).not.toContain('"google_ads_api_called":true');
    expect(serialized).not.toContain('"google_ads_api_used":true');
    expect(serialized).not.toContain('"validateOnly_called":true');
    expect(serialized).not.toContain('"live_ads_execution_used":true');
  });

  it('blocks read-only import, provider validateOnly, approval, preflight, and live execution until ERP-only real setup exists', async () => {
    const result = await buildService().build(fixture());

    for (const provider of result.providers) {
      expect(provider.gates.readonly_import).toEqual(expect.objectContaining({
        can_proceed: false,
        status: 'blocked_until_erp_secret_store_credentials',
        blockers: expect.arrayContaining([
          'real_erp_secret_store_credentials_required',
          'future_erp_readonly_import_approval_required',
        ]),
      }));
      expect(provider.gates.provider_validateOnly).toEqual(expect.objectContaining({
        can_proceed: false,
        status: 'blocked_until_erp_provider_validateOnly',
        blockers: expect.arrayContaining([
          'readonly_import_not_verified_from_real_provider',
          'erp_owned_provider_validateOnly_adapter_not_approved',
        ]),
      }));
      expect(provider.gates.approval.can_proceed).toBe(false);
      expect(provider.gates.execution_preflight.can_proceed).toBe(false);
      expect(provider.gates.live_execution).toEqual(expect.objectContaining({
        can_proceed: false,
        status: 'blocked_until_separate_small_cap_live_test',
        blockers: expect.arrayContaining([
          'production_ready_false',
          'execution_allowed_now_false',
          'small_cap_live_test_not_human_approved',
        ]),
      }));
    }
    expect(result.blockersForRealProduction).toEqual(expect.arrayContaining([
      'real_provider_credentials_missing',
      'real_readonly_import_not_run',
      'provider_validateOnly_adapter_not_approved',
      'human_approval_ui_live_flow_not_completed',
      'small_cap_live_test_not_approved',
      'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
    ]));
    expect(result.next_human_steps.join(' ')).toContain(
      'inside ERP and the ERP secret store',
    );
  });

  it('keeps scale actions monitor-only or blocked when cashflow, stock, margin, refund, supplier, or freshness evidence is uncertain', async () => {
    const result = await buildService().build(fixture());
    const gatesByKey = new Map(
      result.businessSafetyGates.map((gate) => [gate.key, gate]),
    );

    expect(result.scale_action_mode).toBe('monitor_only_or_blocked');
    for (const key of [
      'cash_conversion',
      'stock_coverage',
      'supplier_reliability',
      'fulfillment_capacity',
      'return_refund_risk',
      'data_freshness',
      'daily_loss_limit',
      'monthly_loss_limit',
    ]) {
      expect(gatesByKey.get(key as any)).toEqual(expect.objectContaining({
        state: 'uncertain_blocks_scale',
        scale_action_mode: 'monitor_only_or_blocked',
      }));
    }
    expect(result.markdownPreview).toContain('monitor_only_or_blocked');
  });

  it('blocks the local bridge when provider metadata is not in the required production setup order', async () => {
    const providers = fixture().providerMetadata!;
    const result = await buildService().build(fixture({
      providerMetadata: [providers[1], providers[0], providers[2]],
    }));

    expect(result.status).toBe('BLOCKED');
    expect(result.providerOrderValid).toBe(false);
    expect(result.bridgeBlockers).toEqual(
      expect.arrayContaining(['provider_order_invalid']),
    );
    expect(result.next_recommendation).toBe(
      'FIX_LOCAL_PRODUCTION_READINESS_BRIDGE',
    );
    expect(result.next_codex_prompt).toBe(
      'FIX_LOCAL_PRODUCTION_READINESS_BRIDGE',
    );
  });
});
