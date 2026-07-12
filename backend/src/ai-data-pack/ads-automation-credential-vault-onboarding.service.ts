import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ApiTokenService } from '../api-token/api-token.service';
import { encryptToken, hashToken } from '../api-token/crypto.util';
import { redactSecrets } from '../common/utils/secret-redaction.util';
import { ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE } from './ads-automation-credential-vault-onboarding.fixture';
import type {
  AdsAutomationCredentialVaultAuditAction,
  AdsAutomationCredentialVaultDatabaseReadiness,
  AdsAutomationCredentialVaultDbCollectionReadiness,
  AdsAutomationCredentialVaultDbSchemaStatus,
  AdsAutomationCredentialVaultOnboardingInput,
  AdsAutomationCredentialVaultOnboardingResponse,
  AdsAutomationCredentialVaultProvider,
  AdsAutomationCredentialVaultProviderPlatform,
  AdsAutomationCredentialVaultProviderProfileInput,
  AdsAutomationCredentialVaultProviderReadiness,
  AdsAutomationCredentialVaultSecretStorageEvidence,
} from './contracts/ads-automation-credential-vault-onboarding.contract';

const EXPECTED_PROVIDER_ORDER: AdsAutomationCredentialVaultProvider[] = [
  'google_ads_mcc',
  'meta_business_manager',
  'tiktok_business_center',
];

const PLATFORM_BY_PROVIDER: Record<
  AdsAutomationCredentialVaultProvider,
  AdsAutomationCredentialVaultProviderPlatform
> = {
  google_ads_mcc: 'google_ads',
  meta_business_manager: 'meta_ads',
  tiktok_business_center: 'tiktok_ads',
};

const FORBIDDEN_CREDENTIAL_METADATA_FIELDS = [
  'access_token',
  'refresh_token',
  'client_secret',
  'developer_token',
  'app_secret',
  'password',
  'private_key',
  'api_key',
  'authorization',
  'oauth_code',
  'provider_config_enc',
  'token_enc',
  'token_hash',
  'raw_credential',
  'credential_material',
  'plaintext_secret',
  'token',
  'secret',
];

const FORBIDDEN_METADATA_KEYS = new Set(
  FORBIDDEN_CREDENTIAL_METADATA_FIELDS.map((field) => normalizeFieldName(field)),
);

const FUTURE_DB_BLOCKERS = [
  'meta_business_manager_provider_execution_log_collection_not_implemented_for_future_live_provider',
  'tiktok_business_center_provider_execution_log_collection_not_implemented_for_future_live_provider',
  'real_provider_credential_profile_migration_not_run',
  'real_secret_backend_not_configured',
];

@Injectable()
export class AdsAutomationCredentialVaultOnboardingService {
  constructor(
    @Optional() private readonly apiTokenService?: ApiTokenService,
  ) {}

