import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { AdAccount, AdAccountDocument } from '../ad-account/schemas/ad-account.schema';
import { CreateAdsManagerAccountDto } from './dto/create-ads-manager-account.dto';
import { UpdateAdsManagerAccountDto } from './dto/update-ads-manager-account.dto';
import {
  ADS_MANAGER_READONLY_VERIFIER,
  AdsManagerReadonlyVerifier,
} from './ads-manager-account-readonly-verification.service';
import { redactSecretString } from '../common/utils/secret-redaction.util';
import {
  AdsManagerAccount,
  AdsManagerAccountDocument,
  AdsManagerAccountType,
  AdsManagerCredentialStatus,
  AdsManagerProvider,
  AdsManagerReadinessStatus,
  AdsManagerVaultProvider,
} from './schemas/ads-manager-account.schema';

const MANAGER_TYPE_BY_PROVIDER: Record<AdsManagerProvider, AdsManagerAccountType> = {
  google: 'google_ads_mcc',
  facebook: 'meta_business_manager',
  tiktok: 'tiktok_business_center',
};

const REQUIRED_SCOPES_BY_TYPE: Record<AdsManagerAccountType, string[]> = {
  google_ads_mcc: ['ads.readonly', 'ads.validate_only', 'ads.manage_budgets', 'ads.pause'],
  meta_business_manager: ['business_management', 'ads_management', 'ads.readonly', 'ads.validate_only', 'ads.pause'],
  tiktok_business_center: ['advertiser.read', 'campaign.read', 'campaign.write', 'ads.readonly', 'ads.validate_only'],
};

const SUPPORTED_MVP_ACTIONS = [
  'update_campaign_budget',
  'pause_campaign',
  'pause_ad_group',
  'monitor_only',
  'supplier_sourcing',
  'product_offer_fix',
  'stop_import_review',
];

const BLOCKED_CAPABILITIES = [
  'delete',
  'Performance Max',
  'Shopping',
  'Display',
  'YouTube',
  'create_live_campaign',
  'auto_publish',
];

const RAW_CREDENTIAL_KEYS = new Set([
  'token',
  'tokenenc',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'developertoken',
  'clientsecret',
  'appsecret',
  'apikey',
  'privatekey',
  'password',
  'rawcredential',
  'credentialmaterial',
  'plaintextcredential',
  'providerconfig',
  'providerconfigenc',
]);

const RAW_CREDENTIAL_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/i,
  /\b1\/\/[A-Za-z0-9._-]{8,}/,
  /\bya29\.[A-Za-z0-9._-]{8,}/,
  /\bGOCSPX-[A-Za-z0-9._-]{8,}/i,
  /\bEAA[A-Za-z0-9]{20,}/,
];

