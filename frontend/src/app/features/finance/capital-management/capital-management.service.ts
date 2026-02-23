import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { FundsOverview } from './models/funds.model';

// ===== INTERFACES =====

export interface RealAvailableFunds {
  safeAvailableFunds: number;
  totalNetProfit: number;
  mode: 'conservative' | 'moderate' | 'aggressive';
  // Dữ liệu lịch sử
  yesterday?: {
    safeAvailableFunds: number;
    totalNetProfit: number;
    realizedProfit: number;
    pendingProfit: number;
  };
  cumulative?: {
    safeAvailableFunds: number;
    totalNetProfit: number;
    realizedProfit: number;
    pendingProfit: number;
  };
  cashFlow: {
    realizedNetProfit?: number;
    realizedGrossProfit?: number;
    realizedOrderCount?: number;
    pendingNetProfit?: number;
    pendingGrossProfit?: number;
    pendingOrderCount?: number;
    realizedProfit?: number;
    realizedCount?: number;
    partialProfit?: number;
    partialCount?: number;
    pendingProfit?: number;
    pendingCount?: number;
    discountedFunds?: number;
    initialCapital?: number;
    netCashAvailable?: number;
    estimatedProfit?: number;
    unrealizedProfit?: number;
    loanAvailable?: number;
    // Doanh thu = Số tiền thu được sau khi thanh toán với NCC
    revenue?: number;
    // Vốn đặt chỗ vận hành = Chi phí khác + Chi phí nhân công chưa thanh toán
    reservedOperatingCapital?: number;
  };
  additionalInfo?: {
    riskLevel?: string;
    description?: string;
    note?: string;
    warning?: string;
    recommendation?: string;
  };
  calculatedAt: string;
}

export interface CapitalAllocationPolicy {
  _id: string;
  name: string;
  description?: string;
  reinvestmentRatio: number;
  safetyReserveRatio: number;
  personalIncomeRatio: number;
  longTermAssetRatio: number;
  isActive: boolean;
  notes?: string;
}

export interface AllocationComputation {
  date: string;
  policyName: string;
  mode: string;
  cashAvailable: number;
  totalNetProfit: number;
  // Dữ liệu lịch sử
  yesterday?: {
    cashAvailable: number;
    reinvestmentAmount: number;
    safetyReserveAmount: number;
    personalIncomeAmount: number;
    longTermAssetAmount: number;
  };
  cumulative?: {
    totalAllocated: number;
    totalReinvestment: number;
    totalSafetyReserve: number;
    totalPersonalIncome: number;
    totalLongTermAsset: number;
  };
  reinvestmentAmount: number;
  safetyReserveAmount: number;
  personalIncomeAmount: number;
  longTermAssetAmount: number;
  ratios: {
    reinvestmentRatio: number;
    safetyReserveRatio: number;
    personalIncomeRatio: number;
    longTermAssetRatio: number;
  };
  cashFlowDetail: any;
  additionalInfo: any;
}

export interface BudgetAllocation {
  adGroupId: string;
  adGroupName: string;
  currentBudget: number;
  suggestedBudget: number;
  allocatedBudget: number;
  roi: number;
  profit: number;
  applied: boolean;
  autoApply: boolean;  // Toggle tự động áp dụng
  lastAppliedAt?: string;  // Thời điểm áp dụng gần nhất
  reason?: string;
  scaleCapped?: boolean;  // NEW: Bị giới hạn 20%
  scalePercentage?: number;  // NEW: % tăng thực tế
}

export interface BudgetAllocationResult {
  totalAvailable: number;
  totalAllocated: number;
  allocations: BudgetAllocation[];
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
  horizontalScaling?: {  // NEW: Đề xuất tạo nhóm mới
    excessBudget: number;
    canCreateNewGroups: boolean;
    suggestedNewGroups: number;
    message: string;
  };
}

export interface BudgetAllocationStatus {
  availableFunds: number;
  totalSuggestedSpend: number;
  canAfford: boolean;
  deficit: number;
  adGroupCount: number;
  mode: string;
  
  // Breakdown vốn tái đầu tư (MỚI)
  reinvestmentBreakdown?: {
    initialReinvestment: number;    // Vốn tái đầu tư ban đầu
    allocatedFromProfit: number;    // Vốn phân bổ từ lợi nhuận
    adsCostSpent: number;           // Chi phí ads đã dùng
    available: number;              // Vốn tái đầu tư khả dụng
    formula: string;                // Công thức tính
  };
  
  // Dữ liệu lịch sử
  yesterday?: {
    totalSuggestedSpend: number;
    availableFunds: number;
    canAfford: boolean;
  };
  cumulative?: {
    totalAllocated: number;
    totalSpent: number;
    totalRevenue: number;
    totalProfit: number;
  };
  breakdown: any;
  additionalInfo: any;
}

export interface DashboardData {
  funds: RealAvailableFunds;
  allocation: AllocationComputation | null;
  budgetStatus: BudgetAllocationStatus | null;
  activePolicy: CapitalAllocationPolicy | null;
}

@Injectable({
  providedIn: 'root'
})
export class CapitalManagementService {
  private http = inject(HttpClient);
  private financeApi = `${environment.apiUrl}/finance`;
  private capitalApi = `${environment.apiUrl}/capital-allocation`;
  private budgetApi = `${environment.apiUrl}/budget-allocation`;
  private fundsApi = `${environment.apiUrl}/funds`;

  // ========== FUNDS API (MỚI) ==========
  
  /**
   * Lấy tổng quan các quỹ theo Spec chuẩn
   */
  getFundsOverview(): Observable<FundsOverview> {
    return this.http.get<FundsOverview>(`${this.fundsApi}/overview`);
  }

