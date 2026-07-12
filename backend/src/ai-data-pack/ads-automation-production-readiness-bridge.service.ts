import { BadRequestException, Injectable } from '@nestjs/common';
import { AdsAutomationCredentialVaultOnboardingService } from './ads-automation-credential-vault-onboarding.service';
import { ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE } from './ads-automation-production-readiness-bridge.fixture';
import { AdsAutomationFinalGoNoGoGateService } from './ads-automation-final-go-no-go-gate.service';
import type {
  AdsAutomationFinalGoNoGoGateResponse,
} from './contracts/ads-automation-final-go-no-go-gate.contract';
import type {
  AdsAutomationCredentialVaultOnboardingResponse,
} from './contracts/ads-automation-credential-vault-onboarding.contract';
import type {
  AdsAutomationProductionReadinessBridgeGate,
  AdsAutomationProductionReadinessBridgeGateKey,
  AdsAutomationProductionReadinessBridgeInput,
  AdsAutomationProductionReadinessBridgeProvider,
  AdsAutomationProductionReadinessBridgeProviderAccountKind,
  AdsAutomationProductionReadinessBridgeProviderMetadataInput,
  AdsAutomationProductionReadinessBridgeProviderReadiness,
  AdsAutomationProductionReadinessBridgeResponse,
  AdsAutomationProductionReadinessBridgeSafetyGate,
} from './contracts/ads-automation-production-readiness-bridge.contract';

const EXPECTED_PROVIDER_ORDER:
  AdsAutomationProductionReadinessBridgeProviderAccountKind[] = [
    'google_ads_mcc',
    'meta_business_manager',
    'tiktok_business_center',
  ];

const PROVIDER_BY_KIND: Record<
  AdsAutomationProductionReadinessBridgeProviderAccountKind,
  AdsAutomationProductionReadinessBridgeProvider
> = {
  google_ads_mcc: 'google_ads',
  meta_business_manager: 'meta_ads',
  tiktok_business_center: 'tiktok_ads',
};

const FORBIDDEN_CREDENTIAL_FIELDS = [
  'access_token',
  'refresh_token',
  'client_secret',
  'developer_token',
  'app_secret',
  'password',
  'private_key',
  'api_key',
  'raw_credential',
  'credential_material',
  'plaintext_secret',
  'token',
  'secret',
];

const FORBIDDEN_FIELD_KEYS = new Set(
  FORBIDDEN_CREDENTIAL_FIELDS.map((field) => normalizeFieldName(field)),
);

const EXPECTED_LOCAL_PRODUCTION_BLOCKERS = [
  'real_provider_credentials_missing',
  'real_readonly_import_not_run',
  'provider_validateOnly_adapter_not_approved',
  'human_approval_ui_live_flow_not_completed',
  'small_cap_live_test_not_approved',
  'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
  'cashflow_stock_margin_refund_supplier_uncertainty_blocks_scale',
];

@Injectable()
export class AdsAutomationProductionReadinessBridgeService {
  constructor(
    private readonly finalGoNoGoGateService: AdsAutomationFinalGoNoGoGateService,
    private readonly credentialVaultOnboarding:
      AdsAutomationCredentialVaultOnboardingService,
  ) {}

