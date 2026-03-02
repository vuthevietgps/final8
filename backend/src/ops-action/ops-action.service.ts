/**
 * File: ops-action/ops-action.service.ts
 * Mục đích: Tổng hợp hành động khẩn cấp vận hành từ 2 nguồn:
 * - Supplier Payable (NCC chưa trả hoa hồng)
 * - Agent Receivable (Hoa hồng đại lý)
 * Pattern theo: financial-control.service.ts::getActionSuggestions()
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SupplierPayableService } from '../supplier-payable/supplier-payable.service';
import { AgentReceivableService } from '../agent-receivable/agent-receivable.service';
import { AdsAlertsEventsService } from '../ads-alerts/ads-alerts-events.service';
import {
  OpsActionItem,
  OpsActionsResponse,
  OpsActionPriority,
} from './interfaces/ops-action.interfaces';

const AMOUNT_THRESHOLD = 5_000_000;

@Injectable()
export class OpsActionService {
  private readonly logger = new Logger(OpsActionService.name);

  constructor(
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
}
