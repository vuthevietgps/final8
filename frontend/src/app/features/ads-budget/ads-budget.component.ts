import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * 📊 Ads Budget Component - Bảng Gợi Ý Chi Phí Ads Hàng Ngày + KPI Nhóm Có Lãi
 *
 * Tab 1: Gợi ý chi phí từ /api/ad-group-daily-report/optimal-spend
 * Tab 2: KPI nhóm có lãi từ /api/employee-ads-kpi/profitable-stats
 */

/** Response từ API optimal-spend */
export interface OptimalSpendResponse {
  adGroupSuggestions: AdGroupSuggestion[];
  totalSuggestedSpend: number;
  totalSuggestedSpendWithCap: number;
  totalCurrentSpend: number;
  mode?: 'legacy' | 'product-x';
  defaultAssumedReturnRatePercent?: number;
}

export interface AdGroupSuggestion {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  productCategoryId?: string;
  productCategoryName?: string;
  spendYesterday: number;
  profitYesterday: number;
  currentAvgSpend: number;
  /** CFO Spec v3.0: Baseline = max(spendYesterday, avgLast3Days, 60k) */
  baselineSpend: number;
  suggestedSpend: number;
  suggestedSpendWithCap: number;
  reason: string;
  confidence: number;
  consecutiveNegativeDays: number;
  hasAlert: boolean;
  assumedReturnRatePercent?: number;
  assumptionSource?: 'product' | 'fallback' | 'mixed';
  orderCount?: number;
  expectedReturnedOrders?: number;
  optimizationMode?: 'legacy' | 'product-x';
  marginalAnalysis: {
    dataPoints: number;
    lastMarginalProfit: number;
    avgMarginalProfit: number;
  };
}

/** Mapped for display */
export interface DailyBudgetSuggestion {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  productCategoryId?: string;
  productCategoryName?: string;
  spendYesterday: number;
  profitYesterday: number;
  currentAvgSpend: number;
  /** CFO Spec v3.0: Baseline = max(spendYesterday, avgLast3Days, 60k) */
  baselineSpend: number;
  suggestedSpend: number;
  suggestedSpendWithCap: number;
  reason: string;
  confidence: number;
  dataPoints: number;
  lastMarginalProfit: number;
  avgMarginalProfit: number;
  consecutiveNegativeDays: number;
  hasAlert: boolean;
  assumedReturnRatePercent?: number;
  assumptionSource?: 'product' | 'fallback' | 'mixed';
  orderCount?: number;
  expectedReturnedOrders?: number;
  optimizationMode?: 'legacy' | 'product-x';
  recommendation: 'increase' | 'maintain' | 'decrease' | 'pause';
  actionDone: boolean; // Trạng thái hành động
}

export interface DailySuggestionsSummary {
  total: number;
  totalCurrentSpend: number;
  totalSuggestedSpend: number;
  totalSuggestedSpendWithCap: number;
  increaseCount: number;
  decreaseCount: number;
  maintainCount: number;
  pauseCount: number;
  alertCount: number;
  actionDoneCount: number;
}

// =============================================
// KPI PROFITABLE STATS INTERFACES
// =============================================

export interface KpiDailyStat {
  date: string;
  platform: string;
  productCategoryId: string;
  productCategoryName: string;
  totalGroups: number;
  profitableGroups: number;
  profitableRate: number;
  kpiMet: boolean;
}

export interface KpiDailyResponse {
  dailyStats: KpiDailyStat[];
  summary: {
    totalDays: number;
    avgProfitableRate: number;
    totalPlatformProducts: number;
    avgKpiMetRate: number;
  };
}

export interface KpiMonthlyPlatformProduct {
  platform: string;
  productCategoryId: string;
  productCategoryName: string;
  totalDays: number;
  avgProfitableGroups: number;
  avgTotalGroups: number;
  avgProfitableRate: number;
  daysKpiMet: number;
  kpiMetRate: number;
}

export interface KpiMonthlyResponse {
  yearMonth: string;
  platformProductStats: KpiMonthlyPlatformProduct[];
  overallSummary: {
    avgProfitableRate: number;
    avgKpiMetRate: number;
    totalPlatformProducts: number;
    bestPlatformProduct: { platform: string; productCategoryName: string; avgProfitableRate: number } | null;
    worstPlatformProduct: { platform: string; productCategoryName: string; avgProfitableRate: number } | null;
  };
}

export interface KpiTrendPoint {
  date: string;
  totalGroups: number;
  profitableGroups: number;
  profitableRate: number;
  avgProfitableRate7Day: number;
}

export interface ProductPlatformDailySummary {
  platform: string;
  productCategoryId: string;
  productCategoryName: string;
  totalGroups: number;
  profitableGroups: number;
  unprofitableGroups: number;
  profitableRate: number;
  kpiMet: boolean;
  totalSpend: number;
  totalProfit: number;
}

export interface EmergencyAdAccount {
  _id: string;
  name: string;
  accountId: string;
  accountType: string;
  isActive: boolean;
}

export type EmergencyTaskType =
  | 'create-account'
  | 'create-ad-group'
  | 'change-budget'
  | 'pause-ad-group';

export type EmergencyTaskPriority = 'critical' | 'high' | 'medium';

export interface EmergencyTask {
  id: string;
  type: EmergencyTaskType;
  priority: EmergencyTaskPriority;
  platform: string;
  productCategoryName?: string;
  adGroupId?: string;
  adGroupName?: string;
  currentSpend?: number;
  targetSpend?: number;
  reason: string;
  deadline: string;
  actionText: string;
  done: boolean;
  // Verification fields (from backend)
  verificationStatus?: 'pending' | 'verified' | 'failed' | 'skipped';
  verificationDetails?: string;
  doneByName?: string;
  doneAt?: string;
}

export interface EmergencyPlatformFundingNeed {
  platform: string;
  requiredDaily: number;
}

export interface EmergencyFundingPlan {
  coverageDays: number;
  currentBalance: number;
  requiredDaily: number;
  requiredTotal: number;
  shortage: number;
  surplus: number;
  byPlatform: Array<{
    platform: string;
    requiredDaily: number;
    requiredTotal: number;
    sharePercent: number;
  }>;
}
type EmergencyOptimizationMode = 'product-x' | 'legacy';

interface EmergencyModeFundingSnapshot {
  byPlatform: EmergencyPlatformFundingNeed[];
  requiredDaily: number;
}

