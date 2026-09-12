import { BadRequestException } from '@nestjs/common';
import { MetaAdsApprovalService } from './meta-ads-approval.service';

function validAction(overrides: Record<string, unknown> = {}): any {
  const now = Date.now();
  return {
    actionId: 'META-ACT-1',
    idempotencyKey: 'META:ACTION:0001',
    actionType: 'pause_campaign',
    adAccountId: '123456',
    campaignId: '998877',
    reason: 'Emergency loss guard',
    payloadHash: 'a'.repeat(64),
    workflowStatus: 'pending_approval',
    providerValidationStatus: 'passed',
    providerValidatedAt: new Date(now - 1000),
    providerValidationExpiresAt: new Date(now + 60_000),
    providerValidationPayloadHash: 'a'.repeat(64),
    providerValidationBeforeStateHash: 'b'.repeat(64),
    providerValidationGraphApiVersion: 'v25.0',
    providerValidationCredentialReferenceId: 'meta-token-ref-1',
    revision: 2,
    ...overrides,
  };
}

function queryResult(value: unknown): any {
  return {
    lean: () => ({ exec: async () => value }),
  };
}

describe('MetaAdsApprovalService', () => {
  it('blocks creator self-approval before the atomic approval write', async () => {
    const plan = {
      _id: 'plan-db-id',
      planId: 'META-PLAN-1',
      createdByUserId: 'creator-1',
      actions: [validAction()],
    };
    const model = {
      findOne: jest.fn(() => queryResult(plan)),
      findOneAndUpdate: jest.fn(),
    };
    const service = new MetaAdsApprovalService(model as any);

    await expect(service.approve(
      plan.planId,
      'META-ACT-1',
      'creator-1',
      { expectedActionRevision: 2 },
    )).rejects.toThrow('creator cannot approve');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('requires fresh validation bound to payload, state, v25 and credential', () => {
    const service = new MetaAdsApprovalService({} as any);
    expect(() => service.assertFreshProviderValidation(validAction())).not.toThrow();
    expect(() => service.assertFreshProviderValidation(validAction({
      providerValidationPayloadHash: 'c'.repeat(64),
    }))).toThrow('canonical payload');
    expect(() => service.assertFreshProviderValidation(validAction({
      providerValidationExpiresAt: new Date(Date.now() - 1),
    }))).toThrow('expired');
    expect(() => service.assertFreshProviderValidation(validAction({
      providerValidationGraphApiVersion: 'v24.0',
    }))).toThrow('v25.0');
  });

  it('performs approval as an optimistic per-action atomic transition', async () => {
    const plan = {
      _id: 'plan-db-id',
      planId: 'META-PLAN-1',
      createdByUserId: 'creator-1',
      actions: [validAction()],
      revision: 4,
    };
    const approved = {
      ...plan,
      actions: [validAction({
        workflowStatus: 'approved',
        approvedByUserId: 'director-2',
        revision: 3,
      })],
      revision: 5,
    };
    const model = {
      findOne: jest.fn(() => queryResult(plan)),
      findOneAndUpdate: jest.fn(() => queryResult(approved)),
    };
    const service = new MetaAdsApprovalService(model as any);

    const result = await service.approve(
      plan.planId,
      'META-ACT-1',
      'director-2',
      { expectedActionRevision: 2, note: 'Reviewed' },
    );

    expect(result.action.workflowStatus).toBe('approved');
    const [filter, update] = (model.findOneAndUpdate as jest.Mock).mock.calls[0] as [any, any];
    expect(filter.actions.$elemMatch).toMatchObject({
      actionId: 'META-ACT-1',
      revision: 2,
      workflowStatus: 'pending_approval',
      providerValidationStatus: 'passed',
      providerValidationGraphApiVersion: 'v25.0',
    });
    expect(update.$inc).toEqual({ 'actions.$.revision': 1, revision: 1 });
  });

  it('rejects validation timestamps more than 60 seconds in the future', () => {
    const service = new MetaAdsApprovalService({} as any);
    expect(() => service.assertFreshProviderValidation(validAction({
      providerValidatedAt: new Date(Date.now() + 61_000),
    }))).toThrow(BadRequestException);
  });
});
