import { BadRequestException } from '@nestjs/common';
import { AdsManagerAccountService } from './ads-manager-account.service';

function queryChain(result: unknown) {
  return {
    sort: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

function findOneChain(result: unknown) {
  return {
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
  };
}

function makeService(options: {
  records?: any[];
  childCount?: number;
  verificationResult?: any;
  verificationError?: Error;
} = {}) {
  const records = options.records || [];
  const childCount = options.childCount ?? 0;
  const managerModel = {
    create: jest.fn(async (payload) => ({
      ...payload,
      _id: 'manager-registry-id',
      createdAt: new Date('2026-07-07T00:00:00.000Z'),
      updatedAt: new Date('2026-07-07T00:00:00.000Z'),
      toObject: () => ({
        ...payload,
        _id: 'manager-registry-id',
        createdAt: new Date('2026-07-07T00:00:00.000Z'),
        updatedAt: new Date('2026-07-07T00:00:00.000Z'),
      }),
    })),
    find: jest.fn(() => queryChain(records)),
    findById: jest.fn(() => findOneChain(records[0] || null)),
    findByIdAndUpdate: jest.fn((_id, payload) => findOneChain({
      ...records[0],
      ...(payload?.$set || payload),
      _id,
      updatedAt: new Date('2026-07-07T00:05:00.000Z'),
    })),
  };
  const adAccountModel = {
    countDocuments: jest.fn(() => ({
      exec: jest.fn().mockResolvedValue(childCount),
    })),
    bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
  };
  const readonlyVerifier = {
    verifyGoogleMcc: options.verificationError
      ? jest.fn().mockRejectedValue(options.verificationError)
      : jest.fn().mockResolvedValue(options.verificationResult || {
        runtimeCredentialResolved: true,
        providerConnectionVerified: true,
        verifiedScopes: ['https://www.googleapis.com/auth/adwords'],
        childAccounts: [],
      }),
  };
  return {
    service: new AdsManagerAccountService(managerModel as any, adAccountModel as any, readonlyVerifier as any),
    managerModel,
    adAccountModel,
    readonlyVerifier,
  };
}

describe('AdsManagerAccountService', () => {
  it('stores manager account vault metadata without enabling production or provider calls', async () => {
    const providerBoundary = {
      discover: jest.fn(),
      validateOnly: jest.fn(),
      executeLive: jest.fn(),
    };
    const { service, managerModel, adAccountModel } = makeService({ childCount: 2 });

    const result = await service.create({
      name: 'HTX Google MCC primary',
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '123-456-7890',
      managerAccountName: 'HTX Google MCC',
      vaultProvider: 'erp_secret_store',
      secretReferenceHandle: 'vault://ads/google/mcc-primary',
      credentialReferenceId: 'credref-google-mcc-primary',
      credentialStatus: 'ready_for_import',
      grantedScopes: ['ads.readonly', 'ads.validate_only', 'ads.manage_budgets', 'ads.pause'],
      lastCredentialMetadataAt: '2026-07-07T00:00:00.000Z',
    });

    expect(providerBoundary.discover).not.toHaveBeenCalled();
    expect(providerBoundary.validateOnly).not.toHaveBeenCalled();
    expect(providerBoundary.executeLive).not.toHaveBeenCalled();
    expect(managerModel.create).toHaveBeenCalledWith(expect.objectContaining({
      managerAccountId: '1234567890',
      secretReferenceHandle: 'vault://ads/google/mcc-primary',
      productionReady: false,
      executionAllowedNow: false,
      providerApiCalled: false,
      validateOnlyCalled: false,
      liveAdsExecutionUsed: false,
      realCredentialMaterialPresent: false,
      plaintextSecretsAdded: false,
      canImportReadOnly: true,
      canUseForFutureValidateOnly: true,
      canUseForFutureExecution: false,
    }));
    expect(adAccountModel.countDocuments).toHaveBeenCalledWith({
      accountType: 'google',
      managementMode: 'mcc',
      loginCustomerId: '1234567890',
    });
    expect(result).toEqual(expect.objectContaining({
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '1234567890',
      readinessStatus: 'blocked',
      discoveredChildAccountCount: 2,
      missingScopes: [],
      safety: expect.objectContaining({
        readiness_scope: 'metadata_only',
        production_ready: false,
        execution_allowed_now: false,
        provider_api_called: false,
        validateOnly_called: false,
        live_ads_execution_used: false,
        real_credential_material_present: false,
        plaintext_secrets_added: false,
        GOOGLE_ADS_PRODUCTION_ENABLED: 'false_or_absent',
      }),
      providerReadiness: expect.objectContaining({
        classification: 'metadata_only_not_provider_verified',
        verificationStatus: 'never_verified',
        verificationFresh: false,
        runtimeCredentialResolved: false,
        providerConnectionVerified: false,
        childAccountsVerifiedByProvider: false,
        readyForReadOnlyProviderCall: false,
        readyForValidateOnlyProviderCall: false,
        readyForLiveExecution: false,
      }),
      capabilities: expect.objectContaining({
        canDiscoverChildren: false,
        canImportReadOnly: false,
        canUseForFutureValidateOnly: false,
        canUseForFutureExecution: false,
        metadataEligibleForChildDiscovery: true,
        metadataEligibleForReadOnlyOnboarding: true,
        metadataEligibleForFutureValidateOnly: true,
      }),
    }));
    expect(result.blockers).toContain('provider_verification.not_verified');
  });

  it('rejects provider/type mismatches and raw credential fields before persistence', async () => {
    const { service, managerModel } = makeService();

    await expect(service.create({
      name: 'Invalid Meta manager',
      provider: 'facebook',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: 'BM-001',
    })).rejects.toThrow(BadRequestException);

    await expect(service.create({
      name: 'Raw credential attempt',
      provider: 'tiktok',
      managerAccountType: 'tiktok_business_center',
      managerAccountId: 'BC-001',
      accessToken: 'blocked-unit-test-value',
    } as any)).rejects.toThrow(BadRequestException);

    expect(managerModel.create).not.toHaveBeenCalled();
  });

  it('keeps metadata-only vault entries closed until explicitly ready for import', async () => {
    const { service } = makeService();

    const result = await service.create({
      name: 'Metadata-only Meta BM',
      provider: 'facebook',
      managerAccountType: 'meta_business_manager',
      managerAccountId: 'BM-METADATA-ONLY',
      vaultProvider: 'erp_secret_store',
      secretReferenceHandle: 'vault://ads/meta/bm-metadata-only',
      credentialStatus: 'metadata_ready',
      grantedScopes: ['business_management', 'ads_management', 'ads.readonly', 'ads.validate_only', 'ads.pause'],
    });

    expect(result.readinessStatus).toBe('blocked');
    expect(result.blockers).toContain('credential_status_metadata_ready_not_import_ready');
    expect(result.capabilities.canDiscoverChildren).toBe(false);
    expect(result.capabilities.canImportReadOnly).toBe(false);
    expect(result.capabilities.canUseForFutureValidateOnly).toBe(false);
    expect(result.capabilities.canUseForFutureExecution).toBe(false);
    expect(result.safety.execution_allowed_now).toBe(false);
  });

  it('summarizes local-only readiness and keeps execution closed', async () => {
    const records = [
      {
        _id: 'ready-id',
        name: 'Ready Google MCC',
        provider: 'google',
        managerAccountType: 'google_ads_mcc',
        managerAccountId: '1002003000',
        managerAccountName: 'Ready Google MCC',
        vaultProvider: 'erp_secret_store',
        secretReferenceHandle: 'vault://ads/google/ready',
        credentialStatus: 'ready_for_import',
        requiredScopes: ['ads.readonly'],
        grantedScopes: ['ads.readonly'],
        childAccountIds: [],
        readinessStatus: 'ready_for_import',
        blockers: [],
        warnings: [],
        canDiscoverChildren: true,
        canImportReadOnly: true,
        canUseForFutureValidateOnly: true,
        supportedMvpActions: ['monitor_only'],
        blockedCapabilities: ['delete'],
        isActive: true,
      },
      {
        _id: 'blocked-id',
        name: 'Blocked TikTok BC',
        provider: 'tiktok',
        managerAccountType: 'tiktok_business_center',
        managerAccountId: 'BC-LOCAL',
        vaultProvider: 'pending',
        secretReferenceHandle: 'pending_secret_store_onboarding',
        credentialStatus: 'missing',
        requiredScopes: ['advertiser.read'],
        grantedScopes: [],
        childAccountIds: [],
        readinessStatus: 'not_configured',
        blockers: ['credential_status_missing'],
        warnings: [],
        isActive: true,
      },
    ];
    const { service } = makeService({ records, childCount: 1 });

    const summary = await service.readinessSummary();

    expect(summary).toEqual(expect.objectContaining({
      schema_version: 'ads_manager_account_registry_readiness.v1',
      readiness_scope: 'metadata_only_or_provider_verified_readonly',
      provider_connectivity_verified: false,
      runtime_credential_linked: false,
      production_ready: false,
      execution_allowed_now: false,
      provider_api_called: false,
      validateOnly_called: false,
      live_ads_execution_used: false,
      total: 2,
      readyForImport: 0,
      blocked: 1,
      notConfigured: 1,
      childAccountCount: 2,
      productionBlockers: expect.arrayContaining([
        'manager_registry_is_metadata_only',
        'provider_connectivity_not_verified',
        'production_execution_disabled',
      ]),
    }));
    expect(summary.byProvider).toEqual({ google: 1, facebook: 0, tiktok: 1 });
    expect(summary.managers[0].capabilities.canUseForFutureExecution).toBe(false);
    expect(summary.managers[0].providerReadiness.readyForLiveExecution).toBe(false);
    expect(summary.managers[0].providerReadiness.providerConnectionVerified).toBe(false);
    expect(JSON.stringify(summary)).not.toContain('blocked-unit-test-value');
  });

  it('imports provider-verified Google MCC children with currency/timezone and a finite TTL', async () => {
    const records = [{
      _id: 'google-mcc-id',
      name: 'Production MCC',
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '1234567890',
      vaultProvider: 'env_reference',
      secretReferenceHandle: 'env://google/ads',
      credentialStatus: 'ready_for_import',
      requiredScopes: [],
      grantedScopes: [],
      blockers: [],
      warnings: [],
      isActive: true,
    }];
    const verificationResult = {
      runtimeCredentialResolved: true,
      providerConnectionVerified: true,
      verifiedScopes: ['https://www.googleapis.com/auth/adwords'],
      childAccounts: [{
        accountId: '2223334444',
        name: 'HTX Search VND',
        currency: 'VND',
        timezoneId: 'Asia/Ho_Chi_Minh',
        status: 'ENABLED',
      }],
    };
    const { service, managerModel, adAccountModel, readonlyVerifier } = makeService({
      records,
      verificationResult,
    });

    const result = await service.verifyAndImportReadOnly('google-mcc-id', 'director-id');

    expect(readonlyVerifier.verifyGoogleMcc).toHaveBeenCalledWith({
      managerAccountId: '1234567890',
      vaultProvider: 'env_reference',
      credentialReferenceId: undefined,
    });
    expect(adAccountModel.bulkWrite).toHaveBeenCalledWith([
      expect.objectContaining({
        updateOne: expect.objectContaining({
          filter: { accountType: 'google', accountId: '2223334444' },
          update: expect.objectContaining({
            $set: expect.objectContaining({
              currency: 'VND',
              timezoneId: 'Asia/Ho_Chi_Minh',
              loginCustomerId: '1234567890',
              managementMode: 'mcc',
            }),
          }),
          upsert: true,
        }),
      }),
    ], { ordered: true });
    expect(managerModel.findByIdAndUpdate).toHaveBeenCalledWith('google-mcc-id', expect.objectContaining({
      $set: expect.objectContaining({
        providerVerificationStatus: 'verified',
        providerApiCalled: true,
        runtimeCredentialResolved: true,
        providerConnectionVerified: true,
        childAccountsVerifiedByProvider: true,
        childAccountIds: ['2223334444'],
        providerVerifiedByUserId: 'director-id',
      }),
    }), { new: true, runValidators: true });
    expect(result.providerReadiness).toEqual(expect.objectContaining({
      classification: 'provider_verified_readonly',
      verificationFresh: true,
      readyForReadOnlyProviderCall: true,
      readyForLiveExecution: false,
    }));
    expect(result.safety).toEqual(expect.objectContaining({
      provider_api_called: true,
      production_ready: false,
      execution_allowed_now: false,
    }));
    expect(JSON.stringify(result)).not.toContain('refreshToken');
    const importedSet = adAccountModel.bulkWrite.mock.calls[0][0][0].updateOne.update.$set;
    expect(importedSet).not.toHaveProperty('lastSyncAt');
    expect(importedSet).not.toHaveProperty('lastSyncStatus');
  });

  it('imports discovered metadata but blocks readiness when currency/timezone guardrails mismatch', async () => {
    const records = [{
      _id: 'google-mcc-id',
      name: 'Production MCC',
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '1234567890',
      vaultProvider: 'env_reference',
      blockers: [],
      isActive: true,
    }];
    const { service, adAccountModel } = makeService({
      records,
      verificationResult: {
        runtimeCredentialResolved: true,
        providerConnectionVerified: true,
        verifiedScopes: ['https://www.googleapis.com/auth/adwords'],
        childAccounts: [{
          accountId: '9998887777',
          name: 'Unexpected account locale',
          currency: 'USD',
          timezoneId: 'America/Los_Angeles',
          status: 'ENABLED',
        }],
      },
    });

    const result = await service.verifyAndImportReadOnly('google-mcc-id', 'director-id');

    expect(adAccountModel.bulkWrite).toHaveBeenCalled();
    const importedSet = adAccountModel.bulkWrite.mock.calls[0][0][0].updateOne.update.$set;
    expect(importedSet.isActive).toBe(false);
    expect(result.verifiedChildAccounts[0]).toEqual(expect.objectContaining({
      currency: 'USD',
      timezoneId: 'America/Los_Angeles',
    }));
    expect(result.blockers).toEqual(expect.arrayContaining([
      'provider_verification.child_currency_not_vnd',
      'provider_verification.child_timezone_not_asia_ho_chi_minh',
    ]));
    expect(result.providerReadiness.classification).toBe('provider_verification_incomplete');
    expect(result.providerReadiness.readyForReadOnlyProviderCall).toBe(false);
    expect(result.capabilities.canImportReadOnly).toBe(false);
    expect(result.safety.execution_allowed_now).toBe(false);
  });

  it('marks Meta/TikTok read-only verification unsupported without calling a provider', async () => {
    const records = [{
      _id: 'meta-bm-id',
      name: 'Meta BM',
      provider: 'facebook',
      managerAccountType: 'meta_business_manager',
      managerAccountId: 'BM-1',
      blockers: [],
      isActive: true,
    }];
    const { service, readonlyVerifier } = makeService({ records });

    const result = await service.verifyAndImportReadOnly('meta-bm-id', 'director-id');

    expect(readonlyVerifier.verifyGoogleMcc).not.toHaveBeenCalled();
    expect(result.providerReadiness.classification).toBe('provider_verification_unsupported');
    expect(result.blockers).toContain('provider_verification.readonly_discovery_unsupported');
    expect(result.safety.provider_api_called).toBe(false);
    expect(result.safety.execution_allowed_now).toBe(false);
  });

  it('fails closed and persists only a sanitized provider verification error', async () => {
    const records = [{
      _id: 'google-mcc-id',
      name: 'Google MCC',
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '1234567890',
      blockers: [],
      isActive: true,
    }];
    const { service, managerModel } = makeService({
      records,
      verificationError: new Error('Bearer very-secret-token provider rejected request'),
    });

    await expect(service.verifyAndImportReadOnly('google-mcc-id', 'director-id'))
      .rejects.toThrow('Google MCC read-only verification failed');

    const failureUpdate = managerModel.findByIdAndUpdate.mock.calls.at(-1)?.[1];
    expect(failureUpdate.$set).toEqual(expect.objectContaining({
      providerVerificationStatus: 'failed',
      providerApiCalled: true,
      providerConnectionVerified: false,
      childAccountsVerifiedByProvider: false,
    }));
    expect(JSON.stringify(failureUpdate)).not.toContain('very-secret-token');
  });

  it('refuses verification without a canonical authenticated Director identity', async () => {
    const records = [{
      _id: 'google-mcc-id',
      name: 'Google MCC',
      provider: 'google',
      managerAccountType: 'google_ads_mcc',
      managerAccountId: '1234567890',
      blockers: [],
      isActive: true,
    }];
    const { service, readonlyVerifier, adAccountModel } = makeService({ records });

    await expect(service.verifyAndImportReadOnly('google-mcc-id', '  '))
      .rejects.toThrow('Authenticated Director identity is required');
    expect(readonlyVerifier.verifyGoogleMcc).not.toHaveBeenCalled();
    expect(adAccountModel.bulkWrite).not.toHaveBeenCalled();
  });
});