  build(
    input: AdsAutomationCredentialVaultOnboardingInput =
      ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE,
  ): AdsAutomationCredentialVaultOnboardingResponse {
    const merged = {
      ...ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE,
      ...(input || {}),
    };
    const providerProfiles = input.providerProfiles
      ?? ADS_AUTOMATION_CREDENTIAL_VAULT_ONBOARDING_FIXTURE.providerProfiles
      ?? [];

    this.assertKnownProviders(providerProfiles);
    this.assertNoForbiddenCredentialMetadata(providerProfiles);

    const reportDate = this.isoDate(merged.reportDate, 'reportDate');
    const generatedAt = (merged.now
      ? this.dateTime(merged.now, 'now')
      : new Date()).toISOString();
    const providerOrderValid = this.providerOrderValid(providerProfiles);
    const duplicateProviders = this.duplicateProviders(providerProfiles);
    const providers = this.providerReadiness(providerProfiles, {
      includeLocalEncryptionProbe: merged.includeLocalEncryptionProbe !== false,
    });
    const databaseReadiness = this.databaseReadiness();
    const blockers = this.localBlockers({
      providerProfiles,
      providerOrderValid,
      duplicateProviders,
      providers,
      databaseReadiness,
    });
    const status = blockers.length
      ? 'BLOCKED'
      : 'LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY';
    const credentialReadyCount = providers.filter((provider) => (
      provider.credential_profile_status === 'metadata_profile_ready'
      && (
        provider.secret_storage_status === 'local_encryption_probe_ready'
        || provider.secret_storage_status === 'secret_reference_placeholder_ready'
      )
    )).length;
    const demoReady = status === 'LOCAL_CREDENTIAL_ONBOARDING_DEMO_READY'
      && credentialReadyCount === EXPECTED_PROVIDER_ORDER.length;

    return {
      schemaVersion: 'ads_automation_credential_vault_onboarding.v1',
      generatedAt,
      reportDate,
      fixtureMode: merged.fixtureMode || 'custom_local_payload',
      status,
      expectedProviderOrder: [...EXPECTED_PROVIDER_ORDER],
      providerOrderValid,
      forbiddenCredentialMetadataFields: [...FORBIDDEN_CREDENTIAL_METADATA_FIELDS],
      providers,
      databaseReadiness,
      summary: {
        credential_onboarding_layer_demo_ready: demoReady,
        database_readiness_layer_demo_ready:
          databaseReadiness.status !== 'blocked_missing_required_collection',
        providers_ready_for_local_demo: credentialReadyCount,
        provider_count: providers.length,
        read_only_import_allowed: false,
        validate_only_allowed: false,
        approval_allowed: false,
        execution_preflight_allowed: false,
        live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
      },
      safety: {
        local_only: true,
        dry_run: true,
        fixture_or_payload_only: true,
        plaintext_secrets_added: false,
        plaintext_secret_returned: false,
        encrypted_payload_returned: false,
        real_credential_material_present: false,
        provider_api_used: false,
        provider_api_called: false,
        google_ads_api_used: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        execution_allowed_now: false,
        production_ready: false,
        erp_only_future_validator_approver_executor: true,
      },
      bridgeIntegration: {
        bridge_can_report_credential_layer_demo_ready: demoReady,
        production_readiness_bridge_should_remain_blocked_for_live: true,
        production_ready: false,
        execution_allowed_now: false,
      },
      blockers,
      blockersForRealProduction: this.blockersForRealProduction(providers, databaseReadiness),
      markdownPreview: this.markdownPreview({
        reportDate,
        status,
        providerOrderValid,
        providers,
        databaseReadiness,
        blockers,
      }),
    };
  }

  private providerReadiness(
    profiles: AdsAutomationCredentialVaultProviderProfileInput[],
    options: { includeLocalEncryptionProbe: boolean },
  ): AdsAutomationCredentialVaultProviderReadiness[] {
    const byProvider = new Map<
      AdsAutomationCredentialVaultProvider,
      AdsAutomationCredentialVaultProviderProfileInput
    >();
    for (const profile of profiles) {
      if (!byProvider.has(profile.provider)) {
        byProvider.set(profile.provider, profile);
      }
    }

    return EXPECTED_PROVIDER_ORDER.map((provider, index) => {
      const profile = byProvider.get(provider) || null;
      const profileId = this.profileId(provider, profile);
      const secretStorage = this.secretStorageEvidence(provider, profileId, profile, options);
      const metadata = redactSecrets(profile?.metadata || {}) as Record<string, unknown>;
      const providerBlockers = this.unique([
        ...(!profile ? [`${provider}_profile_metadata_missing`] : []),
        ...(!secretStorage.secret_reference_handle
          ? [`${provider}_secret_reference_handle_missing`]
          : []),
        ...this.futureProviderDbBlockers(provider),
      ]);

      return {
        sequence: (index + 1) as 1 | 2 | 3,
        provider,
        platform: PLATFORM_BY_PROVIDER[provider],
        credential_profile_status: profile
          ? 'metadata_profile_ready'
          : 'metadata_profile_missing',
        secret_storage_status: profile
          ? secretStorage.secret_material_input_accepted_for_encryption_probe
            ? 'local_encryption_probe_ready'
            : 'secret_reference_placeholder_ready'
          : 'blocked_missing_profile_metadata',
        db_schema_status: provider === 'google_ads_mcc'
          ? 'local_contract_ready'
          : 'local_contract_ready_with_future_blockers',
        read_only_import_allowed: false,
        validate_only_allowed: false,
        approval_allowed: false,
        execution_preflight_allowed: false,
        live_execution_allowed: false,
        execution_allowed_now: false,
        production_ready: false,
        profile_id: profileId,
        account_identifier: this.text(profile?.account_identifier),
        customer_id: this.text(profile?.customer_id),
        login_customer_id: this.text(profile?.login_customer_id),
        manager_customer_id: this.text(profile?.manager_customer_id),
        business_manager_id: this.text(profile?.business_manager_id),
        business_center_id: this.text(profile?.business_center_id),
        display_name: this.text(profile?.display_name),
        owner_user_id: this.text(profile?.owner_user_id),
        owner_role: this.text(profile?.owner_role),
        redacted_metadata: metadata,
        secret_reference_handle: secretStorage.secret_reference_handle,
        secret_storage_evidence: secretStorage,
        audit_intents: profile
          ? [
            this.auditIntent(profile.requested_action || 'create', provider),
            this.auditIntent('validate_readiness', provider),
          ]
          : [],
        blockers: providerBlockers,
      };
    });
  }