  async build(
    input: AdsAutomationProductionReadinessBridgeInput =
      ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE,
  ): Promise<AdsAutomationProductionReadinessBridgeResponse> {
    const merged = {
      ...ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE,
      ...(input || {}),
    };
    const providerMetadata = input.providerMetadata
      ?? ADS_AUTOMATION_PRODUCTION_READINESS_BRIDGE_FIXTURE.providerMetadata
      ?? [];
    this.assertNoForbiddenCredentialFields(providerMetadata);

    const reportDate = this.isoDate(merged.reportDate, 'reportDate');
    const generatedAt = (merged.now
      ? this.dateTime(merged.now, 'now')
      : new Date()).toISOString();
    const finalGate = merged.finalGoNoGoGateResponse
      ? this.cloneJson(merged.finalGoNoGoGateResponse)
      : await this.finalGoNoGoGateService.build();
    const credentialVaultOnboarding = merged.credentialVaultOnboardingResponse
      ? this.cloneJson(merged.credentialVaultOnboardingResponse)
      : this.credentialVaultOnboarding.build({
        reportDate,
        now: generatedAt,
      });
    const providerOrderValid = this.providerOrderValid(providerMetadata);
    const bridgeBlockers = this.bridgeBlockers({
      providerMetadata,
      providerOrderValid,
      finalGate,
      credentialVaultOnboarding,
    });
    const providers = this.providers(providerMetadata);
    const finalGateReady = finalGate.summary.local_gate_passed === true
      && finalGate.summary.production_ready === false
      && finalGate.summary.execution_allowed_now === false
      && finalGate.localDefects.length === 0;
    const approvalUiReadyDemo = finalGateReady
      && finalGate.foundationEvidence.safe_pending_actions > 0;
    const executionWorkerReadyDemo = finalGateReady
      && finalGate.foundationEvidence.safe_alert_rollback_records > 0
      && finalGate.safety.campaignBudgetId_no_fallback === true;
    const status = bridgeBlockers.length
      ? 'BLOCKED'
      : 'LOCAL_READINESS_BRIDGE_PASS';

    return {
      schemaVersion: 'ads_automation_production_readiness_bridge.v1',
      generatedAt,
      reportDate,
      fixtureMode: merged.fixtureMode || 'custom_local_payload',
      status,
      production_ready: false,
      execution_allowed_now: false,
      real_credential_material_present: false,
      safety: this.safety(),
      expectedProviderOrder: [...EXPECTED_PROVIDER_ORDER],
      forbiddenCredentialFields: [...FORBIDDEN_CREDENTIAL_FIELDS],
      providers,
      providerOrderValid,
      bridgeBlockers,
      blockersForRealProduction: this.blockersForRealProduction(providers),
      next_human_steps: [
        'Human admin configures real provider credentials only inside ERP and the ERP secret store.',
        'Human admin verifies Google Ads MCC first, then Meta Business Manager, then TikTok Business Center.',
        'ERP runs future read-only import and provider validateOnly after credentials exist; Codex must not receive or print credential material.',
        'Human approval, execution preflight, idempotency, kill switch, and a separately approved small-cap test remain required before live execution.',
      ],
      demoReadiness: {
        final_go_no_go_gate_ready: finalGateReady,
        credential_vault_onboarding_ready_demo:
          credentialVaultOnboarding.summary.credential_onboarding_layer_demo_ready,
        credential_vault_database_ready_demo:
          credentialVaultOnboarding.summary.database_readiness_layer_demo_ready,
        credential_vault_endpoint_added: true,
        approval_ui_ready_demo: approvalUiReadyDemo,
        approval_ui_surface: 'existing_ai_marketing_approval_queue',
        execution_worker_simulation_ready_demo: executionWorkerReadyDemo,
        execution_worker_evidence: executionWorkerReadyDemo
          ? 'dry_run_preflight_idempotency_kill_switch_evidence_present'
          : 'missing',
        frontend_bridge_panel_added: false,
        frontend_gap:
          'existing_approval_queue_can_display_pending_actions_bridge_panel_deferred',
      },
      localFoundationEvidence: {
        finalGoNoGoSchemaVersion: finalGate.schemaVersion,
        finalGoNoGoDecision: finalGate.summary.decision,
        finalGoNoGoLocalGatePassed: finalGate.summary.local_gate_passed,
        safe_pending_actions: finalGate.foundationEvidence.safe_pending_actions,
        unsafe_pending_actions:
          finalGate.foundationEvidence.unsafe_pending_actions,
        safe_alert_rollback_records:
          finalGate.foundationEvidence.safe_alert_rollback_records,
        unsafe_alert_rollback_records:
          finalGate.foundationEvidence.unsafe_alert_rollback_records,
      },
      credentialVaultOnboarding: {
        schemaVersion: credentialVaultOnboarding.schemaVersion,
        status: credentialVaultOnboarding.status,
        providerOrderValid: credentialVaultOnboarding.providerOrderValid,
        providers_ready_for_local_demo:
          credentialVaultOnboarding.summary.providers_ready_for_local_demo,
        credential_onboarding_layer_demo_ready:
          credentialVaultOnboarding.summary.credential_onboarding_layer_demo_ready,
        database_readiness_layer_demo_ready:
          credentialVaultOnboarding.summary.database_readiness_layer_demo_ready,
        db_schema_status: credentialVaultOnboarding.databaseReadiness.status,
        db_blockers: credentialVaultOnboarding.databaseReadiness.db_blockers,
        future_db_blockers:
          credentialVaultOnboarding.databaseReadiness.future_db_blockers,
      },
      businessSafetyGates: this.businessSafetyGates(),
      scale_action_mode: 'monitor_only_or_blocked',
      next_recommendation: status === 'LOCAL_READINESS_BRIDGE_PASS'
        ? 'STOP_AFTER_PRODUCTION_READINESS_BRIDGE'
        : 'FIX_LOCAL_PRODUCTION_READINESS_BRIDGE',
      next_codex_prompt: status === 'LOCAL_READINESS_BRIDGE_PASS'
        ? null
        : 'FIX_LOCAL_PRODUCTION_READINESS_BRIDGE',
      markdownPreview: this.markdownPreview({
        reportDate,
        status,
        providerOrderValid,
        bridgeBlockers,
        providers,
      }),
    };
  }