export interface AdsManagerAccountReadModel {
  id: string;
  name: string;
  provider: AdsManagerProvider;
  managerAccountType: AdsManagerAccountType;
  managerAccountId: string;
  managerAccountName?: string;
  vaultProvider: AdsManagerVaultProvider;
  secretReferenceHandle: string;
  credentialReferenceId?: string;
  credentialStatus: AdsManagerCredentialStatus;
  requiredScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  childAccountIds: string[];
  verifiedChildAccounts: Array<{
    accountId: string;
    name: string;
    currency: string;
    timezoneId: string;
    status: string;
  }>;
  discoveredChildAccountCount: number;
  readinessStatus: AdsManagerReadinessStatus;
  blockers: string[];
  warnings: string[];
  safety: {
    readiness_scope: 'metadata_only' | 'provider_verified_readonly';
    production_ready: false;
    execution_allowed_now: false;
    provider_api_called: boolean;
    validateOnly_called: false;
    live_ads_execution_used: false;
    real_credential_material_present: false;
    plaintext_secrets_added: false;
    GOOGLE_ADS_PRODUCTION_ENABLED: 'false_or_absent';
  };
  providerReadiness: {
    classification: 'metadata_only_not_provider_verified' | 'provider_verified_readonly' | 'provider_verification_stale' | 'provider_verification_incomplete' | 'provider_verification_unsupported' | 'provider_verification_failed';
    verificationStatus: 'never_verified' | 'verified' | 'failed' | 'unsupported';
    verificationFresh: boolean;
    runtimeCredentialResolved: boolean;
    providerConnectionVerified: boolean;
    childAccountsVerifiedByProvider: boolean;
    verifiedScopes: string[];
    readyForReadOnlyProviderCall: boolean;
    readyForValidateOnlyProviderCall: false;
    readyForLiveExecution: false;
  };
  capabilities: {
    canDiscoverChildren: boolean;
    canImportReadOnly: boolean;
    canUseForFutureValidateOnly: boolean;
    canUseForFutureExecution: false;
    metadataEligibleForChildDiscovery: boolean;
    metadataEligibleForReadOnlyOnboarding: boolean;
    metadataEligibleForFutureValidateOnly: boolean;
    supportedMvpActions: string[];
    blockedCapabilities: string[];
  };
  timestamps: {
    lastCredentialMetadataAt?: Date;
    lastDiscoveryAt?: Date;
    lastImportAt?: Date;
    lastMappingAuditAt?: Date;
    providerVerifiedAt?: Date;
    providerVerificationExpiresAt?: Date;
    providerVerificationFailedAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
  };
  notes?: string;
  isActive: boolean;
}

@Injectable()
export class AdsManagerAccountService {
  constructor(
    @InjectModel(AdsManagerAccount.name)
    private readonly managerModel: Model<AdsManagerAccountDocument>,
    @InjectModel(AdAccount.name)
    private readonly adAccountModel: Model<AdAccountDocument>,
    @Optional()
    @Inject(ADS_MANAGER_READONLY_VERIFIER)
    private readonly readonlyVerifier?: AdsManagerReadonlyVerifier,
  ) {}

  async create(dto: CreateAdsManagerAccountDto): Promise<AdsManagerAccountReadModel> {
    const payload = this.buildPayload(dto);
    try {
      const created = await this.managerModel.create(payload);
      return this.toReadModel(this.toPlain(created), await this.countDiscoveredChildren(payload));
    } catch (error: any) {
      if (error?.code === 11000) {
        throw new BadRequestException('Manager account registry entry already exists for this provider/type/id.');
      }
      throw error;
    }
  }

  async findAll(query: {
    provider?: AdsManagerProvider;
    managerAccountType?: AdsManagerAccountType;
    readinessStatus?: AdsManagerReadinessStatus;
    isActive?: string | boolean;
  } = {}): Promise<AdsManagerAccountReadModel[]> {
    const filter: FilterQuery<AdsManagerAccountDocument> = {};
    if (query.provider) filter.provider = query.provider;
    if (query.managerAccountType) filter.managerAccountType = query.managerAccountType;
    if (query.readinessStatus) filter.readinessStatus = query.readinessStatus;
    if (query.isActive !== undefined) filter.isActive = query.isActive === true || query.isActive === 'true';

    const records = await this.managerModel.find(filter).sort({ createdAt: -1 }).lean().exec();
    return Promise.all(records.map(async (record) =>
      this.toReadModel(record, await this.countDiscoveredChildren(record))));
  }

  async findOne(id: string): Promise<AdsManagerAccountReadModel> {
    const record = await this.managerModel.findById(id).lean().exec();
    if (!record) {
      throw new NotFoundException('Manager account registry entry not found.');
    }
    return this.toReadModel(record, await this.countDiscoveredChildren(record));
  }