@Component({
  selector: 'app-ads-budget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads-budget.component.html',
  styleUrls: ['./ads-budget.component.css']
})
export class AdsBudgetComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private apiUrl = `${environment.apiUrl}/ad-group-daily-report`;
  private kpiApiUrl = `${environment.apiUrl}/employee-ads-kpi`;
  private emergencyActionsApiUrl = `${environment.apiUrl}/emergency-actions`;
  private actionStorageKey = 'ads-budget-actions';
  private emergencyFundingStorageKey = 'ads-budget-emergency-funding';
  private minProfitableGroupsPerPlatformProduct = 4;

  // Tab state
  activeTab = signal<'suggestions' | 'kpi' | 'emergency'>('suggestions');

  // State
  isLoading = signal(false);
  error = signal<string | null>(null);

  // Filter
  recommendationFilter = signal<string>('all');
  platformFilter = signal<string>('all');
  showAlertOnly = signal(false);
  showPendingOnly = signal(false);
  optimizationMode = signal<'legacy' | 'product-x'>('product-x');
  defaultAssumedReturnRatePercent = signal<number>(20);

  // Data
  suggestions = signal<DailyBudgetSuggestion[]>([]);
  summary = signal<DailySuggestionsSummary | null>(null);
  actionStatus = signal<Map<string, boolean>>(new Map());

  // Emergency actions data
  emergencyLoading = signal(false);
  emergencyError = signal<string | null>(null);
  emergencyMode = signal<EmergencyOptimizationMode>('product-x');
  emergencyTasks = signal<EmergencyTask[]>([]);
  emergencyTasksByMode = signal<Record<EmergencyOptimizationMode, EmergencyTask[]>>({
    'product-x': [],
    legacy: [],
  });
  emergencyFundingByMode = signal<Record<EmergencyOptimizationMode, EmergencyModeFundingSnapshot>>({
    'product-x': { byPlatform: [], requiredDaily: 0 },
    legacy: { byPlatform: [], requiredDaily: 0 },
  });
  emergencyTaskStatus = signal<Map<string, boolean>>(new Map());
  emergencyCoverageDays = signal<number>(3);
  emergencyCurrentBalance = signal<number>(0);
  emergencyPlatformDailyNeeds = signal<EmergencyPlatformFundingNeed[]>([]);
  emergencyRequiredDaily = signal<number>(0);

  // KPI Data
  kpiLoading = signal(false);
  kpiError = signal<string | null>(null);
  kpiDailyStats = signal<KpiDailyStat[]>([]);
  kpiDailySummary = signal<KpiDailyResponse['summary'] | null>(null);
  kpiMonthlyStats = signal<KpiMonthlyPlatformProduct[]>([]);
  kpiMonthlySummary = signal<KpiMonthlyResponse['overallSummary'] | null>(null);
  kpiTrend = signal<KpiTrendPoint[]>([]);

  // KPI Filters
  kpiViewMode = signal<'daily' | 'monthly'>('daily');
  kpiPlatformFilter = signal<string>('all');
  kpiDateRange = signal<{ from: string; to: string }>({
    from: this.getDateString(-7),
    to: this.getDateString(0)
  });
  kpiYearMonth = signal<string>(this.getCurrentYearMonth());

  // Unique platforms for filter
  platforms = computed(() => {
    const items = this.suggestions();
    const unique = [...new Set(items.map(s => s.platform).filter(Boolean))];
    return unique.sort();
  });

  // Filtered suggestions
  filteredSuggestions = computed(() => {
    let items = this.suggestions();

    if (this.recommendationFilter() !== 'all') {
      items = items.filter(s => s.recommendation === this.recommendationFilter());
    }

    if (this.platformFilter() !== 'all') {
      items = items.filter(s => s.platform === this.platformFilter());
    }

    if (this.showAlertOnly()) {
      items = items.filter(s => s.hasAlert);
    }

    if (this.showPendingOnly()) {
      items = items.filter(s => !s.actionDone);
    }

    return items;
  });

  emergencySummary = computed(() => {
    const tasks = this.emergencyTasks();
    const done = tasks.filter(t => t.done).length;
    const critical = tasks.filter(t => t.priority === 'critical').length;
    const high = tasks.filter(t => t.priority === 'high').length;
    const createCount = tasks.filter(
      t => t.type === 'create-account' || t.type === 'create-ad-group'
    ).length;
    const budgetCount = tasks.filter(t => t.type === 'change-budget').length;
    const pauseCount = tasks.filter(t => t.type === 'pause-ad-group').length;

    return {
      total: tasks.length,
      done,
      pending: tasks.length - done,
      critical,
      high,
      createCount,
      budgetCount,
      pauseCount,
    };
  });

  emergencyModeComparison = computed(() => {
    const taskMap = this.emergencyTasksByMode();
    const fundingMap = this.emergencyFundingByMode();
    const xTasks = taskMap['product-x'] || [];
    const legacyTasks = taskMap.legacy || [];
    const xFunding = fundingMap['product-x']?.requiredDaily || 0;
    const legacyFunding = fundingMap.legacy?.requiredDaily || 0;

    return {
      xTaskCount: xTasks.length,
      legacyTaskCount: legacyTasks.length,
      taskDelta: xTasks.length - legacyTasks.length,
      xRequiredDaily: xFunding,
      legacyRequiredDaily: legacyFunding,
      requiredDailyDelta: xFunding - legacyFunding,
    };
  });

  creationTasks = computed(() =>
    this.emergencyTasks().filter(
      t => t.type === 'create-account' || t.type === 'create-ad-group'
    )
  );

  budgetAdjustmentTasks = computed(() =>
    this.emergencyTasks().filter(t => t.type === 'change-budget')
  );

  pauseTasks = computed(() =>
    this.emergencyTasks().filter(t => t.type === 'pause-ad-group')
  );

  /** Kiểm tra task có quá hạn không (so sánh deadline vs giờ hiện tại) */
  isTaskOverdue(task: EmergencyTask): boolean {
    if (task.done) return false;
    const hour = new Date().getHours();
    const deadlineHour = this.parseDeadlineHour(task.deadline);
    return hour > deadlineHour;
  }

  /** Đếm số task quá hạn */
  overdueCount = computed(() => {
    const hour = new Date().getHours();
    return this.emergencyTasks().filter(t => {
      if (t.done) return false;
      const deadlineHour = this.parseDeadlineHour(t.deadline);
      return hour > deadlineHour;
    }).length;
  });

  private parseDeadlineHour(deadline: string): number {
    if (!deadline) return 23;
    const match = deadline.match(/(\d{1,2}):?\d{0,2}/);
    if (match) return parseInt(match[1], 10);
    if (deadline.includes('ngay')) return 7;
    return 23;
  }

  emergencyFundingPlan = computed<EmergencyFundingPlan>(() => {
    const coverageDays = Math.max(1, Math.round(Number(this.emergencyCoverageDays()) || 1));
    const currentBalance = Math.max(0, Number(this.emergencyCurrentBalance()) || 0);
    const requiredDaily = Math.max(0, Number(this.emergencyRequiredDaily()) || 0);
    const requiredTotal = requiredDaily * coverageDays;
    const shortage = Math.max(0, requiredTotal - currentBalance);
    const surplus = Math.max(0, currentBalance - requiredTotal);

    const byPlatform = this.emergencyPlatformDailyNeeds().map(item => {
      const requiredTotalByPlatform = item.requiredDaily * coverageDays;
      const sharePercent = requiredDaily > 0
        ? (item.requiredDaily / requiredDaily) * 100
        : 0;
      return {
        platform: item.platform,
        requiredDaily: item.requiredDaily,
        requiredTotal: requiredTotalByPlatform,
        sharePercent
      };
    });

    return {
      coverageDays,
      currentBalance,
      requiredDaily,
      requiredTotal,
      shortage,
      surplus,
      byPlatform
    };
  });

  ngOnInit(): void {
    this.loadActionStatus();
    this.loadEmergencyActionStatus();
    this.loadEmergencyFundingConfig();

    const requestedTab = this.route.snapshot.queryParamMap.get('tab');
    if (requestedTab === 'suggestions' || requestedTab === 'kpi' || requestedTab === 'emergency') {
      this.activeTab.set(requestedTab);
    }

    if (this.activeTab() === 'emergency') {
      this.loadEmergencyActions();
      return;
    }

    if (this.activeTab() === 'kpi') {
      this.loadKpiData();
      return;
    }

    this.loadSuggestions();
  }

  onOptimizationModeChange(mode: 'legacy' | 'product-x'): void {
    this.optimizationMode.set(mode);
    this.refreshActiveTab();
  }

  onDefaultXChange(value: number | string): void {
    const parsed = Number(value);
    const normalized = Number.isFinite(parsed)
      ? Math.max(0, Math.min(95, parsed))
      : 20;
    this.defaultAssumedReturnRatePercent.set(normalized);
  }

  applyDefaultX(): void {
    this.refreshActiveTab();
  }

  onEmergencyModeChange(mode: EmergencyOptimizationMode): void {
    this.emergencyMode.set(mode);
    this.applyEmergencyModeData();
    if (this.activeTab() === 'emergency' && this.emergencyTasksByMode()[mode].length === 0) {
      this.loadEmergencyActions();
    }
  }

  getEmergencyModeLabel(mode: EmergencyOptimizationMode = this.emergencyMode()): string {
    return mode === 'product-x' ? 'Theo X hang hoan' : 'Theo loi nhuan thuc te';
  }

  private buildOptimalSpendQueryParams(): Record<string, string> {
    return this.buildOptimalSpendQueryParamsForMode(this.optimizationMode());
  }

  private buildOptimalSpendQueryParamsForMode(mode: EmergencyOptimizationMode): Record<string, string> {
    const params: Record<string, string> = {
      mode,
    };

    if (mode === 'product-x') {
      const normalized = Math.max(0, Math.min(95, Number(this.defaultAssumedReturnRatePercent()) || 20));
      params['defaultX'] = String(normalized);
    }

    return params;
  }

  private fetchOptimalSpendResponse() {
    return this.fetchOptimalSpendResponseByMode(this.optimizationMode());
  }

  private fetchOptimalSpendResponseByMode(mode: EmergencyOptimizationMode) {
    return this.http.get<OptimalSpendResponse>(`${this.apiUrl}/optimal-spend`, {
      params: this.buildOptimalSpendQueryParamsForMode(mode),
    });
  }

  loadSuggestions(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.fetchOptimalSpendResponse()
      .subscribe({
        next: (data) => {
          const actionMap = this.actionStatus();

          // Map API response to display format
          const mapped: DailyBudgetSuggestion[] = (data.adGroupSuggestions || []).map(ag => ({
            adGroupId: ag.adGroupId,
            adGroupName: ag.adGroupName,
            platform: ag.platform || 'unknown',
            productCategoryId: ag.productCategoryId,
            productCategoryName: ag.productCategoryName || 'Chưa phân loại',
            spendYesterday: ag.spendYesterday || 0,
            profitYesterday: ag.profitYesterday || 0,
            currentAvgSpend: ag.currentAvgSpend,
            baselineSpend: ag.baselineSpend || ag.currentAvgSpend, // CFO Spec v3.0
            suggestedSpend: ag.suggestedSpend,
            suggestedSpendWithCap: ag.suggestedSpendWithCap,
            reason: ag.reason,
            confidence: ag.confidence,
            dataPoints: ag.marginalAnalysis?.dataPoints || 0,
            lastMarginalProfit: ag.marginalAnalysis?.lastMarginalProfit || 0,
            avgMarginalProfit: ag.marginalAnalysis?.avgMarginalProfit || 0,
            consecutiveNegativeDays: ag.consecutiveNegativeDays || 0,
            hasAlert: ag.hasAlert || false,
            assumedReturnRatePercent: ag.assumedReturnRatePercent,
            assumptionSource: ag.assumptionSource,
            orderCount: ag.orderCount,
            expectedReturnedOrders: ag.expectedReturnedOrders,
            optimizationMode: ag.optimizationMode || data.mode || this.optimizationMode(),
            recommendation: this.getRecommendationFromReason(ag.reason, ag.baselineSpend || ag.currentAvgSpend, ag.suggestedSpendWithCap),
            actionDone: actionMap.get(ag.adGroupId) || false
          }));

          this.suggestions.set(mapped);

          // Build summary
          const increaseCount = mapped.filter(m => m.recommendation === 'increase').length;
          const decreaseCount = mapped.filter(m => m.recommendation === 'decrease').length;
          const maintainCount = mapped.filter(m => m.recommendation === 'maintain').length;
          const pauseCount = mapped.filter(m => m.recommendation === 'pause').length;
          const alertCount = mapped.filter(m => m.hasAlert).length;
          const actionDoneCount = mapped.filter(m => m.actionDone).length;

          this.summary.set({
            total: mapped.length,
            totalCurrentSpend: data.totalCurrentSpend || 0,
            totalSuggestedSpend: data.totalSuggestedSpend || 0,
            totalSuggestedSpendWithCap: data.totalSuggestedSpendWithCap || 0,
            increaseCount,
            decreaseCount,
            maintainCount,
            pauseCount,
            alertCount,
            actionDoneCount
          });

          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load suggestions:', err);
          this.error.set('Không thể tải dữ liệu. Vui lòng thử lại.');
          this.isLoading.set(false);
        }
      });
  }

  // =============================================
  // ACTION STATUS (localStorage)
  // =============================================

  loadActionStatus(): void {
    try {
      const today = new Date().toISOString().split('T')[0];
      const stored = localStorage.getItem(this.actionStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Reset if different day
        if (parsed.date === today) {
          this.actionStatus.set(new Map(Object.entries(parsed.actions || {})));
        } else {
          // New day - reset all actions
          localStorage.removeItem(this.actionStorageKey);
          this.actionStatus.set(new Map());
        }
      }
    } catch {
      this.actionStatus.set(new Map());
    }
  }

  toggleActionDone(adGroupId: string): void {
    const currentMap = new Map(this.actionStatus());
    const currentValue = currentMap.get(adGroupId) || false;
    currentMap.set(adGroupId, !currentValue);
    this.actionStatus.set(currentMap);

    // Update suggestions
    const updated = this.suggestions().map(s =>
      s.adGroupId === adGroupId ? { ...s, actionDone: !currentValue } : s
    );
    this.suggestions.set(updated);

    // Update summary
    const s = this.summary();
    if (s) {
      this.summary.set({
        ...s,
        actionDoneCount: updated.filter(m => m.actionDone).length
      });
    }

    // Save to localStorage
    this.saveActionStatus();
  }

  saveActionStatus(): void {
    const today = new Date().toISOString().split('T')[0];
    const actions: Record<string, boolean> = {};
    this.actionStatus().forEach((v, k) => { actions[k] = v; });
    localStorage.setItem(this.actionStorageKey, JSON.stringify({ date: today, actions }));
  }

  /** Tải trạng thái emergency tasks từ backend API (thay vì localStorage) */
  loadEmergencyActionStatus(): void {
    const today = new Date().toISOString().split('T')[0];
    this.http.get<{ tasks: any[] }>(`${this.emergencyActionsApiUrl}`, {
      params: { date: today }, withCredentials: true
    }).pipe(
      catchError(() => of({ tasks: [] }))
    ).subscribe(res => {
      const map = new Map<string, boolean>();
      const verificationMap = new Map<string, any>();
      for (const task of (res.tasks || [])) {
        if (task.done) map.set(task.taskId, true);
        verificationMap.set(task.taskId, {
          verificationStatus: task.verificationStatus,
          verificationDetails: task.verificationDetails,
          doneByName: task.doneByName,
          doneAt: task.doneAt,
        });
      }
      this.emergencyTaskStatus.set(map);
      this.emergencyVerificationData.set(verificationMap);
      this.applyBackendEmergencyStateToTaskCaches();
    });
  }

  /** Map lưu verification data từ backend */
  emergencyVerificationData = signal<Map<string, any>>(new Map());

  /** Sync tasks xuống backend sau khi buildEmergencyTasks (upsert) */
  private syncEmergencyTasksToBackend(tasks: EmergencyTask[]): void {
    const today = new Date().toISOString().split('T')[0];
    const payload = tasks.map(t => ({
      taskId: t.id,
      taskType: t.type,
      priority: t.priority,
      platform: t.platform,
      adGroupId: t.adGroupId,
      adGroupName: t.adGroupName,
      actionText: t.actionText,
      reason: t.reason,
      deadline: t.deadline,
      currentSpend: t.currentSpend,
      targetSpend: t.targetSpend,
    }));

    this.http.post<{ success: boolean }>(`${this.emergencyActionsApiUrl}/bulk-sync`, {
      date: today, tasks: payload
    }, { withCredentials: true }).pipe(
      catchError(() => of(null))
    ).subscribe(res => {
      if (res?.success) {
        this.loadEmergencyActionStatus();
      }
    });
  }

  loadEmergencyFundingConfig(): void {
    try {
      const stored = localStorage.getItem(this.emergencyFundingStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      const coverageDays = Math.max(1, Number(parsed.coverageDays) || 3);
      const currentBalance = Math.max(0, Number(parsed.currentBalance) || 0);
      this.emergencyCoverageDays.set(coverageDays);
      this.emergencyCurrentBalance.set(currentBalance);
    } catch {
      this.emergencyCoverageDays.set(3);
      this.emergencyCurrentBalance.set(0);
    }
  }

  saveEmergencyFundingConfig(): void {
    localStorage.setItem(this.emergencyFundingStorageKey, JSON.stringify({
      coverageDays: this.emergencyCoverageDays(),
      currentBalance: this.emergencyCurrentBalance()
    }));
  }

  setEmergencyCoverageDays(value: number | string): void {
    const parsed = Math.max(1, Math.round(Number(value) || 1));
    this.emergencyCoverageDays.set(parsed);
    this.saveEmergencyFundingConfig();
  }

  setEmergencyCurrentBalance(value: number | string): void {
    const parsed = Math.max(0, Number(value) || 0);
    this.emergencyCurrentBalance.set(parsed);
    this.saveEmergencyFundingConfig();
  }

  private rollbackEmergencyTaskToggle(
    taskId: string,
    mode: EmergencyOptimizationMode,
    done: boolean,
  ): void {
    const rollbackMap = new Map(this.emergencyTaskStatus());
    rollbackMap.set(taskId, done);
    this.emergencyTaskStatus.set(rollbackMap);
    this.updateEmergencyTaskInMode(mode, taskId, (task) => ({ ...task, done }));
  }

  toggleEmergencyTaskDone(taskId: string): void {
    type EmergencyToggleResponse = {
      success: boolean;
      task?: any;
      message?: string;
    };

    const mode = this.getEmergencyModeFromTaskId(taskId);
    const map = new Map(this.emergencyTaskStatus());
    const current = map.get(taskId) || false;
    const newDone = !current;

    // Optimistic UI update
    map.set(taskId, newDone);
    this.emergencyTaskStatus.set(map);
    this.updateEmergencyTaskInMode(mode, taskId, (task) => ({ ...task, done: newDone }));

    // Call backend API
    const today = new Date().toISOString().split('T')[0];
    const encodedTaskId = encodeURIComponent(taskId);
    this.http.patch<EmergencyToggleResponse>(
      `${this.emergencyActionsApiUrl}/${encodedTaskId}/toggle`,
      {},
      { params: { date: today }, withCredentials: true }
    ).pipe(
      catchError((err) => {
        this.rollbackEmergencyTaskToggle(taskId, mode, current);
        return of<EmergencyToggleResponse>({
          success: false,
          task: undefined,
          message: err?.error?.message || 'Khong the cap nhat task khan cap',
        });
      })
    ).subscribe(res => {
      const updatedTask = res?.task;
      if (!res?.success || !updatedTask) {
        this.rollbackEmergencyTaskToggle(taskId, mode, current);
        return;
      }

      const vMap = new Map(this.emergencyVerificationData());
      vMap.set(taskId, {
        verificationStatus: updatedTask.verificationStatus,
        verificationDetails: updatedTask.verificationDetails,
        doneByName: updatedTask.doneByName,
        doneAt: updatedTask.doneAt,
      });
      this.emergencyVerificationData.set(vMap);

      this.updateEmergencyTaskInMode(mode, taskId, (currentTask) => ({
        ...currentTask,
        done: !!updatedTask.done,
        verificationStatus: updatedTask.verificationStatus,
        verificationDetails: updatedTask.verificationDetails,
        doneByName: updatedTask.doneByName,
        doneAt: updatedTask.doneAt,
      }));
    });
  }

  getRecommendationFromReason(reason: string, currentSpend: number, suggestedSpend: number): 'increase' | 'maintain' | 'decrease' | 'pause' {
    const diff = suggestedSpend - currentSpend;
    const diffPercent = currentSpend > 0 ? (diff / currentSpend) * 100 : 0;

    if (reason.toLowerCase().includes('tắt') || reason.toLowerCase().includes('pause')) {
      return 'pause';
    }
    if (diffPercent >= 5) {
      return 'increase';
    }
    if (diffPercent <= -5) {
      return 'decrease';
    }
    return 'maintain';
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  formatCurrency(value: number | undefined | null): string {
    if (value === undefined || value === null) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }

  formatNumber(value: number | undefined | null): string {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  formatPercent(value: number | undefined | null): string {
    if (value === undefined || value === null) return '0%';
    return value.toFixed(1) + '%';
  }

  getPlatformIcon(platform: string): string {
    switch (platform?.toLowerCase()) {
      case 'facebook': return '📘';
      case 'google': return '🔍';
      case 'tiktok': return '🎵';
      default: return '📢';
    }
  }

  getRecommendationClass(rec: string): string {
    switch (rec) {
      case 'increase': return 'rec-increase';
      case 'maintain': return 'rec-maintain';
      case 'decrease': return 'rec-decrease';
      case 'pause': return 'rec-pause';
      default: return '';
    }
  }

  getRecommendationLabel(rec: string): string {
    switch (rec) {
      case 'increase': return '↑ Tăng';
      case 'maintain': return '= Giữ';
      case 'decrease': return '↓ Giảm';
      case 'pause': return '⏸ Tắt';
      default: return rec;
    }
  }

  getDiffPercent(s: DailyBudgetSuggestion): number {
    // CFO Spec v3.0: Tính % thay đổi từ baselineSpend
    const baseline = s.baselineSpend || s.currentAvgSpend;
    if (!baseline || baseline === 0) return 0;
    return ((s.suggestedSpendWithCap - baseline) / baseline) * 100;
  }

  // =============================================
  // KPI PROFITABLE STATS METHODS
  // =============================================

  switchTab(tab: 'suggestions' | 'kpi' | 'emergency'): void {
    this.activeTab.set(tab);
    if (tab === 'kpi' && this.kpiDailyStats().length === 0) {
      this.loadKpiData();
    }
    if (tab === 'emergency' && this.emergencyTasks().length === 0) {
      this.loadEmergencyActions();
    }
  }

  refreshActiveTab(): void {
    if (this.activeTab() === 'suggestions') {
      this.loadSuggestions();
      return;
    }

    if (this.activeTab() === 'kpi') {
      this.loadKpiData();
      return;
    }

    this.loadEmergencyActions();
  }

  loadEmergencyActions(): void {
    this.emergencyLoading.set(true);
    this.emergencyError.set(null);

    forkJoin({
      optimalProductX: this.fetchOptimalSpendResponseByMode('product-x').pipe(
        catchError(() => of({
          adGroupSuggestions: [],
          totalSuggestedSpend: 0,
          totalSuggestedSpendWithCap: 0,
          totalCurrentSpend: 0,
          mode: 'product-x',
        } as OptimalSpendResponse))
      ),
      optimalLegacy: this.fetchOptimalSpendResponseByMode('legacy').pipe(
        catchError(() => of({
          adGroupSuggestions: [],
          totalSuggestedSpend: 0,
          totalSuggestedSpendWithCap: 0,
          totalCurrentSpend: 0,
          mode: 'legacy',
        } as OptimalSpendResponse))
      ),
      productSummary: this.http.get<ProductPlatformDailySummary[]>(
        `${this.kpiApiUrl}/daily-suggestions/product-platform-summary`
      ).pipe(
        catchError(() => of([] as ProductPlatformDailySummary[]))
      ),
      adAccounts: this.http.get<EmergencyAdAccount[]>(
        `${environment.apiUrl}/ad-accounts`,
        { params: { isActive: 'true' }, withCredentials: true }
      ).pipe(
        catchError(() => of([] as EmergencyAdAccount[]))
      )
    }).subscribe({
      next: ({ optimalProductX, optimalLegacy, productSummary, adAccounts }) => {
        const commonProductSummary = productSummary || [];
        const commonAdAccounts = adAccounts || [];
        const doneMap = this.emergencyTaskStatus();
        const verificationData = this.emergencyVerificationData();

        const scenarioX = this.buildEmergencyScenarioData(
          'product-x',
          optimalProductX,
          commonProductSummary,
          commonAdAccounts,
          doneMap,
          verificationData,
        );
        const scenarioLegacy = this.buildEmergencyScenarioData(
          'legacy',
          optimalLegacy,
          commonProductSummary,
          commonAdAccounts,
          doneMap,
          verificationData,
        );

        this.setEmergencyScenarioData('product-x', scenarioX.tasks, scenarioX.funding);
        this.setEmergencyScenarioData('legacy', scenarioLegacy.tasks, scenarioLegacy.funding);
        this.applyEmergencyModeData();
        this.emergencyLoading.set(false);

        // Sync tasks to backend (upsert - create if missing, keep done if existing)
        this.syncEmergencyTasksToBackend([
          ...scenarioX.tasks,
          ...scenarioLegacy.tasks,
        ]);
      },
      error: (err) => {
        console.error('Failed to load emergency actions:', err);
        this.emergencyError.set('Không thể tải tab hành động khẩn cấp. Vui lòng thử lại.');
        this.emergencyLoading.set(false);
      }
    });
  }

  private buildEmergencyScenarioData(
    mode: EmergencyOptimizationMode,
    optimal: OptimalSpendResponse,
    productSummary: ProductPlatformDailySummary[],
    adAccounts: EmergencyAdAccount[],
    doneMap: Map<string, boolean>,
    verificationData: Map<string, any>,
  ): { tasks: EmergencyTask[]; funding: EmergencyModeFundingSnapshot } {
    const suggestions = this.mapOptimalToDailySuggestions(optimal, mode);
    const funding = this.calculateEmergencyFundingNeeds(suggestions);
    const tasks = this.buildEmergencyTasks(
      mode,
      suggestions,
      productSummary,
      adAccounts,
      doneMap,
    ).map(task => {
      const verification = verificationData.get(task.id);
      if (!verification) return task;
      return {
        ...task,
        verificationStatus: verification.verificationStatus,
        verificationDetails: verification.verificationDetails,
        doneByName: verification.doneByName,
        doneAt: verification.doneAt,
      };
    });

    return { tasks, funding };
  }

  private mapOptimalToDailySuggestions(
    optimal: OptimalSpendResponse,
    mode: EmergencyOptimizationMode,
  ): DailyBudgetSuggestion[] {
    return (optimal.adGroupSuggestions || []).map(ag => {
      const baseline = ag.baselineSpend || ag.currentAvgSpend || 0;
      return {
        adGroupId: ag.adGroupId,
        adGroupName: ag.adGroupName,
        platform: (ag.platform || 'unknown').toLowerCase(),
        productCategoryId: ag.productCategoryId,
        productCategoryName: ag.productCategoryName || 'Chua phan loai',
        spendYesterday: ag.spendYesterday || 0,
        profitYesterday: ag.profitYesterday || 0,
        currentAvgSpend: ag.currentAvgSpend || 0,
        baselineSpend: baseline,
        suggestedSpend: ag.suggestedSpend || 0,
        suggestedSpendWithCap: ag.suggestedSpendWithCap || 0,
        reason: ag.reason || '',
        confidence: ag.confidence || 0,
        dataPoints: ag.marginalAnalysis?.dataPoints || 0,
        lastMarginalProfit: ag.marginalAnalysis?.lastMarginalProfit || 0,
        avgMarginalProfit: ag.marginalAnalysis?.avgMarginalProfit || 0,
        consecutiveNegativeDays: ag.consecutiveNegativeDays || 0,
        hasAlert: ag.hasAlert || false,
        assumedReturnRatePercent: ag.assumedReturnRatePercent,
        assumptionSource: ag.assumptionSource,
        orderCount: ag.orderCount,
        expectedReturnedOrders: ag.expectedReturnedOrders,
        optimizationMode: ag.optimizationMode || optimal.mode || mode,
        recommendation: this.getRecommendationFromReason(
          ag.reason || '',
          baseline,
          ag.suggestedSpendWithCap || 0
        ),
        actionDone: false
      };
    });
  }

  private calculateEmergencyFundingNeeds(suggestions: DailyBudgetSuggestion[]): EmergencyModeFundingSnapshot {
    const pauseIds = new Set(
      suggestions
        .filter(s => s.recommendation === 'pause' || (s.hasAlert && s.consecutiveNegativeDays >= 3))
        .map(s => s.adGroupId)
    );

    const platformMap = new Map<string, number>();
    let totalRequiredDaily = 0;

    for (const item of suggestions) {
      if (pauseIds.has(item.adGroupId)) continue;
      const budget = Math.max(0, item.suggestedSpendWithCap || item.suggestedSpend || 0);
      if (budget <= 0) continue;
      const platform = (item.platform || 'unknown').toLowerCase();
      platformMap.set(platform, (platformMap.get(platform) || 0) + budget);
      totalRequiredDaily += budget;
    }

    const byPlatform = Array.from(platformMap.entries())
      .map(([platform, requiredDaily]) => ({ platform, requiredDaily }))
      .sort((a, b) => b.requiredDaily - a.requiredDaily);

    return {
      byPlatform,
      requiredDaily: totalRequiredDaily,
    };
  }

  private setEmergencyScenarioData(
    mode: EmergencyOptimizationMode,
    tasks: EmergencyTask[],
    funding: EmergencyModeFundingSnapshot,
  ): void {
    const taskMap = this.emergencyTasksByMode();
    this.emergencyTasksByMode.set({
      ...taskMap,
      [mode]: tasks,
    });

    const fundingMap = this.emergencyFundingByMode();
    this.emergencyFundingByMode.set({
      ...fundingMap,
      [mode]: funding,
    });
  }

  private applyEmergencyModeData(): void {
    const mode = this.emergencyMode();
    const taskMap = this.emergencyTasksByMode();
    const fundingMap = this.emergencyFundingByMode();

    this.emergencyTasks.set(taskMap[mode] || []);
    this.emergencyPlatformDailyNeeds.set(fundingMap[mode]?.byPlatform || []);
    this.emergencyRequiredDaily.set(fundingMap[mode]?.requiredDaily || 0);
  }

  private getEmergencyModeFromTaskId(taskId: string): EmergencyOptimizationMode {
    return taskId.startsWith('legacy:') ? 'legacy' : 'product-x';
  }

  private updateEmergencyTaskInMode(
    mode: EmergencyOptimizationMode,
    taskId: string,
    updater: (task: EmergencyTask) => EmergencyTask,
  ): void {
    const taskMap = this.emergencyTasksByMode();
    const currentTasks = taskMap[mode] || [];
    const updatedTasks = currentTasks.map(task => task.id === taskId ? updater(task) : task);

    this.emergencyTasksByMode.set({
      ...taskMap,
      [mode]: updatedTasks,
    });

    if (this.emergencyMode() === mode) {
      this.emergencyTasks.set(updatedTasks);
    }
  }

  private applyBackendEmergencyStateToTaskCaches(): void {
    const doneMap = this.emergencyTaskStatus();
    const verificationMap = this.emergencyVerificationData();
    const taskMap = this.emergencyTasksByMode();
    const updatedTaskMap: Record<EmergencyOptimizationMode, EmergencyTask[]> = {
      'product-x': [],
      legacy: [],
    };

    (Object.keys(taskMap) as EmergencyOptimizationMode[]).forEach((mode) => {
      updatedTaskMap[mode] = (taskMap[mode] || []).map((task) => {
        const verification = verificationMap.get(task.id);
        return {
          ...task,
          done: doneMap.get(task.id) || false,
          verificationStatus: verification?.verificationStatus ?? task.verificationStatus,
          verificationDetails: verification?.verificationDetails ?? task.verificationDetails,
          doneByName: verification?.doneByName ?? task.doneByName,
          doneAt: verification?.doneAt ?? task.doneAt,
        };
      });
    });

    this.emergencyTasksByMode.set(updatedTaskMap);
    this.applyEmergencyModeData();
  }

  getVerificationIcon(status?: string): string {
    switch (status) {
      case 'verified': return '✅';
      case 'failed': return '❌';
      case 'skipped': return '➖';
      default: return '⏳';
    }
  }

  getVerificationLabel(status?: string): string {
    switch (status) {
      case 'verified': return 'Đã xác minh';
      case 'failed': return 'Chưa thực hiện trên platform';
      case 'skipped': return 'Xác minh thủ công';
      default: return 'Chờ xác minh';
    }
  }

  getVerificationClass(status?: string): string {
    switch (status) {
      case 'verified': return 'verification-verified';
      case 'failed': return 'verification-failed';
      case 'skipped': return 'verification-skipped';
      default: return 'verification-pending';
    }
  }

  private buildEmergencyTasks(
    mode: EmergencyOptimizationMode,
    suggestions: DailyBudgetSuggestion[],
    productSummary: ProductPlatformDailySummary[],
    adAccounts: EmergencyAdAccount[],
    doneMap: Map<string, boolean>
  ): EmergencyTask[] {
    const tasks: EmergencyTask[] = [];
    const activeAccounts = adAccounts.filter(a => a.isActive !== false);
    const accountsByPlatform = new Map<string, EmergencyAdAccount[]>();

    for (const account of activeAccounts) {
      const platform = (account.accountType || '').toLowerCase();
      if (!platform) continue;
      const current = accountsByPlatform.get(platform) || [];
      current.push(account);
      accountsByPlatform.set(platform, current);
    }

    const addTask = (task: Omit<EmergencyTask, 'done'>) => {
      tasks.push({
        ...task,
        done: doneMap.get(task.id) || false
      });
    };

    const requiredPlatforms = new Set<string>();
    for (const item of productSummary) {
      if (item.platform) requiredPlatforms.add(item.platform.toLowerCase());
    }
    for (const item of suggestions) {
      if (item.platform) requiredPlatforms.add(item.platform.toLowerCase());
    }

    for (const platform of requiredPlatforms) {
      if (!platform || accountsByPlatform.has(platform)) continue;

      const impactedProducts = productSummary
        .filter(p => (p.platform || '').toLowerCase() === platform)
        .map(p => p.productCategoryName)
        .filter(Boolean);
      const productText = impactedProducts.length > 0
        ? impactedProducts.join(', ')
        : 'các sản phẩm đang chạy';

      addTask({
        id: `${mode}:create-account:${platform}`,
        type: 'create-account',
        priority: 'critical',
        platform,
        reason: `Chưa có tài khoản quảng cáo active trên ${this.getPlatformLabel(platform)}.`,
        deadline: 'Trước 09:00',
        actionText: `Tạo mới tài khoản quảng cáo trên nền tảng ${this.getPlatformLabel(platform)} cho sản phẩm ${productText}.`
      });
    }

    for (const item of productSummary) {
      const platform = (item.platform || '').toLowerCase();
      const profitableGroups = Math.max(0, item.profitableGroups || 0);
      const missingGroups = Math.max(0, this.minProfitableGroupsPerPlatformProduct - profitableGroups);
      if (missingGroups <= 0) continue;

      const needsAccountFirst = !accountsByPlatform.has(platform);
      const productName = item.productCategoryName || 'Chưa phân loại';
      const baseAction = `Tạo mới ${missingGroups} nhóm quảng cáo trên nền tảng ${this.getPlatformLabel(platform)} cho sản phẩm ${productName}.`;
      const actionText = needsAccountFirst
        ? `Sau khi có tài khoản, ${baseAction}`
        : baseAction;

      addTask({
        id: `${mode}:create-ad-group:${platform}:${item.productCategoryId || productName}`,
        type: 'create-ad-group',
        priority: needsAccountFirst ? 'critical' : 'high',
        platform,
        productCategoryName: productName,
        reason: `${this.getPlatformLabel(platform)} - ${productName} mới có ${item.totalGroups} nhóm, thiếu ${missingGroups} nhóm so với ngưỡng ${this.minProfitableGroupsPerPlatformProduct}.`,
        deadline: 'Trước 10:00',
        actionText
      });
    }

    const pauseIds = new Set<string>();
    const pauseCandidates = suggestions.filter(
      s => s.recommendation === 'pause' || (s.hasAlert && s.consecutiveNegativeDays >= 3)
    );
    for (const item of pauseCandidates) {
      const reason = item.reason || `Lỗ liên tiếp ${item.consecutiveNegativeDays} ngày`;
      addTask({
        id: `${mode}:pause:${item.adGroupId}`,
        type: 'pause-ad-group',
        priority: 'critical',
        platform: (item.platform || '').toLowerCase(),
        productCategoryName: item.productCategoryName,
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        currentSpend: item.spendYesterday,
        targetSpend: 0,
        reason,
        deadline: 'Xử lý ngay',
        actionText: `Tắt nhóm quảng cáo ${item.adGroupName} (${item.adGroupId}) trên ${this.getPlatformLabel(item.platform)}. Vì: ${reason}.`
      });
      pauseIds.add(item.adGroupId);
    }

    const budgetCandidates = suggestions.filter(
      s =>
        !pauseIds.has(s.adGroupId) &&
        (s.recommendation === 'increase' || s.recommendation === 'decrease')
    );

    for (const item of budgetCandidates) {
      const targetSpend = item.suggestedSpendWithCap || item.suggestedSpend || 0;
      addTask({
        id: `${mode}:change-budget:${item.adGroupId}`,
        type: 'change-budget',
        priority: item.hasAlert ? 'high' : 'medium',
        platform: (item.platform || '').toLowerCase(),
        productCategoryName: item.productCategoryName,
        adGroupId: item.adGroupId,
        adGroupName: item.adGroupName,
        currentSpend: item.spendYesterday,
        targetSpend,
        reason: item.reason || 'Theo khuyến nghị tối ưu chi phí',
        deadline: item.hasAlert ? 'Trước 11:00' : 'Trước 14:00',
        actionText: `Thay đổi chi phí nhóm quảng cáo ${item.adGroupName} (${item.adGroupId}) trên ${this.getPlatformLabel(item.platform)} thành ${this.formatCurrency(targetSpend)}.`
      });
    }

    return tasks.sort((a, b) => {
      const p = this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority);
      if (p !== 0) return p;
      return a.deadline.localeCompare(b.deadline);
    });
  }

  private getPriorityWeight(priority: EmergencyTaskPriority): number {
    if (priority === 'critical') return 3;
    if (priority === 'high') return 2;
    return 1;
  }

  getPriorityLabel(priority: EmergencyTaskPriority): string {
    if (priority === 'critical') return 'KHẨN CẤP';
    if (priority === 'high') return 'QUAN TRỌNG';
    return 'CẦN LÀM';
  }

  getPriorityClass(priority: EmergencyTaskPriority): string {
    if (priority === 'critical') return 'priority-critical';
    if (priority === 'high') return 'priority-high';
    return 'priority-medium';
  }

  private getPlatformLabel(platform?: string): string {
    const p = (platform || '').toLowerCase();
    if (p === 'facebook') return 'Facebook';
    if (p === 'google') return 'Google';
    if (p === 'tiktok') return 'TikTok';
    return platform || 'Nền tảng khác';
  }

  loadKpiData(): void {
    if (this.kpiViewMode() === 'daily') {
      this.loadKpiDaily();
    } else {
      this.loadKpiMonthly();
    }
  }

  loadKpiDaily(): void {
    this.kpiLoading.set(true);
    this.kpiError.set(null);

    const { from, to } = this.kpiDateRange();
    this.http.get<KpiDailyResponse>(`${this.kpiApiUrl}/profitable-stats/daily?from=${from}&to=${to}`)
      .subscribe({
        next: (data) => {
          this.kpiDailyStats.set(data.dailyStats || []);
          this.kpiDailySummary.set(data.summary || null);
          this.kpiLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load KPI daily stats:', err);
          this.kpiError.set('Không thể tải dữ liệu KPI. Vui lòng thử lại.');
          this.kpiLoading.set(false);
        }
      });

    // Load trend data
    this.http.get<KpiTrendPoint[]>(`${this.kpiApiUrl}/profitable-stats/trend?from=${from}&to=${to}`)
      .subscribe({
        next: (data) => {
          this.kpiTrend.set(data || []);
        },
        error: () => {}
      });
  }

  loadKpiMonthly(): void {
    this.kpiLoading.set(true);
    this.kpiError.set(null);

    const yearMonth = this.kpiYearMonth();
    this.http.get<KpiMonthlyResponse>(`${this.kpiApiUrl}/profitable-stats/monthly?yearMonth=${yearMonth}`)
      .subscribe({
        next: (data) => {
          this.kpiMonthlyStats.set(data.platformProductStats || []);
          this.kpiMonthlySummary.set(data.overallSummary || null);
          this.kpiLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load KPI monthly stats:', err);
          this.kpiError.set('Không thể tải dữ liệu KPI tháng. Vui lòng thử lại.');
          this.kpiLoading.set(false);
        }
      });
  }

  // Filtered KPI daily stats
  filteredKpiDaily = computed(() => {
    let items = this.kpiDailyStats();
    if (this.kpiPlatformFilter() !== 'all') {
      items = items.filter(s => s.platform === this.kpiPlatformFilter());
    }
    return items;
  });

  // Filtered KPI monthly stats
  filteredKpiMonthly = computed(() => {
    let items = this.kpiMonthlyStats();
    if (this.kpiPlatformFilter() !== 'all') {
      items = items.filter(s => s.platform === this.kpiPlatformFilter());
    }
    return items;
  });

  // Unique platforms from KPI data
  kpiPlatforms = computed(() => {
    const dailyPlatforms = this.kpiDailyStats().map(s => s.platform);
    const monthlyPlatforms = this.kpiMonthlyStats().map(s => s.platform);
    const all = [...dailyPlatforms, ...monthlyPlatforms];
    return [...new Set(all.filter(Boolean))].sort();
  });

  // =============================================
  // KPI HELPER METHODS
  // =============================================

  getDateString(daysOffset: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toISOString().split('T')[0];
  }

  getCurrentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  setKpiDateRange(days: number): void {
    this.kpiDateRange.set({
      from: this.getDateString(-days),
      to: this.getDateString(0)
    });
    this.loadKpiDaily();
  }

  onKpiViewModeChange(): void {
    this.loadKpiData();
  }

  getKpiRateClass(rate: number): string {
    if (rate >= 0.7) return 'kpi-good';
    if (rate >= 0.5) return 'kpi-warning';
    return 'kpi-bad';
  }

  getKpiMetBadge(kpiMet: boolean): string {
    return kpiMet ? '✅ Đạt' : '❌ Chưa đạt';
  }

  getKpiMetClass(kpiMet: boolean): string {
    return kpiMet ? 'kpi-met' : 'kpi-not-met';
  }

  formatRatePercent(rate: number): string {
    return (rate * 100).toFixed(1) + '%';
  }

  formatDate(dateStr: string): string {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
  }
}