  private providers(
    metadata: AdsAutomationProductionReadinessBridgeProviderMetadataInput[],
  ): AdsAutomationProductionReadinessBridgeProviderReadiness[] {
    const byKind = new Map<
      AdsAutomationProductionReadinessBridgeProviderAccountKind,
      AdsAutomationProductionReadinessBridgeProviderMetadataInput
    >();
    for (const item of metadata) {
      if (!byKind.has(item.provider_account_kind)) {
        byKind.set(item.provider_account_kind, item);
      }
    }

    return EXPECTED_PROVIDER_ORDER.map((kind, index) => {
      const item = byKind.get(kind) || null;
      const provider = PROVIDER_BY_KIND[kind];
      const readinessBlockers = this.unique([
        ...(item?.readiness_blockers || []),
        ...(!item ? [`${kind}_metadata_missing`] : []),
        ...(item && item.provider !== provider
          ? [`${kind}_provider_mismatch`]
          : []),
        ...(item?.secret_reference_handle
          && !item.secret_reference_handle.includes('***')
          ? ['redacted_secret_reference_handle_required']
          : []),
      ]);

      return {
        sequence: (index + 1) as 1 | 2 | 3,
        provider,
        provider_account_kind: kind,
        account_identifier: this.text(item?.account_identifier),
        customer_id: this.text(item?.customer_id),
        login_customer_id: this.text(item?.login_customer_id),
        manager_customer_id: this.text(item?.manager_customer_id),
        business_manager_id: this.text(item?.business_manager_id),
        business_center_id: this.text(item?.business_center_id),
        display_name: this.text(item?.display_name),
        environment: item?.environment || 'future_production_metadata_only',
        oauth_app_config_readiness_state:
          item?.oauth_app_config_readiness_state || 'not_configured',
        required_scopes: this.unique(item?.required_scopes || []),
        storage_backend_type:
          item?.storage_backend_type || 'not_configured',
        secret_reference_handle: this.text(item?.secret_reference_handle),
        owner_role: item?.owner_role || null,
        last_checked_at: item?.last_checked_at
          ? this.dateTime(item.last_checked_at, 'last_checked_at').toISOString()
          : null,
        metadata_only: true,
        redacted_handle_only: true,
        forbidden_fields_detected: [],
        real_credential_material_present: false,
        readiness_blockers: readinessBlockers,
        gates: this.gates(readinessBlockers),
        can_proceed_to_readonly_import: false,
        can_proceed_to_provider_validateOnly: false,
        can_proceed_to_approval: false,
        can_proceed_to_execution_preflight: false,
        can_proceed_to_live_execution: false,
        execution_allowed_now: false,
        production_ready: false,
      };
    });
  }

  private gates(
    providerBlockers: string[],
  ): Record<
    AdsAutomationProductionReadinessBridgeGateKey,
    AdsAutomationProductionReadinessBridgeGate
  > {
    return {
      readonly_import: this.gate(
        'readonly_import',
        'blocked_until_erp_secret_store_credentials',
        [
          ...providerBlockers,
          'real_erp_secret_store_credentials_required',
          'future_erp_readonly_import_approval_required',
        ],
        'configure_real_credentials_inside_erp_secret_store_then_run_readonly_import',
      ),
      provider_validateOnly: this.gate(
        'provider_validateOnly',
        'blocked_until_erp_provider_validateOnly',
        [
          'readonly_import_not_verified_from_real_provider',
          'erp_owned_provider_validateOnly_adapter_not_approved',
        ],
        'run_future_erp_owned_provider_validateOnly_after_readonly_import',
      ),
      approval: this.gate(
        'approval',
        'blocked_until_human_approval_ui_and_policy',
        [
          'provider_validateOnly_not_passed',
          'human_approval_and_policy_evidence_required',
        ],
        'complete_human_approval_ui_and_policy_review',
      ),
      execution_preflight: this.gate(
        'execution_preflight',
        'blocked_until_preflight_evidence',
        [
          'approved_action_missing',
          'policy_allowed_missing',
          'GOOGLE_ADS_PRODUCTION_ENABLED_false_or_absent',
          'idempotency_and_kill_switch_evidence_required',
        ],
        'run_erp_execution_preflight_after_approval_and_policy_evidence',
      ),
      live_execution: this.gate(
        'live_execution',
        'blocked_until_separate_small_cap_live_test',
        [
          'production_ready_false',
          'execution_allowed_now_false',
          'small_cap_live_test_not_human_approved',
        ],
        'schedule_later_human_approved_small_cap_live_test_only_after_all_prior_gates',
      ),
    };
  }

