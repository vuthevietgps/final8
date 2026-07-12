import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationProviderAccountInput,
  AdsAutomationProviderAccountReadinessInput,
  AdsAutomationProviderAccountReadinessRecord,
  AdsAutomationProviderAccountReadinessResponse,
  AdsAutomationProviderAdapterCapability,
  AdsAutomationProviderAdapterMode,
  AdsAutomationProviderAdapterRegistryEntry,
  AdsAutomationProviderChannel,
  AdsAutomationProviderCredentialMetadataInput,
  AdsAutomationProviderCredentialReadiness,
  AdsAutomationProviderMvpAction,
  AdsAutomationProviderPermissionScope,
  AdsAutomationProviderPlatform,
  AdsAutomationProviderRequestedActionInput,
  AdsAutomationProviderRequestedActionReadiness,
} from './contracts/ads-automation-provider-account-readiness.contract';

const MVP_ACTIONS: AdsAutomationProviderMvpAction[] = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
  'monitor_only',
];

const UNSUPPORTED_CHANNELS: AdsAutomationProviderChannel[] = [
  'performance_max',
  'shopping',
  'display',
  'youtube',
];

const SECRET_FIELD_NAMES = [
  'access_token',
  'refresh_token',
  'client_secret',
  'developer_token',
  'secret',
];

