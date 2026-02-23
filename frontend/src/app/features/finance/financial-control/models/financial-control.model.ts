/**
 * Financial Control Dashboard - Data Models
 * ==========================================
 * Core interfaces for the one-page executive dashboard
 */

// ===== SECTION A: Overall Status =====
export interface OverallStatus {
  bankBalance: number;
  committedCash: number;
  freeCash: number;
  adsFundBalance: number;
  cashflowSafetyIndex: number; // 0-1, where < 0.3 = danger, < 0.6 = warning
}

// ===== SECTION B: Cash Clarity =====
export interface CashClarity {
  bankBalance: number;
  committedCash: number;
  freeCash: number;
  trend7Days: TrendPoint[];
}

export interface TrendPoint {
  date: string;
  freeCash: number;
  committedCash: number;
}

// ===== SECTION C: Fund Status =====
export interface FundStatus {
  id: string;
  name: string;
  description: string;
  icon: string;
  currentBalance: number;
  yesterdayDelta: number;
  projection7Days: number;
  threshold: {
    min: number;
    max: number;
    status: 'safe' | 'warning' | 'danger';
  };
  usageRules: {
    allowedFor: string[];
    blockedFor: string[];
  };
}

// ===== SECTION D: Profit & Ads Decision =====
export interface ProfitSummary {
  netRevenue: number;
  totalCost: number;
  netProfit: number;
  allocation: ProfitAllocation;
}

export interface ProfitAllocation {
  adsReinvestment: { percent: number; amount: number };
  reserve: { percent: number; amount: number };
  owner: { percent: number; amount: number };
  longTerm: { percent: number; amount: number };
}

export interface AdsDecision {
  optimalBudget: number;       // What ads team wants
  cashflowAllowed: number;     // What cashflow permits
  finalBudget: number;         // MIN of above
  isRestricted: boolean;       // true if cashflow < optimal
  restrictionReason?: string;
  daysRemaining: number;       // How many days can run at this rate
}

// ===== SECTION E: Alerts & Forecast =====
export interface Alert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  actionRequired: boolean;
}

export interface ForecastSummary {
  days7: {
    projectedFreeCash: number;
    trend: 'up' | 'down' | 'stable';
    riskLevel: 'safe' | 'warning' | 'danger';
  };
  days15: {
    projectedFreeCash: number;
    trend: 'up' | 'down' | 'stable';
    riskLevel: 'safe' | 'warning' | 'danger';
  };
  keyEvents: ForecastEvent[];
}

export interface ForecastEvent {
  date: string;
  description: string;
  impact: number; // positive or negative
  type: 'income' | 'expense';
}

// ===== CFO Spec v3.0: Dashboard 8 Numbers =====
export interface CFODashboard {
  bankBalance: number;
  committedCash: number;
  freeCash: number;
  monthlyBurn: number;
  runwayMonths: number;
  adsBudgetApproved: number;
  ownerWithdrawable: number;
  forecast7DLowPoint: {
    amount: number;
    day: number;
  };
  totalDebtOutstanding?: number; // Tổng dư nợ vay (tham khảo)
  calculatedAt: Date;
}

// ===== CFO Spec v3.0: Full Metrics =====
export interface CFOFullMetrics extends CFODashboard {
  survivalFloor: number;
  availableAfterSurvival: number;
  optimalAdsSuggestion: number;
  maxDailyAds: number;
  forecast7D: Forecast7DResult;
  isCashCrunch: boolean;
  isSurvivalRisk: boolean;
  runwayStatus: 'safe' | 'ok' | 'warning' | 'danger';
  committedBreakdown: CommittedCashBreakdown;
  monthlyBurnBreakdown: MonthlyBurnBreakdown;
  loanSummary?: LoanSummary;
}