  private secretStorageEvidence(
    provider: AdsAutomationCredentialVaultProvider,
    profileId: string,
    profile: AdsAutomationCredentialVaultProviderProfileInput | null,
    options: { includeLocalEncryptionProbe: boolean },
  ): AdsAutomationCredentialVaultSecretStorageEvidence {
    const secretMaterial = profile?.secretMaterial || null;
    const secretText = secretMaterial ? JSON.stringify(secretMaterial) : '';
    const hasSecretMaterial = Boolean(secretText && secretText !== '{}');
    let encryptedPayloadPlaintextFree: boolean | null = null;
    let secretReferenceHandle: string | null = null;

    if (hasSecretMaterial && options.includeLocalEncryptionProbe) {
      const encryptedPayload = encryptToken(secretText);
      const materialValues = Object.values(secretMaterial || {})
        .map((value) => String(value || ''))
        .filter(Boolean);
      encryptedPayloadPlaintextFree = !encryptedPayload.includes(secretText)
        && materialValues.every((value) => !encryptedPayload.includes(value));
      const fingerprint = hashToken(secretText).slice(0, 16);
      secretReferenceHandle =
        `api-token-secret-ref://ads/${provider}/${profileId}/sha256-${fingerprint}/***redacted***`;
    } else if (profile) {
      secretReferenceHandle =
        `api-token-secret-ref://ads/${provider}/${profileId}/pending-secret-backend/***redacted***`;
    }

    return {
      adapter: 'api_token_service_contract',
      api_token_service_available: Boolean(this.apiTokenService),
      api_token_crypto_util_used: true,
      api_token_storage_fields: ['tokenEnc', 'tokenHash', 'providerConfigEnc'],
      decrypt_method_exposed_by_endpoint: false,
      secret_material_input_accepted_for_encryption_probe: hasSecretMaterial
        && options.includeLocalEncryptionProbe,
      plaintext_secret_returned: false,
      encrypted_payload_returned: false,
      encrypted_payload_plaintext_free: encryptedPayloadPlaintextFree,
      secret_reference_handle: secretReferenceHandle,
    };
  }

