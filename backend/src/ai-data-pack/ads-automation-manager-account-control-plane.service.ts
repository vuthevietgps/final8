import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AdsAutomationManagerAccountControlPlaneInput,
  AdsAutomationManagerAccountControlPlaneResponse,
  AdsAutomationManagerAccountType,
  AdsAutomationManagerActionGate,
  AdsAutomationManagerAdGroupInput,
  AdsAutomationManagerAdGroupReadiness,
  AdsAutomationManagerCampaignInput,
  AdsAutomationManagerCampaignReadiness,
  AdsAutomationManagerChannel,
  AdsAutomationManagerChildAccountInput,
  AdsAutomationManagerChildAccountReadiness,
  AdsAutomationManagerCredentialMetadataInput,
  AdsAutomationManagerCredentialReadiness,
  AdsAutomationManagerGateKey,
  AdsAutomationManagerMappingStatus,
  AdsAutomationManagerMvpAction,
  AdsAutomationManagerPendingActionInput,
  AdsAutomationManagerPendingActionReadiness,
  AdsAutomationManagerPermissionScope,
  AdsAutomationManagerProvider,
  AdsAutomationManagerReadiness,
  AdsAutomationManagerSyncStatus,
} from './contracts/ads-automation-manager-account-control-plane.contract';

const MVP_ACTIONS: AdsAutomationManagerMvpAction[] = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
  'monitor_only',
  'supplier_sourcing',
  'product_offer_fix',
  'stop_import_review',
];

const PROVIDER_API_ACTIONS: AdsAutomationManagerMvpAction[] = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
];

const TYPE_BY_PROVIDER: Record<
  AdsAutomationManagerProvider,
  AdsAutomationManagerAccountType
> = {
  google_ads: 'google_ads_mcc',
  meta_ads: 'meta_business_manager',
  tiktok_ads: 'tiktok_business_center',
};

const PROVIDER_BY_TYPE: Record<
  AdsAutomationManagerAccountType,
  AdsAutomationManagerProvider
> = {
  google_ads_mcc: 'google_ads',
  meta_business_manager: 'meta_ads',
  tiktok_business_center: 'tiktok_ads',
};

const REQUIRED_SCOPES_BY_TYPE: Record<
  AdsAutomationManagerAccountType,
  AdsAutomationManagerPermissionScope[]
> = {
  google_ads_mcc: [
    'ads.readonly',
    'ads.validate_only',
    'ads.manage_budgets',
    'ads.pause',
  ],
  meta_business_manager: [
    'business_management',
    'ads_management',
    'ads.readonly',
    'ads.validate_only',
    'ads.pause',
  ],
  tiktok_business_center: [
    'advertiser.read',
    'campaign.read',
    'campaign.write',
    'ads.readonly',
    'ads.validate_only',
  ],
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
  'plaintext_credential',
];

const FORBIDDEN_FIELD_KEYS = new Set(
  FORBIDDEN_CREDENTIAL_FIELDS.map((field) => normalizeFieldName(field)),
);

const BLOCKED_CAPABILITIES = [
  'delete',
  'Performance Max',
  'PMax',
  'Shopping',
  'Display',
  'YouTube',
  'create_live_campaign',
  'auto_publish',
];

const BUSINESS_SAFETY_CHECKS: Array<{
  field: keyof NonNullable<AdsAutomationManagerPendingActionInput['businessSafety']>;
  blocker: string;
}> = [
  { field: 'cashflowSafe', blocker: 'cashflow_safe_missing_or_unsafe' },
  { field: 'grossMarginSafe', blocker: 'gross_margin_safe_missing_or_unsafe' },
  { field: 'contributionProfitSafe', blocker: 'contribution_profit_safe_missing_or_unsafe' },
  { field: 'stockCoverageSafe', blocker: 'stock_coverage_safe_missing_or_unsafe' },
  { field: 'supplierReliabilitySafe', blocker: 'supplier_reliability_safe_missing_or_unsafe' },
  { field: 'fulfillmentCapacitySafe', blocker: 'fulfillment_capacity_safe_missing_or_unsafe' },
  { field: 'refundRiskSafe', blocker: 'refund_risk_safe_missing_or_unsafe' },
  { field: 'dataFreshnessSafe', blocker: 'data_freshness_safe_missing_or_unsafe' },
  { field: 'dailyLossLimitSafe', blocker: 'daily_loss_limit_safe_missing_or_unsafe' },
  { field: 'monthlyLossLimitSafe', blocker: 'monthly_loss_limit_safe_missing_or_unsafe' },
];

