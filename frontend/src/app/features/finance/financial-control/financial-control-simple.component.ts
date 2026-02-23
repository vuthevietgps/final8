/**
 * SIMPLIFIED FINANCIAL CONTROL COMPONENT
 * ========================================
 * Chỉ giữ các chỉ số quan trọng nhất:
 * - Số Dư Ngân Hàng (Bank Balance)
 * - Vốn Đã Cam Kết (Committed Cash)
 * - Tiền Khả Dụng (Free Cash)
 * - An Toàn Vốn (Survival Buffer)
 * - Chi Phí Quảng Cáo Đề Xuất (totalSuggestedSpendWithCap)
 * - Forecast 7 Ngày
 */

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';

interface SimplifiedDashboard {
  bankBalance: number;
  committedCash: number;
  freeCash: number;
  survivalBuffer: number; // % of survival floor covered
  monthlyBurn: number;
  runwayMonths: number;
  adsBudgetSuggested: number; // totalSuggestedSpendWithCap * 7 (weekly)
  adsBudgetApproved: number;
  ownerWithdrawable: number;
  forecast7D: Forecast7DSimple | null;
  lastUpdated: Date;
}

interface Forecast7DSimple {
  days: ForecastDay[];
  lowPoint: number;
  lowPointDay: number;
  endBalance: number;
  isCashCrunch: boolean;
  isSurvivalRisk: boolean;
}

interface ForecastDay {
  day: number;
  expectedIn: number;
  expectedOut: number;
  forecastBank: number;
  note?: string;
}