  private databaseReadiness(): AdsAutomationCredentialVaultDatabaseReadiness {
    const collections: AdsAutomationCredentialVaultDbCollectionReadiness[] = [
      {
        collection: 'api_tokens',
        model: 'ApiToken',
        purpose: 'Encrypted provider credential and provider profile storage through tokenEnc, tokenHash, and providerConfigEnc.',
        status: 'local_contract_ready',
        owner_fields: ['ownerUserId', 'ownerName'],
        idempotency_fields: ['tokenHash', 'provider', 'tokenType', 'adAccountId', 'businessCenterId'],
        required_indexes: [
          this.index('tokenHash_1', { tokenHash: 1 }, false, 'Find existing encrypted credential fingerprints without exposing plaintext.'),
          this.index('provider_1_status_1', { provider: 1, status: 1 }, false, 'List active provider credential profiles.'),
          this.index('adAccountId_1_provider_1', { adAccountId: 1, provider: 1 }, false, 'Resolve account-scoped provider profiles idempotently.'),
          this.index('businessCenterId_1_provider_1', { businessCenterId: 1, provider: 1 }, false, 'Resolve business-manager/business-center profiles idempotently.'),
          this.index('idx_api_token_provider_owner_profile', { provider: 1, tokenType: 1, ownerUserId: 1 }, false, 'Review credential profile ownership.'),
        ],
        db_blockers: [],
      },
      {
        collection: 'api_token_audits',
        model: 'ApiTokenAudit',
        purpose: 'Future create, rotate, and readiness-validation audit trail for credential onboarding.',
        status: 'local_contract_ready',
        owner_fields: ['actorUserId'],
        idempotency_fields: ['tokenId', 'action', 'createdAt'],
        required_indexes: [
          this.index('tokenId_1', { tokenId: 1 }, false, 'Read audit history for one credential profile.'),
          this.index('action_1_createdAt_-1', { action: 1, createdAt: -1 }, false, 'Review credential lifecycle actions by recency.'),
        ],
        db_blockers: [],
      },
      {
        collection: 'google_ads_action_plans',
        model: 'GoogleAdsActionPlan',
        purpose: 'Future imported action plans with unique plan and idempotency keys.',
        status: 'local_contract_ready',
        owner_fields: ['source', 'items.approvedByUserId'],
        idempotency_fields: ['planId', 'idempotencyKeys'],
        required_indexes: [
          this.index('planId_1', { planId: 1 }, true, 'Deduplicate imported plans.'),
          this.index('uniq_google_ads_action_plan_idempotency_key', { idempotencyKeys: 1 }, true, 'Deduplicate action idempotency keys.'),
        ],
        db_blockers: [],
      },
      {
        collection: 'google_ads_action_execution_logs',
        model: 'GoogleAdsActionExecutionLog',
        purpose: 'Future Google Ads execution evidence and idempotency reservation log.',
        status: 'local_contract_ready',
        owner_fields: ['approvedBy', 'executedBy'],
        idempotency_fields: ['planId', 'actionId', 'idempotencyKey'],
        required_indexes: [
          this.index('idx_google_ads_execution_plan_date', { planId: 1, executedAt: -1 }, false, 'Review execution history for one plan.'),
          this.index('uniq_google_ads_reserved_idempotency_key', { idempotencyKey: 1 }, true, 'Reserve execution idempotency keys.'),
        ],
        db_blockers: [],
      },
      {
        collection: 'ai_data_pack_ads_automation_decision_audit_records',
        model: 'AiDataPackAdsAutomationDecisionAuditRecord',
        purpose: 'ERP-local approval decision audit evidence before any future execution.',
        status: 'local_contract_ready',
        owner_fields: ['reviewerUserId', 'reviewerRole'],
        idempotency_fields: ['audit_id', 'idempotency_key', 'approval_id'],
        required_indexes: [
          this.index('uq_ai_data_pack_ads_decision_audit_id', { audit_id: 1 }, true, 'Deduplicate decision audit records.'),
          this.index('uq_ai_data_pack_ads_decision_audit_idempotency', { idempotency_key: 1 }, true, 'Deduplicate decision audit writes.'),
          this.index('idx_ai_data_pack_ads_decision_audit_approval_created', { approval_id: 1, createdAt: -1 }, false, 'Read decision audit history by approval.'),
        ],
        db_blockers: [],
      },
      {
        collection: 'ai_data_pack_ads_automation_execution_preflight_dry_runs',
        model: 'AiDataPackAdsAutomationExecutionPreflightDryRun',
        purpose: 'ERP-local execution preflight, kill-switch, and validateOnly evidence before live execution.',
        status: 'local_contract_ready',
        owner_fields: ['requestedByUserId', 'requestedByRole'],
        idempotency_fields: ['execution_record_id', 'idempotency_key', 'approval_id'],
        required_indexes: [
          this.index('uq_ai_data_pack_ads_exec_preflight_record_id', { execution_record_id: 1 }, true, 'Deduplicate dry-run records.'),
          this.index('uq_ai_data_pack_ads_exec_preflight_idempotency', { idempotency_key: 1 }, true, 'Deduplicate execution preflight attempts.'),
          this.index('idx_ai_data_pack_ads_exec_preflight_approval_created', { approval_id: 1, createdAt: -1 }, false, 'Read preflight history by approval.'),
        ],
        db_blockers: [],
      },
    ];

    return {
      status: 'local_contract_ready_with_future_blockers',
      collections,
      db_blockers: [],
      future_db_blockers: [...FUTURE_DB_BLOCKERS],
    };
  }