@Injectable()
export class AdsAutomationManagerAccountControlPlaneService {
  build(
    input: AdsAutomationManagerAccountControlPlaneInput,
  ): AdsAutomationManagerAccountControlPlaneResponse {
    this.assertInput(input);
    this.assertNoForbiddenCredentialFields(input.managerAccounts);

    const reportDate = this.isoDate(input.reportDate, 'reportDate');
    const generatedAt = (input.now
      ? this.dateTime(input.now, 'now')
      : new Date()).toISOString();
    const managerAccounts = input.managerAccounts.map((manager) =>
      this.managerReadiness(manager));
    const pendingActions = input.pendingActions.map((action) =>
      this.pendingActionReadiness(action, managerAccounts));
    const blockers = this.unique([
      ...managerAccounts.flatMap((manager) => manager.blockers),
      ...pendingActions.flatMap((action) => action.blockers),
    ]);
    const warnings = this.unique([
      ...managerAccounts.flatMap((manager) => manager.warnings),
      ...pendingActions.flatMap((action) => action.warnings),
    ]);
    const childAccounts = managerAccounts.flatMap((manager) => manager.childAccounts);
    const campaigns = childAccounts.flatMap((child) => child.campaigns);
    const adGroups = campaigns.flatMap((campaign) => campaign.adGroups);
    const readyPendingActions = pendingActions.filter((action) =>
      action.status !== 'blocked_before_provider_boundary');
    const status = blockers.length
      ? 'blocked'
      : 'ready_for_future_erp_validateOnly_contract';

    return {
      schemaVersion: 'ads_automation_manager_account_control_plane.v1',
      generatedAt,
      reportDate,
      safety: this.safety(),
      summary: {
        status,
        fixture_mode: input.fixtureMode || 'custom_local_payload',
        manager_account_count: managerAccounts.length,
        child_account_count: childAccounts.length,
        campaign_count: campaigns.length,
        ad_group_count: adGroups.length,
        pending_action_count: pendingActions.length,
        ready_manager_count: managerAccounts.filter((manager) => manager.canUseForFutureValidateOnly).length,
        blocked_manager_count: managerAccounts.filter((manager) => !manager.canUseForFutureValidateOnly).length,
        ready_child_account_count: childAccounts.filter((child) => child.canUseForFutureValidateOnly).length,
        blocked_child_account_count: childAccounts.filter((child) => !child.canUseForFutureValidateOnly).length,
        ready_pending_action_count: readyPendingActions.length,
        blocked_pending_action_count: pendingActions.length - readyPendingActions.length,
        monitor_only_action_count: pendingActions.filter((action) => action.actionType === 'monitor_only').length,
        missing_scope_count: this.sum(managerAccounts.map((manager) =>
          manager.credentialReadiness.missingScopes.length)),
        missing_campaignBudgetId_count: this.missingCampaignBudgetIdCount(campaigns, pendingActions),
        plaintext_credential_metadata_rejected_count: managerAccounts.filter((manager) =>
          manager.credentialReadiness.plaintextCredentialFieldCount > 0).length,
        provider_api_called: false,
        google_ads_api_called: false,
        meta_api_called: false,
        tiktok_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
        production_ready: false,
        scale_up_execution_mode: blockers.length ? 'monitor_only' : 'pending_validation',
        next_required_action: blockers.length
          ? 'resolve_manager_control_plane_blockers'
          : 'review_future_manager_control_plane_contract',
      },
      futureControlIntent: {
        erp_only_future_caller: true,
        manager_credential_controls_only_authorized_children: true,
        provider_discovery_import_validate_execute_adapter_boundary_only: true,
        real_tokens_required_later_in_erp_secret_store: true,
        codex_runner_must_not_receive_credentials: true,
        execution_allowed_now: false,
        production_ready: false,
      },
      adapterBoundaries: this.adapterBoundaries(),
      managerAccounts,
      pendingActions,
      blockers,
      warnings,
      markdownPreview: this.markdownPreview({
        reportDate,
        status,
        managerAccounts,
        pendingActions,
        blockers,
      }),
    };
  }

  private managerReadiness(
    manager: AdsAutomationManagerAccountControlPlaneInput['managerAccounts'][number],
  ): AdsAutomationManagerReadiness {
    const managerAccountType = manager.managerAccountType;
    const provider = manager.provider;
    const requiredScopes = this.uniqueScopes(
      manager.requiredScopes || REQUIRED_SCOPES_BY_TYPE[managerAccountType] || [],
    );
    const credentialReadiness = this.credentialReadiness(
      manager.credentialMetadata || null,
      requiredScopes,
    );
    const childAccounts = (manager.childAccounts || []).map((child) =>
      this.childAccountReadiness(child));
    const blockers = this.unique([
      ...(!this.text(manager.managerAccountId) ? ['manager_account_id_missing'] : []),
      ...(!this.text(manager.managerAccountName) ? ['manager_account_name_missing'] : []),
      ...(PROVIDER_BY_TYPE[managerAccountType] !== provider
        ? [`manager_account_type_provider_mismatch.${managerAccountType}.${provider}`]
        : []),
      ...(TYPE_BY_PROVIDER[provider] !== managerAccountType
        ? [`provider_manager_account_type_mismatch.${provider}.${managerAccountType}`]
        : []),
      ...(credentialReadiness.status === 'ready'
        ? []
        : [`credential_readiness.${credentialReadiness.status}`]),
      ...credentialReadiness.missingScopes.map((scope) => `permission_scope.${scope}_missing`),
      ...(!childAccounts.length ? ['child_accounts_missing'] : []),
      ...childAccounts.flatMap((child) =>
        child.blockers.map((blocker) => `child_account.${blocker}`)),
    ]);
    const warnings = this.unique([
      ...(!this.text(manager.credentialMetadata?.secret_reference_handle)
        ? ['secret_reference_handle_missing']
        : []),
    ]);
    const canUse = blockers.length === 0;

    return {
      provider,
      managerAccountType,
      managerAccountId: this.text(manager.managerAccountId),
      managerAccountName: this.text(manager.managerAccountName),
      credentialReadiness,
      requiredScopes,
      childAccounts,
      controlFlow: this.controlFlow(),
      canDiscoverAuthorizedChildren: canUse,
      canUseForFutureValidateOnly: canUse,
      canUseForFutureExecution: false,
      execution_allowed_now: false,
      production_ready: false,
      blockers,
      warnings,
    };
  }

