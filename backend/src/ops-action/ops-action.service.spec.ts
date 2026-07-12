import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { OpsActionService } from './ops-action.service';
import { OpsActionItem, OpsActionsResponse } from './interfaces/ops-action.interfaces';

describe('OpsActionService approval plans', () => {
  const makeSuggestion = (overrides: Partial<OpsActionItem> = {}): OpsActionItem => ({
    actionType: 'SUPPLIER_OVER_THRESHOLD',
    priority: 'high',
    title: 'Thu hoa hong NCC ton dong lon',
    description: 'Con 6,000,000 VND chua duoc NCC thanh toan.',
    reason: 'Vuot nguong can xu ly.',
    linkTo: '/payments/supplier',
    amount: 6_000_000,
    count: 2,
    generatedAt: new Date('2026-06-09T00:00:00.000Z').toISOString(),
    ...overrides,
  });

  const makeSuggestionsResponse = (actions: OpsActionItem[]): OpsActionsResponse => ({
    actions,
    totalCount: actions.length,
    criticalCount: actions.filter((item) => item.priority === 'critical').length,
    highCount: actions.filter((item) => item.priority === 'high').length,
    mediumCount: actions.filter((item) => item.priority === 'medium').length,
    bySeverity: {
      critical: actions.filter((item) => item.priority === 'critical').length,
      high: actions.filter((item) => item.priority === 'high').length,
      medium: actions.filter((item) => item.priority === 'medium').length,
      low: actions.filter((item) => item.priority === 'low').length,
    },
    asOf: new Date('2026-06-09T01:00:00.000Z').toISOString(),
    dataSources: { supplierPayable: true, agentReceivable: true },
  });

  const makePlanDoc = (tasks: any[]) => ({
    _id: new Types.ObjectId(),
    title: 'Ops action plan',
    status: 'pending_approval',
    tasks,
    markModified: jest.fn(),
    save: jest.fn(),
  });

  const createService = (overrides: Record<string, any> = {}) => {
    const planModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      ...overrides.planModel,
    };
    const service = new OpsActionService(
      planModel as any,
      overrides.supplierPayableService || {},
      overrides.agentReceivableService || {},
      overrides.alertsEventsService || { createAlert: jest.fn() },
    );

    return { service, planModel };
  };

  it('creates an approval-only plan from current suggestions', async () => {
    const actions = [
      makeSuggestion({ priority: 'critical', actionType: 'AGENT_CLAWBACK_OUTSTANDING' }),
      makeSuggestion({ priority: 'medium', actionType: 'SUPPLIER_AGING_8_14' }),
    ];
    const { service, planModel } = createService({
      planModel: { create: jest.fn((payload) => Promise.resolve({ _id: 'plan-1', ...payload })) },
    });
    jest.spyOn(service, 'getActionSuggestions').mockResolvedValue(makeSuggestionsResponse(actions));

    const result = await service.createPlanFromSuggestions(
      { email: 'director@example.com' },
      { title: 'Morning ops plan', priorities: ['critical'], limit: 10 },
    );

    expect(result.success).toBe(true);
    expect(planModel.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Morning ops plan',
      status: 'pending_approval',
      mode: 'approval_only',
      createdBy: 'director@example.com',
      tasks: [expect.objectContaining({
        actionType: 'AGENT_CLAWBACK_OUTSTANDING',
        priority: 'critical',
        requiresApproval: true,
        status: 'pending',
        metadata: expect.objectContaining({
          executionMode: 'approval_only_no_live_apply',
          liveApplyEnabled: false,
        }),
      })],
      summary: expect.objectContaining({
        selectedSuggestions: 1,
        executionMode: 'approval_only_no_live_apply',
        liveApplyEnabled: false,
      }),
    }));
  });

  it('approves a task without live execution', async () => {
    const taskId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const plan = makePlanDoc([
      {
        _id: taskId,
        actionType: 'SUPPLIER_OVER_THRESHOLD',
        priority: 'high',
        status: 'pending',
        metadata: {},
      },
    ]);
    const { service, planModel } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
    });

    const result = await service.approveTask(
      { email: 'manager@example.com' },
      String(planId),
      String(taskId),
      { note: 'ok' },
    );

    expect(result.execution).toEqual(expect.objectContaining({
      applied: false,
      mode: 'approval_only_no_live_apply',
    }));
    expect(plan.tasks[0]).toEqual(expect.objectContaining({
      status: 'approved',
      approvedBy: 'manager@example.com',
      rejectionReason: undefined,
    }));
    expect(plan.status).toBe('approved');
    expect(plan.markModified).toHaveBeenCalledWith('tasks');
    expect(plan.save).toHaveBeenCalled();
    expect(planModel.findById).toHaveBeenCalledWith(String(planId));
  });

  it('rejects a task and keeps the action manual-only', async () => {
    const taskId = new Types.ObjectId();
    const planId = new Types.ObjectId();
    const plan = makePlanDoc([
      {
        _id: taskId,
        actionType: 'AGENT_COMMISSION_DUE_14D',
        priority: 'high',
        status: 'pending',
        metadata: {},
      },
    ]);
    const { service } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
    });

    const result = await service.rejectTask(
      { fullName: 'Ops Manager' },
      String(planId),
      String(taskId),
      { reason: 'Needs review' },
    );

    expect(result.execution.applied).toBe(false);
    expect(plan.tasks[0]).toEqual(expect.objectContaining({
      status: 'rejected',
      rejectedBy: 'Ops Manager',
      rejectionReason: 'Needs review',
      approvedBy: undefined,
    }));
    expect(plan.status).toBe('rejected');
  });

  it('throws for invalid plan ids before querying the model', async () => {
    const { service, planModel } = createService();

    await expect(service.approveTask({}, 'not-an-id', String(new Types.ObjectId()), {})).rejects.toBeInstanceOf(BadRequestException);
    expect(planModel.findById).not.toHaveBeenCalled();
  });

  it('throws when the task is missing', async () => {
    const plan = makePlanDoc([]);
    const { service } = createService({
      planModel: { findById: jest.fn().mockResolvedValue(plan) },
    });

    await expect(
      service.approveTask({}, String(new Types.ObjectId()), String(new Types.ObjectId()), {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
