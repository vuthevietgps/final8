import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, delay, catchError } from 'rxjs/operators';
import { environment } from '../../../../../environments/environment';
import {
  FinancialControlData,
  OverallStatus,
  CashClarity,
  FundStatus,
  ProfitSummary,
  AdsDecision,
  Alert,
  ForecastSummary,
  CFODashboard,
  CFOFullMetrics,
  Forecast7DResult,
  OptimalAdsSuggestionResult,
  ModuleHealthResult,
  ActionSuggestionsResult
} from '../models/financial-control.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialControlService {
  private apiUrl = `${environment.apiUrl}/funds`;
  private financialControlUrl = `${environment.apiUrl}/financial-control`;

  constructor(private http: HttpClient) {}

  // ═══════════════════════════════════════════════════════════
  // CFO SPEC V3.0 APIs
  // ═══════════════════════════════════════════════════════════

  /**
   * Get CFO Dashboard 8 Numbers
   */
  getCFODashboard(): Observable<CFODashboard> {
    return this.http.get<CFODashboard>(`${this.financialControlUrl}/dashboard`);
  }

  /**
   * Get Full Financial Control Metrics
   */
  getCFOFullMetrics(): Observable<CFOFullMetrics> {
    return this.http.get<CFOFullMetrics>(`${this.financialControlUrl}/full`);
  }

  /**
   * Get Forecast 7 Days
   */
  getForecast7D(): Observable<Forecast7DResult> {
    return this.http.get<Forecast7DResult>(`${this.financialControlUrl}/forecast`);
  }

  /**
   * Get Optimal Ads Suggestion with Rule 20%
   */
  getOptimalAdsSuggestion(): Observable<OptimalAdsSuggestionResult> {
    return this.http.get<OptimalAdsSuggestionResult>(`${this.financialControlUrl}/optimal-ads`);
  }

  /**
   * CFO v3.2: Get Module Health Status
   */
  getModuleHealth(): Observable<ModuleHealthResult> {
    return this.http.get<ModuleHealthResult>(`${this.financialControlUrl}/module-health`);
  }

  /**
   * CFO v3.2: Get Action Suggestions
   */
  getActionSuggestions(): Observable<ActionSuggestionsResult> {
    return this.http.get<ActionSuggestionsResult>(`${this.financialControlUrl}/actions`);
  }

  // ═══════════════════════════════════════════════════════════
  // LEGACY APIs (backward compatible)
  // ═══════════════════════════════════════════════════════════

  /**
   * Load all dashboard data from API
   */
  loadDashboardData(): Observable<FinancialControlData> {
    // Gọi cả 2 API: legacy + new CFO spec
    return forkJoin({
      overview: this.http.get<any>(`${this.apiUrl}/overview`).pipe(
        catchError(() => of(null))
      ),
      cfoDashboard: this.getCFODashboard().pipe(
        catchError(() => of(null))
      )
    }).pipe(
      map(({ overview, cfoDashboard }) => {
        const data = this.mapOverviewToDashboard(overview || {});
        if (cfoDashboard) {
          data.cfoDashboard = cfoDashboard;
        }
        return data;
      })
    );
  }

  /**
   * Map FundsOverview API response to FinancialControlData
   */
  private mapOverviewToDashboard(overview: Record<string, any>): FinancialControlData {
    const bankBalance = overview['validation']?.bankBalance || 0;
    const committedCash = overview['committedCash']?.stock?.current || 0;
    
    /**
     * TIỀN KHẢ DỤNG (Free Cash)
     * =========================
     * CÔNG THỨC: freeCash = bankBalance - committedCash
     * 
     * Ý nghĩa: Số tiền THỰC SỰ có thể chi tiêu, đã trừ đi các khoản phải trả
     */
    const freeCash = Math.max(0, bankBalance - committedCash);
    const adsFundBalance = overview['adsFund']?.stock?.current || 0;

    /**
     * SURVIVAL RUNWAY (Thời gian sống còn)
     * ====================================
     * CÔNG THỨC: Survival Runway = Free Cash / Monthly Burn Rate
     * 
     * Trong đó:
     * - Free Cash = Bank Balance - Committed Cash (tiền thực sự khả dụng)
     * - Monthly Burn Rate = Lương nhân công + Chi phí vận hành cố định
     * 
     * Kết quả: Số THÁNG còn chạy được nếu không có doanh thu mới
     * 
     * Phân loại:
     * - >= 6 tháng: 🟢 AN TOÀN (safe zone)
     * - 3-6 tháng: 🟡 KHÁ ỔN (building buffer)
     * - 1-3 tháng: 🟠 CẢNH BÁO (warning zone)
     * - < 1 tháng: 🔴 NGUY HIỂM (critical - hành động ngay)
     * 
     * Ví dụ:
     * - Free Cash: 280M (Bank 350M - Committed 70M)
     * - Monthly Burn Rate: 70M/tháng (Lương 50M + Vận hành 20M)
     * → Survival Runway = 280M / 70M = 4.0 tháng 🟡 KHÁ ỔN
     * 
     * Ý nghĩa:
     * - Đo khả năng chịu đựng SAI LẦM / KHỦNG HOẢNG
     * - Nếu ads không hiệu quả, công ty còn chạy được bao lâu?
     * - Thời gian để sửa sai, pivot, tận dụng cơ hội
     * 
     * ⚠️ KHÁC VỚI Reserve Fund Health:
     * - Survival Runway: Dùng FREE CASH (toàn bộ)
     * - Reserve Health: Dùng RESERVE FUND (20% profit allocation)
     */
    const monthlyBurnRate = (overview['survivalBuffer']?.threshold?.max || 210000000) / 3; // Target là 3 tháng
    const survivalRunway = monthlyBurnRate > 0 ? freeCash / monthlyBurnRate : 0;
    
    // Normalize survival runway to 0-1 scale for display (0=critical, 1=safe)
    // 6+ months = 1.0 (safe), 3 months = 0.5 (building), 1 month = 0.17 (warning), <1 month = critical
    const survivalHealth = Math.min(1.0, survivalRunway / 6);

    return {
      overallStatus: {
        bankBalance,
        committedCash,
        freeCash,
        adsFundBalance,
        cashflowSafetyIndex: survivalHealth // 0-1: đại diện cho Survival Runway (tháng) / 6
      },
      cashClarity: {
        bankBalance,
        committedCash,
        freeCash,
        trend7Days: [] // TODO: implement trend data
      },
      funds: this.mapFundsStatus(overview),
      profitSummary: {
        netRevenue: overview['revenue']?.realized || 0,
        totalCost: 0, // TODO: calculate from costs
        netProfit: overview['netProfit']?.realized || 0,
        allocation: {
          adsReinvestment: {
            percent: 45,
            amount: overview['adsFund']?.breakdown?.fromReinvestment || 0
          },
          reserve: {
            percent: 30,
            amount: overview['survivalBuffer']?.stock?.current || 0
          },
          owner: {
            percent: 15,
            amount: overview['ownerFund']?.stock?.current || 0
          },
          longTerm: {
            percent: 10,
            amount: 0 // TODO
          }
        }
      },
      adsDecision: {
        optimalBudget: 25000000, // TODO: get from ads service
        cashflowAllowed: overview['formulas']?.adsBudgetAllowed || 0,
        finalBudget: Math.min(25000000, overview['formulas']?.adsBudgetAllowed || 0),
        isRestricted: (overview['formulas']?.adsBudgetAllowed || 0) < 25000000,
        restrictionReason: 'Dòng tiền hạn chế',
        daysRemaining: 30 // TODO: calculate from spend rate
      },
      alerts: [], // TODO: get from alerts service
      forecast: {
        days7: {
          projectedFreeCash: freeCash,
          trend: 'stable',
          riskLevel: 'safe'
        },
        days15: {
          projectedFreeCash: freeCash,
          trend: 'stable',
          riskLevel: 'safe'
        },
        keyEvents: []
      },
      lastUpdated: new Date()
    };
  }

  private mapFundsStatus(overview: Record<string, any>): FundStatus[] {
    const funds: FundStatus[] = [];

    // Ads Fund
    if (overview['adsFund']) {
      funds.push({
        id: 'ads',
        name: 'Ads Fund',
        description: 'Budget for advertising campaigns',
        icon: '📢',
        currentBalance: overview['adsFund'].stock?.current || 0,
        yesterdayDelta: overview['adsFund'].flow?.yesterday || 0,
        projection7Days: overview['adsFund'].projection?.days7 || 0,
        threshold: overview['adsFund'].threshold || { min: 0, max: 0, status: 'safe' },
        usageRules: overview['adsFund'].permission || { allowedFor: [], blockedFor: [] }
      });
    }

    // Committed Cash
    if (overview['committedCash']) {
      funds.push({
        id: 'committed',
        name: 'Committed Cash',
        description: 'Money allocated but not yet paid',
        icon: '📌',
        currentBalance: overview['committedCash'].stock?.current || 0,
        yesterdayDelta: overview['committedCash'].flow?.yesterday || 0,
        projection7Days: overview['committedCash'].projection?.days7 || 0,
        threshold: overview['committedCash'].threshold || { min: 0, max: 0, status: 'safe' },
        usageRules: overview['committedCash'].permission || { allowedFor: [], blockedFor: [] }
      });
    }

    // Reserve Fund
    if (overview['survivalBuffer']) {
      funds.push({
        id: 'reserve',
        name: 'Reserve Fund',
        description: 'Emergency buffer for survival',
        icon: '🛡️',
        currentBalance: overview['survivalBuffer'].stock?.current || 0,
        yesterdayDelta: overview['survivalBuffer'].flow?.yesterday || 0,
        projection7Days: overview['survivalBuffer'].projection?.days7 || 0,
        threshold: overview['survivalBuffer'].threshold || { min: 0, max: 0, status: 'safe' },
        usageRules: overview['survivalBuffer'].permission || { allowedFor: [], blockedFor: [] }
      });
    }

    // Owner Fund
    if (overview['ownerFund']) {
      funds.push({
        id: 'owner',
        name: 'Owner Fund',
        description: 'Personal income allocation',
        icon: '👤',
        currentBalance: overview['ownerFund'].stock?.current || 0,
        yesterdayDelta: overview['ownerFund'].flow?.yesterday || 0,
        projection7Days: overview['ownerFund'].projection?.days7 || 0,
        threshold: overview['ownerFund'].threshold || { min: 0, max: 0, status: 'safe' },
        usageRules: overview['ownerFund'].permission || { allowedFor: [], blockedFor: [] }
      });
    }

    return funds;
  }

  /**
   * Get mock data for development/demo
   */
  getMockData(): Observable<FinancialControlData> {
    const mockData: FinancialControlData = {
      overallStatus: {
        bankBalance: 850000000,
        committedCash: 320000000,
        freeCash: 530000000,
        adsFundBalance: 180000000,
        cashflowSafetyIndex: 0.72
      },
      cashClarity: {
        bankBalance: 850000000,
        committedCash: 320000000,
        freeCash: 530000000,
        trend7Days: [
          { date: '25/01', freeCash: 480000000, committedCash: 350000000 },
          { date: '26/01', freeCash: 495000000, committedCash: 340000000 },
          { date: '27/01', freeCash: 510000000, committedCash: 335000000 },
          { date: '28/01', freeCash: 505000000, committedCash: 330000000 },
          { date: '29/01', freeCash: 520000000, committedCash: 325000000 },
          { date: '30/01', freeCash: 525000000, committedCash: 322000000 },
          { date: '31/01', freeCash: 530000000, committedCash: 320000000 }
        ]
      },
      funds: [
        {
          id: 'ads',
          name: 'Ads Fund',
          description: 'Budget for advertising campaigns',
          icon: '📢',
          currentBalance: 180000000,
          yesterdayDelta: -12500000,
          projection7Days: 92500000,
          threshold: { min: 50000000, max: 300000000, status: 'safe' },
          usageRules: {
            allowedFor: ['Facebook Ads', 'Google Ads', 'TikTok Ads'],
            blockedFor: ['Salaries', 'Operations', 'Personal']
          }
        },
        {
          id: 'committed',
          name: 'Committed Cash',
          description: 'Money allocated but not yet paid',
          icon: '📌',
          currentBalance: 320000000,
          yesterdayDelta: -15000000,
          projection7Days: 280000000,
          threshold: { min: 0, max: 400000000, status: 'safe' },
          usageRules: {
            allowedFor: ['Salaries', 'Operations', 'Agent Commission'],
            blockedFor: ['Ads', 'Personal', 'Investment']
          }
        },
        {
          id: 'reserve',
          name: 'Reserve Fund',
          description: 'Emergency buffer for survival',
          icon: '🛡️',
          currentBalance: 120000000,
          yesterdayDelta: 5000000,
          projection7Days: 125000000,
          threshold: { min: 100000000, max: 200000000, status: 'safe' },
          usageRules: {
            allowedFor: ['Emergency Only'],
            blockedFor: ['Ads', 'Scaling', 'Regular Operations']
          }
        },
        {
          id: 'owner',
          name: 'Owner Fund',
          description: 'Personal income allocation',
          icon: '👤',
          currentBalance: 85000000,
          yesterdayDelta: 8000000,
          projection7Days: 110000000,
          threshold: { min: 0, max: 500000000, status: 'safe' },
          usageRules: {
            allowedFor: ['Personal Withdrawal', 'Long-term Investment'],
            blockedFor: ['Business Operations', 'Ads']
          }
        },
        {
          id: 'longterm',
          name: 'Long-term Fund',
          description: 'Asset accumulation',
          icon: '🏦',
          currentBalance: 45000000,
          yesterdayDelta: 3000000,
          projection7Days: 60000000,
          threshold: { min: 0, max: 1000000000, status: 'safe' },
          usageRules: {
            allowedFor: ['Asset Purchase', 'Investment'],
            blockedFor: ['Operations', 'Ads', 'Salaries']
          }
        }
      ],
      profitSummary: {
        netRevenue: 425000000,
        totalCost: 285000000,
        netProfit: 140000000,
        allocation: {
          adsReinvestment: { percent: 45, amount: 63000000 },
          reserve: { percent: 20, amount: 28000000 },
          owner: { percent: 20, amount: 28000000 },
          longTerm: { percent: 15, amount: 21000000 }
        }
      },
      adsDecision: {
        optimalBudget: 25000000,
        cashflowAllowed: 18000000,
        finalBudget: 18000000,
        isRestricted: true,
        restrictionReason: 'Free cash below optimal threshold. Reduce by 28%.',
        daysRemaining: 10
      },
      alerts: [
        {
          id: '1',
          type: 'warning',
          title: 'Ads Budget Restricted',
          message: 'Daily ads budget reduced from 25M to 18M due to cashflow constraints.',
          timestamp: new Date(),
          actionRequired: false
        },
        {
          id: '2',
          type: 'info',
          title: 'Salary Payment Due',
          message: '15M salary payment scheduled for Feb 5th.',
          timestamp: new Date(),
          actionRequired: true
        },
        {
          id: '3',
          type: 'danger',
          title: 'Low Reserve Warning',
          message: 'Reserve fund approaching minimum threshold.',
          timestamp: new Date(Date.now() - 3600000),
          actionRequired: true
        }
      ],
      forecast: {
        days7: {
          projectedFreeCash: 485000000,
          trend: 'down',
          riskLevel: 'warning'
        },
        days15: {
          projectedFreeCash: 420000000,
          trend: 'down',
          riskLevel: 'warning'
        },
        keyEvents: [
          { date: '05/02', description: 'Salary Payment', impact: -150000000, type: 'expense' },
          { date: '07/02', description: 'Supplier Settlement', impact: 280000000, type: 'income' },
          { date: '10/02', description: 'Office Rent', impact: -25000000, type: 'expense' }
        ]
      },
      lastUpdated: new Date()
    };

    return of(mockData).pipe(delay(500));
  }
}