@Injectable()
export class AdsAutomationProviderAccountReadinessService {
  build(
    input: AdsAutomationProviderAccountReadinessInput,
  ): AdsAutomationProviderAccountReadinessResponse {
    this.assertInput(input);
    const reportDate = this.isoDate(input.reportDate, 'reportDate');
    const generatedAt = (input.now ? this.dateTime(input.now, 'now') : new Date()).toISOString();
    const requestedActions = input.requestedActions || [];
    const requiredScopesByAccount = this.requiredScopesByAccount(requestedActions);
    const adapterRegistry = this.adapterRegistry();
    const accountReadiness = input.accounts.map((account) => this.accountReadiness({
      account,
      requiredScopes: requiredScopesByAccount.get(this.accountKey(account)) || [],
      adapterRegistry,
    }));
    const actionReadiness = requestedActions.map((action) => this.actionReadiness({
      action,
      accounts: accountReadiness,
      adapterRegistry,
    }));
    const blockers = this.unique([
      ...accountReadiness.flatMap((account) => account.blockers),
      ...actionReadiness.flatMap((action) => action.blockers),
    ]);
    const warnings = this.unique([
      ...accountReadiness.flatMap((account) => account.warnings),
      ...actionReadiness.flatMap((action) => action.warnings),
    ]);
    const readyProviderActions = actionReadiness.filter(
      (action) => action.status === 'ready_for_future_validate_only'
        && action.providerApiRequired,
    );
    const providerActions = actionReadiness.filter((action) => action.providerApiRequired);
    const monitorOnlyActions = actionReadiness.filter((action) => action.status === 'ready_monitor_only');
    const monitorOnlyDowngrades = actionReadiness.filter((action) => action.monitorOnlyDowngradeRequired);
    const unsupportedActions = actionReadiness.filter((action) =>
      action.blockers.some((blocker) => blocker.startsWith('capability.unsupported_action')),
    );
    const unsupportedChannels = actionReadiness.filter((action) =>
      action.blockers.some((blocker) => blocker.startsWith('capability.unsupported_channel')),
    );
    const missingScopes = actionReadiness.reduce(
      (total, action) => total + action.missingScopes.length,
      0,
    );
    const readyAccounts = accountReadiness.filter((account) => account.canUseForFutureValidateOnly);
    const futureValidateOnlyReady = providerActions.length > 0
      && readyProviderActions.length === providerActions.length;
    const blocked = blockers.length > 0 || !futureValidateOnlyReady;

    return {
      schemaVersion: 'ads_automation_provider_account_readiness.v1',
      generatedAt,
      reportDate,
      safety: {
        read_only: true,
        dry_run: true,
        local_only: true,
        report_only: true,
        fixture_or_payload_only: true,
        adapter_registry_contract_only: true,
        credential_metadata_only: true,
        plaintext_credentials_stored: false,
        persistence_used: false,
        durable_storage_used: false,
        erp_local_persistence_used: false,
        provider_persistence_used: false,
        provider_api_called: false,
        provider_api_used: false,
        google_ads_api_called: false,
        google_ads_api_used: false,
        validateOnly_called: false,
        validate_only_provider_call_used: false,
        live_ads_execution_used: false,
        erp_mutation_used: false,
        payment_mutation_used: false,
        order_mutation_used: false,
        inventory_mutation_used: false,
        campaignBudgetId_no_fallback: true,
        approval_required_for_all_provider_actions: true,
        future_live_execution_allowed: false,
        execution_allowed_now: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: false,
        production_ready: false,
      },
      summary: {
        status: blocked ? 'blocked' : 'ready_for_local_validate_only',
        fixture_mode: input.fixtureMode || 'custom_local_payload',
        adapter_count: adapterRegistry.length,
        registered_adapter_count: adapterRegistry.filter((entry) => entry.registered).length,
        account_count: accountReadiness.length,
        ready_account_count: readyAccounts.length,
        blocked_account_count: accountReadiness.length - readyAccounts.length,
        requested_action_count: actionReadiness.length,
        provider_actions_requested: providerActions.length,
        provider_actions_ready_for_future_validate_only: readyProviderActions.length,
        provider_actions_blocked_before_boundary: providerActions.length - readyProviderActions.length,
        monitor_only_actions_ready: monitorOnlyActions.length,
        unsupported_action_count: unsupportedActions.length,
        unsupported_channel_count: unsupportedChannels.length,
        missing_scope_count: missingScopes,
        missing_account_mapping_count: accountReadiness.filter((account) =>
          account.blockers.some((blocker) => blocker.includes('mapping')),
        ).length,
        plaintext_credential_metadata_rejected_count: accountReadiness.filter((account) =>
          account.credentialReadiness.plaintextCredentialFieldCount > 0,
        ).length,
        campaignBudgetId_missing_actions: actionReadiness.filter((action) =>
          action.blockers.includes('campaignBudgetId_missing_no_fallback'),
        ).length,
        monitor_only_downgrade_count: monitorOnlyDowngrades.length,
        safety_actions_available: 3,
        scale_up_execution_mode: monitorOnlyDowngrades.length || blocked
          ? 'monitor_only'
          : 'pending_validation',
        future_validate_only_contract_ready: futureValidateOnlyReady,
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        next_required_action: blocked
          ? 'resolve_provider_account_readiness'
          : 'review_local_provider_account_readiness',
      },
      adapterRegistry,
      accounts: accountReadiness,
      requestedActions: actionReadiness,
      safetyActionAvailability: [
        {
          actionType: 'pause_campaign',
          availableAsSafetyCandidate: true,
          providerReadinessRequiredBeforeProviderExecution: true,
          execution_allowed_now: false,
          note: 'Pause campaign remains an allowed safety candidate, but provider execution still requires readiness, approval, validate-only evidence, and preflight.',
        },
        {
          actionType: 'pause_ad_group',
          availableAsSafetyCandidate: true,
          providerReadinessRequiredBeforeProviderExecution: true,
          execution_allowed_now: false,
          note: 'Pause ad group remains an allowed safety candidate, but provider execution still requires readiness, approval, validate-only evidence, and preflight.',
        },
        {
          actionType: 'monitor_only',
          availableAsSafetyCandidate: true,
          providerReadinessRequiredBeforeProviderExecution: false,
          execution_allowed_now: false,
          note: 'Monitor-only remains available as the default downgrade while provider/account/scope readiness is incomplete.',
        },
      ],
      blockers,
      warnings,
      markdownPreview: this.markdownPreview({
        reportDate,
        accountReadiness,
        actionReadiness,
        blockers,
      }),
    };
  }

