/**
 * FINANCIAL CONTROL - CFO Spec v3.0
 * ==================================
 * Quản lý sự sống còn, tốc độ scale, số tiền owner có thể rút, và dự báo 7 ngày.
 * Nguyên tắc: Chỉ có Cash In/Cash Out làm thay đổi Bank Balance.
 */

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

export interface FinancialControlConfig {
  CommittedWindowDays: number;    // Default: 14
  SurvivalMonths: number;         // Default: 3
  SupplierCashCycleDays: number;  // Default: 10
  RiskAdjustInflow: number;       // Default: 0.80
  MinStartBudget: number;         // Default: 60_000
  UpperCapMultiplier: number;     // Default: 1.20
  LowerCapMultiplier: number;     // Default: 0.70
  SafetyFactor: number;           // Default: 0.80
}

export const DEFAULT_CONFIG: FinancialControlConfig = {
  CommittedWindowDays: 14,
  SurvivalMonths: 3,
  SupplierCashCycleDays: 10,
  RiskAdjustInflow: 0.80,
  MinStartBudget: 60_000,
  UpperCapMultiplier: 1.20,
  LowerCapMultiplier: 0.70,
  SafetyFactor: 0.80,
};

// ═══════════════════════════════════════════════════════════
// CORE METRICS
// ═══════════════════════════════════════════════════════════

/**
 * Dashboard 8 số chính cho CEO/CFO
 */
export interface FinancialControlDashboard {
  // 1. Bank Balance (Now)
  bankBalance: number;
  
  // 2. Committed (14D)
  committedCash: number;
  
  // 3. Free Cash (Now)
  freeCash: number;
  
  // 4. Monthly Burn
  monthlyBurn: number;
  
  // 5. Runway (months) - CFO v3.1: null khi burn=0 (UI hiển thị "∞")
  runwayMonths: number | null;
  
  // 6. Ads Budget Approved (7D)
  adsBudgetApproved: number;
  
  // 7. Owner Withdrawable (Now)
  ownerWithdrawable: number;
  
  // 8. Forecast 7D Low Point
  forecast7DLowPoint: {
    amount: number;
    day: number;
  };
  
  // 9. Tổng dư nợ vay (Total Debt Outstanding) - toàn bộ, không giới hạn window
  totalDebtOutstanding?: number;
  
  // Metadata
  calculatedAt: Date;
  config: FinancialControlConfig;
}

/**
 * Chi tiết đầy đủ Financial Control
 */
export interface FinancialControlFull extends FinancialControlDashboard {
  // Survival metrics
  survivalFloor: number;
  availableAfterSurvival: number;
  
  // Ads metrics
  optimalAdsSuggestion: number;
  maxDailyAds: number;
  
  // Forecast 7D chi tiết
  forecast7D: Forecast7DResult;
  
  // Alerts (boolean flags - legacy)
  isCashCrunch: boolean;
  isSurvivalRisk: boolean;
  
  // Runway status
  runwayStatus: 'safe' | 'ok' | 'warning' | 'danger';
  
  // Aggregated alerts with source (CFO v3.1)
  alerts: string[];  // Format: "source: ALERT_TYPE" e.g. "fc: SURVIVAL_RISK"
  
  // Breakdown
  committedBreakdown: CommittedCashBreakdown;
  monthlyBurnBreakdown: MonthlyBurnBreakdown;
  
  // Loan Summary (tổng quan vốn vay)
  loanSummary?: {
    totalPrincipal: number;           // Tổng tiền vay theo hợp đồng
    totalDisbursed: number;           // Tổng đã giải ngân (vào Bank)
    totalPendingDisbursement: number; // Chờ giải ngân
    totalDebtOutstanding: number;     // Dư nợ còn lại (phải trả)
    totalPrincipalPaid: number;       // Gốc đã trả
    totalInterestPaid: number;        // Lãi đã trả
    upcomingRepayments: number;       // Số kỳ trả nợ sắp tới (14D)
  };
}

// ═══════════════════════════════════════════════════════════
// COMMITTED CASH
// ═══════════════════════════════════════════════════════════

export interface CommittedCashBreakdown {
  labor: number;          // Lương đến hạn
  operations: number;     // Vận hành đến hạn
  agents: number;         // Đại lý đến hạn
  tax: number;            // Thuế đến hạn
  loanPayment: number;    // Nợ vay đến hạn
  total: number;
  windowDays: number;
}

// ═══════════════════════════════════════════════════════════
// MONTHLY BURN
// ═══════════════════════════════════════════════════════════