  private credentialReadiness(
    metadata: AdsAutomationManagerCredentialMetadataInput | null,
    requiredScopes: AdsAutomationManagerPermissionScope[],
  ): AdsAutomationManagerCredentialReadiness {
    const plaintextCredentialFieldNames = this.plaintextCredentialFields(metadata);
    const grantedScopes = this.scopes(metadata?.grantedScopes || []);
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
    const credentialReferenceId = this.text(metadata?.credentialReferenceId);
    const secretReferenceHandle = this.text(metadata?.secret_reference_handle);
    const handleRedacted = Boolean(secretReferenceHandle?.includes('***'));
    const declaredStatus = metadata?.credentialStatus || 'missing';
    const status = plaintextCredentialFieldNames.length
      ? 'plaintext_rejected'
      : declaredStatus === 'ready' && credentialReferenceId && handleRedacted
        ? 'ready'
        : declaredStatus === 'ready'
          ? 'missing'
          : declaredStatus;

    return {
      status,
      credentialReferenceId,
      secret_reference_handle: secretReferenceHandle,
      grantedScopes,
      missingScopes,
      plaintextCredentialFieldCount: plaintextCredentialFieldNames.length,
      metadataOnly: true,
      redacted_handle_only: true,
      real_credential_material_present: false,
      lastCheckedAt: metadata?.lastCheckedAt
        ? this.dateTime(metadata.lastCheckedAt, 'credentialMetadata.lastCheckedAt').toISOString()
        : null,
    };
  }

  private childAccountReadiness(
    child: AdsAutomationManagerChildAccountInput,
  ): AdsAutomationManagerChildAccountReadiness {
    const campaigns = (child.campaigns || []).map((campaign) =>
      this.campaignReadiness(campaign));
    const syncStatus = this.syncStatus(child.syncStatus);
    const blockers = this.unique([
      ...(!this.text(child.childAccountId) ? ['childAccountId_missing'] : []),
      ...(!this.text(child.erpAccountMappingId) ? ['erpAccountMappingId_missing'] : []),
      ...(child.authorizedUnderManager === true ? [] : ['not_authorized_under_manager']),
      ...(child.approvedForReadOnlyImport === true ? [] : ['readonly_import_not_approved']),
      ...(child.approvedForFutureProviderActions === true ? [] : ['future_provider_actions_not_approved']),
      ...(child.active === true ? [] : ['child_account_not_active']),
      ...(syncStatus === 'fresh' ? [] : [`sync_status.${syncStatus}`]),
      ...(!campaigns.length ? ['campaigns_missing'] : []),
      ...campaigns.flatMap((campaign) =>
        campaign.blockers.map((blocker) => `campaign.${blocker}`)),
    ]);
    const canUse = blockers.length === 0;

    return {
      childAccountId: this.text(child.childAccountId),
      childAccountName: this.text(child.childAccountName),
      erpAccountMappingId: this.text(child.erpAccountMappingId),
      authorizedUnderManager: child.authorizedUnderManager === true,
      approvedForReadOnlyImport: child.approvedForReadOnlyImport === true,
      approvedForFutureProviderActions: child.approvedForFutureProviderActions === true,
      active: child.active === true,
      syncStatus,
      lastSyncAt: child.lastSyncAt
        ? this.dateTime(child.lastSyncAt, 'childAccount.lastSyncAt').toISOString()
        : null,
      campaigns,
      canDiscoverReadViaManagerCredential: canUse,
      canUseForFutureValidateOnly: canUse,
      canUseForFutureExecution: false,
      execution_allowed_now: false,
      blockers,
    };
  }

