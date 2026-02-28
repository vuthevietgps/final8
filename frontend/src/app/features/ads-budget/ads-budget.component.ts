import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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

@Component({
  selector: 'app-ads-budget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads-budget.component.html',
  styleUrls: ['./ads-budget.component.css']
})
export class AdsBudgetComponent implements OnInit {
  private http = inject(HttpClient);
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

  // Data
  suggestions = signal<DailyBudgetSuggestion[]>([]);
  summary = signal<DailySuggestionsSummary | null>(null);
  actionStatus = signal<Map<string, boolean>>(new Map());

  // Emergency actions data
  emergencyLoading = signal(false);
  emergencyError = signal<string | null>(null);
  emergencyTasks = signal<EmergencyTask[]>([]);
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
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<OptimalSpendResponse>(`${this.apiUrl}/optimal-spend`)
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

    this.http.post(`${this.emergencyActionsApiUrl}/bulk-sync`, {
      date: today, tasks: payload
    }, { withCredentials: true }).pipe(
      catchError(() => of(null))
    ).subscribe();
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

  toggleEmergencyTaskDone(taskId: string): void {
    const map = new Map(this.emergencyTaskStatus());
    const current = map.get(taskId) || false;
    const newDone = !current;

    // Optimistic UI update
    map.set(taskId, newDone);
    this.emergencyTaskStatus.set(map);
    this.emergencyTasks.update(tasks =>
      tasks.map(task => task.id === taskId ? { ...task, done: newDone } : task)
    );

    // Call backend API
    const today = new Date().toISOString().split('T')[0];
    const encodedTaskId = encodeURIComponent(taskId);
    this.http.patch<{ success: boolean; task: any }>(
      `${this.emergencyActionsApiUrl}/${encodedTaskId}/toggle`,
      {},
      { params: { date: today }, withCredentials: true }
    ).pipe(
      catchError(() => {
        // Rollback on failure
        const rollbackMap = new Map(this.emergencyTaskStatus());
        rollbackMap.set(taskId, current);
        this.emergencyTaskStatus.set(rollbackMap);
        this.emergencyTasks.update(tasks =>
          tasks.map(task => task.id === taskId ? { ...task, done: current } : task)
        );
        return of(null);
      })
    ).subscribe(res => {
      if (res?.task) {
        // Update verification data from response
        const vMap = new Map(this.emergencyVerificationData());
        vMap.set(taskId, {
          verificationStatus: res.task.verificationStatus,
          verificationDetails: res.task.verificationDetails,
          doneByName: res.task.doneByName,
          doneAt: res.task.doneAt,
        });
        this.emergencyVerificationData.set(vMap);

        // Update task with verification info
        this.emergencyTasks.update(tasks =>
          tasks.map(task => task.id === taskId ? {
            ...task,
            verificationStatus: res.task.verificationStatus,
            verificationDetails: res.task.verificationDetails,
            doneByName: res.task.doneByName,
            doneAt: res.task.doneAt,
          } : task)
        );
      }
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
      optimal: this.http.get<OptimalSpendResponse>(`${this.apiUrl}/optimal-spend`).pipe(
        catchError(() => of({
          adGroupSuggestions: [],
          totalSuggestedSpend: 0,
          totalSuggestedSpendWithCap: 0,
          totalCurrentSpend: 0
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
      next: ({ optimal, productSummary, adAccounts }) => {
        const suggestions: DailyBudgetSuggestion[] = (optimal.adGroupSuggestions || []).map(ag => {
          const baseline = ag.baselineSpend || ag.currentAvgSpend || 0;
          return {
            adGroupId: ag.adGroupId,
            adGroupName: ag.adGroupName,
            platform: (ag.platform || 'unknown').toLowerCase(),
            productCategoryId: ag.productCategoryId,
            productCategoryName: ag.productCategoryName || 'Chưa phân loại',
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
            recommendation: this.getRecommendationFromReason(
              ag.reason || '',
              baseline,
              ag.suggestedSpendWithCap || 0
            ),
            actionDone: false
          };
        });

        this.updateEmergencyFundingNeeds(suggestions);

        const tasks = this.buildEmergencyTasks(
          suggestions,
          productSummary || [],
          adAccounts || [],
          this.emergencyTaskStatus()
        );

        // Merge verification data from backend
        const vData = this.emergencyVerificationData();
        const mergedTasks = tasks.map(t => {
          const v = vData.get(t.id);
          if (v) {
            return {
              ...t,
              verificationStatus: v.verificationStatus,
              verificationDetails: v.verificationDetails,
              doneByName: v.doneByName,
              doneAt: v.doneAt,
            };
          }
          return t;
        });

        this.emergencyTasks.set(mergedTasks);
        this.emergencyLoading.set(false);

        // Sync tasks to backend (upsert - tạo mới nếu chưa có, giữ done status nếu đã có)
        this.syncEmergencyTasksToBackend(mergedTasks);
      },
      error: (err) => {
        console.error('Failed to load emergency actions:', err);
        this.emergencyError.set('Không thể tải tab hành động khẩn cấp. Vui lòng thử lại.');
        this.emergencyLoading.set(false);
      }
    });
  }

  private updateEmergencyFundingNeeds(suggestions: DailyBudgetSuggestion[]): void {
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

    this.emergencyPlatformDailyNeeds.set(byPlatform);
    this.emergencyRequiredDaily.set(totalRequiredDaily);
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
        id: `create-account:${platform}`,
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
      const missingGroups = Math.max(0, this.minProfitableGroupsPerPlatformProduct - (item.totalGroups || 0));
      if (missingGroups <= 0) continue;

      const needsAccountFirst = !accountsByPlatform.has(platform);
      const productName = item.productCategoryName || 'Chưa phân loại';
      const baseAction = `Tạo mới ${missingGroups} nhóm quảng cáo trên nền tảng ${this.getPlatformLabel(platform)} cho sản phẩm ${productName}.`;
      const actionText = needsAccountFirst
        ? `Sau khi có tài khoản, ${baseAction}`
        : baseAction;

      addTask({
        id: `create-ad-group:${platform}:${item.productCategoryId || productName}`,
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
        id: `pause:${item.adGroupId}`,
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
        id: `change-budget:${item.adGroupId}`,
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
    this.http.get<KpiDailyResponse>(`${this.kpiApiUrl}/profitable-stats/daily?fromDate=${from}&toDate=${to}`)
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
    this.http.get<KpiTrendPoint[]>(`${this.kpiApiUrl}/profitable-stats/trend?fromDate=${from}&toDate=${to}`)
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