  private adapterRegistry(): AdsAutomationProviderAdapterRegistryEntry[] {
    return [
      {
        platform: 'google_ads',
        provider: 'google',
        adapterKey: 'erp_owned_google_ads_provider_boundary',
        adapterMode: 'contract_only',
        boundaryMode: 'erp_owned_contract_only',
        registered: true,
        capabilityMap: MVP_ACTIONS.map((actionType) => this.capability(actionType, true)),
        unsupportedChannels: [...UNSUPPORTED_CHANNELS],
        unsupportedActionsBlockedByDefault: [
          'create_campaign',
          'delete_resource',
          'auto_publish',
          'performance_max_campaign',
          'shopping_campaign',
          'display_campaign',
          'youtube_campaign',
        ],
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      },
      {
        platform: 'facebook_ads',
        provider: 'facebook',
        adapterKey: 'erp_owned_facebook_ads_provider_boundary',
        adapterMode: 'not_registered',
        boundaryMode: 'erp_owned_contract_only',
        registered: false,
        capabilityMap: MVP_ACTIONS.map((actionType) => this.capability(actionType, false)),
        unsupportedChannels: ['unknown', ...UNSUPPORTED_CHANNELS],
        unsupportedActionsBlockedByDefault: ['all_provider_actions'],
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      },
      {
        platform: 'tiktok_ads',
        provider: 'tiktok',
        adapterKey: 'erp_owned_tiktok_ads_provider_boundary',
        adapterMode: 'not_registered',
        boundaryMode: 'erp_owned_contract_only',
        registered: false,
        capabilityMap: MVP_ACTIONS.map((actionType) => this.capability(actionType, false)),
        unsupportedChannels: ['unknown', ...UNSUPPORTED_CHANNELS],
        unsupportedActionsBlockedByDefault: ['all_provider_actions'],
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
      },
    ];
  }

  private capability(
    actionType: AdsAutomationProviderMvpAction,
    supported: boolean,
  ): AdsAutomationProviderAdapterCapability {
    return {
      actionType,
      supported,
      providerApiRequired: actionType !== 'monitor_only',
      requiresValidateOnlyBeforeExecution: actionType !== 'monitor_only',
      requiredScopes: this.requiredScopes(actionType),
      supportedChannels: actionType === 'monitor_only' ? ['search', 'unknown'] : ['search'],
    };
  }

  private accountReadiness(input: {
    account: AdsAutomationProviderAccountInput;
    requiredScopes: AdsAutomationProviderPermissionScope[];
    adapterRegistry: AdsAutomationProviderAdapterRegistryEntry[];
  }): AdsAutomationProviderAccountReadinessRecord {
    const adapter = this.adapter(input.account.platform, input.adapterRegistry);
    const accountId = this.text(input.account.accountId);
    const customerId = this.customerId(input.account.customerId);
    const loginCustomerId = this.customerId(input.account.loginCustomerId);
    const managerCustomerId = this.customerId(input.account.managerCustomerId);
    const adapterRegistered = input.account.adapterRegistered === true
      && adapter?.registered === true;
    const adapterMode = this.adapterMode(input.account.adapterMode || adapter?.adapterMode);
    const credentialReadiness = this.credentialReadiness(
      input.account.credentialMetadata || null,
      input.requiredScopes,
    );
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!adapter?.registered) blockers.push(`adapter_registry.${input.account.platform}_not_registered`);
    if (!adapterRegistered) blockers.push('adapter_registry.account_adapter_not_registered');
    if (adapterMode !== 'contract_only') blockers.push('adapter_registry.adapter_mode_not_contract_only');
    if (!accountId) blockers.push('account_mapping.accountId_missing');
    if (!customerId) blockers.push('account_mapping.customerId_missing_or_malformed');
    if (!this.text(input.account.erpAccountMappingId)) blockers.push('account_mapping.erpAccountMappingId_missing');
    if (input.account.isActive !== true) blockers.push('account_mapping.account_not_active');
    if (input.account.approvedForProviderActions !== true) {
      blockers.push('account_mapping.provider_actions_not_approved');
    }
    if (input.account.approvedForReadOnlyImport !== true) {
      blockers.push('account_mapping.readonly_import_not_approved');
    }
    if (input.account.googleAdsProductionEnabled === true) {
      blockers.push('GOOGLE_ADS_PRODUCTION_ENABLED_must_be_false_or_absent');
    }
    if (credentialReadiness.status !== 'ready') {
      blockers.push(`credential_readiness.${credentialReadiness.status}`);
    }
    for (const scope of credentialReadiness.missingScopes) {
      blockers.push(`permission_scope.${scope}_missing`);
    }
    if (!loginCustomerId && input.account.platform === 'google_ads') {
      warnings.push('loginCustomerId_missing_for_manager_account_review');
    }
    if (!managerCustomerId && input.account.platform === 'google_ads') {
      warnings.push('managerCustomerId_missing_for_manager_account_review');
    }