  private campaignReadiness(
    campaign: AdsAutomationManagerCampaignInput,
  ): AdsAutomationManagerCampaignReadiness {
    const adGroups = (campaign.adGroups || []).map((adGroup) =>
      this.adGroupReadiness(adGroup));
    const channel = this.channel(campaign.channel);
    const budgetEvidence = campaign.campaignBudgetEvidence || {};
    const campaignBudgetId = this.text(budgetEvidence.campaignBudgetId);
    const blockers = this.unique([
      ...(!this.text(campaign.campaignId) ? ['campaignId_missing'] : []),
      ...this.unsupportedChannelBlockers(campaign.channel),
      ...(!campaignBudgetId ? ['campaignBudgetId_missing_no_fallback'] : []),
      ...this.mappingBlockers('erp_product', campaign.erpProductMappingStatus),
      ...this.mappingBlockers('supplier', campaign.supplierMappingStatus),
      ...this.mappingBlockers('order_profit', campaign.orderProfitMappingStatus),
      ...this.mappingBlockers('cashflow', campaign.cashflowMappingStatus),
      ...(!adGroups.length ? ['ad_groups_missing'] : []),
      ...adGroups.flatMap((adGroup) =>
        adGroup.blockers.map((blocker) => `ad_group.${blocker}`)),
    ]);

    return {
      campaignId: this.text(campaign.campaignId),
      campaignName: this.text(campaign.campaignName),
      channel,
      status: this.text(campaign.status),
      campaignBudgetEvidence: {
        campaignBudgetId,
        campaignBudgetResourceName: this.text(budgetEvidence.campaignBudgetResourceName),
        evidenceSource: this.text(budgetEvidence.evidenceSource),
        lastVerifiedAt: budgetEvidence.lastVerifiedAt
          ? this.dateTime(budgetEvidence.lastVerifiedAt, 'campaignBudgetEvidence.lastVerifiedAt').toISOString()
          : null,
        campaignBudgetIdNoFallback: true,
      },
      erpProductMappingStatus: this.mappingStatus(campaign.erpProductMappingStatus),
      supplierMappingStatus: this.mappingStatus(campaign.supplierMappingStatus),
      orderProfitMappingStatus: this.mappingStatus(campaign.orderProfitMappingStatus),
      cashflowMappingStatus: this.mappingStatus(campaign.cashflowMappingStatus),
      adGroups,
      controlEligible: blockers.length === 0,
      blockers,
    };
  }

  private adGroupReadiness(
    adGroup: AdsAutomationManagerAdGroupInput,
  ): AdsAutomationManagerAdGroupReadiness {
    const blockers = this.unique([
      ...(!this.text(adGroup.adGroupId) ? ['adGroupId_missing'] : []),
      ...(!this.text(adGroup.erpProductId) ? ['erpProductId_missing'] : []),
      ...(!this.text(adGroup.supplierId) ? ['supplierId_missing'] : []),
      ...this.mappingBlockers('erp_product', adGroup.erpProductMappingStatus),
      ...this.mappingBlockers('supplier', adGroup.supplierMappingStatus),
      ...this.mappingBlockers('profit', adGroup.profitMappingStatus),
      ...this.mappingBlockers('stock', adGroup.stockMappingStatus),
    ]);

    return {
      adGroupId: this.text(adGroup.adGroupId),
      adGroupName: this.text(adGroup.adGroupName),
      erpProductId: this.text(adGroup.erpProductId),
      erpProductName: this.text(adGroup.erpProductName),
      supplierId: this.text(adGroup.supplierId),
      supplierName: this.text(adGroup.supplierName),
      erpProductMappingStatus: this.mappingStatus(adGroup.erpProductMappingStatus),
      supplierMappingStatus: this.mappingStatus(adGroup.supplierMappingStatus),
      profitMappingStatus: this.mappingStatus(adGroup.profitMappingStatus),
      stockMappingStatus: this.mappingStatus(adGroup.stockMappingStatus),
      controlEligible: blockers.length === 0,
      blockers,
    };
  }

