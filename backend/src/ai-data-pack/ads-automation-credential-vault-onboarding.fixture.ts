import type {
  AdsAutomationCredentialVaultOnboardingInput,
} from './contracts/ads-automation-credential-vault-onboarding.contract';

export const ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE:
  AdsAutomationCredentialVaultOnboardingInput = {
    reportDate: '2026-07-06',
    now: '2026-07-06T05:30:00.000Z',
    fixtureMode: 'htx_ads_credential_vault_onboarding_demo',
    includeLocalEncryptionProbe: true,
    providerProfiles: [
      {
        provider: 'google_ads_mcc',
        profile_id: 'ads-credential-profile-google-mcc-demo',
        account_identifier: 'HTX-DEMO-GADS-MCC',
        customer_id: '1112223333',
        login_customer_id: '1112223333',
        manager_customer_id: '1112223333',
        display_name: 'HTX Bach Gia Google Ads MCC - local onboarding demo',
        owner_user_id: 'director-demo-user',
        owner_role: 'director',
        metadata: {
          currency: 'VND',
          timezone: 'Asia/Ho_Chi_Minh',
          api_version: 'v24',
          consent_flow: 'future_erp_only',
        },
        secretMaterial: {
          refresh_token: 'FAKE_GOOGLE_REFRESH_MATERIAL_FOR_ENCRYPTION_TEST_ONLY',
          client_secret: 'FAKE_GOOGLE_CLIENT_SECRET_FOR_ENCRYPTION_TEST_ONLY',
          developer_token: 'FAKE_GOOGLE_DEVELOPER_TOKEN_FOR_ENCRYPTION_TEST_ONLY',
        },
        requested_action: 'create',
      },
      {
        provider: 'meta_business_manager',
        profile_id: 'ads-credential-profile-meta-bm-demo',
        account_identifier: 'HTX-DEMO-META-BM',
        business_manager_id: 'bm_demo_111222333333333',
        display_name: 'HTX Bach Gia Meta Business Manager - local onboarding demo',
        owner_user_id: 'director-demo-user',
        owner_role: 'director',
        metadata: {
          app_review_state: 'future_erp_only',
          account_scope: 'business_manager_readiness',
        },
        secretMaterial: {
          access_token: 'FAKE_META_ACCESS_MATERIAL_FOR_ENCRYPTION_TEST_ONLY',
          app_secret: 'FAKE_META_APP_SECRET_FOR_ENCRYPTION_TEST_ONLY',
        },
        requested_action: 'create',
      },
      {
        provider: 'tiktok_business_center',
        profile_id: 'ads-credential-profile-tiktok-bc-demo',
        account_identifier: 'HTX-DEMO-TIKTOK-BC',
        business_center_id: 'bc_demo_444555666777',
        display_name: 'HTX Bach Gia TikTok Business Center - local onboarding demo',
        owner_user_id: 'director-demo-user',
        owner_role: 'director',
        metadata: {
          oauth_state: 'future_erp_only',
          advertiser_scope: 'business_center_readiness',
        },
        secretMaterial: {
          access_token: 'FAKE_TIKTOK_ACCESS_MATERIAL_FOR_ENCRYPTION_TEST_ONLY',
          refresh_token: 'FAKE_TIKTOK_REFRESH_MATERIAL_FOR_ENCRYPTION_TEST_ONLY',
          app_secret: 'FAKE_TIKTOK_APP_SECRET_FOR_ENCRYPTION_TEST_ONLY',
        },
        requested_action: 'create',
      },
    ],
  };
