import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ADS_COST_REFRESH, ORDER_COST_ALLOCATED, FINANCIAL_INPUT_CHANGED, AdvertisingCostRefreshService } from '../advertising-cost/advertising-cost-refresh.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';
import { businessDay, businessDayRange } from '../common/business-day';
import { FinanceEventListenerService } from './events/finance-event-listener.service';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { FinancialControlService } from './financial-control.service';
import { FinanceService } from './finance.service';
import { FundsService } from './funds.service';

@Injectable()
export class AdsCostProjectionService {
  constructor(
    private readonly calculation: OrderCalculationService,
    private readonly reports: AdGroupDailyReportService,
    private readonly control: FinancialControlService,
    private readonly finance: FinanceService,
    private readonly funds: FundsService,
    @InjectModel(TestOrder2.name) private readonly orders: Model<TestOrder2Document>,
    private readonly queue: AdvertisingCostRefreshService,
    private readonly financeEvents: FinanceEventListenerService,
  ) {}

  @OnEvent(ADS_COST_REFRESH, { suppressErrors: false })
  async refresh({ day, revalue }: { day: string; revalue?: boolean }) {
    if (revalue) {
      this.calculation.clearStatusCaches();
      const { start, end } = businessDayRange(day);
      const cursor = this.orders.find({ orderDate: { $gte: start, $lte: end }, isActive: { $ne: false } }).cursor();
      for await (const order of cursor) {
        // Resolves missing approved quotes only. Existing prices, stock costs and payment evidence stay frozen.
        await this.calculation.autoCalculateQuoteFields(order);
        if (order.isModified()) await order.save();
      }
    }
    // Allocation emits ORDER_COST_ALLOCATED, including days without any orders.
    await this.calculation.recalculateOrdersForDate(day);
  }

  @OnEvent(FINANCIAL_INPUT_CHANGED, { suppressErrors: false })
  async inputsChanged(input: { productIds?: string[]; statuses?: string[]; dates?: Array<Date | string>; revalue?: boolean }) {
    const days = new Set((input.dates || []).map(date => businessDay(date)));
    const filters: any[] = [];
    const ids = (input.productIds || []).filter(id => Types.ObjectId.isValid(id));
    if (ids.length) filters.push({ productId: { $in: [...ids, ...ids.map(id => new Types.ObjectId(id))] } });
    if (input.statuses?.length) filters.push({ orderStatus: { $in: input.statuses } });
    if (filters.length) {
      const dates = await this.orders.distinct('orderDate', { $or: filters, isActive: { $ne: false } });
      for (const date of dates) if (date) days.add(businessDay(date));
    }
    try {
      if (input.statuses) this.calculation.clearStatusCaches();
      await this.queue.mark([...days], undefined, input.revalue !== false);
      for (const day of days) await this.queue.flush(day);
    } finally {
      // Catalog changes can affect forecast assumptions even when there are no orders yet.
      this.control.invalidateCache('financial-input-changed');
      this.finance.invalidateMasterBankBalanceCache('financial-input-changed');
      this.funds.invalidateCache('financial-input-changed');
    }
  }

  @OnEvent(ORDER_COST_ALLOCATED, { suppressErrors: false })
  async afterAllocation({ day }: { day: string }) {
    try {
      await this.reports.syncFromOrderTest2(day);
      await this.financeEvents.refreshOrderFinancialSnapshots();
    } finally {
      // Some writes may already have committed even when a later projection fails.
      this.control.invalidateCache('ads-cost-recalculated');
      this.finance.invalidateMasterBankBalanceCache('ads-cost-recalculated');
      this.funds.invalidateCache('ads-cost-recalculated');
    }
  }
}