  private gate(
    key: AdsAutomationProductionReadinessBridgeGateKey,
    status: AdsAutomationProductionReadinessBridgeGate['status'],
    blockers: string[],
    nextRequiredAction: string,
  ): AdsAutomationProductionReadinessBridgeGate {
    return {
      key,
      status,
      can_proceed: false,
      blockers: this.unique(blockers),
      next_required_action: nextRequiredAction,
    };
  }

  private bridgeBlockers(input: {
    providerMetadata: AdsAutomationProductionReadinessBridgeProviderMetadataInput[];
    providerOrderValid: boolean;
    finalGate: AdsAutomationFinalGoNoGoGateResponse;
    credentialVaultOnboarding: AdsAutomationCredentialVaultOnboardingResponse;
  }): string[] {
    const kinds = input.providerMetadata.map((item) => item.provider_account_kind);
    const duplicateKinds = kinds.filter((kind, index) => kinds.indexOf(kind) !== index);
    const missingKinds = EXPECTED_PROVIDER_ORDER.filter((kind) => !kinds.includes(kind));
    const providerMismatch = input.providerMetadata
      .filter((item) => PROVIDER_BY_KIND[item.provider_account_kind] !== item.provider)
      .map((item) => `${item.provider_account_kind}_provider_mismatch`);
    const unredactedHandles = input.providerMetadata
      .filter((item) => item.secret_reference_handle && !item.secret_reference_handle.includes('***'))
      .map((item) => `${item.provider_account_kind}_redacted_handle_missing`);
    const invalidDates = input.providerMetadata.flatMap((item) => {
      if (!item.last_checked_at) return [];
      const parsed = new Date(item.last_checked_at);
      return Number.isNaN(parsed.getTime())
        ? [`${item.provider_account_kind}_last_checked_at_invalid`]
        : [];
    });
    const finalGateBlockers = [
      ...(input.finalGate.summary.local_gate_passed ? [] : ['final_go_no_go_gate_not_ready']),
      ...(input.finalGate.summary.production_ready === false ? [] : ['final_go_no_go_production_ready_not_false']),
      ...(input.finalGate.summary.execution_allowed_now === false ? [] : ['final_go_no_go_execution_allowed_now_not_false']),
      ...input.finalGate.localDefects.map((defect) => `final_go_no_go.${defect}`),
    ];
    const credentialVaultBlockers = [
      ...(input.credentialVaultOnboarding.summary.credential_onboarding_layer_demo_ready
        ? []
        : ['credential_vault_onboarding_not_demo_ready']),
      ...(input.credentialVaultOnboarding.summary.database_readiness_layer_demo_ready
        ? []
        : ['credential_vault_database_not_demo_ready']),
      ...input.credentialVaultOnboarding.blockers.map((blocker) =>
        `credential_vault.${blocker}`),
    ];

    return this.unique([
      ...(!input.providerOrderValid ? ['provider_order_invalid'] : []),
      ...duplicateKinds.map((kind) => `${kind}_metadata_duplicate`),
      ...missingKinds.map((kind) => `${kind}_metadata_missing`),
      ...providerMismatch,
      ...unredactedHandles,
      ...invalidDates,
      ...finalGateBlockers,
      ...credentialVaultBlockers,
    ]);
  }

  private blockersForRealProduction(
    providers: AdsAutomationProductionReadinessBridgeProviderReadiness[],
  ): string[] {
    return this.unique([
      ...EXPECTED_LOCAL_PRODUCTION_BLOCKERS,
      ...providers.flatMap((provider) => provider.readiness_blockers),
      ...providers.flatMap((provider) => Object.values(provider.gates)
        .flatMap((gate) => gate.blockers)),
    ]);
  }

