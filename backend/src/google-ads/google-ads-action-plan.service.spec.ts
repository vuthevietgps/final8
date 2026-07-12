import { BadRequestException } from '@nestjs/common';
import { GoogleAdsActionApprovalPolicyService } from './google-ads-action-approval-policy.service';
import { GoogleAdsActionPlanService } from './google-ads-action-plan.service';

const action = (overrides: Record<string, any> = {}) => ({
  actionId: 'ACT001',
  idempotencyKey: 'PLAN-001:ACT001',
  actionType: 'create_keyword',
  status: 'pending',
  providerValidationStatus: 'provider_validate_passed',
  approvalHistory: [],
  ...overrides,
});

const plan = (items: any[]) => ({
  planId: 'PLAN-001',
  status: 'pending_approval',
  items,
  markModified: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
});

describe('GoogleAdsActionPlanService', () => {
  const actionPlanModel = {
    findOne: jest.fn(),
    exists: jest.fn(),
  };
  const executionLogModel = {
    find: jest.fn(),
  };
  const service = new GoogleAdsActionPlanService(
    actionPlanModel as any,
    executionLogModel as any,
    new GoogleAdsActionApprovalPolicyService(),
  );
  const director = { id: 'user-1', email: 'director@example.com', role: 'director' };

  beforeEach(() => jest.clearAllMocks());

  it('approves a provider-validated action and preserves approvalText verbatim', async () => {
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    const approvalText = '  Người dùng duyệt nguyên văn ACT001.  ';

    const result = await service.approve(director, document.planId, 'ACT001', {
      approvedBySource: 'codex_operator',
      approvalText,
      requireExecutionConfirmation: true,
    });

    expect(document.items[0]).toEqual(expect.objectContaining({
      status: 'approved',
      approvalText,
      approvedBy: 'director@example.com',
      approvedByUserId: 'user-1',
      approvedBySource: 'codex_operator',
      requireExecutionConfirmation: true,
    }));
    expect(document.items[0].approvedAt).toBeInstanceOf(Date);
    expect(document.items[0].approvalHistory[0].text).toBe(approvalText);
    expect(document.status).toBe('approved');
    expect(document.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ success: true, planStatus: 'approved' }));
  });

  it('rejects an action with a required verbatim reason', async () => {
    const document = plan([action()]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);
    const reason = '  Keyword quá rộng, cần chỉnh lại.  ';

    await service.reject(director, document.planId, 'ACT001', {
      rejectedBySource: 'codex_operator',
      reason,
    });

    expect(document.items[0]).toEqual(expect.objectContaining({
      status: 'rejected',
      rejectionReason: reason,
      rejectedBy: 'director@example.com',
      rejectedByUserId: 'user-1',
      rejectedBySource: 'codex_operator',
    }));
    expect(document.items[0].rejectedAt).toBeInstanceOf(Date);
    expect(document.items[0].approvalHistory[0].text).toBe(reason);
    expect(document.status).toBe('rejected');
  });

  it('blocks approval before provider validateOnly passes', async () => {
    const document = plan([action({ providerValidationStatus: 'pending' })]);
    actionPlanModel.findOne.mockResolvedValueOnce(document);

    await expect(service.approve(director, document.planId, 'ACT001', {
      approvedBySource: 'codex_operator',
      approvalText: 'Approve ACT001',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(document.save).not.toHaveBeenCalled();
  });

  it('requires a reject reason and never changes the action', async () => {
    const document = plan([action()]);

    await expect(service.reject(director, document.planId, 'ACT001', {
      rejectedBySource: 'codex_operator',
      reason: '   ',
    })).rejects.toThrow('reason is required');
    expect(actionPlanModel.findOne).not.toHaveBeenCalled();
    expect(document.save).not.toHaveBeenCalled();
  });

  it('returns execution logs without executing actions', async () => {
    actionPlanModel.exists.mockResolvedValueOnce({ _id: 'plan-object-id' });
    const lean = jest.fn().mockResolvedValue([{ actionId: 'ACT001', status: 'dry_run' }]);
    const sort = jest.fn(() => ({ lean }));
    executionLogModel.find.mockReturnValueOnce({ sort } as any);

    const result = await service.getExecutions('PLAN-001');

    expect(executionLogModel.find).toHaveBeenCalledWith({ planId: 'PLAN-001' });
    expect(result).toEqual(expect.objectContaining({ total: 1 }));
  });
});