  async update(id: string, dto: UpdateAdsManagerAccountDto): Promise<AdsManagerAccountReadModel> {
    const current = await this.managerModel.findById(id).lean().exec();
    if (!current) {
      throw new NotFoundException('Manager account registry entry not found.');
    }
    const payload = this.buildPayload({
      ...current,
      ...dto,
      provider: dto.provider ?? current.provider,
      managerAccountType: dto.managerAccountType ?? current.managerAccountType,
      managerAccountId: dto.managerAccountId ?? current.managerAccountId,
      name: dto.name ?? current.name,
    } as CreateAdsManagerAccountDto);

    if (!this.verificationInputsChanged(current, dto)) {
      this.copyVerificationState(payload, current);
    }

    const updated = await this.managerModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .lean()
      .exec();
    if (!updated) {
      throw new NotFoundException('Manager account registry entry not found.');
    }
    return this.toReadModel(updated, await this.countDiscoveredChildren(updated));
  }

  async verifyAndImportReadOnly(id: string, verifiedByUserId?: string): Promise<AdsManagerAccountReadModel> {
    const current = await this.managerModel.findById(id).lean().exec();
    if (!current) {
      throw new NotFoundException('Manager account registry entry not found.');
    }
    const actorUserId = this.clean(verifiedByUserId);
    if (!actorUserId) {
      throw new BadRequestException('Authenticated Director identity is required for provider verification audit.');
    }

    if (current.provider !== 'google' || current.managerAccountType !== 'google_ads_mcc') {
      const blockers = this.unique([
        ...(current.blockers || []).filter((item) => !item.startsWith('provider_verification.')),
        'provider_verification.readonly_discovery_unsupported',
      ]);
      const unsupported = await this.managerModel.findByIdAndUpdate(id, {
        $set: {
          providerVerificationStatus: 'unsupported',
          providerApiCalled: false,
          runtimeCredentialResolved: false,
          providerConnectionVerified: false,
          childAccountsVerifiedByProvider: false,
          readinessStatus: 'blocked',
          blockers,
        },
      }, { new: true, runValidators: true }).lean().exec();
      return this.toReadModel(unsupported || current, await this.countDiscoveredChildren(unsupported || current));
    }

    try {
      if (!this.readonlyVerifier) {
        throw new Error('Manager account read-only verifier is not configured.');
      }
      const result = await this.readonlyVerifier.verifyGoogleMcc({
        managerAccountId: current.managerAccountId,
        vaultProvider: current.vaultProvider || 'pending',
        credentialReferenceId: current.credentialReferenceId,
      });
      const children = result.childAccounts;
      const metadataPresent = children.length > 0
        && children.every((child) => Boolean(child.accountId && child.currency && child.timezoneId));
      const currencyGuardrailPassed = children.length > 0
        && children.every((child) => child.currency === 'VND');
      const timezoneGuardrailPassed = children.length > 0
        && children.every((child) => child.timezoneId === 'Asia/Ho_Chi_Minh');
      const metadataComplete = metadataPresent && currencyGuardrailPassed && timezoneGuardrailPassed;
      const providerBlockers = [
        ...(children.length ? [] : ['provider_verification.no_authorized_child_accounts']),
        ...(children.length && !metadataPresent
          ? ['provider_verification.child_currency_or_timezone_missing']
          : []),
        ...(metadataPresent && !currencyGuardrailPassed
          ? ['provider_verification.child_currency_not_vnd']
          : []),
        ...(metadataPresent && !timezoneGuardrailPassed
          ? ['provider_verification.child_timezone_not_asia_ho_chi_minh']
          : []),
      ];
      const blockers = this.unique([
        ...(current.blockers || []).filter((item) => !item.startsWith('provider_verification.')),
        ...providerBlockers,
      ]);

      if (children.length) {
        await this.adAccountModel.bulkWrite(children.map((child) => ({
          updateOne: {
            filter: { accountType: 'google', accountId: child.accountId },
            update: {
              $set: {
                name: child.name,
                currency: child.currency,
                timezoneId: child.timezoneId,
                managementMode: 'mcc',
                loginCustomerId: current.managerAccountId,
                isActive: child.status === 'ENABLED'
                  && child.currency === 'VND'
                  && child.timezoneId === 'Asia/Ho_Chi_Minh',
              },
              $setOnInsert: { accountType: 'google', accountId: child.accountId, tokenSource: 'system' },
            },
            upsert: true,
          },
        })), { ordered: true });
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.verificationTtlMs());
      const updated = await this.managerModel.findByIdAndUpdate(id, {
        $set: {
          providerVerificationStatus: 'verified',
          providerApiCalled: true,
          runtimeCredentialResolved: result.runtimeCredentialResolved,
          providerConnectionVerified: result.providerConnectionVerified,
          childAccountsVerifiedByProvider: metadataComplete,
          providerVerifiedScopes: this.unique(result.verifiedScopes),
          verifiedChildAccounts: children,
          childAccountIds: this.unique(children.map((child) => child.accountId)),
          providerVerifiedAt: now,
          providerVerificationExpiresAt: expiresAt,
          providerVerifiedByUserId: actorUserId,
          readinessStatus: metadataComplete ? 'ready_for_import' : 'needs_mapping',
          blockers,
          lastCredentialMetadataAt: now,
          lastDiscoveryAt: now,
          lastImportAt: now,
          lastMappingAuditAt: now,
        },
        $unset: { providerVerificationFailedAt: 1, providerVerificationError: 1 },
      }, { new: true, runValidators: true }).lean().exec();
      if (!updated) throw new NotFoundException('Manager account registry entry not found.');
      return this.toReadModel(updated, await this.countDiscoveredChildren(updated));
    } catch (error: any) {
      const failedAt = new Date();
      const sanitizedError = redactSecretString(String(error?.message || 'Provider read-only verification failed.'));
      await this.managerModel.findByIdAndUpdate(id, {
        $set: {
          providerVerificationStatus: 'failed',
          providerApiCalled: true,
          runtimeCredentialResolved: false,
          providerConnectionVerified: false,
          childAccountsVerifiedByProvider: false,
          providerVerificationFailedAt: failedAt,
          providerVerificationError: sanitizedError.slice(0, 500),
          readinessStatus: 'blocked',
          blockers: this.unique([
            ...(current.blockers || []).filter((item) => !item.startsWith('provider_verification.')),
            'provider_verification.failed',
          ]),
        },
      }, { runValidators: true }).exec();
      throw new BadRequestException('Google MCC read-only verification failed. Review the sanitized registry status.');
    }
  }