export interface LoanSummary {
  totalPrincipal: number;           // Tổng tiền vay theo hợp đồng
  totalDisbursed: number;           // Tổng đã giải ngân
  totalPendingDisbursement: number; // Chờ giải ngân
  totalDebtOutstanding: number;     // Dư nợ còn lại
  totalPrincipalPaid: number;       // Gốc đã trả
  totalInterestPaid: number;        // Lãi đã trả
  upcomingRepayments: number;       // Số kỳ trả nợ sắp tới
}

export interface CommittedCashBreakdown {
  labor: number;
  operations: number;
  agents: number;
  tax: number;
  loanPayment: number;
  total: number;
  windowDays: number;
}

export interface MonthlyBurnBreakdown {
  laborCore: number;
  operationsMandatory: number;
  loanPayment: number;
  total: number;
}

// ===== CFO Spec v3.0: Forecast 7D =====
export interface Forecast7DResult {
  days: ForecastDay[];
  lowPoint: number;
  lowPointDay: number;
  lowPointDate: Date;
  isCashCrunch: boolean;
  isSurvivalRisk: boolean;
  endBalance: number;
}

export interface ForecastDay {
  day: number;
  date: Date;
  expectedIn: number;
  expectedOut: number;
  forecastBank: number;
  note?: string;
}

// ===== CFO Spec v3.0: Optimal Ads Suggestion =====
export interface AdGroupOptimalSpend {
  adGroupId: string;
  adGroupName: string;
  spendYesterday: number;
  avgSpendLast3Days: number;
  optimalRaw: number;
  baselineSpend: number;
  upperCap: number;
  lowerCap: number;
  optimalSuggested: number;
  isNewAdGroup: boolean;
  isCapped: boolean;
  capReason?: 'upper' | 'lower';
}

export interface OptimalAdsSuggestionResult {
  adGroups: AdGroupOptimalSpend[];
  totalOptimalDaily: number;
  totalOptimalWeekly: number;
  cappedCount: number;
}

// ===== Complete Dashboard Data =====
export interface FinancialControlData {
  overallStatus: OverallStatus;
  cashClarity: CashClarity;
  funds: FundStatus[];
  profitSummary: ProfitSummary;
  adsDecision: AdsDecision;
  alerts: Alert[];
  forecast: ForecastSummary;
  lastUpdated: Date;
  // CFO Spec v3.0 additions
  cfoDashboard?: CFODashboard;
  cfoFullMetrics?: CFOFullMetrics;
}

// ===== CFO Spec v3.2: Module Health =====
export type ModuleHealthStatus = 'ok' | 'partial' | 'error' | 'timeout';

export interface ModuleHealth {
  status: ModuleHealthStatus;
  lastUpdated: Date | null;
  error?: string;
  dataCount?: number;
}

export interface ModuleHealthResult {
  overall: ModuleHealthStatus;
  modules: {
    labor: ModuleHealth;
    operations: ModuleHealth;
    supplier: ModuleHealth;
    agent: ModuleHealth;
    debt: ModuleHealth;
    ads: ModuleHealth;
    tax: ModuleHealth;
  };
  timestamp: Date;
}

// ===== CFO Spec v3.2: Action Suggestions =====
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';
export type ActionType = 
  | 'PAUSE_ADS' 
  | 'STOP_OWNER_WITHDRAW' 
  | 'PRIORITY_SALARY' 
  | 'REVIEW_OPS_COST'
  | 'COLLECT_RECEIVABLES'
  | 'DELAY_PAYMENT'
  | 'INCREASE_ADS'
  | 'ALLOW_OWNER_WITHDRAW'
  | 'CHECK_MODULE';

export interface ActionSuggestion {
  id: string;
  type: ActionType;
  priority: ActionPriority;
  title: string;
  description: string;
  reason: string;
  linkTo?: string;
  linkLabel?: string;
  amount?: number;
  impact?: string;
}

export interface ActionSuggestionsResult {
  actions: ActionSuggestion[];
  generatedAt: Date;
  basedOnStatus: {
    runway: string;
    isCashCrunch: boolean;
    isSurvivalRisk: boolean;
    moduleHealth?: ModuleHealthStatus;
  };
}
