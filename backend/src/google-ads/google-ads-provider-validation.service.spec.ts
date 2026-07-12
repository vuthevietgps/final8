import axios from 'axios';
import { GoogleAdsActionApprovalPolicyService } from './google-ads-action-approval-policy.service';
import { GoogleAdsOperationBuilderService } from './google-ads-operation-builder.service';
import { GoogleAdsProviderValidationService } from './google-ads-provider-validation.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const action = (overrides: Record<string, any> = {}) => ({
  actionId: 'ACT001',
  actionType: 'create_keyword',
  customerId: '1234567890',
  loginCustomerId: '4345552613',
  typedPayload: {
    adGroupId: '9876543210',
    keywordText: 'sample product',
    matchType: 'PHRASE',
    negative: false,
  },
  status: 'pending',
  providerValidationStatus: 'pending',
  ...overrides,
});

const plan = (items: any[]) => ({
  planId: 'PLAN-20260612-001',
  status: 'pending_approval',
  providerValidationStatus: 'pending',
  providerValidationErrors: [],
  items,
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

describe('GoogleAdsProviderValidationService', () => {
  const apiTokenService = {
    getGoogleAdsRuntimeConfig: jest.fn().mockResolvedValue({
      developerToken: 'developer-secret',
      refreshToken: 'refresh-secret',
      loginCustomerId: '4345552613',
      apiVersion: 'v20',
    }),
    getGoogleAdsAccessToken: jest.fn().mockResolvedValue('access-secret'),
  };

  const createService = (document: any) => new GoogleAdsProviderValidationService(
    { findOne: jest.fn().mockResolvedValue(document) } as any,
    apiTokenService as any,
    new GoogleAdsOperationBuilderService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    apiTokenService.getGoogleAdsRuntimeConfig.mockResolvedValue({
      developerToken: 'developer-secret',
      refreshToken: 'refresh-secret',
      loginCustomerId: '4345552613',
      apiVersion: 'v20',
    });
    apiTokenService.getGoogleAdsAccessToken.mockResolvedValue('access-secret');
  });

  it('passes validateOnly without executing a live mutate', async () => {
    const document = plan([action()]);
    mockedAxios.post.mockResolvedValueOnce({
      data: {},
      headers: { 'request-id': 'request-123' },
    } as any);

    const result = await createService(document).validatePlan(document.planId);

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post.mock.calls[0][1]).toEqual(expect.objectContaining({
      validateOnly: true,
      partialFailure: false,
      mutateOperations: expect.any(Array),
    }));
    expect(document.items[0].providerValidationStatus).toBe('provider_validate_passed');
    expect(document.items[0].status).toBe('pending');
    expect(document.providerValidationStatus).toBe('passed');
    expect(result).toEqual(expect.objectContaining({ success: true, actionsPassed: 1, actionsFailed: 0 }));
  });

  it('stores redacted provider validation errors and does not approve the failed action', async () => {
    const document = plan([action()]);
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        headers: { 'request-id': 'request-failed' },
        data: {
          error: {
            code: 400,
            message: 'authorization=Bearer secret-access-token invalid request',
            details: [{
              errors: [{
                errorCode: { keywordError: 'INVALID_KEYWORD_TEXT' },
                message: 'developer_token=real-secret invalid keyword',
                location: { fieldPathElements: [{ fieldName: 'operations' }, { fieldName: 'keyword' }] },
              }],
            }],
          },
        },
      },
    });

    const result = await createService(document).validatePlan(document.planId);

    expect(document.items[0].providerValidationStatus).toBe('provider_validate_failed');
    expect(document.items[0].status).toBe('pending');
    expect(document.items[0].providerValidationErrors[0].message).toContain('[REDACTED]');
    expect(document.items[0].providerValidationErrors[0].message).not.toContain('real-secret');
    expect(document.providerValidationStatus).toBe('failed');
    expect(result).toEqual(expect.objectContaining({ success: false, actionsPassed: 0, actionsFailed: 1 }));
  });

  it('treats a validateOnly partial failure response as failed', async () => {
    const document = plan([action()]);
    mockedAxios.post.mockResolvedValueOnce({
      headers: { 'request-id': 'request-partial-failure' },
      data: { partialFailureError: { code: 3, message: 'Invalid operation.' } },
    } as any);

    await createService(document).validatePlan(document.planId);

    expect(document.items[0].providerValidationStatus).toBe('provider_validate_failed');
    expect(document.items[0].providerRequestId).toBe('request-partial-failure');
  });

  it('passes monitor-only locally without calling Google Ads', async () => {
    const document = plan([action({
      actionType: 'monitor_only',
      typedPayload: { monitorUntil: '2026-06-20', metrics: ['conversions'] },
    })]);

    await createService(document).validatePlan(document.planId);

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(apiTokenService.getGoogleAdsRuntimeConfig).not.toHaveBeenCalled();
    expect(document.items[0].providerValidationStatus).toBe('provider_validate_passed');
  });
});

describe('GoogleAdsActionApprovalPolicyService', () => {
  const policy = new GoogleAdsActionApprovalPolicyService();

  it('blocks approval when provider validateOnly failed', () => {
    expect(() => policy.assertCanApprove(action({
      providerValidationStatus: 'provider_validate_failed',
    }) as any)).toThrow('must pass provider validateOnly');
  });

  it('allows approval policy check only after provider validateOnly passed', () => {
    expect(() => policy.assertCanApprove(action({
      providerValidationStatus: 'provider_validate_passed',
    }) as any)).not.toThrow();
  });
});