export interface MonthlyBurnBreakdown {
  laborCore: number;           // Lương core (dự chi tháng tới)
  operationsMandatory: number; // Vận hành bắt buộc (loại trừ ads)
  loanPayment: number;         // Trả nợ bắt buộc (đến hạn tháng tới)
  agentCommission?: number;    // Hoa hồng đại lý chờ thanh toán
  supplierPendingPayment?: number; // Khoản NCC chờ thanh toán
  total: number;
  // CFO v3.1: Flag if estimation was used due to missing data
  isEstimated?: boolean;    // true if some data came from fallback/estimation
  estimationNotes?: string[]; // Which parts were estimated
}

// ═══════════════════════════════════════════════════════════
// OPTIMAL ADS SUGGESTION (Rule 20%)
// ═══════════════════════════════════════════════════════════

export interface AdGroupOptimalSpend {
  adGroupId: string;
  adGroupName: string;
  
  // Input
  spendYesterday: number;
  avgSpendLast3Days: number;
  optimalRaw: number;        // Từ thuật toán ROI
  
  // Calculated
  baselineSpend: number;
  upperCap: number;          // +20%
  lowerCap: number;          // -30%
  optimalSuggested: number;  // Clamp trong [lowerCap, upperCap]
  
  // Status
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

// ═══════════════════════════════════════════════════════════
// FORECAST 7 DAYS
// ═══════════════════════════════════════════════════════════

export interface ForecastDay {
  day: number;              // 1-7
  date: Date;
  expectedIn: number;
  expectedOut: number;
  forecastBank: number;
  note?: string;            // VD: "Ngày trả lương"
}

export interface ExpectedInflowBreakdown {
  supplierPayments: number;   // NCC dự kiến trả
  loanDisbursement: number;   // Vay dự kiến giải ngân
  refunds: number;            // Refund dự kiến
  other: number;
  total: number;
  adjustedTotal: number;      // × RiskAdjustInflow
}

export interface ExpectedOutflowBreakdown {
  adsDaily: number;
  labor: number;
  operations: number;
  agents: number;
  tax: number;
  loanPayment: number;
  total: number;
}

export interface Forecast7DResult {
  days: ForecastDay[];
  lowPoint: number;
  lowPointDay: number;
  lowPointDate: Date;
  isCashCrunch: boolean;       // lowPoint < 0
  isSurvivalRisk: boolean;     // lowPoint < survivalFloor
  endBalance: number;          // Số dư cuối T+7
  
  // Inflows/Outflows theo ngày
  expectedInflows: ExpectedInflowBreakdown[];
  expectedOutflows: ExpectedOutflowBreakdown[];
}

// ═══════════════════════════════════════════════════════════
// API RESPONSE
// ═══════════════════════════════════════════════════════════

export interface FinancialControlResponse {
  success: boolean;
  data: FinancialControlFull;
  message?: string;
}

export interface Forecast7DResponse {
  success: boolean;
  data: Forecast7DResult;
  message?: string;
}

export interface OptimalAdsResponse {
  success: boolean;
  data: OptimalAdsSuggestionResult;
  message?: string;
}

// ═══════════════════════════════════════════════════════════
// MODULE HEALTH STATUS (CFO v3.2)
// ═══════════════════════════════════════════════════════════

export type ModuleHealthStatus = 'ok' | 'partial' | 'error' | 'timeout';

export interface ModuleHealth {
  name: string;
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

// ═══════════════════════════════════════════════════════════
// DRILL-DOWN BREAKDOWN (CFO v3.2)
// ═══════════════════════════════════════════════════════════

export interface BreakdownItem {
  id: string;
  name: string;
  amount: number;
  dueDate?: Date;
  status?: string;
  category?: string;
  linkTo?: string;  // Route to navigate for details
}

export interface CommittedCashDrilldown extends CommittedCashBreakdown {
  laborItems: BreakdownItem[];
  operationsItems: BreakdownItem[];
  agentsItems: BreakdownItem[];
  taxItems: BreakdownItem[];
  loanItems: BreakdownItem[];
  nextDueDate: Date | null;
  nextDueAmount: number;
  nextDueCategory: string;
}

export interface MonthlyBurnDrilldown extends MonthlyBurnBreakdown {
  laborCoreItems: BreakdownItem[];
  operationsMandatoryItems: BreakdownItem[];
  loanPaymentItems: BreakdownItem[];
}

// ═══════════════════════════════════════════════════════════
// ACTION SUGGESTIONS (CFO v3.2)
// ═══════════════════════════════════════════════════════════

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
  linkTo?: string;          // Route to navigate
  linkLabel?: string;       // Button text
  amount?: number;          // Related amount if applicable
  impact?: string;          // Expected impact description
}

export interface ActionSuggestionsResult {
  actions: ActionSuggestion[];
  generatedAt: Date;
  basedOnStatus: {
    runway: string;
    isCashCrunch: boolean;
    isSurvivalRisk: boolean;
    moduleHealth: ModuleHealthStatus;
  };
}