  private pendingActionReadiness(
    action: AdsAutomationManagerPendingActionInput,
    managerAccounts: AdsAutomationManagerReadiness[],
  ): AdsAutomationManagerPendingActionReadiness {
    const actionType = this.text(action.actionType) || 'unknown';
    const allowedMvpAction = MVP_ACTIONS.includes(actionType as AdsAutomationManagerMvpAction);
    const providerApiRequired = PROVIDER_API_ACTIONS.includes(actionType as AdsAutomationManagerMvpAction);
    const manager = this.findManager(managerAccounts, action.provider, action.managerAccountId);
    const child = this.findChild(manager, action.childAccountId);
    const campaign = this.findCampaign(child, action.campaignId);
    const adGroup = this.findAdGroup(campaign, action.adGroupId);
    const gates = this.actionGates({
      action,
      actionType,
      providerApiRequired,
      manager,
      child,
      campaign,
      adGroup,
    });
    const blockers = this.unique([
      ...(!allowedMvpAction ? [`capability.unsupported_action.${actionType}`] : []),
      ...this.unsupportedActionBlockers(actionType),
      ...this.unsupportedChannelBlockers(action.channel),
      ...(!manager ? ['manager_account_not_found'] : []),
      ...(!child ? ['child_account_not_found'] : []),
      ...(!campaign ? ['campaign_not_found'] : []),
      ...(providerApiRequired && !adGroup ? ['ad_group_not_found'] : []),
      ...(manager ? manager.blockers.map((blocker) => `manager.${blocker}`) : []),
      ...(child ? child.blockers.map((blocker) => `child_account.${blocker}`) : []),
      ...(campaign ? campaign.blockers.map((blocker) => `campaign.${blocker}`) : []),
      ...(adGroup ? adGroup.blockers.map((blocker) => `ad_group.${blocker}`) : []),
      ...gates.flatMap((gate) => gate.blockers),
    ]);
    const monitorOnlyDowngradeRequired = providerApiRequired && blockers.length > 0;
    const status = actionType === 'monitor_only' && blockers.length === 0
      ? 'ready_monitor_only'
      : blockers.length
        ? 'blocked_before_provider_boundary'
        : 'ready_for_future_erp_validateOnly_contract';

    return {
      actionId: this.requiredText(action.actionId, 'pendingActions.actionId'),
      actionType,
      provider: action.provider,
      managerAccountId: this.text(action.managerAccountId),
      childAccountId: this.text(action.childAccountId),
      campaignId: this.text(action.campaignId),
      adGroupId: this.text(action.adGroupId),
      campaignBudgetId: this.text(action.campaignBudgetId),
      currentDailyBudgetVnd: this.numberOrNull(action.currentDailyBudgetVnd),
      requestedDailyBudgetVnd: this.numberOrNull(action.requestedDailyBudgetVnd),
      status,
      providerApiRequired,
      validateOnlyRequiredBeforeExecution: providerApiRequired,
      allowedMvpAction,
      campaignBudgetIdNoFallback: true,
      monitorOnlyDowngradeRequired,
      approval_can_be_considered_executable: false,
      execution_allowed_now: false,
      production_ready: false,
      gates,
      blockers,
      warnings: [],
      next_required_action: status === 'ready_monitor_only'
        ? 'use_monitor_only_safety_action'
        : status === 'ready_for_future_erp_validateOnly_contract'
          ? 'review_future_erp_validateOnly_contract'
          : 'resolve_manager_control_plane_blockers',
    };
  }

  private actionGates(input: {
    action: AdsAutomationManagerPendingActionInput;
    actionType: string;
    providerApiRequired: boolean;
    manager: AdsAutomationManagerReadiness | null;
    child: AdsAutomationManagerChildAccountReadiness | null;
    campaign: AdsAutomationManagerCampaignReadiness | null;
    adGroup: AdsAutomationManagerAdGroupReadiness | null;
  }): AdsAutomationManagerActionGate[] {
    const actionControlsRequired = input.actionType !== 'monitor_only';
    const managerScopeBlockers = input.providerApiRequired && input.manager
      ? input.manager.credentialReadiness.missingScopes
        .map((scope) => `permission_scope.${scope}_missing`)
      : [];
    const campaignBudgetBlockers = this.campaignBudgetIdBlockers(
      input.action,
      input.actionType,
      input.providerApiRequired,
      input.campaign,
    );
    const approvalBlockers = !actionControlsRequired
      ? []
      : [
        ...(!this.text(input.action.approvalId) ? ['approval_id_missing'] : []),
        ...(input.action.approvalStatus === 'approved' ? [] : ['approval_status_not_approved']),
      ];
    const validateOnlyBlockers = !input.providerApiRequired
      ? []
      : input.action.validateOnlyReadiness === 'ready'
        ? []
        : ['validateOnly_readiness_missing_or_failed'];
    const preflightBlockers = !actionControlsRequired
      ? []
      : input.action.preflightReadiness === 'ready'
        ? []
        : ['execution_preflight_missing_or_failed'];
    const idempotencyBlockers = !actionControlsRequired || this.text(input.action.idempotencyKey)
      ? []
      : ['idempotency_key_missing'];
    const killSwitchBlockers = !actionControlsRequired || input.action.killSwitchArmed === true
      ? []
      : ['kill_switch_not_armed'];
    const cashflowBlockers = !actionControlsRequired
      ? []
      : this.businessSafetyBlockers(input.action.businessSafety || null);

    return [
      this.gate('manager_credential_readiness', input.manager?.canUseForFutureValidateOnly ? [] : [
        ...(input.manager ? input.manager.blockers : ['manager_account_not_found']),
      ]),
      this.gate('child_account_eligibility', input.child?.canUseForFutureValidateOnly ? [] : [
        ...(input.child ? input.child.blockers : ['child_account_not_found']),
      ]),
      this.gate('campaign_ad_group_mapping', (
        input.campaign?.controlEligible
        && (!input.providerApiRequired || input.adGroup?.controlEligible)
      ) ? [] : [
        ...(input.campaign ? input.campaign.blockers : ['campaign_not_found']),
        ...(input.providerApiRequired
          ? input.adGroup ? input.adGroup.blockers : ['ad_group_not_found']
          : []),
      ]),
      this.gate('required_scopes', managerScopeBlockers),
      this.gate('campaignBudgetId_evidence', campaignBudgetBlockers),
      this.gateOrNotRequired('approval', approvalBlockers, actionControlsRequired),
      this.gateOrNotRequired('validateOnly_readiness', validateOnlyBlockers, input.providerApiRequired),
      this.gateOrNotRequired('execution_preflight', preflightBlockers, actionControlsRequired),
      this.gateOrNotRequired('idempotency', idempotencyBlockers, actionControlsRequired),
      this.gateOrNotRequired('kill_switch', killSwitchBlockers, actionControlsRequired),
      this.gateOrNotRequired('cashflow_first_safety', cashflowBlockers, actionControlsRequired),
    ];
  }

