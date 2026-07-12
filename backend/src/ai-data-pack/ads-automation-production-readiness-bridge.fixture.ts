import type {
  AdsAutomationProductionReadinessBridgeInput,
} from './contracts/ads-automation-production-readiness-bridge.contract';

export const ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE:
  AdsAutomationProductionReadinessBridgeInput = {
    reportDate: '2026-07-06',
    now: '2026-07-06T05:00:00.000Z',
    fixtureMode: 'htx_ads_production_readiness_bridge_demo',
    providerMetadata: [
      {
        provider: 'google_ads',
        provider_account_kind: 'google_ads_mcc',
        account_identifier: 'HTX-DEMO-GADS-MCC',
        customer_id: '1112223333',
        login_customer_id: '1112223333',
        manager_customer_id: '1112223333',
        display_name: 'HTX Bach Gia Google Ads MCC - redacted demo',
        environment: 'future_production_metadata_only',
        oauth_app_config_readiness_state: 'metadata_ready_redacted',
        required_scopes: [
          'erp.ads.readonly',
          'erp.ads.validate_only',
          'erp.ads.manage_budgets',
          'erp.ads.pause',
        ],
        storage_backend_type: 'erp_secret_store_reference_placeholder',
        secret_reference_handle:
          'erp-secret-ref://ads/google_ads_mcc/HTX-DEMO-GADS-MCC/***redacted***',
        owner_role: 'director',
        last_checked_at: '2026-07-06T05:00:00.000Z',
        readiness_blockers: [
          'real_erp_secret_store_entry_not_configured',
          'human_oauth_consent_not_completed_in_erp',
          'readonly_import_not_enabled_for_real_provider',
          'provider_validateOnly_adapter_not_approved',
        ],
      },
      {
        provider: 'meta_ads',
        provider_account_kind: 'meta_business_manager',
        account_identifier: 'HTX-DEMO-META-BM',
        business_manager_id: 'bm_demo_111222333333333',
        display_name: 'HTX Bach Gia Meta Business Manager - redacted demo',
        environment: 'future_production_metadata_only',
        oauth_app_config_readiness_state: 'not_configured',
        required_scopes: [
          'erp.ads.readonly',
          'erp.ads.validate_only',
        ],
        storage_backend_type: 'erp_secret_store_reference_placeholder',
        secret_reference_handle:
          'erp-secret-ref://ads/meta_business_manager/HTX-DEMO-META-BM/***redacted***',
        owner_role: 'director',
        last_checked_at: '2026-07-06T05:00:00.000Z',
        readiness_blockers: [
          'meta_business_manager_app_config_not_created_in_erp',
          'real_erp_secret_store_entry_not_configured',
          'readonly_import_not_enabled_for_real_provider',
          'provider_validateOnly_adapter_not_registered',
        ],
      },
      {
        provider: 'tiktok_ads',
        provider_account_kind: 'tiktok_business_center',
        account_identifier: 'HTX-DEMO-TIKTOK-BC',
        business_center_id: 'bc_demo_444555666777',
        display_name: 'HTX Bach Gia TikTok Business Center - redacted demo',
        environment: 'future_production_metadata_only',
        oauth_app_config_readiness_state: 'not_configured',
        required_scopes: [
          'erp.ads.readonly',
          'erp.ads.validate_only',
        ],
        storage_backend_type: 'erp_secret_store_reference_placeholder',
        secret_reference_handle:
          'erp-secret-ref://ads/tiktok_business_center/HTX-DEMO-TIKTOK-BC/***redacted***',
        owner_role: 'director',
        last_checked_at: '2026-07-06T05:00:00.000Z',
        readiness_blockers: [
          'tiktok_business_center_app_config_not_created_in_erp',
          'real_erp_secret_store_entry_not_configured',
          'readonly_import_not_enabled_for_real_provider',
          'provider_validateOnly_adapter_not_registered',
        ],
      },
    ],
  };