  async readinessSummary(): Promise<{
    schema_version: 'ads_manager_account_registry_readiness.v1';
    readiness_scope: 'metadata_only_or_provider_verified_readonly';
    provider_connectivity_verified: boolean;
    runtime_credential_linked: boolean;
    production_ready: false;
    execution_allowed_now: false;
    provider_api_called: boolean;
    validateOnly_called: false;
    live_ads_execution_used: false;
    total: number;
    byProvider: Record<AdsManagerProvider, number>;
    readyForImport: number;
    blocked: number;
    notConfigured: number;
    needsMapping: number;
    childAccountCount: number;
    productionBlockers: string[];
    managers: AdsManagerAccountReadModel[];
  }> {
    const managers = await this.findAll();
    return {
      schema_version: 'ads_manager_account_registry_readiness.v1',
      readiness_scope: 'metadata_only_or_provider_verified_readonly',
      provider_connectivity_verified: managers.some((manager) => manager.providerReadiness.verificationFresh && manager.providerReadiness.providerConnectionVerified),
      runtime_credential_linked: managers.some((manager) => manager.providerReadiness.verificationFresh && manager.providerReadiness.runtimeCredentialResolved),
      production_ready: false,
      execution_allowed_now: false,
      provider_api_called: managers.some((manager) => manager.safety.provider_api_called),
      validateOnly_called: false,
      live_ads_execution_used: false,
      total: managers.length,
      byProvider: {
        google: managers.filter((manager) => manager.provider === 'google').length,
        facebook: managers.filter((manager) => manager.provider === 'facebook').length,
        tiktok: managers.filter((manager) => manager.provider === 'tiktok').length,
      },
      readyForImport: managers.filter((manager) => manager.readinessStatus === 'ready_for_import').length,
      blocked: managers.filter((manager) => manager.readinessStatus === 'blocked').length,
      notConfigured: managers.filter((manager) => manager.readinessStatus === 'not_configured').length,
      needsMapping: managers.filter((manager) => manager.readinessStatus === 'needs_mapping').length,
      childAccountCount: managers.reduce((sum, manager) => sum + manager.discoveredChildAccountCount, 0),
      productionBlockers: [
        'manager_registry_is_metadata_only',
        'runtime_credential_resolution_not_verified',
        'provider_connectivity_not_verified',
        'child_account_authorization_not_verified_by_provider',
        'production_execution_disabled',
      ],
      managers,
    };
  }