  private campaignBudgetIdBlockers(
    action: AdsAutomationManagerPendingActionInput,
    actionType: string,
    providerApiRequired: boolean,
    campaign: AdsAutomationManagerCampaignReadiness | null,
  ): string[] {
    if (!providerApiRequired) return [];
    const actionCampaignBudgetId = this.text(action.campaignBudgetId);
    const campaignCampaignBudgetId = this.text(
      campaign?.campaignBudgetEvidence.campaignBudgetId,
    );
    const blockers: string[] = [];
    if (!actionCampaignBudgetId) blockers.push('campaignBudgetId_missing_no_fallback');
    if (!campaignCampaignBudgetId) blockers.push('campaignBudgetId_evidence_missing_no_fallback');
    if (
      actionType === 'update_campaign_budget'
      && actionCampaignBudgetId
      && campaignCampaignBudgetId
      && actionCampaignBudgetId !== campaignCampaignBudgetId
    ) {
      blockers.push('campaignBudgetId_mismatch_no_campaignId_or_adGroupId_fallback');
    }
    if (actionCampaignBudgetId && actionCampaignBudgetId === this.text(action.campaignId)) {
      blockers.push('campaignBudgetId_must_not_fallback_to_campaignId');
    }
    if (actionCampaignBudgetId && actionCampaignBudgetId === this.text(action.adGroupId)) {
      blockers.push('campaignBudgetId_must_not_fallback_to_adGroupId');
    }
    return blockers;
  }

  private businessSafetyBlockers(
    safety: AdsAutomationManagerPendingActionInput['businessSafety'] | null,
  ): string[] {
    return BUSINESS_SAFETY_CHECKS.flatMap((check) => (
      safety?.[check.field] === true ? [] : [check.blocker]
    ));
  }

  private gate(
    key: AdsAutomationManagerGateKey,
    blockers: string[],
  ): AdsAutomationManagerActionGate {
    const uniqueBlockers = this.unique(blockers);
    return {
      key,
      status: uniqueBlockers.length ? 'blocked' : 'ready',
      blockers: uniqueBlockers,
    };
  }

  private gateOrNotRequired(
    key: AdsAutomationManagerGateKey,
    blockers: string[],
    required: boolean,
  ): AdsAutomationManagerActionGate {
    if (!required) {
      return {
        key,
        status: 'not_required',
        blockers: [],
      };
    }
    return this.gate(key, blockers);
  }

  private adapterBoundaries():
    AdsAutomationManagerAccountControlPlaneResponse['adapterBoundaries'] {
    return ([
      ['google_ads', 'google_ads_mcc'],
      ['meta_ads', 'meta_business_manager'],
      ['tiktok_ads', 'tiktok_business_center'],
    ] as Array<[AdsAutomationManagerProvider, AdsAutomationManagerAccountType]>)
      .map(([provider, managerAccountType]) => ({
        provider,
        managerAccountType,
        boundaryMode: 'erp_owned_contract_only',
        discoveryImportMode: 'mock_fixture_only',
        validateOnlyMode: 'future_erp_adapter_required',
        executionMode: 'future_erp_adapter_required',
        supportedMvpActions: [...MVP_ACTIONS],
        blockedCapabilities: [...BLOCKED_CAPABILITIES],
        provider_api_called: false,
        google_ads_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        execution_allowed_now: false,
      }));
  }

  private controlFlow():
    AdsAutomationManagerReadiness['controlFlow'] {
    return [
      {
        step: 'manager_credential_metadata',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'contract_only',
        note: 'ERP stores only a redacted manager credential reference in this local contract.',
      },
      {
        step: 'discover_authorized_child_accounts',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'blocked_until_future_erp_step',
        note: 'Future ERP adapter may discover only child ad accounts authorized under the manager account.',
      },
      {
        step: 'read_campaigns_and_ad_groups',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'blocked_until_future_erp_step',
        note: 'Future imports must stay inside ERP-owned read/validate adapter boundaries.',
      },
      {
        step: 'map_erp_product_supplier_profit_cashflow',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'contract_only',
        note: 'Product, supplier, order-profit, stock, refund, and cashflow gates are required before scale.',
      },
      {
        step: 'draft_pending_actions',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'contract_only',
        note: 'Only MVP action candidates are modeled; unsupported channels and destructive actions remain blocked.',
      },
      {
        step: 'human_approval',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'blocked_until_future_erp_step',
        note: 'Human approval evidence remains mandatory before future validateOnly or preflight.',
      },
      {
        step: 'provider_validateOnly',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'blocked_until_future_erp_step',
        note: 'This service does not call validateOnly; future ERP provider adapters must do that after approval.',
      },
      {
        step: 'execution_preflight',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'blocked_until_future_erp_step',
        note: 'Idempotency, audit, rollback, and kill switch evidence are required before execution.',
      },
      {
        step: 'future_erp_provider_execution',
        actor: 'erp_only',
        provider_api_called: false,
        google_ads_api_called: false,
        live_ads_execution_used: false,
        status: 'blocked_until_future_erp_step',
        note: 'Execution is disabled now; real credentials and live calls are a later ERP admin step.',
      },
    ];
  }

