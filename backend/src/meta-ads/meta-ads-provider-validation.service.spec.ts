import { MetaAdsProviderValidationService } from './meta-ads-provider-validation.service';
import { MetaAdsProviderError } from './meta-ads-provider-client.service';

describe('MetaAdsProviderValidationService', () => {
  const action: any = {
    actionId: 'META-ACT-1',
    idempotencyKey: 'meta:plan:action',
    actionType: 'create_campaign',
    adAccountId: '123',
    payloadHash: 'a'.repeat(64),
    workflowStatus: 'validating',
    providerValidationStatus: 'pending',
  };
  const plan: any = { planId: 'META-PLAN-1', actions: [action], revision: 1 };
  const planModel = {
    exists: jest.fn().mockResolvedValue({ _id: 'plan-id' }),
    findOneAndUpdate: jest.fn().mockResolvedValue(plan),
    updateOne: jest.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const preflight: any = {
    providerAction: { actionType: 'create_campaign', adAccountId: '123' },
    payloadHash: 'a'.repeat(64),
    beforeStateHash: 'b'.repeat(64),
    graphApiVersion: 'v25.0',
    credentialReferenceId: 'credential-1',
  };
  const policy = { preflightValidation: jest.fn().mockResolvedValue(preflight) };
  const providerClient = { validateOnly: jest.fn() };
  const service = () => new MetaAdsProviderValidationService(
    planModel as any,
    policy as any,
    providerClient as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    planModel.exists.mockResolvedValue({ _id: 'plan-id' });
    planModel.findOneAndUpdate.mockResolvedValue({ ...plan, actions: [{ ...action }] });
    planModel.updateOne.mockResolvedValue({ matchedCount: 1 });
    policy.preflightValidation.mockResolvedValue(preflight);
  });

  it('persists fresh payload/state/version/exact-credential evidence after provider validate_only', async () => {
    providerClient.validateOnly.mockResolvedValue({
      providerRequestId: 'trace-1',
      credentialReferenceId: 'credential-1',
      response: { success: true },
    });

    const result = await service().validateActions(plan.planId, [action.actionId]);

    expect(result.success).toBe(true);
    expect(providerClient.validateOnly).toHaveBeenCalledWith(
      preflight.providerAction,
      'credential-1',
    );
    expect(planModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          'actions.$.workflowStatus': 'pending_approval',
          'actions.$.providerValidationStatus': 'passed',
          'actions.$.providerValidationPayloadHash': 'a'.repeat(64),
          'actions.$.providerValidationBeforeStateHash': 'b'.repeat(64),
          'actions.$.providerValidationGraphApiVersion': 'v25.0',
          'actions.$.providerValidationCredentialReferenceId': 'credential-1',
        }),
      }),
    );
  });

  it('fails validation without leaking credential material', async () => {
    providerClient.validateOnly.mockRejectedValue(
      new MetaAdsProviderError('authorization=Bearer actual-token', 'definitive_failure', 'trace-2', '100'),
    );

    const result = await service().validateActions(plan.planId, [action.actionId]);

    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain('actual-token');
    expect(planModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          'actions.$.workflowStatus': 'validation_failed',
          'actions.$.providerValidationStatus': 'failed',
          'actions.$.providerValidationErrorCode': '100',
        }),
      }),
    );
  });
});