  private buildPayload(dto: CreateAdsManagerAccountDto): Partial<AdsManagerAccount> {
    this.assertNoRawCredentialMaterial(dto);

    const provider = dto.provider;
    const managerAccountType = dto.managerAccountType;
    if (MANAGER_TYPE_BY_PROVIDER[provider] !== managerAccountType) {
      throw new BadRequestException(`managerAccountType ${managerAccountType} does not match provider ${provider}.`);
    }

    const requiredScopes = this.unique(dto.requiredScopes?.length
      ? dto.requiredScopes
      : REQUIRED_SCOPES_BY_TYPE[managerAccountType]);
    const grantedScopes = this.unique(dto.grantedScopes || []);
    const childAccountIds = this.unique(dto.childAccountIds || []);
    const credentialStatus = dto.credentialStatus || 'missing';
    const secretReferenceHandle = (dto.secretReferenceHandle || 'pending_secret_store_onboarding').trim();
    const vaultProvider = dto.vaultProvider || (secretReferenceHandle === 'pending_secret_store_onboarding'
      ? 'pending'
      : 'erp_secret_store');
    const isActive = dto.isActive ?? true;
    const derived = this.deriveReadiness({
      isActive,
      credentialStatus,
      secretReferenceHandle,
      requiredScopes,
      grantedScopes,
      childAccountIds,
      inputBlockers: dto.blockers || [],
    });

    return {
      name: this.clean(dto.name),
      provider,
      managerAccountType,
      managerAccountId: this.normalizeManagerAccountId(provider, dto.managerAccountId),
      managerAccountName: this.clean(dto.managerAccountName) || this.clean(dto.name),
      vaultProvider,
      secretReferenceHandle,
      credentialReferenceId: this.clean(dto.credentialReferenceId),
      credentialStatus,
      requiredScopes,
      grantedScopes,
      childAccountIds,
      blockers: derived.blockers,
      warnings: this.unique(dto.warnings || []),
      readinessStatus: derived.readinessStatus,
      canDiscoverChildren: derived.canUseCredential,
      canImportReadOnly: derived.canUseCredential,
      canUseForFutureValidateOnly: derived.canUseCredential && credentialStatus === 'ready_for_import',
      canUseForFutureExecution: false,
      productionReady: false,
      executionAllowedNow: false,
      providerApiCalled: false,
      providerVerificationStatus: 'never_verified',
      runtimeCredentialResolved: false,
      providerConnectionVerified: false,
      childAccountsVerifiedByProvider: false,
      providerVerifiedScopes: [],
      verifiedChildAccounts: [],
      validateOnlyCalled: false,
      liveAdsExecutionUsed: false,
      realCredentialMaterialPresent: false,
      plaintextSecretsAdded: false,
      supportedMvpActions: [...SUPPORTED_MVP_ACTIONS],
      blockedCapabilities: [...BLOCKED_CAPABILITIES],
      lastCredentialMetadataAt: this.dateOrUndefined(dto.lastCredentialMetadataAt),
      lastDiscoveryAt: this.dateOrUndefined(dto.lastDiscoveryAt),
      lastImportAt: this.dateOrUndefined(dto.lastImportAt),
      lastMappingAuditAt: this.dateOrUndefined(dto.lastMappingAuditAt),
      notes: this.clean(dto.notes),
      isActive,
    };
  }

