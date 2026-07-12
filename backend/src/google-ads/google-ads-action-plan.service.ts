import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleAdsActionApprovalPolicyService } from './google-ads-action-approval-policy.service';
import {
  GoogleAdsActionExecutionLog,
  GoogleAdsActionExecutionLogDocument,
} from './schemas/google-ads-action-execution-log.schema';
import {
  GoogleAdsActionPlan,
  GoogleAdsActionPlanDocument,
  GoogleAdsActionPlanItem,
} from './schemas/google-ads-action-plan.schema';

type ApprovalBody = {
  approvedBySource?: string;
  approvalText?: string;
  requireExecutionConfirmation?: boolean;
};

type RejectionBody = {
  rejectedBySource?: string;
  reason?: string;
};

@Injectable()
export class GoogleAdsActionPlanService {
  constructor(
    @InjectModel(GoogleAdsActionPlan.name)
    private readonly actionPlanModel: Model<GoogleAdsActionPlanDocument>,
    @InjectModel(GoogleAdsActionExecutionLog.name)
    private readonly executionLogModel: Model<GoogleAdsActionExecutionLogDocument>,
    private readonly approvalPolicy: GoogleAdsActionApprovalPolicyService,
  ) {}

  async getPlan(planId: string) {
    const plan = await this.actionPlanModel.findOne({ planId: this.requiredText(planId, 'planId') }).lean();
    if (!plan) throw new NotFoundException('Google Ads action plan not found.');
    return { success: true, plan };
  }

  async getExecutions(planId: string) {
    const normalizedPlanId = this.requiredText(planId, 'planId');
    const exists = await this.actionPlanModel.exists({ planId: normalizedPlanId });
    if (!exists) throw new NotFoundException('Google Ads action plan not found.');
    const executions = await this.executionLogModel
      .find({ planId: normalizedPlanId })
      .sort({ executedAt: -1, createdAt: -1 })
      .lean();
    return { success: true, planId: normalizedPlanId, executions, total: executions.length };
  }

  async approve(currentUser: any, planId: string, actionId: string, body: ApprovalBody) {
    const approvalText = this.requiredOriginalText(body?.approvalText, 'approvalText');
    this.assertCodexSource(body?.approvedBySource, 'approvedBySource');
    const plan: any = await this.loadPlan(planId);
    const action = this.findAction(plan, actionId);
    this.assertDecisionAllowed(action);
    this.approvalPolicy.assertCanApprove(action);

    const at = new Date();
    const actor = this.userLabel(currentUser);
    const actorId = this.userId(currentUser);
    action.status = 'approved';
    action.approvalText = approvalText;
    action.approvedBy = actor;
    action.approvedByUserId = actorId;
    action.approvedAt = at;
    action.approvedBySource = 'codex_operator';
    action.requireExecutionConfirmation = body?.requireExecutionConfirmation !== false;
    action.rejectionReason = undefined;
    action.rejectedBy = undefined;
    action.rejectedByUserId = undefined;
    action.rejectedAt = undefined;
    action.rejectedBySource = undefined;
    action.approvalHistory = [
      ...(action.approvalHistory || []),
      { decision: 'approved', text: approvalText, by: actor, byUserId: actorId, source: 'codex_operator', at },
    ];

    await this.saveDecision(plan);
    return { success: true, planId: plan.planId, planStatus: plan.status, action };
  }

  async reject(currentUser: any, planId: string, actionId: string, body: RejectionBody) {
    const reason = this.requiredOriginalText(body?.reason, 'reason');
    this.assertCodexSource(body?.rejectedBySource, 'rejectedBySource');
    const plan: any = await this.loadPlan(planId);
    const action = this.findAction(plan, actionId);
    this.assertDecisionAllowed(action);

    const at = new Date();
    const actor = this.userLabel(currentUser);
    const actorId = this.userId(currentUser);
    action.status = 'rejected';
    action.rejectionReason = reason;
    action.rejectedBy = actor;
    action.rejectedByUserId = actorId;
    action.rejectedAt = at;
    action.rejectedBySource = 'codex_operator';
    action.approvalText = undefined;
    action.approvedBy = undefined;
    action.approvedByUserId = undefined;
    action.approvedAt = undefined;
    action.approvedBySource = undefined;
    action.requireExecutionConfirmation = undefined;
    action.approvalHistory = [
      ...(action.approvalHistory || []),
      { decision: 'rejected', text: reason, by: actor, byUserId: actorId, source: 'codex_operator', at },
    ];

    await this.saveDecision(plan);
    return { success: true, planId: plan.planId, planStatus: plan.status, action };
  }

  private async loadPlan(planId: string) {
    const plan = await this.actionPlanModel.findOne({ planId: this.requiredText(planId, 'planId') });
    if (!plan) throw new NotFoundException('Google Ads action plan not found.');
    if (['executing', 'executed', 'failed'].includes(plan.status)) {
      throw new BadRequestException(`Cannot change approval when plan status is ${plan.status}.`);
    }
    return plan;
  }

  private findAction(plan: GoogleAdsActionPlan, actionId: string) {
    const normalizedActionId = this.requiredText(actionId, 'actionId');
    const action = plan.items.find((item) => item.actionId === normalizedActionId);
    if (!action) throw new NotFoundException('Google Ads action plan item not found.');
    return action;
  }

  private assertDecisionAllowed(action: GoogleAdsActionPlanItem) {
    if (['executed', 'failed'].includes(action.status)) {
      throw new BadRequestException(`Cannot change approval when action status is ${action.status}.`);
    }
  }

  private async saveDecision(plan: any) {
    this.refreshPlanStatus(plan);
    plan.markModified('items');
    await plan.save();
  }

  private refreshPlanStatus(plan: GoogleAdsActionPlan) {
    const statuses = plan.items.map((item) => item.status);
    if (statuses.length && statuses.every((status) => status === 'approved')) {
      plan.status = 'approved';
    } else if (statuses.length && statuses.every((status) => status === 'rejected')) {
      plan.status = 'rejected';
    } else if (statuses.some((status) => status === 'approved')) {
      plan.status = 'partially_approved';
    } else {
      plan.status = 'pending_approval';
    }
  }

  private assertCodexSource(value: any, field: string) {
    if (value !== undefined && value !== 'codex_operator') {
      throw new BadRequestException(`${field} must be codex_operator.`);
    }
  }

  private requiredText(value: any, field: string) {
    const normalized = String(value || '').trim();
    if (!normalized) throw new BadRequestException(`${field} is required.`);
    return normalized;
  }

  private requiredOriginalText(value: any, field: string) {
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${field} is required.`);
    return value;
  }

  private userLabel(user: any) {
    return String(user?.email || user?.username || user?.fullName || user?._id || user?.id || 'unknown');
  }

  private userId(user: any) {
    const value = user?.id || user?._id || user?.sub;
    return value ? String(value) : undefined;
  }
}
