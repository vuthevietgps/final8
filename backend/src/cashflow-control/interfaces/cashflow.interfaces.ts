/**
 * File: cashflow-control/interfaces/cashflow.interfaces.ts
 * Purpose: Core interfaces for the Cashflow Control System
 * 
 * BUSINESS MODEL: INTERMEDIARY/AGENT
 * - We do NOT hold inventory
 * - Suppliers collect COD, deduct product cost, then pay us NET AMOUNT
 * - Revenue = COD - SupplierCost (NOT COD itself!)
 * - Cash in bank ≠ Cash allowed to spend
 */

// ═══════════════════════════════════════════════════════════════════════════
// FUND TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The 4 core virtual funds that partition our cash
 * These are LOGICAL allocations, not separate bank accounts
 */
export enum FundType {
  /** Cash already allocated to pending obligations (not spendable) */
  COMMITTED_CASH = 'COMMITTED_CASH',
  
  /** Reserved specifically for advertising spend */
  ADS_FUND = 'ADS_FUND',
  
  /** Emergency buffer - NEVER touch unless survival is at stake */
  SURVIVAL_BUFFER = 'SURVIVAL_BUFFER',
  
  /** Owner's withdrawable profit after all allocations */
  OWNER_FUND = 'OWNER_FUND',
}

export enum FundStatus {
  SAFE = 'safe',
  WARNING = 'warning',
  DANGER = 'danger',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger',
  CRITICAL = 'critical',
}

export enum AlertType {
  CASHFLOW_LOW = 'CASHFLOW_LOW',
  ADS_BUDGET_RESTRICTED = 'ADS_BUDGET_RESTRICTED',
  FUND_THRESHOLD_BREACH = 'FUND_THRESHOLD_BREACH',
  COMMITMENT_DUE = 'COMMITMENT_DUE',
  PROFIT_NEGATIVE = 'PROFIT_NEGATIVE',
  SURVIVAL_BUFFER_TOUCHED = 'SURVIVAL_BUFFER_TOUCHED',
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a single fund's status
 */
export interface IFundStatus {
  fundType: FundType;
  /** Current balance in VND */
  currentBalance: number;
  /** Change from yesterday (positive = inflow, negative = outflow) */
  yesterdayChange: number;
  /** Projected balance in 7 days based on current trends */
  projection7d: number;
  /** Minimum threshold - below this triggers warning/danger */
  threshold: number;
  /** Computed status based on balance vs threshold */
  status: FundStatus;
}

/**
 * Dashboard summary - the ONE-GLANCE view for Owner/CFO
 */
export interface IDashboardSummary {
  /** Total cash in all bank accounts */
  bankBalance: number;
  /** Cash allocated to pending obligations (payables, committed expenses) */
  committedCash: number;
  /** FreeCash = BankBalance - CommittedCash (ACTUALLY SPENDABLE) */
  freeCash: number;
  /** Current balance in the Ads Fund */
  adsFundBalance: number;
  /** 0-1 index: Higher = safer cashflow position */
  cashflowSafetyIndex: number;
  /** Timestamp of data */
  asOf: Date;
}

/**
 * Profit summary following agent model revenue recognition
 * CRITICAL: Revenue is NET revenue, NOT COD!
 */
export interface IProfitSummary {
  /** NET Revenue = COD - SupplierCost (what we actually earn) */
  netRevenue: number;
  /** Total costs: ads, labor, operations, shipping, etc. */
  totalCost: number;
  /** NetProfit = NetRevenue - TotalCost */
  netProfit: number;
  /** How profit is allocated across funds */
  profitAllocation: IProfitAllocation;
  /** Period this summary covers */
  periodStart: Date;
  periodEnd: Date;
}

export interface IProfitAllocation {
  /** % reinvested into ads (typically 40%) */
  adsReinvestment: { percent: number; amount: number };
  /** % to reserve/survival buffer (typically 20%) */
  reserve: { percent: number; amount: number };
  /** % to owner withdrawal (typically 30%) */
  owner: { percent: number; amount: number };
  /** % to long-term savings (typically 10%) */
  longTerm: { percent: number; amount: number };
}

/**
 * Today's Ads Budget Decision
 * Core formula: AdsBudget = MIN(OptimalBudget, CashflowAllowed)
 */
export interface IAdsDecision {
  /** What the ads team wants to spend (based on performance) */
  optimalAdsBudget: number;
  /** Maximum cashflow permits without endangering operations */
  allowedByCashflow: number;
  /** Final approved budget: MIN(optimal, allowed) */
  finalAdsBudget: number;
  /** If restricted, explain why */
  restrictionReason: string | null;
  /** Is the budget restricted by cashflow? */
  isRestricted: boolean;
  /** How many days can we sustain current ads spend? */
  daysRemaining: number;
}

/**
 * System alerts for proactive cash management
 */
export interface IAlert {
  id: string;
  alertType: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  triggeredAt: Date;
  /** Does this require immediate action? */
  actionRequired: boolean;
  /** Optional: affected fund or metric */
  relatedEntity?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT DATA INTERFACES (for service calculations)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Raw bank account data
 */
export interface IBankAccount {
  accountId: string;
  accountName: string;
  balance: number;
  lastUpdated: Date;
}

/**
 * Pending commitment/obligation
 */
export interface ICommitment {
  id: string;
  description: string;
  amount: number;
  dueDate: Date;
  category: 'supplier' | 'labor' | 'ads' | 'operations' | 'other';
}

/**
 * Order for revenue calculation
 * Note: We use NET revenue model
 */
export interface IOrder {
  orderId: string;
  cod: number; // Cash on Delivery amount
  supplierCost: number; // What supplier deducts
  netRevenue: number; // cod - supplierCost (what we receive)
  status: 'delivered' | 'returned' | 'pending';
  deliveredAt?: Date;
}

/**
 * Cost entry for profit calculation
 */
export interface ICostEntry {
  id: string;
  category: 'ads' | 'labor' | 'shipping' | 'operations' | 'other';
  amount: number;
  date: Date;
  description: string;
}
