import { businessDayRange } from '../../common/business-day';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../schemas/test-order2.schema';
import {
  PaymentStatus,
  COMPLETED_ORDER_STATUSES,
} from '../constants/test-order2.constants';
import { BusinessLedgerService } from '../../business-ledger/business-ledger.service';

@Injectable()
export class OrderReportService {
  private readonly logger = new Logger(OrderReportService.name);

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
    private readonly businessLedger: BusinessLedgerService,
  ) {}

  async getDailyProfitReport(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const { day, start: startOfDay, end: endOfDay } = businessDayRange(targetDate);

    const [allOrders, ledgerReport] = await Promise.all([
      this.model.find({ orderDate: { $gte: startOfDay, $lte: endOfDay } }),
      this.businessLedger.report(day, day),
    ]);

    const completedOrders = allOrders.filter(o =>
      o.dealerProfitState === 'recognized' || o.retailProfitState === 'recognized'
    );

    const realizedOrders = allOrders.filter(o => o.financialModelVersion !== 2 && o.realizedAt);
    const pendingPaymentOrders = completedOrders.filter(o => !o.realizedAt);

    const reportRows = ledgerReport.orders;
    const estimatedStats = {
      totalOrders: reportRows.filter((row: any) => !row.adsOnly && !row.costOnly).length,
      totalGrossProfit: reportRows.reduce(
        (sum: number, row: any) => sum + row.recordedNetProfit + row.advertisingCost
          + row.laborCostAllocation + row.otherCostAllocation,
        0,
      ),
      totalNetProfit: reportRows.reduce((sum: number, row: any) => sum + row.recordedNetProfit, 0),
      totalAdvertisingCost: reportRows.reduce((sum: number, row: any) => sum + row.advertisingCost, 0),
      totalLaborCost: reportRows.reduce((sum: number, row: any) => sum + row.laborCostAllocation, 0),
      totalOtherCost: reportRows.reduce((sum: number, row: any) => sum + row.otherCostAllocation, 0),
    };

    const realizedStats = {
      totalOrders: realizedOrders.length,
      totalGrossProfit: realizedOrders.reduce((sum, o) => sum + (o.realizedGrossProfit || 0), 0),
      totalNetProfit: realizedOrders.reduce((sum, o) => sum + (o.realizedNetProfit || 0), 0),
      totalSupplierPaid: realizedOrders.reduce((sum, o) => sum + (o.supplierPaidAmount || 0), 0),
      totalAgentPaid: realizedOrders.reduce((sum, o) => sum + (o.agentPaidAmount || 0), 0),
    };

    const pendingStats = {
      totalOrders: pendingPaymentOrders.length,
      estimatedGrossProfit: pendingPaymentOrders.reduce((sum, o) => sum + (o.grossProfit || 0), 0),
      estimatedNetProfit: pendingPaymentOrders.reduce((sum, o) => sum + (o.netProfit || 0), 0),
      pendingSupplierPayment: pendingPaymentOrders.filter(o => o.supplierPaymentStatus === PaymentStatus.PENDING).length,
      pendingAgentPayment: pendingPaymentOrders.filter(o => o.agentPaymentStatus === PaymentStatus.PENDING).length,
    };

    return {
      date: day,
      estimated: estimatedStats,
      realized: realizedStats,
      pending: pendingStats,
      // An order-profit total is not a bank/cash balance. Confirmed account
      // balances are available from finance/business-ledger/report.
      cashAvailable: null,
      cashAvailableStatus: 'requires_account_reconciliation',
      accountingBasis: ledgerReport.basis,
      realizedAccountingBasis: 'historical_unreconciled_reference_only',
      unreviewedOrders: ledgerReport.quality.unreviewedOrders,
      estimatedAdsRows: ledgerReport.quality.estimatedAdsRows,
      estimatedAdsSpend: ledgerReport.quality.estimatedAdsSpend,
    };
  }

  /**
   * Get product profit report grouped by product
   * Returns profit stats per product for a given date range
   */
  async getProductProfitReport(params: { date?: string; from?: string; to?: string }) {
    const today = businessDayRange(new Date()).day;
    const from = params.date
      ? businessDayRange(params.date).day
      : params.from ? businessDayRange(params.from).day : today;
    const to = params.date
      ? from
      : params.to ? businessDayRange(params.to).day : from;
    const ledgerReport = await this.businessLedger.report(from, to);
    const products = ledgerReport.products.map((row: any) => ({
      productId: row.key,
      productName: row.name,
      productColor: row.color || '#888888',
      totalOrders: row.orders,
      totalQuantity: row.quantity,
      totalRevenue: row.revenue,
      totalProductCost: row.cogs,
      totalAdvertisingCost: row.advertisingCost,
      totalLaborCost: row.laborCostAllocation,
      totalOtherCost: row.otherCostAllocation,
      totalAgentCommission: 0,
      grossProfit: row.recordedNetProfit + row.advertisingCost
        + row.laborCostAllocation + row.otherCostAllocation,
      netProfit: row.recordedNetProfit,
      averageOrderValue: row.orders > 0 ? row.revenue / row.orders : 0,
      averageProfitPerOrder: row.orders > 0 ? row.recordedNetProfit / row.orders : 0,
      profitMargin: row.revenue > 0 ? (row.recordedNetProfit / row.revenue) * 100 : 0,
      needsReview: row.needsReview,
      unallocatedAdvertisingCost: row.unallocatedAdvertisingCost,
    }));

    const totals = {
      totalProducts: products.length,
      totalOrders: products.reduce((sum, p) => sum + p.totalOrders, 0),
      totalQuantity: products.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
      totalProductCost: products.reduce((sum, p) => sum + p.totalProductCost, 0),
      totalAdvertisingCost: products.reduce((sum, p) => sum + p.totalAdvertisingCost, 0),
      totalLaborCost: products.reduce((sum, p) => sum + p.totalLaborCost, 0),
      totalOtherCost: products.reduce((sum, p) => sum + p.totalOtherCost, 0),
      totalAgentCommission: products.reduce((sum, p) => sum + p.totalAgentCommission, 0),
      grossProfit: products.reduce((sum, p) => sum + p.grossProfit, 0),
      netProfit: products.reduce((sum, p) => sum + p.netProfit, 0),
    };

    return {
      dateRange: {
        from,
        to,
      },
      products,
      totals,
      accountingBasis: ledgerReport.basis,
      quality: ledgerReport.quality,
    };
  }
}
