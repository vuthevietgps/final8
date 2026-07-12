/**
 * File: ops-action/ops-action.service.ts
 * Mục đích: Tổng hợp hành động khẩn cấp vận hành từ 2 nguồn:
 * - Supplier Payable (NCC chưa trả hoa hồng)
 * - Agent Receivable (Hoa hồng đại lý)
 * Pattern theo: financial-control.service.ts::getActionSuggestions()
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { AgentReceivableService } from '../agent-receivable/agent-receivable.service';
import { AdsAlertsEventsService } from '../ads-alerts/ads-alerts-events.service';
import {
  ApproveOpsTaskDto,
  CreateOpsActionPlanFromSuggestionsDto,
  ListOpsActionPlansQueryDto,
  ListOpsTasksQueryDto,
  RejectOpsTaskDto,
} from './dto/ops-action-plan.dto';
import {
  OpsActionItem,
  OpsActionsResponse,
  OpsActionPriority,
} from './interfaces/ops-action.interfaces';
import {
  OpsActionPlan,
  OpsActionPlanDocument,
  OpsTask,
} from './schemas/ops-action-plan.schema';

const AMOUNT_THRESHOLD = 5_000_000;

@Injectable()
export class OpsActionService {
  private readonly logger = new Logger(OpsActionService.name);

  constructor(
    @InjectModel(OpsActionPlan.name)
    private readonly planModel: Model<OpsActionPlanDocument>,
    private readonly supplierPayableService: SupplierPayableService,
    private readonly agentReceivableService: AgentReceivableService,
    private readonly alertsEventsService: AdsAlertsEventsService,
  ) {}

  async getActionSuggestions(): Promise<OpsActionsResponse> {
    const now = new Date();

    const [supplierCashflow, supplierAging, agentCashflow] =
      await Promise.allSettled([
        this.supplierPayableService.getCashflowSummary(),
        this.supplierPayableService.getSupplierAgingSummary(),
        this.agentReceivableService.getCashflowSummary(14),
      ]);

    const actions: OpsActionItem[] = [];
    const generatedAt = now.toISOString();

    // === SUPPLIER ACTIONS ===
    if (supplierAging.status === 'fulfilled') {
      const aging = supplierAging.value;

      if (aging.aging15plus.orderCount > 0) {
        actions.push({
          actionType: 'SUPPLIER_OVERDUE_15PLUS',
          priority: 'critical',
          title: `${aging.aging15plus.orderCount} đơn NCC quá hạn 15+ ngày`,
          description: `${this.fmt(aging.aging15plus.amount)} tồn đọng trên 15 ngày chưa quyết toán với NCC.`,
          reason: 'Vượt quá hạn thanh toán 15 ngày theo quy định đối soát D+10.',
          linkTo: '/purchases/payables',
          amount: aging.aging15plus.amount,
          count: aging.aging15plus.orderCount,
          generatedAt,
        });
      }

      if (aging.aging8_14.amount > AMOUNT_THRESHOLD) {
        actions.push({
          actionType: 'SUPPLIER_AGING_8_14',
          priority: 'medium',
          title: 'NCC có đơn 8-14 ngày chưa quyết toán',
          description: `${this.fmt(aging.aging8_14.amount)} trong khung 8-14 ngày, sắp đến ngưỡng quá hạn.`,
          reason: 'Sắp đến ngưỡng 15 ngày - cần xử lý trước khi quá hạn.',
          linkTo: '/purchases/payables',
          amount: aging.aging8_14.amount,
          count: aging.aging8_14.orderCount,
          generatedAt,
        });
      }
    }

    if (supplierCashflow.status === 'fulfilled') {
      const summary = supplierCashflow.value;

      if (summary.totalCommissionUnreceived > AMOUNT_THRESHOLD) {
        actions.push({
          actionType: 'SUPPLIER_OVER_THRESHOLD',
          priority: 'high',
          title: 'Thu hoa hồng NCC tồn đọng lớn',
          description: `Còn ${this.fmt(summary.totalCommissionUnreceived)} chưa được NCC thanh toán.`,
          reason: `Số dư chưa thu vượt ngưỡng ${this.fmt(AMOUNT_THRESHOLD)}.`,
          linkTo: '/payments/supplier',
          amount: summary.totalCommissionUnreceived,
          generatedAt,
        });
      }

      if (summary.openStatements > 0) {
        actions.push({
          actionType: 'SUPPLIER_OPEN_STATEMENT',
          priority: 'high',
          title: `Có ${summary.openStatements} kỳ đối soát NCC chưa đóng`,
          description: `${summary.openStatements} kỳ đối soát đang mở, cần xem lại và đóng để chính xác hóa đơn thu nhập.`,
          reason: 'Kỳ đối soát đã hết thời hạn nhưng chưa được đóng (close).',
          linkTo: '/purchases/payables',
          count: summary.openStatements,
          generatedAt,
        });
      }
    }

    // === AGENT ACTIONS ===
    if (agentCashflow.status === 'fulfilled') {
      const agent = agentCashflow.value;

      if (agent.totalAgentClawback > 0) {
        actions.push({
          actionType: 'AGENT_CLAWBACK_OUTSTANDING',
          priority: 'critical',
          title: 'Cần thu hồi hoa hồng đại lý (Clawback)',
          description: `${this.fmt(agent.totalAgentClawback)} hoa hồng đã trả nhưng đơn hàng đã bị hoàn. Cần thu hồi lại.`,
          reason: 'Đơn hàng đã hoàn sau khi đã thanh toán hoa hồng cho đại lý.',
          linkTo: '/payments/agent',
          amount: agent.totalAgentClawback,
          generatedAt,
        });

        // Per-agent clawback details
        for (const a of agent.byAgent) {
          if (a.clawback > 0) {
            actions.push({
              actionType: 'AGENT_CLAWBACK_OUTSTANDING',
              priority: 'critical',
              title: `Clawback: ${a.agentName}`,
              description: `${a.agentName} cần trả lại ${this.fmt(a.clawback)} do đơn hoàn.`,
              reason: 'Đơn hoàn sau khi đã thanh toán hoa hồng.',
              linkTo: '/payments/agent',
              amount: a.clawback,
              entityName: a.agentName,
              entityId: a.agentId,
              generatedAt,
            });
          }
        }
      }

      if (agent.totalAgentDue14d > AMOUNT_THRESHOLD) {
        actions.push({
          actionType: 'AGENT_COMMISSION_DUE_14D',
          priority: 'high',
          title: 'Hoa hồng đại lý đến hạn trong 14 ngày',
          description: `${this.fmt(agent.totalAgentDue14d)} hoa hồng cần thanh toán trong 14 ngày tới.`,
          reason: `Tổng hoa hồng đến hạn vượt ngưỡng ${this.fmt(AMOUNT_THRESHOLD)}.`,
          linkTo: '/payments/agent',
          amount: agent.totalAgentDue14d,
          generatedAt,
        });
      }

      // Check for agents with large unpaid amounts
      for (const a of agent.byAgent) {
        if (a.unpaid > AMOUNT_THRESHOLD && a.due14d > 0) {
          actions.push({
            actionType: 'AGENT_OVERDUE_15PLUS',
            priority: 'high',
            title: `Hoa hồng chưa trả: ${a.agentName}`,
            description: `${a.agentName} còn ${this.fmt(a.unpaid)} chưa thanh toán.`,
            reason: `Đại lý có hoa hồng tồn đọng vượt ngưỡng.`,
            linkTo: '/payments/agent',
            amount: a.unpaid,
            entityName: a.agentName,
            entityId: a.agentId,
            generatedAt,
          });
        }
      }

      // Biweekly payment approaching
      const payDays = agent.defaultPayDaysOfMonth || [1, 15];
      const currentDay = now.getDate();
      const nextPayDay = payDays.find((d) => d >= currentDay) || payDays[0];
      const daysUntilPay = nextPayDay >= currentDay
        ? nextPayDay - currentDay
        : 30 - currentDay + nextPayDay;

      if (daysUntilPay <= 3 && agent.totalAgentUnpaid > 0) {
        actions.push({
          actionType: 'AGENT_BIWEEKLY_APPROACHING',
          priority: 'medium',
          title: 'Kỳ thanh toán hoa hồng nửa tháng sắp đến',
          description: `Kỳ thanh toán ngày ${nextPayDay} sắp đến. Còn ${this.fmt(agent.totalAgentUnpaid)} chưa thanh toán.`,
          reason: `Thanh toán nửa tháng vào ngày 1 và 15 hàng tháng. Hiện tại là ngày ${currentDay}.`,
          linkTo: '/payments/agent',
          amount: agent.totalAgentUnpaid,
          generatedAt,
        });
      }

      if (agent.openStatements > 0) {
        actions.push({
          actionType: 'AGENT_BIWEEKLY_APPROACHING',
          priority: 'medium',
          title: `Có ${agent.openStatements} kỳ đối soát đại lý chưa đóng`,
          description: `${agent.openStatements} kỳ đối soát đại lý đang mở, cần đóng.`,
          reason: 'Kỳ đối soát chưa được close.',
          linkTo: '/agents/receivables',
          count: agent.openStatements,
          generatedAt,
        });
      }
    }

    // Sort by priority
    const priorityOrder: Record<OpsActionPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const bySeverity = {
      critical: actions.filter((a) => a.priority === 'critical').length,
      high: actions.filter((a) => a.priority === 'high').length,
      medium: actions.filter((a) => a.priority === 'medium').length,
      low: actions.filter((a) => a.priority === 'low').length,
    };

    return {
      actions,
      totalCount: actions.length,
      criticalCount: bySeverity.critical,
      highCount: bySeverity.high,
      mediumCount: bySeverity.medium,
      bySeverity,
      asOf: now.toISOString(),
      dataSources: {
        supplierPayable:
          supplierCashflow.status === 'fulfilled' ||
          supplierAging.status === 'fulfilled',
        agentReceivable: agentCashflow.status === 'fulfilled',
      },
    };
  }

  /**
   * Persist current ops suggestions as an approval-only plan.
   */
  async createPlanFromSuggestions(
    currentUser: any,
    body: CreateOpsActionPlanFromSuggestionsDto = {},
  ) {
    const payload = body || {};
    const suggestions = await this.getActionSuggestions();
    const actionTypeFilter = new Set(payload.actionTypes || []);
    const priorityFilter = new Set(payload.priorities || []);
    const selected = suggestions.actions
      .map((action, index) => ({ action, index }))
      .filter(({ action }) => {
        if (actionTypeFilter.size && !actionTypeFilter.has(action.actionType)) {
          return false;
        }
        if (priorityFilter.size && !priorityFilter.has(action.priority)) {
          return false;
        }
        return true;
      })
      .slice(0, payload.limit || suggestions.actions.length);

    const tasks = selected.map(({ action, index }) =>
      this.buildTaskFromSuggestion(action, index),
    );
    const selectedSeverity = this.countBySeverity(tasks);
    const now = new Date();

    const plan = await this.planModel.create({
      title: payload.title || `Ops action plan ${this.formatDate(now)}`,
      status: tasks.length ? 'pending_approval' : 'draft',
      source: 'ops-action-suggestions',
      mode: 'approval_only',
      summary: {
        generatedAt: now,
        sourceAsOf: suggestions.asOf,
        totalSuggestions: suggestions.totalCount,
        selectedSuggestions: tasks.length,
        bySeverity: selectedSeverity,
        sourceBySeverity: suggestions.bySeverity,
        dataSources: suggestions.dataSources,
        filters: {
          actionTypes: payload.actionTypes || [],
          priorities: payload.priorities || [],
          limit: payload.limit,
        },
        executionMode: 'approval_only_no_live_apply',
        liveApplyEnabled: false,
      },
      tasks,
      createdBy: this.getUserLabel(currentUser),
      notes: payload.notes,
    });

    return { success: true, plan };
  }

  async listPlans(query: ListOpsActionPlansQueryDto = {}) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    this.applyCreatedAtFilter(filter, query);

    const limit = query.limit || 30;
    const plans = await this.planModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return { success: true, plans, total: plans.length };
  }

  async getPlan(planId: string) {
    this.assertObjectId(planId, 'Ops action plan id');
    const plan = await this.planModel.findById(planId).lean();
    if (!plan) throw new NotFoundException('Ops action plan not found');
    return { success: true, plan };
  }

  async listTasks(query: ListOpsTasksQueryDto = {}) {
    const filter: Record<string, any> = {};
    if (query.planId) {
      this.assertObjectId(query.planId, 'Ops action plan id');
      filter._id = new Types.ObjectId(query.planId);
    }
    this.applyCreatedAtFilter(filter, query);

    const limit = query.limit || 50;
    const plans = await this.planModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(query.planId ? 1 : 100)
      .lean();

    if (query.planId && !plans.length) {
      throw new NotFoundException('Ops action plan not found');
    }

    const tasks: any[] = [];
    for (const plan of plans as any[]) {
      for (const task of plan.tasks || []) {
        if (query.status && task.status !== query.status) continue;
        if (query.priority && task.priority !== query.priority) continue;
        if (query.actionType && task.actionType !== query.actionType) continue;

        tasks.push({
          planId: String(plan._id),
          planTitle: plan.title,
          planStatus: plan.status,
          createdAt: plan.createdAt,
          updatedAt: plan.updatedAt,
          task,
        });

        if (tasks.length >= limit) {
          return { success: true, tasks, total: tasks.length };
        }
      }
    }

    return { success: true, tasks, total: tasks.length };
  }

  async approveTask(
    currentUser: any,
    planId: string,
    taskId: string,
    body: ApproveOpsTaskDto = {},
  ) {
    return this.setTaskApproval(currentUser, planId, taskId, true, body?.note);
  }

  async rejectTask(
    currentUser: any,
    planId: string,
    taskId: string,
    body: RejectOpsTaskDto = {},
  ) {
    return this.setTaskApproval(
      currentUser,
      planId,
      taskId,
      false,
      body?.reason || body?.note || 'Rejected by approver',
    );
  }

  /**
   * Cron mỗi 4 giờ (8h, 12h, 16h, 20h Vietnam): push SSE alert cho critical items.
   */
  @Cron('0 0 8,12,16,20 * * *', {
    name: 'ops-action-check',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async checkAndAlertCriticalActions(): Promise<void> {
    try {
      const result = await this.getActionSuggestions();
      const criticalItems = result.actions.filter(
        (a) => a.priority === 'critical',
      );

      for (const item of criticalItems) {
        this.alertsEventsService.createAlert({
          type: 'CRITICAL',
          category: 'BUDGET',
          title: `[Vận hành] ${item.title}`,
          message: item.description,
          action: { type: 'REVIEW', label: 'Xử lý ngay' },
        });
      }

      if (criticalItems.length > 0) {
        this.logger.warn(
          `OpsAction cron: ${criticalItems.length} critical items found`,
        );
      }
    } catch (err: any) {
      this.logger.error(`OpsAction cron failed: ${err?.message}`);
    }
  }

  private fmt(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private buildTaskFromSuggestion(
    item: OpsActionItem,
    suggestionIndex: number,
  ): Partial<OpsTask> {
    return {
      actionType: item.actionType,
      priority: item.priority,
      title: item.title,
      description: item.description,
      reason: item.reason,
      linkTo: item.linkTo,
      amount: item.amount,
      count: item.count,
      entityName: item.entityName,
      entityId: item.entityId,
      sourceGeneratedAt: new Date(item.generatedAt),
      sourceSuggestionKey: this.buildSourceSuggestionKey(item),
      requiresApproval: true,
      status: 'pending',
      sourceSnapshot: item,
      metadata: {
        suggestionIndex,
        executionMode: 'approval_only_no_live_apply',
        liveApplyEnabled: false,
      },
    };
  }

  private async setTaskApproval(
    currentUser: any,
    planId: string,
    taskId: string,
    approved: boolean,
    note?: string,
  ) {
    this.assertObjectId(planId, 'Ops action plan id');
    this.assertObjectId(taskId, 'Ops task id');

    const plan = await this.planModel.findById(planId);
    if (!plan) throw new NotFoundException('Ops action plan not found');

    const task = this.findTask(plan, taskId);
    if (!task) throw new NotFoundException('Ops task not found');

    const userLabel = this.getUserLabel(currentUser);
    if (approved) {
      task.status = 'approved';
      task.approvedBy = userLabel;
      task.approvedAt = new Date();
      task.rejectedBy = undefined;
      task.rejectedAt = undefined;
      task.rejectionReason = undefined;
      task.metadata = {
        ...(task.metadata || {}),
        approvalNote: note,
        executionMode: 'approval_only_no_live_apply',
      };
    } else {
      task.status = 'rejected';
      task.rejectedBy = userLabel;
      task.rejectedAt = new Date();
      task.rejectionReason = note || 'Rejected by approver';
      task.approvedBy = undefined;
      task.approvedAt = undefined;
      task.metadata = {
        ...(task.metadata || {}),
        rejectionNote: note,
        executionMode: 'approval_only_no_live_apply',
      };
    }

    this.refreshPlanStatus(plan);
    plan.markModified('tasks');
    await plan.save();

    return {
      success: true,
      plan,
      task: this.findTask(plan, taskId),
      execution: {
        applied: false,
        mode: 'approval_only_no_live_apply',
        message:
          'Task approval was recorded. No live operational action was executed.',
      },
    };
  }

  private findTask(
    plan: OpsActionPlanDocument,
    taskId: string,
  ): OpsTask | undefined {
    return (plan.tasks as any[]).find((task) => String(task._id) === taskId);
  }

  private refreshPlanStatus(plan: OpsActionPlanDocument) {
    const statuses = (plan.tasks || []).map((task) => task.status);
    if (!statuses.length) {
      plan.status = 'draft';
      return;
    }
    if (statuses.every((status) => status === 'approved')) {
      plan.status = 'approved';
      return;
    }
    if (statuses.every((status) => status === 'rejected')) {
      plan.status = 'rejected';
      return;
    }
    if (statuses.some((status) => status === 'approved')) {
      plan.status = 'partially_approved';
      return;
    }
    plan.status = 'pending_approval';
  }

  private applyCreatedAtFilter(
    filter: Record<string, any>,
    query?: { from?: string; to?: string },
  ) {
    if (!query?.from && !query?.to) return;

    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  private countBySeverity(items: Array<{ priority?: OpsActionPriority }>) {
    return {
      critical: items.filter((item) => item.priority === 'critical').length,
      high: items.filter((item) => item.priority === 'high').length,
      medium: items.filter((item) => item.priority === 'medium').length,
      low: items.filter((item) => item.priority === 'low').length,
    };
  }

  private buildSourceSuggestionKey(item: OpsActionItem): string {
    return [
      item.actionType,
      item.priority,
      item.entityId || '',
      item.linkTo || '',
      Math.round(item.amount || 0),
      item.count || 0,
      item.title,
    ].join('|');
  }

  private assertObjectId(value: string, label: string) {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException(`${label} is invalid`);
    }
  }

  private getUserLabel(user: any) {
    return String(
      user?.email ||
        user?.username ||
        user?.fullName ||
        user?._id ||
        user?.id ||
        'system',
    );
  }

  private formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