  private businessSafetyGates():
    AdsAutomationProductionReadinessBridgeSafetyGate[] {
    const uncertain = (
      key: AdsAutomationProductionReadinessBridgeSafetyGate['key'],
      evidence: string,
    ): AdsAutomationProductionReadinessBridgeSafetyGate => ({
      key,
      state: 'uncertain_blocks_scale',
      scale_action_mode: 'monitor_only_or_blocked',
      evidence,
    });
    const demoSafe = (
      key: AdsAutomationProductionReadinessBridgeSafetyGate['key'],
      evidence: string,
    ): AdsAutomationProductionReadinessBridgeSafetyGate => ({
      key,
      state: 'local_demo_safe_but_live_blocked',
      scale_action_mode: 'monitor_only_or_blocked',
      evidence,
    });

    return [
      demoSafe('gross_margin', 'Local demo has margin evidence, but real import still must verify it before scale.'),
      demoSafe('contribution_profit', 'Local demo has contribution-profit evidence, but live scale remains blocked.'),
      uncertain('cash_conversion', 'Real cash conversion and working-capital health are not proven by credential metadata.'),
      uncertain('stock_coverage', 'Real stock coverage must be fresh before any scale-up recommendation can execute.'),
      uncertain('supplier_reliability', 'Supplier reliability must be fresh before any scale-up recommendation can execute.'),
      uncertain('fulfillment_capacity', 'Fulfillment capacity must be fresh before any scale-up recommendation can execute.'),
      uncertain('return_refund_risk', 'Return, cancel, and refund risk must be fresh before any scale-up recommendation can execute.'),
      uncertain('data_freshness', 'Real provider import freshness and coverage are not available in this repo-local bridge.'),
      uncertain('daily_loss_limit', 'Daily loss-limit evidence is required before any future execution.'),
      uncertain('monthly_loss_limit', 'Monthly loss-limit evidence is required before any future execution.'),
    ];
  }

  private providerOrderValid(
    metadata: AdsAutomationProductionReadinessBridgeProviderMetadataInput[],
  ): boolean {
    const actual = metadata.map((item) => item.provider_account_kind);
    return actual.length === EXPECTED_PROVIDER_ORDER.length
      && actual.every((kind, index) => kind === EXPECTED_PROVIDER_ORDER[index]);
  }

  private assertNoForbiddenCredentialFields(value: unknown): void {
    const matches = this.findForbiddenCredentialFields(value);
    if (matches.length) {
      throw new BadRequestException(
        `forbidden credential metadata fields rejected: ${matches.join(', ')}`,
      );
    }
  }

  private findForbiddenCredentialFields(
    value: unknown,
    path = 'providerMetadata',
  ): string[] {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) =>
        this.findForbiddenCredentialFields(item, `${path}[${index}]`));
    }

    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, child]) => {
        const currentPath = `${path}.${key}`;
        const normalized = normalizeFieldName(key);
        const keyMatches = FORBIDDEN_FIELD_KEYS.has(normalized)
          ? [currentPath]
          : [];
        return [
          ...keyMatches,
          ...this.findForbiddenCredentialFields(child, currentPath),
        ];
      },
    );
  }

  private safety(): AdsAutomationProductionReadinessBridgeResponse['safety'] {
    return {
      read_only: true,
      dry_run: true,
      local_only: true,
      report_only: true,
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
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      direct_google_ads_api_call: false,
      provider_mutation_used: false,
      campaignBudgetId_no_fallback: true,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
      erp_only_future_validator_approver_executor: true,
    };
  }

  private markdownPreview(input: {
    reportDate: string;
    status: AdsAutomationProductionReadinessBridgeResponse['status'];
    providerOrderValid: boolean;
    bridgeBlockers: string[];
    providers: AdsAutomationProductionReadinessBridgeProviderReadiness[];
  }): string {
    return [
      '# Ads Automation Production Readiness Bridge',
      `Report date: ${input.reportDate}`,
      `Status: ${input.status}`,
      `Provider order valid: ${input.providerOrderValid}`,
      `Providers: ${input.providers.map((provider) => provider.provider_account_kind).join(' -> ')}`,
      `Bridge blockers: ${this.joinOrNone(input.bridgeBlockers)}`,
      'Production ready: false',
      'Execution allowed now: false',
      'Real credential material present: false',
      'Provider/API calls: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
      'Scale action mode: monitor_only_or_blocked until real cashflow, stock, margin, refund, supplier, freshness, and loss-limit evidence is safe.',
    ].join('\n');
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

  private cloneJson<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}

function normalizeFieldName(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