  private localBlockers(input: {
    providerProfiles: AdsAutomationCredentialVaultProviderProfileInput[];
    providerOrderValid: boolean;
    duplicateProviders: AdsAutomationCredentialVaultProvider[];
    providers: AdsAutomationCredentialVaultProviderReadiness[];
    databaseReadiness: AdsAutomationCredentialVaultDatabaseReadiness;
  }): string[] {
    const present = input.providerProfiles.map((profile) => profile.provider);
    const missing = EXPECTED_PROVIDER_ORDER.filter((provider) => !present.includes(provider));
    const providerBlockers = input.providers.flatMap((provider) =>
      provider.blockers.filter((blocker) => blocker.endsWith('_profile_metadata_missing')
        || blocker.endsWith('_secret_reference_handle_missing')),
    );

    return this.unique([
      ...(!input.providerOrderValid ? ['provider_order_invalid'] : []),
      ...input.duplicateProviders.map((provider) => `${provider}_profile_duplicate`),
      ...missing.map((provider) => `${provider}_profile_missing`),
      ...providerBlockers,
      ...input.databaseReadiness.db_blockers,
    ]);
  }

  private blockersForRealProduction(
    providers: AdsAutomationCredentialVaultProviderReadiness[],
    databaseReadiness: AdsAutomationCredentialVaultDatabaseReadiness,
  ): string[] {
    return this.unique([
      'real_mcc_bm_bc_credentials_not_entered_in_erp',
      'real_secret_backend_not_configured',
      'human_credential_owner_approval_missing',
      'real_readonly_import_not_run',
      'provider_validateOnly_not_run',
      'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
      'execution_allowed_now_false',
      ...providers.flatMap((provider) => provider.blockers),
      ...databaseReadiness.future_db_blockers,
    ]);
  }

  private assertKnownProviders(
    profiles: AdsAutomationCredentialVaultProviderProfileInput[],
  ): void {
    const allowed = new Set(EXPECTED_PROVIDER_ORDER);
    const unknown = profiles
      .map((profile) => profile.provider)
      .filter((provider) => !allowed.has(provider));
    if (unknown.length) {
      throw new BadRequestException(`unknown credential provider rejected: ${this.unique(unknown).join(', ')}`);
    }
  }

  private assertNoForbiddenCredentialMetadata(
    profiles: AdsAutomationCredentialVaultProviderProfileInput[],
  ): void {
    const matches = profiles.flatMap((profile, index) =>
      this.findForbiddenCredentialMetadataFields(profile, `providerProfiles[${index}]`));
    if (matches.length) {
      throw new BadRequestException(
        `forbidden credential metadata fields rejected: ${this.unique(matches).join(', ')}`,
      );
    }
  }