@Component({
  selector: 'app-financial-control-simple',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="header">
        <div class="header-left">
          <h1>💰 Kiểm Soát Tài Chính</h1>
          <span class="subtitle">Dòng Tiền • Sống Còn • Chi Tiêu Ads</span>
        </div>
        <button class="btn-refresh" (click)="refresh()" [disabled]="loading()">
          <span [class.spin]="loading()">↻</span>
          {{ loading() ? 'Đang tải...' : 'Làm mới' }}
        </button>
      </header>

      <!-- Loading -->
      @if (loading()) {
        <div class="loading">
          <div class="spinner"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      }

      <!-- Main Content -->
      @if (dashboard() && !loading()) {
        <main class="content">
          
          <!-- ═══════ SECTION 1: 5 CHỈ SỐ CHÍNH ═══════ -->
          <section class="section-main">
            <h2 class="section-title">📊 Chỉ Số Quan Trọng</h2>
            
            <div class="main-grid">
              <!-- Bank Balance -->
              <div class="card bank">
                <span class="icon">🏦</span>
                <span class="label">Số Dư Ngân Hàng</span>
                <span class="value">{{ formatCurrency(dashboard()!.bankBalance) }}</span>
              </div>

              <!-- Committed Cash -->
              <div class="card committed">
                <span class="icon">📌</span>
                <span class="label">Vốn Đã Cam Kết (14D)</span>
                <span class="value minus">-{{ formatCurrency(dashboard()!.committedCash) }}</span>
              </div>

              <!-- Free Cash -->
              <div class="card free hero">
                <span class="icon">🚀</span>
                <span class="label">Tiền Khả Dụng</span>
                <span class="value">{{ formatCurrency(dashboard()!.freeCash) }}</span>
                <span class="formula">= Số dư - Cam kết</span>
              </div>

              <!-- Survival Buffer -->
              <div class="card survival" 
                   [class.safe]="dashboard()!.survivalBuffer >= 100"
                   [class.warning]="dashboard()!.survivalBuffer >= 50 && dashboard()!.survivalBuffer < 100"
                   [class.danger]="dashboard()!.survivalBuffer < 50">
                <span class="icon">🛡️</span>
                <span class="label">An Toàn Vốn</span>
                <span class="value">{{ dashboard()!.survivalBuffer | number:'1.0-0' }}%</span>
                <span class="status">
                  {{ dashboard()!.survivalBuffer >= 100 ? '✅ Đủ 3 tháng' : 
                     dashboard()!.survivalBuffer >= 50 ? '⚠️ Đang xây dựng' : '🚨 Nguy hiểm' }}
                </span>
              </div>

              <!-- Runway -->
              <div class="card runway"
                   [class.safe]="dashboard()!.runwayMonths >= 6"
                   [class.warning]="dashboard()!.runwayMonths >= 3 && dashboard()!.runwayMonths < 6"
                   [class.danger]="dashboard()!.runwayMonths < 3">
                <span class="icon">⏱️</span>
                <span class="label">Runway</span>
                <span class="value">{{ dashboard()!.runwayMonths | number:'1.1-1' }} tháng</span>
              </div>
            </div>
          </section>

          <!-- ═══════ SECTION 2: NGÂN SÁCH QUẢNG CÁO ═══════ -->
          <section class="section-ads">
            <h2 class="section-title">📈 Ngân Sách Quảng Cáo</h2>
            
            <div class="ads-grid">
              <!-- Suggested (from ad-group-daily-report) -->
              <div class="card suggested">
                <span class="icon">💡</span>
                <span class="label">Chi Phí Đề Xuất (7 ngày)</span>
                <span class="value">{{ formatCurrency(dashboard()!.adsBudgetSuggested) }}</span>
                <span class="hint">Từ phân tích lợi nhuận biên + trần %</span>
              </div>

              <!-- Approved -->
              <div class="card approved">
                <span class="icon">✅</span>
                <span class="label">Ngân Sách Duyệt (7 ngày)</span>
                <span class="value">{{ formatCurrency(dashboard()!.adsBudgetApproved) }}</span>
                <span class="formula">= min(Đề xuất, Tiền dư sau an toàn)</span>
              </div>

              <!-- Owner Withdrawable -->
              <div class="card owner">
                <span class="icon">👤</span>
                <span class="label">Chủ Có Thể Rút</span>
                <span class="value">{{ formatCurrency(dashboard()!.ownerWithdrawable) }}</span>
              </div>
            </div>
          </section>

          <!-- ═══════ SECTION 3: DỰ BÁO 7 NGÀY ═══════ -->
          @if (dashboard()!.forecast7D) {
            <section class="section-forecast">
              <h2 class="section-title">
                📅 Dự Báo 7 Ngày
                @if (dashboard()!.forecast7D!.isCashCrunch) {
                  <span class="badge danger">🚨 CASH CRUNCH</span>
                } @else if (dashboard()!.forecast7D!.isSurvivalRisk) {
                  <span class="badge warning">⚠️ RỦI RO</span>
                } @else {
                  <span class="badge safe">✅ Ổn định</span>
                }
              </h2>
              
              <div class="forecast-table-wrapper">
                <table class="forecast-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>📥 Tiền VÀO</th>
                      <th>📤 Tiền RA</th>
                      <th>💰 Số Dư</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="today">
                      <td><strong>T0 (Hôm nay)</strong></td>
                      <td>-</td>
                      <td>-</td>
                      <td class="balance">{{ formatCurrency(dashboard()!.bankBalance) }}</td>
                    </tr>
                    @for (day of dashboard()!.forecast7D!.days; track day.day) {
                      <tr [class.low-point]="day.forecastBank === dashboard()!.forecast7D!.lowPoint"
                          [class.danger]="day.forecastBank < 0">
                        <td><strong>T+{{ day.day }}</strong></td>
                        <td class="inflow">+{{ formatCurrency(day.expectedIn) }}</td>
                        <td class="outflow">-{{ formatCurrency(day.expectedOut) }}</td>
                        <td class="balance" [class.negative]="day.forecastBank < 0">
                          {{ formatCurrency(day.forecastBank) }}
                          @if (day.forecastBank === dashboard()!.forecast7D!.lowPoint) {
                            <span class="low-badge">📍 LOW</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="forecast-summary">
                <span>Low Point: <strong>{{ formatCurrency(dashboard()!.forecast7D!.lowPoint) }}</strong> @ T+{{ dashboard()!.forecast7D!.lowPointDay }}</span>
                <span>Số dư cuối: <strong>{{ formatCurrency(dashboard()!.forecast7D!.endBalance) }}</strong></span>
              </div>
            </section>
          }

          <!-- Last Updated -->
          <div class="footer">
            Cập nhật: {{ dashboard()!.lastUpdated | date:'dd/MM/yyyy HH:mm' }}
          </div>

        </main>
      }
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
      background: #0d1117;
      min-height: 100vh;
      color: #f0f6fc;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #30363d;
    }

    .header h1 {
      font-size: 24px;
      margin: 0;
    }

    .subtitle {
      font-size: 12px;
      color: #8b949e;
    }

    .btn-refresh {
      padding: 8px 16px;
      background: #238636;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .btn-refresh:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .loading {
      text-align: center;
      padding: 60px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #30363d;
      border-top-color: #58a6ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    /* Sections */
    .section-main,
    .section-ads,
    .section-forecast {
      background: #161b22;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #30363d;
    }

    .section-title {
      font-size: 16px;
      margin: 0 0 16px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Main Grid */
    .main-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
    }

    .ads-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    /* Cards */
    .card {
      background: #21262d;
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      border: 1px solid #30363d;
    }

    .card.hero {
      border-color: #3fb950;
      background: rgba(63, 185, 80, 0.1);
    }

    .card .icon {
      font-size: 20px;
    }

    .card .label {
      font-size: 11px;
      color: #8b949e;
      text-transform: uppercase;
    }

    .card .value {
      font-size: 18px;
      font-weight: 700;
    }

    .card .value.minus {
      color: #f85149;
    }

    .card .formula,
    .card .hint {
      font-size: 10px;
      color: #6e7681;
    }

    .card .status {
      font-size: 11px;
    }

    /* Card variants */
    .card.bank { border-left: 3px solid #58a6ff; }
    .card.committed { border-left: 3px solid #d29922; }
    .card.free .value { color: #3fb950; }
    .card.survival.safe { border-left: 3px solid #3fb950; }
    .card.survival.warning { border-left: 3px solid #d29922; }
    .card.survival.danger { border-left: 3px solid #f85149; background: rgba(248, 81, 73, 0.1); }
    .card.runway.safe { border-left: 3px solid #3fb950; }
    .card.runway.warning { border-left: 3px solid #d29922; }
    .card.runway.danger { border-left: 3px solid #f85149; }
    .card.suggested { border-left: 3px solid #a371f7; }
    .card.approved { border-left: 3px solid #3fb950; }
    .card.owner { border-left: 3px solid #58a6ff; }

    /* Forecast Table */
    .forecast-table-wrapper {
      overflow-x: auto;
    }

    .forecast-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .forecast-table th,
    .forecast-table td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #21262d;
    }

    .forecast-table th {
      background: #21262d;
      color: #8b949e;
      font-weight: 600;
    }

    .forecast-table .today {
      background: rgba(63, 185, 80, 0.1);
    }

    .forecast-table tr.low-point {
      background: rgba(210, 153, 34, 0.15);
    }

    .forecast-table tr.danger {
      background: rgba(248, 81, 73, 0.1);
    }

    .forecast-table .inflow { color: #3fb950; }
    .forecast-table .outflow { color: #f85149; }
    .forecast-table .balance { font-weight: 600; }
    .forecast-table .balance.negative { color: #f85149; }

    .low-badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      background: #d29922;
      color: #000;
      border-radius: 3px;
      margin-left: 6px;
    }

    .forecast-summary {
      display: flex;
      gap: 24px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #30363d;
      font-size: 13px;
      color: #8b949e;
    }

    /* Badges */
    .badge {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
    }

    .badge.safe { background: rgba(63, 185, 80, 0.2); color: #3fb950; }
    .badge.warning { background: rgba(210, 153, 34, 0.2); color: #d29922; }
    .badge.danger { background: rgba(248, 81, 73, 0.2); color: #f85149; }

    .footer {
      text-align: center;
      color: #6e7681;
      font-size: 12px;
      padding: 16px;
    }

    /* Responsive */
    @media (max-width: 1000px) {
      .main-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 700px) {
      .main-grid,
      .ads-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 500px) {
      .main-grid,
      .ads-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class FinancialControlSimpleComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  loading = signal(false);
  dashboard = signal<SimplifiedDashboard | null>(null);

  ngOnInit() {
    this.loadData();
  }

  refresh() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);

    // Call 2 APIs in parallel: financial-control/dashboard và ad-group-daily-report/optimal-spend
    forkJoin({
      cfo: this.http.get<any>(`${this.apiUrl}/financial-control/dashboard`).pipe(
        catchError(() => of(null))
      ),
      optimalSpend: this.http.get<any>(`${this.apiUrl}/ad-group-daily-report/optimal-spend`).pipe(
        catchError(() => of(null))
      ),
      forecast: this.http.get<any>(`${this.apiUrl}/financial-control/forecast`).pipe(
        catchError(() => of(null))
      )
    }).subscribe({
      next: ({ cfo, optimalSpend, forecast }) => {
        const dashboard: SimplifiedDashboard = {
          bankBalance: cfo?.bankBalance || 0,
          committedCash: cfo?.committedCash || 0,
          freeCash: cfo?.freeCash || 0,
          survivalBuffer: this.calculateSurvivalBuffer(cfo),
          monthlyBurn: cfo?.monthlyBurn || 0,
          runwayMonths: cfo?.runwayMonths || 0,
          adsBudgetSuggested: (optimalSpend?.totalSuggestedSpendWithCap || 0) * 7, // Weekly
          adsBudgetApproved: cfo?.adsBudgetApproved || 0,
          ownerWithdrawable: cfo?.ownerWithdrawable || 0,
          forecast7D: forecast ? this.mapForecast(forecast) : null,
          lastUpdated: new Date()
        };
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load financial control data:', err);
        this.loading.set(false);
      }
    });
  }

  private calculateSurvivalBuffer(cfo: any): number {
    if (!cfo) return 0;
    const monthlyBurn = cfo.monthlyBurn || 1;
    const survivalFloor = monthlyBurn * 3; // 3 tháng
    const freeCash = cfo.freeCash || 0;
    return Math.min(100, (freeCash / survivalFloor) * 100);
  }

  private mapForecast(forecast: any): Forecast7DSimple {
    return {
      days: forecast.days || [],
      lowPoint: forecast.lowPoint || 0,
      lowPointDay: forecast.lowPointDay || 1,
      endBalance: forecast.endBalance || 0,
      isCashCrunch: forecast.isCashCrunch || false,
      isSurvivalRisk: forecast.isSurvivalRisk || false
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'decimal',
      maximumFractionDigits: 0
    }).format(value) + '₫';
  }
}