  private deriveReadiness(input: {
    isActive: boolean;
    credentialStatus: AdsManagerCredentialStatus;
    secretReferenceHandle: string;
    requiredScopes: string[];
    grantedScopes: string[];
    childAccountIds: string[];
    inputBlockers: string[];
  }): { readinessStatus: AdsManagerReadinessStatus; blockers: string[]; canUseCredential: boolean } {
    const missingScopes = input.requiredScopes.filter((scope) => !input.grantedScopes.includes(scope));
    const blockers = this.unique([
      ...(input.inputBlockers || []),
      ...(input.isActive ? [] : ['manager_account_inactive']),
      ...(input.credentialStatus === 'blocked' ? ['credential_status_blocked'] : []),
      ...(input.credentialStatus === 'revoked' ? ['credential_status_revoked'] : []),
      ...(input.credentialStatus === 'missing' ? ['credential_status_missing'] : []),
      ...(input.credentialStatus === 'metadata_ready' ? ['credential_status_metadata_ready_not_import_ready'] : []),
      ...(input.secretReferenceHandle === 'pending_secret_store_onboarding'
        ? ['secret_reference_handle_pending']
        : []),
      ...missingScopes.map((scope) => `permission_scope.${scope}_missing`),
    ]);
    const canUseCredential = blockers.length === 0 && input.credentialStatus === 'ready_for_import';
    const readinessStatus: AdsManagerReadinessStatus = !input.isActive || blockers.length
      ? (input.credentialStatus === 'missing' ? 'not_configured' : 'blocked')
      : input.childAccountIds.length
        ? 'needs_mapping'
        : 'ready_for_import';

    return { readinessStatus, blockers, canUseCredential };
  }

  private async countDiscoveredChildren(manager: Partial<AdsManagerAccount>): Promise<number> {
    const filter = this.childAccountFilter(manager);
    const dbCount = filter ? await this.adAccountModel.countDocuments(filter).exec() : 0;
    return Math.max(dbCount, manager.childAccountIds?.length || 0);
  }

  private childAccountFilter(manager: Partial<AdsManagerAccount>): FilterQuery<AdAccountDocument> | null {
    if (!manager.provider || !manager.managerAccountId) return null;
    if (manager.provider === 'google') {
      return {
        accountType: 'google',
        managementMode: 'mcc',
        loginCustomerId: manager.managerAccountId,
      };
    }
    if (manager.provider === 'facebook') {
      return {
        accountType: 'facebook',
        managementMode: 'bm',
        businessCenterId: manager.managerAccountId,
      };
    }
    return {
      accountType: 'tiktok',
      managementMode: 'bc',
      businessCenterId: manager.managerAccountId,
    };
  }

