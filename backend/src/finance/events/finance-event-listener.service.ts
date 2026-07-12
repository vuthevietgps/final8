/**
 * FINANCE EVENT LISTENER SERVICE — Phase 3
 * ==========================================
 * Lắng nghe các sự kiện từ domain modules, refresh CashflowSummarySnapshot,
 * và invalidate FC cache — thay thế cho circular forwardRef dependencies.
 *
 * Đây là điểm duy nhất trong FinanceModule được phép gọi cross-domain services
 * (LaborStatementService, OtherCostService, AgentReceivableService,
 *  SupplierPayableService). FinancialControlService không cần biết đến chúng.
 */
import { Injectable, Logger, Inject, ServiceUnavailableException, forwardRef } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FinancialControlService } from '../financial-control.service';
import { FinanceService } from '../finance.service';
import { FundsService } from '../funds.service';
import { CashflowSnapshotService } from '../cashflow-snapshot.service';
import { FinanceEvents } from './finance-events.constants';
import { LaborStatementService } from '../../labor-cost1/labor-statement.service';
import { OtherCostService } from '../../other-cost/other-cost.service';
import { AgentReceivableService } from '../../agent-receivable/agent-receivable.service';
import { SupplierPayableService } from '../../supplier-payable/supplier-payable.service';
import { AdvertisingCostRecalculationQueueService } from '../../advertising-cost/advertising-cost.recalculation-queue.service';
import type {
  FinanceStateChangedEvent,
  FinancialControlPolicyUpdatedEvent,
  OrderPaymentUpdatedEvent,
  OrderCompletedEvent,
  LaborStatementUpdatedEvent,
  OtherCostUpdatedEvent,
  AgentReceivableUpdatedEvent,
  SupplierPayableUpdatedEvent,
  LoanEvent,
  OwnerFundChangedEvent,
} from './finance-events.interfaces';

/** Window sizes we keep snapshots for */
const SNAPSHOT_WINDOWS = [7, 14, 30] as const;

@Injectable()
export class FinanceEventListenerService {
  private readonly logger = new Logger(FinanceEventListenerService.name);
  private readonly snapshotRefreshStates = new Map<string, {
    pending: boolean;
    running: boolean;
    runner: () => Promise<void>;
  }>();

  constructor(
    private readonly financialControlService: FinancialControlService,
    private readonly financeService: FinanceService,
    @Inject(forwardRef(() => FundsService))
    private readonly fundsService: FundsService,
    private readonly snapshotService: CashflowSnapshotService,
    @Inject(forwardRef(() => LaborStatementService))
    private readonly laborStatementService: LaborStatementService,
    @Inject(forwardRef(() => OtherCostService))
    private readonly otherCostService: OtherCostService,
    @Inject(forwardRef(() => AgentReceivableService))
    private readonly agentReceivableService: AgentReceivableService,
    @Inject(forwardRef(() => SupplierPayableService))
    private readonly supplierPayableService: SupplierPayableService,
    private readonly recalculationQueue: AdvertisingCostRecalculationQueueService,
  ) {}

  private getBusinessDateString(date: Date): string {
    const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return shifted.toISOString().slice(0, 10);
  }

  private invalidateFinanceCaches(reason: string): void {
    this.financialControlService.invalidateCache(reason);
    this.financeService.invalidateMasterBankBalanceCache(reason);
    this.fundsService.invalidateCache(reason);
  }

  private scheduleSnapshotRefresh(key: string, runner: () => Promise<void>): void {
    const existing = this.snapshotRefreshStates.get(key);
    if (existing) {
      existing.runner = runner;
      existing.pending = true;
      if (!existing.running) {
        existing.running = true;
        void this.runSnapshotRefreshLoop(key, existing);
      }
      return;
    }

    const state = {
      pending: true,
      running: true,
      runner,
    };
    this.snapshotRefreshStates.set(key, state);
    void this.runSnapshotRefreshLoop(key, state);
  }

