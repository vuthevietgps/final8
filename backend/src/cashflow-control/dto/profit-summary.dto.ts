/**
 * File: cashflow-control/dto/profit-summary.dto.ts
 * Purpose: DTO for profit summary with allocation breakdown
 * 
 * CRITICAL BUSINESS RULE:
 * We are an INTERMEDIARY/AGENT model:
 * - Supplier collects COD from customer
 * - Supplier deducts their product cost
 * - Supplier pays us the NET AMOUNT
 * 
 * Therefore:
 * - Revenue = NET amount received (NOT the COD!)
 * - Never expose COD as revenue (misleading)
 */

export class ProfitAllocationDto {
  /** Portion reinvested into advertising (typically 40%) */
  adsReinvestment: { percent: number; amount: number };

  /** Portion to reserve/survival buffer (typically 20%) */
  reserve: { percent: number; amount: number };

  /** Portion available for owner withdrawal (typically 30%) */
  owner: { percent: number; amount: number };

  /** Portion to long-term savings/investment (typically 10%) */
  longTerm: { percent: number; amount: number };
}

export class ProfitSummaryDto {
  /** NET Revenue = What we actually receive (COD - SupplierCost). NOT the COD amount! */
  netRevenue: number;

  /** Total costs: ads, labor, shipping, operations */
  totalCost: number;

  /** Net Profit = NetRevenue - TotalCost */
  netProfit: number;

  /** Profit margin percentage */
  profitMargin: number;

  /** How profit is allocated to different funds */
  profitAllocation: ProfitAllocationDto;

  /** Cost breakdown by category */
  costBreakdown: {
    ads: number;
    labor: number;
    shipping: number;
    operations: number;
    other: number;
  };

  /** Start of the reporting period */
  periodStart: Date;

  /** End of the reporting period */
  periodEnd: Date;

  /** Explanation of revenue calculation for transparency */
  revenueNote: string;
}