  private safety(): AdsAutomationManagerAccountControlPlaneResponse['safety'] {
    return {
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
      validate_only_provider_call_used: false,
      live_ads_execution_used: false,
      erp_mutation_used: false,
      payment_mutation_used: false,
      order_mutation_used: false,
      inventory_mutation_used: false,
      campaignBudgetId_no_fallback: true,
      approval_required_for_all_drafts: true,
      future_provider_validateOnly_required_before_execution: true,
      erp_only_future_validator_approver_executor: true,
      future_live_execution_allowed: false,
      GOOGLE_ADS_PRODUCTION_ENABLED: false,
      execution_allowed_now: false,
      production_ready: false,
    };
  }

  private markdownPreview(input: {
    reportDate: string;
    status: AdsAutomationManagerAccountControlPlaneResponse['summary']['status'];
    managerAccounts: AdsAutomationManagerReadiness[];
    pendingActions: AdsAutomationManagerPendingActionReadiness[];
    blockers: string[];
  }): string {
    return [
      '# Ads Automation Manager Account Control Plane',
      `Report date: ${input.reportDate}`,
      `Status: ${input.status}`,
      `Managers: ${input.managerAccounts.map((manager) => manager.managerAccountType).join(' -> ')}`,
      `Child accounts: ${this.sum(input.managerAccounts.map((manager) => manager.childAccounts.length))}`,
      `Pending actions ready: ${input.pendingActions.filter((action) => action.status !== 'blocked_before_provider_boundary').length}/${input.pendingActions.length}`,
      `Blockers: ${this.joinOrNone(input.blockers)}`,
      'Provider/API calls: provider_api_called=false, google_ads_api_called=false, meta_api_called=false, tiktok_api_called=false, validateOnly_called=false, live_ads_execution_used=false',
      'Execution allowed now: false',
      'Production ready: false',
      'Cashflow-first rule: unsafe or missing margin, contribution profit, cash conversion, stock, supplier, fulfillment, refund, freshness, or loss-limit evidence blocks execution and downgrades scale to monitor_only.',
    ].join('\n');
  }

  private missingCampaignBudgetIdCount(
    campaigns: AdsAutomationManagerCampaignReadiness[],
    pendingActions: AdsAutomationManagerPendingActionReadiness[],
  ): number {
    return campaigns.filter((campaign) =>
      !campaign.campaignBudgetEvidence.campaignBudgetId).length
      + pendingActions.filter((action) =>
        action.blockers.some((blocker) => blocker.includes('campaignBudgetId'))).length;
  }

  private findManager(
    managers: AdsAutomationManagerReadiness[],
    provider: AdsAutomationManagerProvider,
    managerAccountId: unknown,
  ): AdsAutomationManagerReadiness | null {
    const id = this.text(managerAccountId);
    return managers.find((manager) =>
      manager.provider === provider
      && (!id || manager.managerAccountId === id)
    ) || null;
  }

  private findChild(
    manager: AdsAutomationManagerReadiness | null,
    childAccountId: unknown,
  ): AdsAutomationManagerChildAccountReadiness | null {
    const id = this.text(childAccountId);
    if (!manager || !id) return null;
    return manager.childAccounts.find((child) => child.childAccountId === id) || null;
  }

  private findCampaign(
    child: AdsAutomationManagerChildAccountReadiness | null,
    campaignId: unknown,
  ): AdsAutomationManagerCampaignReadiness | null {
    const id = this.text(campaignId);
    if (!child || !id) return null;
    return child.campaigns.find((campaign) => campaign.campaignId === id) || null;
  }

  private findAdGroup(
    campaign: AdsAutomationManagerCampaignReadiness | null,
    adGroupId: unknown,
  ): AdsAutomationManagerAdGroupReadiness | null {
    const id = this.text(adGroupId);
    if (!campaign || !id) return null;
    return campaign.adGroups.find((adGroup) => adGroup.adGroupId === id) || null;
  }

  private mappingBlockers(
    prefix: string,
    status: AdsAutomationManagerMappingStatus | undefined,
  ): string[] {
    const normalized = this.mappingStatus(status);
    return normalized === 'mapped' ? [] : [`${prefix}_mapping.${normalized}`];
  }

  private mappingStatus(
    status: AdsAutomationManagerMappingStatus | undefined,
  ): AdsAutomationManagerMappingStatus {
    return ['mapped', 'missing', 'stale', 'blocked'].includes(String(status))
      ? status as AdsAutomationManagerMappingStatus
      : 'missing';
  }