    const canUse = blockers.length === 0;
    return {
      platform: input.account.platform,
      accountId,
      customerId,
      loginCustomerId,
      managerCustomerId,
      erpAccountMappingId: this.text(input.account.erpAccountMappingId),
      accountName: this.text(input.account.accountName),
      adapterRegistered,
      adapterMode,
      isActive: input.account.isActive === true,
      approvedForProviderActions: input.account.approvedForProviderActions === true,
      approvedForReadOnlyImport: input.account.approvedForReadOnlyImport === true,
      credentialReadiness,
      requiredScopes: [...input.requiredScopes],
      blockers: this.unique(blockers),
      warnings: this.unique(warnings),
      canUseForReadOnlyImport: canUse,
      canUseForFutureValidateOnly: canUse,
      canUseForFutureLiveExecution: false,
      execution_allowed_now: false,
    };
  }

  private actionReadiness(input: {
    action: AdsAutomationProviderRequestedActionInput;
    accounts: AdsAutomationProviderAccountReadinessRecord[];
    adapterRegistry: AdsAutomationProviderAdapterRegistryEntry[];
  }): AdsAutomationProviderRequestedActionReadiness {
    const action = input.action;
    const actionType = this.text(action.actionType) || 'unknown';
    const mvpAction = MVP_ACTIONS.includes(actionType as AdsAutomationProviderMvpAction)
      ? actionType as AdsAutomationProviderMvpAction
      : null;
    const adapter = this.adapter(action.platform, input.adapterRegistry);
    const accountId = this.text(action.accountId);
    const customerId = this.customerId(action.customerId);
    const account = this.findAccount(input.accounts, accountId, customerId, action.platform);
    const channel = this.channel(action.channel);
    const requiredScopes = mvpAction ? this.requiredScopes(mvpAction) : [];
    const grantedScopes = account?.credentialReadiness.grantedScopes || [];
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
    const campaignBudgetId = this.text(action.campaignBudgetId);
    const targetStatus = this.text(action.targetStatus);
    const budgetDirection = this.budgetDirection(action);
    const providerApiRequired = mvpAction ? mvpAction !== 'monitor_only' : true;
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!mvpAction) blockers.push(`capability.unsupported_action.${actionType}`);
    if (!adapter?.registered) blockers.push(`adapter_registry.${action.platform}_not_registered`);
    if (providerApiRequired && adapter?.registered && !adapter.capabilityMap.some((capability) =>
      capability.actionType === mvpAction && capability.supported,
    )) {
      blockers.push(`capability.unsupported_action.${actionType}`);
    }
    if (providerApiRequired && channel !== 'search') {
      blockers.push(`capability.unsupported_channel.${channel}`);
    }
    if (providerApiRequired && !account) {
      blockers.push('account_mapping.account_not_found_for_action');
    }
    if (providerApiRequired && account) {
      blockers.push(...account.blockers.map((blocker) => `account.${blocker}`));
    }
    for (const scope of missingScopes) {
      blockers.push(`permission_scope.${scope}_missing`);
    }

    if (mvpAction === 'update_campaign_budget') {
      if (!campaignBudgetId) blockers.push('campaignBudgetId_missing_no_fallback');
      if (!this.positiveNumber(action.requestedDailyBudgetVnd)) {
        blockers.push('requestedDailyBudgetVnd_missing_or_invalid');
      }
    }
    if (mvpAction === 'pause_campaign') {
      if (!this.text(action.campaignId)) blockers.push('campaignId_missing');
      if (targetStatus !== 'PAUSED') blockers.push('targetStatus_must_be_PAUSED');
    }
    if (mvpAction === 'pause_ad_group') {
      if (!this.text(action.adGroupId)) blockers.push('adGroupId_missing');
      if (targetStatus !== 'PAUSED') blockers.push('targetStatus_must_be_PAUSED');
    }
    if (mvpAction === 'monitor_only' && blockers.length) {
      warnings.push('monitor_only_ignores_provider_boundary_blockers');
    }

    const uniqueBlockers = providerApiRequired ? this.unique(blockers) : [];
    const monitorOnlyDowngradeRequired = providerApiRequired
      && mvpAction === 'update_campaign_budget'
      && uniqueBlockers.length > 0;
    const status = !providerApiRequired
      ? 'ready_monitor_only'
      : uniqueBlockers.length
        ? 'blocked_before_provider_boundary'
        : 'ready_for_future_validate_only';
    const safetyActionCandidateAvailable = !providerApiRequired
      || mvpAction === 'pause_campaign'
      || mvpAction === 'pause_ad_group'
      || budgetDirection === 'reduce';

    return {
      actionId: this.requiredText(action.actionId, 'requestedActions.actionId'),
      sourcePendingActionId: this.text(action.sourcePendingActionId),
      approvalId: this.text(action.approvalId),
      platform: action.platform,
      channel,
      actionType,
      accountId,
      customerId,
      campaignId: this.text(action.campaignId),
      adGroupId: this.text(action.adGroupId),
      campaignBudgetId,
      campaignBudgetResourceName: this.text(action.campaignBudgetResourceName),
      budgetDirection,
      status,
      requiredScopes,
      missingScopes,
      blockers: uniqueBlockers,
      warnings: this.unique(warnings),
      providerApiRequired,
      validateOnlyRequiredBeforeExecution: providerApiRequired,
      monitorOnlyDowngradeRequired,
      safetyActionCandidateAvailable,
      campaignBudgetIdNoFallback: true,
      approval_can_be_considered_executable: false,
      execution_allowed_now: false,
      next_required_action: status === 'ready_for_future_validate_only'
        ? 'review_future_validate_only_contract'
        : status === 'ready_monitor_only'
          ? 'use_monitor_only_safety_action'
          : monitorOnlyDowngradeRequired
            ? 'monitor_only_until_provider_readiness_resolved'
            : 'resolve_provider_account_readiness',
    };
  }

  private credentialReadiness(
    metadata: AdsAutomationProviderCredentialMetadataInput | null,
    requiredScopes: AdsAutomationProviderPermissionScope[],
  ): AdsAutomationProviderCredentialReadiness {
    const plaintextFields = this.plaintextCredentialFields(metadata);
    const grantedScopes = this.scopes(metadata?.grantedScopes || []);
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
    const credentialReferenceId = this.text(metadata?.credentialReferenceId);
    const redactedCredentialReference = this.text(metadata?.redactedCredentialReference);
    const oauthConnectionStatus = metadata?.oauthConnectionStatus || 'missing';
    const redactedReferenceSafe = Boolean(
      credentialReferenceId
      && redactedCredentialReference
      && redactedCredentialReference.includes('***'),
    );
    const status = plaintextFields.length
      ? 'plaintext_rejected'
      : redactedReferenceSafe
        ? oauthConnectionStatus
        : 'missing';

    return {
      status,
      credentialReferenceId,
      redactedCredentialReference,
      oauthConnectionStatus,
      grantedScopes,
      missingScopes,
      plaintextCredentialFieldCount: plaintextFields.length,
      metadataOnly: true,
    };
  }

  private requiredScopesByAccount(
    actions: AdsAutomationProviderRequestedActionInput[],
  ): Map<string, AdsAutomationProviderPermissionScope[]> {
    const result = new Map<string, AdsAutomationProviderPermissionScope[]>();
    for (const action of actions || []) {
      const actionType = this.text(action.actionType) as AdsAutomationProviderMvpAction;
      if (!MVP_ACTIONS.includes(actionType)) continue;
      const key = this.actionAccountKey(action);
      const current = result.get(key) || [];
      result.set(key, this.uniqueScopes([...current, ...this.requiredScopes(actionType)]));
    }
    return result;
  }

  private requiredScopes(
    actionType: AdsAutomationProviderMvpAction,
  ): AdsAutomationProviderPermissionScope[] {
    if (actionType === 'update_campaign_budget') {
      return ['ads.readonly', 'ads.validate_only', 'ads.manage_budgets'];
    }
    if (actionType === 'pause_campaign' || actionType === 'pause_ad_group') {
      return ['ads.readonly', 'ads.validate_only', 'ads.pause'];
    }
    return [];
  }

  private findAccount(
    accounts: AdsAutomationProviderAccountReadinessRecord[],
    accountId: string | null,
    customerId: string | null,
    platform: AdsAutomationProviderPlatform,
  ): AdsAutomationProviderAccountReadinessRecord | null {
    return accounts.find((account) =>
      account.platform === platform
      && (
        (accountId && account.accountId === accountId)
        || (customerId && account.customerId === customerId)
      ),
    ) || null;
  }

  private adapter(
    platform: AdsAutomationProviderPlatform,
    adapterRegistry: AdsAutomationProviderAdapterRegistryEntry[],
  ): AdsAutomationProviderAdapterRegistryEntry | null {
    return adapterRegistry.find((entry) => entry.platform === platform) || null;
  }

  private budgetDirection(
    action: AdsAutomationProviderRequestedActionInput,
  ): AdsAutomationProviderRequestedActionReadiness['budgetDirection'] {
    if (action.actionType !== 'update_campaign_budget') return 'not_applicable';
    const requested = Number(action.requestedDailyBudgetVnd);
    const current = Number(action.currentDailyBudgetVnd);
    if (!Number.isFinite(requested) || !Number.isFinite(current)) return 'unchanged';
    if (requested > current) return 'increase';
    if (requested < current) return 'reduce';
    return 'unchanged';
  }

  private plaintextCredentialFields(
    metadata: AdsAutomationProviderCredentialMetadataInput | null,
  ): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const declared = Array.isArray(metadata.plaintextCredentialFieldNames)
      ? metadata.plaintextCredentialFieldNames
      : [];
    const presentKeys = Object.keys(metadata).filter((key) =>
      SECRET_FIELD_NAMES.includes(key.toLowerCase()),
    );
    return this.unique([...declared, ...presentKeys]);
  }

  private scopes(values: unknown[]): AdsAutomationProviderPermissionScope[] {
    const allowed: AdsAutomationProviderPermissionScope[] = [
      'ads.readonly',
      'ads.validate_only',
      'ads.manage_budgets',
      'ads.pause',
    ];
    return this.uniqueScopes(
      (values || []).filter((value): value is AdsAutomationProviderPermissionScope =>
        allowed.includes(value as AdsAutomationProviderPermissionScope),
      ),
    );
  }

  private channel(value: unknown): AdsAutomationProviderChannel {
    const channel = this.text(value) || 'unknown';
    if (['search', 'performance_max', 'shopping', 'display', 'youtube'].includes(channel)) {
      return channel as AdsAutomationProviderChannel;
    }
    return 'unknown';
  }

  private adapterMode(value: unknown): AdsAutomationProviderAdapterMode {
    return value === 'contract_only' ? 'contract_only' : 'not_registered';
  }

  private accountKey(account: AdsAutomationProviderAccountInput): string {
    return [
      account.platform,
      this.text(account.accountId) || '',
      this.customerId(account.customerId) || '',
    ].join(':');
  }

  private actionAccountKey(action: AdsAutomationProviderRequestedActionInput): string {
    return [
      action.platform,
      this.text(action.accountId) || '',
      this.customerId(action.customerId) || '',
    ].join(':');
  }

  private markdownPreview(input: {
    reportDate: string;
    accountReadiness: AdsAutomationProviderAccountReadinessRecord[];
    actionReadiness: AdsAutomationProviderRequestedActionReadiness[];
    blockers: string[];
  }): string {
    return [
      '# Provider Account Readiness',
      `Report date: ${input.reportDate}`,
      `Accounts ready: ${input.accountReadiness.filter((account) => account.canUseForFutureValidateOnly).length}/${input.accountReadiness.length}`,
      `Provider actions ready: ${input.actionReadiness.filter((action) => action.status === 'ready_for_future_validate_only').length}/${input.actionReadiness.filter((action) => action.providerApiRequired).length}`,
      `Monitor-only actions ready: ${input.actionReadiness.filter((action) => action.status === 'ready_monitor_only').length}`,
      `Blockers: ${this.joinOrNone(input.blockers)}`,
      'Safety gates: provider_api_called=false, google_ads_api_called=false, validateOnly_called=false, live_ads_execution_used=false, execution_allowed_now=false, production_ready=false',
    ].join('\n');
  }

  private assertInput(input: AdsAutomationProviderAccountReadinessInput): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('provider account readiness payload is required');
    }
    if (!Array.isArray(input.accounts) || !input.accounts.length) {
      throw new BadRequestException('accounts must be a non-empty array');
    }
    if (!Array.isArray(input.requestedActions)) {
      throw new BadRequestException('requestedActions must be an array');
    }
  }

  private isoDate(value: unknown, field: string): string {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    }
    const parsed = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
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

  private customerId(value: unknown): string | null {
    const text = this.text(value);
    if (!text) return null;
    const digits = text.replace(/\D/g, '');
    return /^\d{10}$/.test(digits) ? digits : null;
  }

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private text(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private positiveNumber(value: unknown): boolean {
    const number = Number(value);
    return Number.isFinite(number) && number > 0;
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private uniqueScopes(
    values: AdsAutomationProviderPermissionScope[],
  ): AdsAutomationProviderPermissionScope[] {
    return [...new Set(values)].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((value) => String(value || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}
