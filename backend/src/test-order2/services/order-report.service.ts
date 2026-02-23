import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TestOrder2, TestOrder2Document } from '../schemas/test-order2.schema';
import {
  PaymentStatus,
  COMPLETED_ORDER_STATUSES,
} from '../constants/test-order2.constants';

@Injectable()
export class OrderReportService {
  private readonly logger = new Logger(OrderReportService.name);

  constructor(
    @InjectModel(TestOrder2.name) private model: Model<TestOrder2Document>,
  ) {}

  async getDailyProfitReport(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const allOrders = await this.model.find({
      orderDate: { $gte: startOfDay, $lte: endOfDay }
    });

    const completedOrders = allOrders.filter(o =>
      o.orderStatus && COMPLETED_ORDER_STATUSES.includes(o.orderStatus)
    );

    const realizedOrders = completedOrders.filter(o => o.realizedAt);
    const pendingPaymentOrders = completedOrders.filter(o => !o.realizedAt);

    const estimatedStats = {
      totalOrders: completedOrders.length,
      totalGrossProfit: completedOrders.reduce((sum, o) => sum + (o.grossProfit || 0), 0),
      totalNetProfit: completedOrders.reduce((sum, o) => sum + (o.netProfit || 0), 0),
      totalAdvertisingCost: completedOrders.reduce((sum, o) => sum + (o.advertisingCost || 0), 0),
      totalLaborCost: completedOrders.reduce((sum, o) => sum + (o.laborCostAllocation || 0), 0),
      totalOtherCost: completedOrders.reduce((sum, o) => sum + (o.otherCostAllocation || 0), 0),
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
      date: targetDate.toISOString().split('T')[0],
      estimated: estimatedStats,
      realized: realizedStats,
      pending: pendingStats,
      cashAvailable: realizedStats.totalNetProfit,
    };
  }

  /**
   * Get product profit report grouped by product
   * Returns profit stats per product for a given date range
   */
  async getProductProfitReport(params: { date?: string; from?: string; to?: string }) {
    let startDate: Date;
    let endDate: Date;

    if (params.date) {
      startDate = new Date(params.date);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(params.date);
      endDate.setHours(23, 59, 59, 999);
    } else if (params.from && params.to) {
      startDate = new Date(params.from);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(params.to);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    const orders = await this.model.find({
      orderDate: { $gte: startDate, $lte: endDate },
      orderStatus: { $in: COMPLETED_ORDER_STATUSES }
    }).populate('productId', 'name color').lean();

    const productMap = new Map<string, {
      productId: string;
      productName: string;
      productColor: string;
      totalOrders: number;
      totalQuantity: number;
      totalRevenue: number;
      totalProductCost: number;
      totalAdvertisingCost: number;
      totalLaborCost: number;
      totalOtherCost: number;
      totalAgentCommission: number;
      grossProfit: number;
      netProfit: number;
      averageOrderValue: number;
      averageProfitPerOrder: number;
      profitMargin: number;
    }>();

    for (const order of orders) {
      const productId = order.productId?.toString() || 'unknown';
      const revenue = (order.codAmount || 0) + (order.depositAmount || 0) + (order.manualPayment || 0);
      const productCost = (order.supplierAppliedPrice || 0) * (order.quantity || 1);
      const agentCommission = (order.agentQuote || 0) * (order.quantity || 1);

      const productInfo = order.productId as any;
      const productName = productInfo?.name || 'Không xác định';
      const productColor = productInfo?.color || '#888888';

      const existing = productMap.get(productId);

      if (existing) {
        existing.totalOrders += 1;
        existing.totalQuantity += order.quantity || 0;
        existing.totalRevenue += revenue;
        existing.totalProductCost += productCost;
        existing.totalAdvertisingCost += order.advertisingCost || 0;
        existing.totalLaborCost += order.laborCostAllocation || 0;
        existing.totalOtherCost += order.otherCostAllocation || 0;
        existing.totalAgentCommission += agentCommission;
        existing.grossProfit += order.grossProfit || 0;
        existing.netProfit += order.netProfit || 0;
      } else {
        productMap.set(productId, {
          productId,
          productName,
          productColor,
          totalOrders: 1,
          totalQuantity: order.quantity || 0,
          totalRevenue: revenue,
          totalProductCost: productCost,
          totalAdvertisingCost: order.advertisingCost || 0,
          totalLaborCost: order.laborCostAllocation || 0,
          totalOtherCost: order.otherCostAllocation || 0,
          totalAgentCommission: agentCommission,
          grossProfit: order.grossProfit || 0,
          netProfit: order.netProfit || 0,
          averageOrderValue: 0,
          averageProfitPerOrder: 0,
          profitMargin: 0,
        });
      }
    }

    const products = Array.from(productMap.values()).map(p => {
      p.averageOrderValue = p.totalOrders > 0 ? p.totalRevenue / p.totalOrders : 0;
      p.averageProfitPerOrder = p.totalOrders > 0 ? p.netProfit / p.totalOrders : 0;
      p.profitMargin = p.totalRevenue > 0 ? (p.netProfit / p.totalRevenue) * 100 : 0;
      return p;
    });

    products.sort((a, b) => b.netProfit - a.netProfit);

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
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
      products,
      totals,
    };
  }
}