  /**
   * Lấy chi tiết Quỹ Đặt Chỗ (Committed Cash)
   */
  getCommittedCashFund(): Observable<any> {
    return this.http.get(`${this.fundsApi}/committed-cash`);
  }

  /**
   * Lấy chi tiết Quỹ Ads (Growth Capital)
   */
  getAdsFund(): Observable<any> {
    return this.http.get(`${this.fundsApi}/ads`);
  }

  /**
   * Lấy chi tiết Quỹ Dự Phòng (Survival Buffer)
   */
  getSurvivalBufferFund(): Observable<any> {
    return this.http.get(`${this.fundsApi}/survival-buffer`);
  }

  /**
   * Lấy chi tiết Quỹ Owner (Thu nhập)
   */
  getOwnerFund(): Observable<any> {
    return this.http.get(`${this.fundsApi}/owner`);
  }

  /**
   * Lấy công thức cốt lõi
   */
  getFundsFormulas(): Observable<any> {
    return this.http.get(`${this.fundsApi}/formulas`);
  }

  // ========== DASHBOARD API ==========

  /**
   * Load tất cả dữ liệu cho dashboard
   */
  loadDashboard(mode: 'conservative' | 'moderate' | 'aggressive' = 'conservative'): Observable<DashboardData> {
    return forkJoin({
      funds: this.getAvailableFunds(mode).pipe(catchError(() => of(null as any))),
      allocation: this.computeAllocation(mode).pipe(catchError(() => of(null))),
      budgetStatus: this.getBudgetStatus(mode).pipe(catchError(() => of(null))),
      activePolicy: this.getActivePolicy().pipe(catchError(() => of(null)))
    });
  }

  /**
   * Lấy vốn khả dụng
   */
  getAvailableFunds(mode: 'conservative' | 'moderate' | 'aggressive' = 'conservative'): Observable<RealAvailableFunds> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get<RealAvailableFunds>(`${this.financeApi}/available-funds/current`, { params });
  }

  /**
   * Tính toán phân bổ lợi nhuận
   */
  computeAllocation(mode: 'conservative' | 'moderate' | 'aggressive' = 'conservative'): Observable<AllocationComputation> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get<AllocationComputation>(`${this.capitalApi}/compute`, { params });
  }

  /**
   * Lấy active policy
   */
  getActivePolicy(): Observable<CapitalAllocationPolicy> {
    return this.http.get<CapitalAllocationPolicy>(`${this.capitalApi}/policies/active`);
  }

  /**
   * Lấy tất cả policies
   */
  getAllPolicies(): Observable<CapitalAllocationPolicy[]> {
    return this.http.get<CapitalAllocationPolicy[]>(`${this.capitalApi}/policies`);
  }

  /**
   * Tạo snapshot phân bổ
   */
  captureAllocationSnapshot(note?: string): Observable<any> {
    return this.http.post(`${this.capitalApi}/snapshots`, { note });
  }

  /**
   * Lấy trạng thái phân bổ ngân sách
   */
  getBudgetStatus(mode: 'conservative' | 'moderate' | 'aggressive' = 'conservative'): Observable<BudgetAllocationStatus> {
    const params = new HttpParams().set('mode', mode);
    return this.http.get<BudgetAllocationStatus>(`${this.budgetApi}/status`, { params });
  }

  /**
   * Thực hiện phân bổ ngân sách
   */
  allocateBudget(params: {
    dryRun?: boolean;
    minBudget?: number;
    maxBudget?: number;
    priorityMode?: 'roi' | 'profit' | 'equal';
    fundMode?: 'conservative' | 'moderate' | 'aggressive';
  }): Observable<BudgetAllocationResult> {
    return this.http.post<BudgetAllocationResult>(`${this.budgetApi}/auto`, params);
  }

  /**
   * Preview phân bổ ngân sách (dry run) - sử dụng GET /preview
   */
  previewBudgetAllocation(fundMode: 'conservative' | 'moderate' | 'aggressive' = 'conservative'): Observable<BudgetAllocationResult> {
    const params = new HttpParams().set('priorityMode', 'roi');
    return this.http.get<BudgetAllocationResult>(`${this.budgetApi}/preview`, { params });
  }

  /**
   * Toggle Auto Apply cho một ad group
   * Khi bật, sẽ tự động gọi API điều chỉnh budget cho nhóm QC đó
   */
  toggleAutoApply(adGroupId: string, autoApply: boolean): Observable<any> {
    return this.http.patch(`${this.budgetApi}/ad-groups/${adGroupId}/auto-apply`, { autoApply });
  }

  /**
   * Áp dụng budget cho một ad group cụ thể
   */
  applyBudgetToAdGroup(adGroupId: string, budget: number): Observable<any> {
    return this.http.post(`${this.budgetApi}/ad-groups/${adGroupId}/apply`, { budget });
  }

  /**
   * Lấy lịch sử phân bổ theo ngày
   */
  getAllocationHistory(days: number = 7): Observable<BudgetAllocationHistory[]> {
    const params = new HttpParams().set('days', days.toString());
    return this.http.get<BudgetAllocationHistory[]>(`${this.budgetApi}/history`, { params });
  }
}

/**
 * Interface cho lịch sử phân bổ
 */
export interface BudgetAllocationHistory {
  date: string;
  adGroupId: string;
  adGroupName: string;
  allocatedBudget: number;
  actualSpent: number;
  roi: number;
  profit: number;
  autoApplied: boolean;
  appliedAt?: string;
}
