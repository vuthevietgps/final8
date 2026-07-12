import { AdsManagerAccountReadonlyVerificationService } from './ads-manager-account-readonly-verification.service';

describe('AdsManagerAccountReadonlyVerificationService', () => {
  it('resolves the declared env runtime and performs only the constrained manager-child query', async () => {
    const apiTokenService = {
      getGoogleAdsRuntimeConfig: jest.fn().mockResolvedValue({
        clientId: 'configured-client',
        clientSecret: 'configured-secret',
        refreshToken: 'configured-refresh',
        developerToken: 'configured-developer',
        loginCustomerId: '1234567890',
        apiVersion: 'v24',
        configSource: 'env',
        refreshTokenSource: 'env',
      }),
    };
    const transport = {
      searchStream: jest.fn().mockResolvedValue([
        {
          customerClient: {
            clientCustomer: 'customers/2223334444',
            descriptiveName: 'HTX VND',
            currencyCode: 'VND',
            timeZone: 'Asia/Ho_Chi_Minh',
            status: 'ENABLED',
            manager: false,
            level: 1,
          },
        },
      ]),
    };
    const service = new AdsManagerAccountReadonlyVerificationService(apiTokenService as any);
    (service as any).transportInstance = transport;

    const result = await service.verifyGoogleMcc({
      managerAccountId: '123-456-7890',
      vaultProvider: 'env_reference',
    });

    expect(transport.searchStream).toHaveBeenCalledWith(expect.objectContaining({
      customerId: '1234567890',
      loginCustomerId: '1234567890',
      allowedCustomerIds: ['1234567890'],
      templateId: 'manager_children',
    }));
    expect(result).toEqual({
      runtimeCredentialResolved: true,
      providerConnectionVerified: true,
      verifiedScopes: ['https://www.googleapis.com/auth/adwords'],
      childAccounts: [{
        accountId: '2223334444',
        name: 'HTX VND',
        currency: 'VND',
        timezoneId: 'Asia/Ho_Chi_Minh',
        status: 'ENABLED',
      }],
    });
    expect(JSON.stringify(result)).not.toContain('configured-secret');
  });

  it('fails before transport when the registry reference does not resolve to its declared source', async () => {
    const apiTokenService = {
      getGoogleAdsRuntimeConfig: jest.fn().mockResolvedValue({
        apiVersion: 'v24',
        loginCustomerId: '1234567890',
        configSource: 'none',
        refreshTokenSource: 'none',
      }),
    };
    const transport = { searchStream: jest.fn() };
    const service = new AdsManagerAccountReadonlyVerificationService(apiTokenService as any);
    (service as any).transportInstance = transport;

    await expect(service.verifyGoogleMcc({
      managerAccountId: '1234567890',
      vaultProvider: 'erp_secret_store',
      credentialReferenceId: '507f1f77bcf86cd799439011',
    })).rejects.toThrow('did not resolve');
    expect(transport.searchStream).not.toHaveBeenCalled();
  });
});