  private async runSnapshotRefreshLoop(
    key: string,
    state: { pending: boolean; running: boolean; runner: () => Promise<void> },
  ): Promise<void> {
    try {
      while (state.pending) {
        state.pending = false;
        try {
          await state.runner();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`[SNAP_REFRESH_QUEUE] ${key} failed: ${message}`);
        }
      }
    } finally {
      state.running = false;
      if (state.pending) {
        state.running = true;
        void this.runSnapshotRefreshLoop(key, state);
        return;
      }
      this.snapshotRefreshStates.delete(key);
    }
  }

  private queueOpsSnapshotRefresh(): void {
    this.scheduleSnapshotRefresh('ops', () => this.refreshOpsSnapshots());
  }

  private queueAgentSnapshotRefresh(): void {
    this.scheduleSnapshotRefresh('agent', () => this.refreshAgentSnapshots());
  }

  private queueSupplierSnapshotRefresh(): void {
    this.scheduleSnapshotRefresh('supplier', () => this.refreshSupplierSnapshot());
  }

  // ─── Snapshot refresh helpers ────────────────────────────────────────────────

  private async refreshLaborSnapshots(): Promise<void> {
    for (const w of SNAPSHOT_WINDOWS) {
      try {
        const data = await this.laborStatementService.getCashflowSummary(w);
        await this.snapshotService.store('labor', w, data as unknown as Record<string, unknown>);
      } catch (err) {
        this.logger.warn(`[SNAP_REFRESH] labor/${w} failed`, err);
      }
    }
  }

  private async refreshOpsSnapshots(): Promise<void> {
    await Promise.all(
      SNAPSHOT_WINDOWS.map(async (w) => {
        try {
          const data = await this.otherCostService.getCashflowSummary(w);
          await this.snapshotService.store('ops', w, data as unknown as Record<string, unknown>);
        } catch (err) {
          this.logger.warn(`[SNAP_REFRESH] ops/${w} failed`, err);
        }
      }),
    );
  }

  private async refreshAgentSnapshots(): Promise<void> {
    for (const w of SNAPSHOT_WINDOWS) {
      try {
        const data = await this.agentReceivableService.getCashflowSummary(w);
        await this.snapshotService.store('agent', w, data as unknown as Record<string, unknown>);
      } catch (err) {
        this.logger.warn(`[SNAP_REFRESH] agent/${w} failed`, err);
      }
    }
  }

  private async refreshSupplierSnapshot(): Promise<void> {
    try {
      const data = await this.supplierPayableService.getCashflowSummary();
      await this.snapshotService.store('supplier', -1, data as unknown as Record<string, unknown>);
    } catch (err) {
      this.logger.warn(`[SNAP_REFRESH] supplier/-1 failed`, err);
    }
  }

  /**
   * Explicit production/bootstrap path. Event listeners keep snapshots fresh
   * afterwards, but a newly connected database must be able to build and prove
   * the complete canonical baseline before Financial Control is enabled.
   */
  async rebuildCanonicalSnapshots(): Promise<{
    schemaVersion: 'financial_snapshot_rebuild.v1';
    refreshed: string[];
    completedAt: string;
  }> {
    await Promise.all([
      this.refreshLaborSnapshots(),
      this.refreshOpsSnapshots(),
      this.refreshAgentSnapshots(),
      this.refreshSupplierSnapshot(),
    ]);

    const required = [
      ...SNAPSHOT_WINDOWS.flatMap((windowDays) => [
        { domain: 'labor' as const, windowDays },
        { domain: 'ops' as const, windowDays },
        { domain: 'agent' as const, windowDays },
      ]),
      { domain: 'supplier' as const, windowDays: -1 },
    ];
    const freshness = await Promise.all(required.map(async (entry) => ({
      ...entry,
      staleness: await this.snapshotService.getStaleness(entry.domain, entry.windowDays),
    })));
    const failed = freshness.filter((entry) => (
      !Number.isFinite(entry.staleness) || entry.staleness > 5 * 60 * 1000
    ));
    if (failed.length) {
      throw new ServiceUnavailableException({
        code: 'FINANCIAL_SNAPSHOT_REBUILD_INCOMPLETE',
        failed: failed.map((entry) => `${entry.domain}:${entry.windowDays}`),
      });
    }

    this.invalidateFinanceCaches('financial-snapshot-rebuild');
    return {
      schemaVersion: 'financial_snapshot_rebuild.v1',
      refreshed: freshness.map((entry) => `${entry.domain}:${entry.windowDays}`),
      completedAt: new Date().toISOString(),
    };
  }

  // ─── Đơn hàng ───────────────────────────────────────────────────────────────

  @OnEvent(FinanceEvents.ORDER_PAYMENT_UPDATED)
  onOrderPaymentUpdated(event: OrderPaymentUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.ORDER_PAYMENT_UPDATED} orderId=${event.orderId}`);
    if (event.paymentType !== 'supplier') {
      this.queueAgentSnapshotRefresh();
    }
    if (event.paymentType !== 'agent') {
      this.queueSupplierSnapshotRefresh();
    }
    this.invalidateFinanceCaches(FinanceEvents.ORDER_PAYMENT_UPDATED);
  }

  @OnEvent(FinanceEvents.FINANCE_STATE_CHANGED)
  onFinanceStateChanged(event: FinanceStateChangedEvent) {
    this.logger.debug(
      `[EVENT] ${FinanceEvents.FINANCE_STATE_CHANGED} source=${event.source} entityId=${event.entityId || 'n/a'}`,
    );
    this.invalidateFinanceCaches(`${FinanceEvents.FINANCE_STATE_CHANGED}:${event.source}`);
  }

  @OnEvent(FinanceEvents.FINANCIAL_CONTROL_POLICY_UPDATED)
  async onFinancialControlPolicyUpdated(event: FinancialControlPolicyUpdatedEvent) {
    this.logger.debug(
      `[EVENT] ${FinanceEvents.FINANCIAL_CONTROL_POLICY_UPDATED} fields=${event.changedFields.join(',')}`,
    );
    if (event.changedFields.includes('SupplierCashCycleDays')) {
      // Await refresh so the first forecast after a policy save cannot hydrate
      // the old D+N schedule from the supplier snapshot.
      await this.refreshSupplierSnapshot();
    }
    this.invalidateFinanceCaches(FinanceEvents.FINANCIAL_CONTROL_POLICY_UPDATED);
  }

  @OnEvent(FinanceEvents.ORDER_COMPLETED)
  onOrderCompleted(event: OrderCompletedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.ORDER_COMPLETED} orderId=${event.orderId}`);

    if (event.orderDate) {
      const orderDate = new Date(event.orderDate);
      if (!Number.isNaN(orderDate.getTime())) {
        const dateStr = orderDate.toISOString().slice(0, 10);
        const todayStr = this.getBusinessDateString(new Date());
        if (dateStr < todayStr) {
          this.recalculationQueue.scheduleRecalculation(dateStr, 'retroactive-order-change');
        }
      }
    }

    this.invalidateFinanceCaches(FinanceEvents.ORDER_COMPLETED);
    this.queueAgentSnapshotRefresh();
    this.queueSupplierSnapshotRefresh();
  }

  // ─── Chi phí lao động ────────────────────────────────────────────────────────

  @OnEvent(FinanceEvents.LABOR_STATEMENT_UPDATED)
  async onLaborStatementUpdated(event: LaborStatementUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.LABOR_STATEMENT_UPDATED} id=${event.statementId}`);
    await this.refreshLaborSnapshots();
    this.invalidateFinanceCaches(FinanceEvents.LABOR_STATEMENT_UPDATED);
  }

  @OnEvent(FinanceEvents.LABOR_STATEMENT_CLOSED)
  async onLaborStatementClosed(event: LaborStatementUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.LABOR_STATEMENT_CLOSED} id=${event.statementId}`);
    await this.refreshLaborSnapshots();
    this.invalidateFinanceCaches(FinanceEvents.LABOR_STATEMENT_CLOSED);
  }

  // ─── Chi phí khác ────────────────────────────────────────────────────────────

  @OnEvent(FinanceEvents.OTHER_COST_UPDATED)
  onOtherCostUpdated(event: OtherCostUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.OTHER_COST_UPDATED} id=${event.costId}`);
    this.queueOpsSnapshotRefresh();
    this.invalidateFinanceCaches(FinanceEvents.OTHER_COST_UPDATED);
  }

  @OnEvent(FinanceEvents.OTHER_COST_CONFIRMED)
  onOtherCostConfirmed(event: OtherCostUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.OTHER_COST_CONFIRMED} id=${event.costId}`);
    this.queueOpsSnapshotRefresh();
    this.invalidateFinanceCaches(FinanceEvents.OTHER_COST_CONFIRMED);
  }

  // ─── Công nợ đại lý & NCC ────────────────────────────────────────────────────

  @OnEvent(FinanceEvents.AGENT_RECEIVABLE_UPDATED)
  onAgentReceivableUpdated(event: AgentReceivableUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.AGENT_RECEIVABLE_UPDATED} id=${event.recordId}`);
    this.queueAgentSnapshotRefresh();
    this.invalidateFinanceCaches(FinanceEvents.AGENT_RECEIVABLE_UPDATED);
  }

  @OnEvent(FinanceEvents.SUPPLIER_PAYABLE_UPDATED)
  onSupplierPayableUpdated(event: SupplierPayableUpdatedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.SUPPLIER_PAYABLE_UPDATED} id=${event.recordId}`);
    this.queueSupplierSnapshotRefresh();
    this.invalidateFinanceCaches(FinanceEvents.SUPPLIER_PAYABLE_UPDATED);
  }

  // ─── Khoản vay ───────────────────────────────────────────────────────────────

  @OnEvent(FinanceEvents.LOAN_DISBURSED)
  onLoanDisbursed(event: LoanEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.LOAN_DISBURSED} loanId=${event.loanId}`);
    this.invalidateFinanceCaches(FinanceEvents.LOAN_DISBURSED);
  }

  @OnEvent(FinanceEvents.LOAN_REPAYMENT_MADE)
  onLoanRepaymentMade(event: LoanEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.LOAN_REPAYMENT_MADE} loanId=${event.loanId}`);
    this.invalidateFinanceCaches(FinanceEvents.LOAN_REPAYMENT_MADE);
  }

  // ─── Quỹ chủ sở hữu ──────────────────────────────────────────────────────────

  @OnEvent(FinanceEvents.OWNER_FUND_CHANGED)
  onOwnerFundChanged(event: OwnerFundChangedEvent) {
    this.logger.debug(`[EVENT] ${FinanceEvents.OWNER_FUND_CHANGED} type=${event.type} amount=${event.amount}`);
    this.invalidateFinanceCaches(FinanceEvents.OWNER_FUND_CHANGED);
  }
}