  private syncStatus(
    status: AdsAutomationManagerSyncStatus | undefined,
  ): AdsAutomationManagerSyncStatus {
    return ['fresh', 'stale', 'missing', 'blocked'].includes(String(status))
      ? status as AdsAutomationManagerSyncStatus
      : 'missing';
  }

  private channel(value: unknown): AdsAutomationManagerChannel {
    const normalized = this.text(value) || 'unknown';
    if (['search', 'social_feed', 'short_video'].includes(normalized)) {
      return normalized as AdsAutomationManagerChannel;
    }
    return 'unknown';
  }

  private unsupportedChannelBlockers(value: unknown): string[] {
    const raw = String(value ?? '').trim();
    const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
    if (!raw) return [];
    if (['search', 'social_feed', 'short_video'].includes(normalized)) return [];
    if (
      normalized.includes('performance_max')
      || normalized.includes('pmax')
      || normalized.includes('shopping')
      || normalized.includes('display')
      || normalized.includes('youtube')
    ) {
      return [`capability.unsupported_channel.${normalized}`];
    }
    return [`capability.unsupported_channel.${normalized || 'unknown'}`];
  }

  private unsupportedActionBlockers(actionType: string): string[] {
    const normalized = actionType.toLowerCase().replace(/[\s-]+/g, '_');
    const blockers: string[] = [];
    if (normalized.includes('delete')) blockers.push('capability.delete_blocked');
    if (normalized.includes('performance_max') || normalized.includes('pmax')) {
      blockers.push('capability.performance_max_blocked');
    }
    if (normalized.includes('shopping')) blockers.push('capability.shopping_blocked');
    if (normalized.includes('display')) blockers.push('capability.display_blocked');
    if (normalized.includes('youtube')) blockers.push('capability.youtube_blocked');
    if (normalized.includes('create_campaign') || normalized.includes('create_live_campaign')) {
      blockers.push('capability.create_live_campaign_blocked');
    }
    if (normalized.includes('auto_publish')) blockers.push('capability.auto_publish_blocked');
    return blockers;
  }

  private plaintextCredentialFields(
    metadata: AdsAutomationManagerCredentialMetadataInput | null,
  ): string[] {
    if (!metadata || typeof metadata !== 'object') return [];
    const declared = Array.isArray(metadata.plaintextCredentialFieldNames)
      ? metadata.plaintextCredentialFieldNames
      : [];
    const presentKeys = Object.keys(metadata).filter((key) =>
      FORBIDDEN_FIELD_KEYS.has(normalizeFieldName(key)),
    );
    return this.unique([...declared, ...presentKeys]);
  }

  private assertNoForbiddenCredentialFields(value: unknown): void {
    const matches = this.findForbiddenCredentialFields(value);
    if (matches.length) {
      throw new BadRequestException(
        `forbidden credential fields rejected: ${matches.join(', ')}`,
      );
    }
  }

  private findForbiddenCredentialFields(
    value: unknown,
    path = 'managerAccounts',
  ): string[] {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) =>
        this.findForbiddenCredentialFields(item, `${path}[${index}]`));
    }

    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const currentPath = `${path}.${key}`;
      const normalized = normalizeFieldName(key);
      return [
        ...(FORBIDDEN_FIELD_KEYS.has(normalized) ? [currentPath] : []),
        ...this.findForbiddenCredentialFields(child, currentPath),
      ];
    });
  }

  private scopes(values: unknown[]): AdsAutomationManagerPermissionScope[] {
    const allowed: AdsAutomationManagerPermissionScope[] = [
      'ads.readonly',
      'ads.validate_only',
      'ads.manage_budgets',
      'ads.pause',
      'business_management',
      'ads_management',
      'advertiser.read',
      'campaign.read',
      'campaign.write',
    ];
    return this.uniqueScopes(
      (values || []).filter((value): value is AdsAutomationManagerPermissionScope =>
        allowed.includes(value as AdsAutomationManagerPermissionScope)),
    );
  }

  private assertInput(input: AdsAutomationManagerAccountControlPlaneInput): void {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('manager account control-plane payload is required');
    }
    if (!Array.isArray(input.managerAccounts) || !input.managerAccounts.length) {
      throw new BadRequestException('managerAccounts must be a non-empty array');
    }
    if (!Array.isArray(input.pendingActions)) {
      throw new BadRequestException('pendingActions must be an array');
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

  private requiredText(value: unknown, field: string): string {
    const text = this.text(value);
    if (!text) throw new BadRequestException(`${field} is required`);
    return text;
  }

  private text(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private numberOrNull(value: unknown): number | null {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  private sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0);
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))].sort();
  }

  private uniqueScopes(
    values: AdsAutomationManagerPermissionScope[],
  ): AdsAutomationManagerPermissionScope[] {
    return [...new Set(values)].sort();
  }

  private joinOrNone(values: string[]): string {
    const normalized = values.map((value) => String(value || '').trim()).filter(Boolean);
    return normalized.length ? normalized.join(', ') : 'none';
  }
}

function normalizeFieldName(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