  private toReadModel(record: Partial<AdsManagerAccount> & { _id?: any; createdAt?: Date; updatedAt?: Date }, childCount: number): AdsManagerAccountReadModel {
    const requiredScopes = this.unique(record.requiredScopes || []);
    const grantedScopes = this.unique(record.grantedScopes || []);
    const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));
    const verificationStatus = record.providerVerificationStatus || 'never_verified';
    const verificationFresh = verificationStatus === 'verified'
      && Boolean(record.providerVerificationExpiresAt)
      && new Date(record.providerVerificationExpiresAt as Date).getTime() > Date.now();
    const verifiedChildren = record.verifiedChildAccounts || [];
    const childAccountsVerified = verificationFresh
      && record.childAccountsVerifiedByProvider === true
      && verifiedChildren.length > 0;
    const providerSpecificBlockers = record.provider === 'google'
      ? verificationStatus === 'verified' && !verificationFresh
        ? ['provider_verification.expired']
        : verificationStatus === 'never_verified'
          ? ['provider_verification.not_verified']
          : []
      : ['provider_verification.readonly_discovery_unsupported'];
    const blockers = this.unique([...(record.blockers || []), ...providerSpecificBlockers]);
    const classification = this.providerClassification(record.provider, verificationStatus, verificationFresh, childAccountsVerified);
    const storedReadiness = (record.readinessStatus || 'not_configured') as AdsManagerReadinessStatus;
    const effectiveReadiness = storedReadiness === 'not_configured'
      ? storedReadiness
      : verificationFresh
        ? (childAccountsVerified ? 'ready_for_import' : 'needs_mapping')
        : 'blocked';
    return {
      id: String(record._id || ''),
      name: record.name || '',
      provider: record.provider as AdsManagerProvider,
      managerAccountType: record.managerAccountType as AdsManagerAccountType,
      managerAccountId: record.managerAccountId || '',
      managerAccountName: record.managerAccountName,
      vaultProvider: (record.vaultProvider || 'pending') as AdsManagerVaultProvider,
      secretReferenceHandle: record.secretReferenceHandle || 'pending_secret_store_onboarding',
      credentialReferenceId: record.credentialReferenceId,
      credentialStatus: (record.credentialStatus || 'missing') as AdsManagerCredentialStatus,
      requiredScopes,
      grantedScopes,
      missingScopes,
      childAccountIds: record.childAccountIds || [],
      verifiedChildAccounts: verifiedChildren,
      discoveredChildAccountCount: childCount,
      readinessStatus: effectiveReadiness,
      blockers,
      warnings: record.warnings || [],
      safety: {
        readiness_scope: verificationFresh ? 'provider_verified_readonly' : 'metadata_only',
        production_ready: false,
        execution_allowed_now: false,
        provider_api_called: record.providerApiCalled === true,
        validateOnly_called: false,
        live_ads_execution_used: false,
        real_credential_material_present: false,
        plaintext_secrets_added: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: 'false_or_absent',
      },
      providerReadiness: {
        classification,
        verificationStatus,
        verificationFresh,
        runtimeCredentialResolved: record.runtimeCredentialResolved === true,
        providerConnectionVerified: record.providerConnectionVerified === true,
        childAccountsVerifiedByProvider: childAccountsVerified,
        verifiedScopes: record.providerVerifiedScopes || [],
        readyForReadOnlyProviderCall: verificationFresh && childAccountsVerified,
        readyForValidateOnlyProviderCall: false,
        readyForLiveExecution: false,
      },
      capabilities: {
        // Registry metadata alone never authorizes a provider call. Preserve
        // the derived metadata eligibility under explicitly named fields.
        canDiscoverChildren: verificationFresh,
        canImportReadOnly: verificationFresh && childAccountsVerified,
        canUseForFutureValidateOnly: false,
        canUseForFutureExecution: false,
        metadataEligibleForChildDiscovery: record.canDiscoverChildren === true,
        metadataEligibleForReadOnlyOnboarding: record.canImportReadOnly === true,
        metadataEligibleForFutureValidateOnly: record.canUseForFutureValidateOnly === true,
        supportedMvpActions: record.supportedMvpActions || [...SUPPORTED_MVP_ACTIONS],
        blockedCapabilities: record.blockedCapabilities || [...BLOCKED_CAPABILITIES],
      },
      timestamps: {
        lastCredentialMetadataAt: record.lastCredentialMetadataAt,
        lastDiscoveryAt: record.lastDiscoveryAt,
        lastImportAt: record.lastImportAt,
        lastMappingAuditAt: record.lastMappingAuditAt,
        providerVerifiedAt: record.providerVerifiedAt,
        providerVerificationExpiresAt: record.providerVerificationExpiresAt,
        providerVerificationFailedAt: record.providerVerificationFailedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
      notes: record.notes,
      isActive: record.isActive !== false,
    };
  }

  private assertNoRawCredentialMaterial(value: unknown): void {
    const paths = this.findRawCredentialKeys(value);
    const values = this.findRawCredentialValues(value);
    if (paths.length || values.length) {
      throw new BadRequestException(
        `Raw credential material is not accepted in manager account registry metadata: ${[...paths, ...values].join(', ')}`,
      );
    }
  }

  private providerClassification(
    provider: AdsManagerProvider | undefined,
    status: 'never_verified' | 'verified' | 'failed' | 'unsupported',
    fresh: boolean,
    childrenVerified: boolean,
  ): AdsManagerAccountReadModel['providerReadiness']['classification'] {
    if (provider !== 'google' || status === 'unsupported') return 'provider_verification_unsupported';
    if (status === 'failed') return 'provider_verification_failed';
    if (status === 'verified' && !fresh) return 'provider_verification_stale';
    if (fresh && !childrenVerified) return 'provider_verification_incomplete';
    if (fresh) return 'provider_verified_readonly';
    return 'metadata_only_not_provider_verified';
  }

  private verificationTtlMs(): number {
    const configuredMinutes = Number(process.env.ADS_MANAGER_PROVIDER_VERIFICATION_TTL_MINUTES || 60);
    const minutes = Number.isFinite(configuredMinutes)
      ? Math.min(1440, Math.max(5, configuredMinutes))
      : 60;
    return minutes * 60_000;
  }

  private verificationInputsChanged(current: Partial<AdsManagerAccount>, dto: UpdateAdsManagerAccountDto): boolean {
    const fields: Array<keyof UpdateAdsManagerAccountDto> = [
      'provider', 'managerAccountType', 'managerAccountId', 'vaultProvider',
      'secretReferenceHandle', 'credentialReferenceId', 'credentialStatus',
      'requiredScopes', 'grantedScopes', 'isActive',
    ];
    return fields.some((field) => dto[field] !== undefined
      && JSON.stringify(dto[field]) !== JSON.stringify((current as any)[field]));
  }

  private copyVerificationState(target: Partial<AdsManagerAccount>, source: Partial<AdsManagerAccount>): void {
    const fields: Array<keyof AdsManagerAccount> = [
      'providerApiCalled', 'providerVerificationStatus', 'runtimeCredentialResolved',
      'providerConnectionVerified', 'childAccountsVerifiedByProvider', 'providerVerifiedScopes',
      'verifiedChildAccounts', 'providerVerifiedAt', 'providerVerificationExpiresAt',
      'providerVerificationFailedAt', 'providerVerificationError', 'providerVerifiedByUserId',
    ];
    fields.forEach((field) => {
      if (source[field] !== undefined) (target as any)[field] = source[field];
    });
  }

  private findRawCredentialKeys(value: unknown, path = 'payload'): string[] {
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.findRawCredentialKeys(item, `${path}[${index}]`));
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const currentPath = `${path}.${key}`;
      const normalized = normalizeFieldName(key);
      return [
        ...(RAW_CREDENTIAL_KEYS.has(normalized) ? [currentPath] : []),
        ...this.findRawCredentialKeys(child, currentPath),
      ];
    });
  }

  private findRawCredentialValues(value: unknown, path = 'payload'): string[] {
    if (typeof value === 'string') {
      return RAW_CREDENTIAL_VALUE_PATTERNS.some((pattern) => pattern.test(value))
        ? [path]
        : [];
    }
    if (!value || typeof value !== 'object') return [];
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => this.findRawCredentialValues(item, `${path}[${index}]`));
    }
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      this.findRawCredentialValues(child, `${path}.${key}`));
  }

  private normalizeManagerAccountId(provider: AdsManagerProvider, value: string): string {
    const trimmed = this.clean(value);
    if (!trimmed) return '';
    if (provider === 'google') {
      return trimmed.replace(/[^0-9]/g, '') || trimmed;
    }
    return trimmed;
  }

  private dateOrUndefined(value?: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private clean(value?: string | null): string {
    return String(value ?? '').trim();
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set((values || []).map((value) => this.clean(value)).filter(Boolean))).sort();
  }

  private toPlain(value: any): Partial<AdsManagerAccount> & { _id?: any; createdAt?: Date; updatedAt?: Date } {
    if (value?.toObject) return value.toObject();
    return value;
  }
}

function normalizeFieldName(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
