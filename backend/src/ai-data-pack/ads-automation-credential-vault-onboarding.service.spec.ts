import { AdsAutomationCredentialVaultOnboardingService } from './ads-automation-credential-vault-onboarding.service';
import { ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE } from './ads-automation-credential-vault-onboarding.fixture';
import type {
  AdsAutomationCredentialVaultOnboardingInput,
} from './contracts/ads-automation-credential-vault-onboarding.contract';

const FAKE_GOOGLE_REFRESH =
  'FAKE_GOOGLE_REFRESH_MATERIAL_FOR_ENCRYPTION_TEST_ONLY';
const FAKE_META_ACCESS =
  'FAKE_META_ACCESS_MATERIAL_FOR_ENCRYPTION_TEST_ONLY';

function service() {
  return new AdsAutomationCredentialVaultOnboardingService({} as any);
}

function fixture(
  overrides: Partial<AdsAutomationCredentialVaultOnboardingInput> = {},
): AdsAutomationCredentialVaultOnboardingInput {
  return {
    ...ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE,
    providerProfiles:
      ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE.providerProfiles?.map(
        (profile) => ({
          ...profile,
          metadata: { ...(profile.metadata || {}) },
          secretMaterial: { ...(profile.secretMaterial || {}) },
        }),
      ),
    ...overrides,
  };
}

describe('AdsAutomationCredentialVaultOnboardingService', () => {
  it('builds the local credential onboarding readiness profile in the required provider order', () => {
    const result = service().build(fixture());

    expect(result.schemaVersion).toBe('ads_automation_credential_vault_onboarding.v1');
    expect(result.status).toBe('LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY');
    expect(result.expectedProviderOrder).toEqual([
      'google_ads_mcc',
      'meta_business_manager',
      'tiktok_business_center',
    ]);
    expect(result.providers.map((provider) => provider.provider)).toEqual([
      'google_ads_mcc',
      'meta_business_manager',
      'tiktok_business_center',
    ]);
    expect(result.summary).toEqual(expect.objectContaining({
      credential_onboarding_layer_demo_ready: true,
      database_readiness_layer_demo_ready: true,
      providers_ready_for_local_demo: 3,
      read_only_import_allowed: false,
      validate_only_allowed: false,
      approval_allowed: false,
      execution_preflight_allowed: false,
      live_execution_allowed: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
  });

  it('rejects unknown providers before producing readiness output', () => {
    expect(() => service().build(fixture({
      providerProfiles: [
        {
          ...fixture().providerProfiles![0],
          provider: 'unknown_provider' as any,
        },
        ...fixture().providerProfiles!.slice(1),
      ],
    }))).toThrow('unknown credential provider rejected');
  });

  it('rejects credential-like fields in metadata but accepts them only under secretMaterial', () => {
    const accepted = service().build(fixture());
    expect(accepted.status).toBe('LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY');

    expect(() => service().build(fixture({
      providerProfiles: [
        {
          ...fixture().providerProfiles![0],
          metadata: {
            client_secret: 'FORBIDDEN_TEST_VALUE',
          },
        },
        ...fixture().providerProfiles!.slice(1),
      ],
    }))).toThrow('forbidden credential metadata fields rejected');
  });

  it('uses api-token crypto for fake secret material and never returns plaintext or encrypted payloads', () => {
    const result = service().build(fixture());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(FAKE_GOOGLE_REFRESH);
    expect(serialized).not.toContain(FAKE_META_ACCESS);
    expect(serialized).not.toContain('FAKE_TIKTOK_ACCESS_MATERIAL_FOR_ENCRYPTION_TEST_ONLY');
    expect(result.providers[0].secret_storage_evidence).toEqual(expect.objectContaining({
      adapter: 'api_token_service_contract',
      api_token_service_available: true,
      api_token_crypto_util_used: true,
      api_token_storage_fields: ['tokenEnc', 'tokenHash', 'providerConfigEnc'],
      decrypt_method_exposed_by_endpoint: false,
      secret_material_input_accepted_for_encryption_probe: true,
      plaintext_secret_returned: false,
      encrypted_payload_returned: false,
      encrypted_payload_plaintext_free: true,
    }));
    expect(result.providers[0].secret_reference_handle).toContain(
      'api-token-secret-ref://ads/google_ads_mcc',
    );
    expect(result.providers[0].secret_reference_handle).toContain('***redacted***');
  });

  it('keeps all provider/live gates blocked without real ERP credential setup', () => {
    const result = service().build(fixture());

    for (const provider of result.providers) {
      expect(provider).toEqual(expect.objectContaining({
        read_only_import_allowed: false,
        validate_only_allowed: false,
        approval_allowed: false,
        execution_preflight_allowed: false,
        live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
      }));
    }
    expect(result.safety).toEqual(expect.objectContaining({
      provider_api_used: false,
      provider_api_called: false,
      google_ads_api_used: false,
      google_ads_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
    }));
    expect(result.blockersForRealProduction).toEqual(expect.arrayContaining([
      'real_mcc_bm_bc_credentials_not_entered_in_erp',
      'real_secret_backend_not_configured',
      'provider_validateOnly_not_run',
      'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
    ]));
  });

  it('returns database readiness evidence for token storage, audit, profiles, and future execution logs', () => {
    const result = service().build(fixture());
    const byCollection = new Map(
      result.databaseReadiness.collections.map((collection) => [
        collection.collection,
        collection,
      ]),
    );

    expect(result.databaseReadiness.status).toBe(
      'local_contract_ready_with_future_blockers',
    );
    expect(byCollection.get('api_tokens')).toEqual(expect.objectContaining({
      model: 'ApiToken',
      owner_fields: expect.arrayContaining(['ownerUserId', 'ownerName']),
      idempotency_fields: expect.arrayContaining(['tokenHash', 'provider', 'tokenType']),
    }));
    expect(byCollection.get('api_tokens')?.required_indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'tokenHash_1', present_in_schema: true }),
        expect.objectContaining({
          name: 'idx_api_token_provider_owner_profile',
          present_in_schema: true,
        }),
      ]),
    );
    expect(byCollection.get('api_token_audits')).toEqual(expect.objectContaining({
      model: 'ApiTokenAudit',
      owner_fields: ['actorUserId'],
    }));
    expect(byCollection.get('google_ads_action_execution_logs')?.required_indexes)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          name: 'uniq_google_ads_reserved_idempotency_key',
          unique: true,
        }),
      ]));
    expect(byCollection.get('ai_data_pack_ads_automation_execution_preflight_dry_runs'))
      .toEqual(expect.objectContaining({
        owner_fields: expect.arrayContaining(['requestedByUserId', 'requestedByRole']),
        idempotency_fields: expect.arrayContaining(['execution_record_id', 'idempotency_key']),
      }));
    expect(result.databaseReadiness.future_db_blockers).toEqual(expect.arrayContaining([
      'meta_business_manager_provider_execution_log_collection_not_implemented_for_future_live_provider',
      'tiktok_business_center_provider_execution_log_collection_not_implemented_for_future_live_provider',
    ]));
  });

  it('blocks the local demo when provider setup order is wrong', () => {
    const providers = fixture().providerProfiles!;
    const result = service().build(fixture({
      providerProfiles: [providers[1], providers[0], providers[2]],
    }));

    expect(result.status).toBe('BLOCKED');
    expect(result.providerOrderValid).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      'provider_order_invalid',
    ]));
    expect(result.summary.credential_onboarding_layer_demo_ready).toBe(false);
  });
});
