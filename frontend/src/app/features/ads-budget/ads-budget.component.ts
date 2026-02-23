import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
  private actionStorageKey = 'ads-budget-actions';

  // Tab state
  activeTab = signal<'suggestions' | 'kpi'>('suggestions');

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

  ngOnInit(): void {
    this.loadActionStatus();
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

  switchTab(tab: 'suggestions' | 'kpi'): void {
    this.activeTab.set(tab);
    if (tab === 'kpi' && this.kpiDailyStats().length === 0) {
      this.loadKpiData();
    }
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