  private findForbiddenCredentialMetadataFields(
    value: unknown,
    path: string,
  ): string[] {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) =>
        this.findForbiddenCredentialMetadataFields(item, `${path}[${index}]`));
    }

    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      if (key === 'secretMaterial') return [];
      const currentPath = `${path}.${key}`;
      const normalized = normalizeFieldName(key);
      const keyMatches = FORBIDDEN_METADATA_KEYS.has(normalized)
        ? [currentPath]
        : [];
      return [
        ...keyMatches,
        ...this.findForbiddenCredentialMetadataFields(child, currentPath),
      ];
    });
  }

  private providerOrderValid(
    profiles: AdsAutomationCredentialVaultProviderProfileInput[],
  ): boolean {
    const actual = profiles.map((profile) => profile.provider);
    return actual.length === EXPECTED_PROVIDER_ORDER.length
      && actual.every((provider, index) => provider === EXPECTED_PROVIDER_ORDER[index]);
  }

  private duplicateProviders(
    profiles: AdsAutomationCredentialVaultProviderProfileInput[],
  ): AdsAutomationCredentialVaultProvider[] {
    const values = profiles.map((profile) => profile.provider);
    return this.unique(values.filter((provider, index) => values.indexOf(provider) !== index)) as
      AdsAutomationCredentialVaultProvider[];
  }

  private auditIntent(
    action: AdsAutomationCredentialVaultAuditAction,
    provider: AdsAutomationCredentialVaultProvider,
  ) {
    return {
      action,
      provider,
      audit_collection: 'api_token_audits' as const,
      metadata_only: true as const,
      should_persist_in_real_erp: true as const,
      persisted_in_local_demo: false as const,
      plaintext_secret_logged: false as const,
    };
  }

  private futureProviderDbBlockers(
    provider: AdsAutomationCredentialVaultProvider,
  ): string[] {
    if (provider === 'google_ads_mcc') return [];
    return [`${provider}_future_provider_execution_log_collection_not_implemented`];
  }

  private index(
    name: string,
    keys: Record<string, 1 | -1>,
    unique: boolean,
    purpose: string,
  ) {
    return {
      name,
      keys,
      unique,
      present_in_schema: true,
      purpose,
    };
  }

  private markdownPreview(input: {
    reportDate: string;
    status: AdsAutomationCredentialVaultOnboardingResponse['status'];
    providerOrderValid: boolean;
    providers: AdsAutomationCredentialVaultProviderReadiness[];
    databaseReadiness: AdsAutomationCredentialVaultDatabaseReadiness;
    blockers: string[];
  }): string {
    return [
      '# Ads Automation Credential Vault Onboarding',
      `Report date: ${input.reportDate}`,
      `Status: ${input.status}`,
      `Provider order valid: ${input.providerOrderValid}`,
      `Providers: ${input.providers.map((provider) => provider.provider).join(' -> ')}`,
      `Database status: ${input.databaseReadiness.status}`,
      `Local blockers: ${this.joinOrNone(input.blockers)}`,
      `Future DB blockers: ${this.joinOrNone(input.databaseReadiness.future_db_blockers)}`,
      'Read-only import allowed: false',
      'Provider validateOnly allowed: false',
      'Approval allowed: false',
      'Execution preflight allowed: false',
      'Live execution allowed: false',
      'Production ready: false',
      'Execution allowed now: false',
      'Provider/API calls: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
    ].join('\n');
  }

  private profileId(
    provider: AdsAutomationCredentialVaultProvider,
    profile: AdsAutomationCredentialVaultProviderProfileInput | null,
  ): string {
    const value = this.text(profile?.profile_id)
      || this.text(profile?.account_identifier)
      || this.text(profile?.customer_id)
      || this.text(profile?.business_manager_id)
      || this.text(profile?.business_center_id)
      || `${provider}_missing_profile`;
    return value.replace(/[^a-z0-9_-]/gi, '_').slice(0, 96);
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime())
      || parsed.toISOString().slice(0, 10) !== text
    ) {
      throw new BadRequestException(`${field} is invalid`);
    }
    return text;
  }

  private dateTime(value: unknown, field: string): Date {
    const parsed = new Date(value as string | Date);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date-time`);
    }
    return parsed;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private unique(values: string[]): string[] {
    return [
      ...new Set(values.map((value) => String(value || '').trim()).filter(Boolean)),
    ].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}

function normalizeFieldName(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
