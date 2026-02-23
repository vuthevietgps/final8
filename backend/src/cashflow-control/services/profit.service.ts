/**
 * File: cashflow-control/services/profit.service.ts
 * Purpose: Business logic for profit calculation and allocation
 * 
 * CRITICAL BUSINESS RULE - AGENT MODEL REVENUE:
 * 
 * We are an INTERMEDIARY, not a traditional retailer:
 * 
 * Traditional Model:
 *   Revenue = Sales Price
 *   COGS = Purchase Cost
 *   Profit = Sales - COGS
 * 
 * OUR Agent Model:
 *   Customer pays COD to Supplier
 *   Supplier deducts their cost
 *   Supplier pays us NET AMOUNT
 *   
 *   Revenue = NET AMOUNT (what we actually receive)
 *   NOT the COD! (that's the customer's payment, not ours)
 * 
 * Example:
 *   COD = 500,000 VND (customer pays)
 *   Supplier Cost = 350,000 VND (supplier keeps)
 *   NET Revenue = 150,000 VND (we receive)
 *   
 *   Our costs: ads, labor, shipping
 *   Our Profit = 150,000 - our costs
 */

import { Injectable } from '@nestjs/common';
import { ProfitSummaryDto, ProfitAllocationDto } from '../dto/profit-summary.dto';
import { IOrder, ICostEntry } from '../interfaces/cashflow.interfaces';

@Injectable()
export class ProfitService {

  /**
   * Default profit allocation percentages
   * These can be configured per business
   */
  private readonly ALLOCATION_RULES = {
    adsReinvestment: 40, // 40% back to ads
    reserve: 20,         // 20% to survival buffer
    owner: 30,           // 30% to owner
    longTerm: 10,        // 10% to long-term savings
  };

  /**
   * Get profit summary for the current period
   */
  getProfitSummary(periodDays: number = 30): ProfitSummaryDto {
    const periodEnd = new Date();
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Get data (in production, from database)
    const orders = this.getDeliveredOrders(periodStart, periodEnd);
    const costs = this.getCosts(periodStart, periodEnd);

    // Calculate NET revenue (NOT COD!)
    const netRevenue = this.calculateNetRevenue(orders);
    
    // Calculate total costs
    const costBreakdown = this.calculateCostBreakdown(costs);
    const totalCost = Object.values(costBreakdown).reduce((a, b) => a + b, 0);
    
    // Calculate profit
    const netProfit = netRevenue - totalCost;
    const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
    
    // Calculate allocation (only if profit is positive)
    const profitAllocation = this.calculateAllocation(netProfit);

    return {
      netRevenue,
      totalCost,
      netProfit,
      profitMargin: Math.round(profitMargin * 10) / 10,
      profitAllocation,
      costBreakdown,
      periodStart,
      periodEnd,
      revenueNote: 'Revenue is NET amount received from suppliers after COD collection. This is what we actually earn, NOT the COD amount.',
    };
  }

  /**
   * Calculate NET revenue from delivered orders
   * 
   * IMPORTANT: We use the NET amount (what supplier pays us),
   * NOT the COD amount (what customer paid to supplier)
   */
  private calculateNetRevenue(orders: IOrder[]): number {
    return orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, order) => sum + order.netRevenue, 0);
  }

  /**
   * Calculate cost breakdown by category
   */
  private calculateCostBreakdown(costs: ICostEntry[]): {
    ads: number;
    labor: number;
    shipping: number;
    operations: number;
    other: number;
  } {
    const breakdown = {
      ads: 0,
      labor: 0,
      shipping: 0,
      operations: 0,
      other: 0,
    };

    for (const cost of costs) {
      if (cost.category in breakdown) {
        breakdown[cost.category] += cost.amount;
      } else {
        breakdown.other += cost.amount;
      }
    }

    return breakdown;
  }

  /**
   * Calculate profit allocation to different funds
   * 
   * Allocation rules:
   * - 40% reinvested to ads (fuel growth)
   * - 20% to reserve (safety buffer)
   * - 30% to owner (reward)
   * - 10% to long-term (future investments)
   */
  private calculateAllocation(netProfit: number): ProfitAllocationDto {
    // If no profit, no allocation
    if (netProfit <= 0) {
      return {
        adsReinvestment: { percent: 0, amount: 0 },
        reserve: { percent: 0, amount: 0 },
        owner: { percent: 0, amount: 0 },
        longTerm: { percent: 0, amount: 0 },
      };
    }

    return {
      adsReinvestment: {
        percent: this.ALLOCATION_RULES.adsReinvestment,
        amount: Math.round(netProfit * this.ALLOCATION_RULES.adsReinvestment / 100),
      },
      reserve: {
        percent: this.ALLOCATION_RULES.reserve,
        amount: Math.round(netProfit * this.ALLOCATION_RULES.reserve / 100),
      },
      owner: {
        percent: this.ALLOCATION_RULES.owner,
        amount: Math.round(netProfit * this.ALLOCATION_RULES.owner / 100),
      },
      longTerm: {
        percent: this.ALLOCATION_RULES.longTerm,
        amount: Math.round(netProfit * this.ALLOCATION_RULES.longTerm / 100),
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOCK DATA (Replace with database queries in production)
  // ═══════════════════════════════════════════════════════════════════════════

  private getDeliveredOrders(start: Date, end: Date): IOrder[] {
    // Generate mock orders showing NET revenue model
    // In production, this would be thousands of orders from database
    return this.generateMockOrders(1500, 300000); // 1500 orders avg 300k net
  }

  private generateMockOrders(count: number, avgNetRevenue: number): IOrder[] {
    const orders: IOrder[] = [];
    for (let i = 0; i < count; i++) {
      const netRevenue = avgNetRevenue * (0.5 + Math.random());
      const order: IOrder = {
        orderId: `ORD-MOCK-${i}`,
        cod: netRevenue * 3, // Approximate COD
        supplierCost: netRevenue * 2, // Approximate supplier cost
        netRevenue: Math.round(netRevenue),
        status: 'delivered',
        deliveredAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      };
      orders.push(order);
    }
    return orders;
  }

  private getCosts(start: Date, end: Date): ICostEntry[] {
    return [
      { id: 'c-001', category: 'ads', amount: 180000000, date: new Date(), description: 'Facebook Ads' },
      { id: 'c-002', category: 'ads', amount: 50000000, date: new Date(), description: 'Google Ads' },
      { id: 'c-003', category: 'labor', amount: 80000000, date: new Date(), description: 'Salaries' },
      { id: 'c-004', category: 'shipping', amount: 35000000, date: new Date(), description: 'Shipping costs' },
      { id: 'c-005', category: 'operations', amount: 25000000, date: new Date(), description: 'Office & utilities' },
    ];
  }
}
