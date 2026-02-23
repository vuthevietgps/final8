import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FinancialControlService } from './services/financial-control.service';
import { FinancialControlData, CFODashboard, Forecast7DResult, CFOFullMetrics, ModuleHealthResult, ActionSuggestionsResult } from './models/financial-control.model';
import { KPI_TOOLTIPS, FORECAST_COLUMN_TOOLTIPS, CEO_GUIDE, TooltipContent, KpiTooltipsType } from './financial-control.copy';

@Component({
  selector: 'app-financial-control',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <!-- Header -->
      <header class="dash-header">
        <div class="header-left">
          <h1>Kiểm Soát Tài Chính</h1>
          <span class="subtitle">Bảng Điều Khiển • Vị Thế Tiền Mặt & Quyền Chi Tiêu</span>
        </div>
        <div class="header-right">
          <!-- Data Status Indicator -->
          <div class="data-status" [class]="dataStatus()">
            <span class="status-time">Cập nhật: {{ data()?.lastUpdated | date:'HH:mm dd/MM' }}</span>
            <span class="status-pill" [title]="getDataStatusTooltip()">{{ dataStatus().toUpperCase() }}</span>
          </div>
          <button class="btn-help" (click)="toggleHelp()" title="Cách đọc dashboard">❓</button>
          <button class="btn-refresh" (click)="refresh()" [disabled]="loading()">
            <span [class.spin]="loading()">↻</span>
          </button>
        </div>
      </header>

      <!-- Collapsible Help Panel -->
      <div class="help-panel" *ngIf="showHelp()">
        <div class="help-header">
          <h3>{{ ceoGuide.title }}</h3>
          <button class="btn-close" (click)="toggleHelp()">✕</button>
        </div>
        <div class="help-steps">
          <div class="step" *ngFor="let step of ceoGuide.steps">
            <span class="step-num">{{ step.step }}</span>
            <div class="step-content">
              <strong>{{ step.title }}</strong>
              <p>{{ step.description }}</p>
            </div>
          </div>
        </div>
        <div class="help-notes">
          <h4>⚠️ Lưu ý quan trọng:</h4>
          <ul>
            <li *ngFor="let note of ceoGuide.notes">{{ note }}</li>
          </ul>
        </div>
        <div class="help-legend">
          <h4>📊 Màu sắc trạng thái:</h4>
          <div class="legend-inline">
            <span class="legend-item safe"><i class="dot safe"></i> OK - An toàn</span>
            <span class="legend-item watch"><i class="dot watch"></i> Watch - Theo dõi</span>
            <span class="legend-item warning"><i class="dot warning"></i> Warning - Cảnh báo</span>
            <span class="legend-item danger"><i class="dot danger"></i> Danger - Nguy hiểm</span>
          </div>
        </div>
      </div>

      <!-- 🚨 CRITICAL ALERT BANNER - Hiển thị khi tình trạng nguy hiểm -->
      <div class="critical-alert-banner" *ngIf="isCriticalStatus()">
        <div class="alert-icon">🚨</div>
        <div class="alert-content">
          <strong class="alert-title">{{ getCriticalAlertTitle() }}</strong>
          <p class="alert-message">{{ getCriticalAlertMessage() }}</p>
        </div>
        <div class="alert-metrics">
          <div class="metric" *ngIf="cfoDashboard()">
            <span class="m-label">Runway</span>
            <span class="m-value danger">{{ cfoDashboard()!.runwayMonths | number:'1.0-0' }} ngày</span>
          </div>
          <div class="metric" *ngIf="cfoDashboard()">
            <span class="m-label">Free Cash</span>
            <span class="m-value">{{ formatCurrency(cfoDashboard()!.freeCash) }}</span>
          </div>
        </div>
        <button class="alert-action-btn" (click)="scrollToActions()">Xem việc cần làm ↓</button>
      </div>

      <!-- MODULE HEALTH BAR -->
      <div class="module-health-bar" *ngIf="moduleHealth()">
        <div class="health-modules">
          <div class="health-module" *ngFor="let mod of moduleHealthList()"
               [class]="mod.status"
               [title]="mod.error || ('Last update: ' + (mod.lastUpdated | date:'HH:mm'))">
            <span class="mod-icon">{{ getModuleIcon(mod.name) }}</span>
            <span class="mod-name">{{ getModuleName(mod.name) }}</span>
            <span class="mod-status-dot"></span>
          </div>
        </div>
      </div>

      <!-- ACTION PANEL - Cải tiến với chi tiết tác động -->
      <div class="action-panel" id="action-panel" *ngIf="actionSuggestions() && actionSuggestions()!.actions.length > 0" [class.critical-mode]="isCriticalStatus()">
        <div class="action-header">
          <div class="action-header-left">
            <h3>{{ isCriticalStatus() ? '🔥 HÀNH ĐỘNG KHẨN CẤP' : '⚡ Việc cần làm hôm nay' }}</h3>
            <span class="action-status-badge" [class]="getOverallStatusClass()">{{ getOverallStatusLabel() }}</span>
          </div>
          <span class="action-count">{{ actionSuggestions()!.actions.length }} việc</span>
        </div>

        <!-- Recovery Suggestion Summary -->
        <div class="recovery-summary" *ngIf="isCriticalStatus() && cfoFullMetrics()">
          <div class="recovery-header">
            <span class="recovery-icon">💡</span>
            <strong>Để thoát khỏi tình trạng nguy hiểm, bạn cần:</strong>
          </div>
          <div class="recovery-targets">
            <div class="target-item">
              <span class="target-label">Tăng Free Cash thêm:</span>
              <span class="target-value">{{ formatCurrency(getRecoveryTarget()) }}</span>
            </div>
            <div class="target-item">
              <span class="target-label">Hoặc giảm Monthly Burn còn:</span>
              <span class="target-value">{{ formatCurrency(getTargetBurn()) }}</span>
            </div>
          </div>
        </div>

        <div class="action-list">
          <div class="action-item" *ngFor="let action of actionSuggestions()!.actions; let i = index" [class]="action.priority">
            <div class="action-number">{{ i + 1 }}</div>
            <div class="action-priority-badge">{{ getPriorityLabel(action.priority) }}</div>
            <div class="action-content">
              <strong>{{ action.title }}</strong>
              <p>{{ action.description }}</p>
              <div class="action-details">
                <span class="action-reason">💡 {{ action.reason }}</span>
                <span class="action-impact" *ngIf="action.amount">
                  📊 Tác động: {{ formatCurrency(action.amount!) }}
                </span>
              </div>
            </div>
            <button class="action-btn" *ngIf="action.linkTo" (click)="navigateTo(action.linkTo!)">
              {{ action.linkLabel || 'Thực hiện' }} →
            </button>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions" *ngIf="isCriticalStatus()">
          <div class="quick-header">⚡ Hành động nhanh:</div>
          <div class="quick-buttons">
            <button class="quick-btn pause-ads" (click)="navigateTo('/finance/ad-group-daily-report')">
              ⏸️ Xem chi phí Ads
            </button>
            <button class="quick-btn collect" (click)="navigateTo('/purchases/payables')">
              💰 Thu hồi công nợ
            </button>
            <button class="quick-btn review" (click)="navigateTo('/costs/other')">
              📋 Rà soát chi phí
            </button>
          </div>
        </div>
      </div>

      <!-- ACTION FALLBACK (trường hợp không tải được) -->
      <div class="action-panel action-fallback" *ngIf="!loading() && (!actionSuggestions() || (actionSuggestions()!.actions?.length || 0) === 0)">
        <div class="action-header">
          <div class="action-header-left">
            <h3>⚡ Việc cần làm hôm nay</h3>
            <span class="action-status-badge warning">Chưa tải được</span>
          </div>
        </div>
        <p class="action-fallback-text">{{ actionError() || 'Không lấy được danh sách hành động. Thử tải lại hoặc kiểm tra kết nối API.' }}</p>
        <button class="action-btn" (click)="refresh()">↻ Tải lại</button>
      </div>

      <!-- Loading State -->
      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
        <p>Đang tải dữ liệu tài chính...</p>
      </div>

      <!-- Main Content -->
      <main class="dash-content" *ngIf="data() && !loading()">

        <!-- CFO DASHBOARD -->
        <section class="section section-cfo-dashboard" *ngIf="cfoDashboard()">
          <div class="section-header">
            <h2 class="section-title">💰 CFO DASHBOARD <span class="cfo-info-title" (click)="showTooltip('section')" title="Xem giải thích">ⓘ</span></h2>
            <span class="section-hint">8 Chỉ Số Quan Trọng • Click vào số để xem chi tiết</span>
          </div>
          <div class="cfo-grid">
            <div class="cfo-card" (click)="openDrilldown('bankBalance')">
              <span class="cfo-icon">🏦</span>
              <span class="cfo-label">Bank Balance</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.bankBalance) }}</span>
            </div>

            <div class="cfo-card committed" (click)="openDrilldown('committedCash')">
              <div class="cfo-card-header">
                <span class="cfo-icon">📌</span>
                <span class="cfo-info" (click)="showTooltip('committedCash'); $event.stopPropagation()" title="Xem công thức">ⓘ</span>
              </div>
              <span class="cfo-label">Committed (14D)</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.committedCash) }}</span>
              <div class="kpi-tooltip" *ngIf="activeTooltip() === 'committedCash'" (click)="$event.stopPropagation()">
                <div class="tooltip-content">
                  <p><strong>📌 Ý nghĩa:</strong> {{ kpiTooltips.committedCash.meaning }}</p>
                  <p><strong>📐 Công thức:</strong> {{ kpiTooltips.committedCash.formula }}</p>
                  <p><strong>📊 Nguồn:</strong> {{ kpiTooltips.committedCash.source }}</p>
                  <p><strong>⚠️ Lưu ý:</strong> {{ kpiTooltips.committedCash.note }}</p>
                </div>
                <button class="tooltip-close" (click)="hideTooltip()">✕</button>
              </div>
            </div>

            <div class="cfo-card free" (click)="openDrilldown('freeCash')">
              <div class="cfo-card-header">
                <span class="cfo-icon">🚀</span>
                <span class="cfo-info" (click)="showTooltip('freeCash'); $event.stopPropagation()" title="Xem công thức">ⓘ</span>
              </div>
              <span class="cfo-label">Free Cash</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.freeCash) }}</span>
              <div class="kpi-tooltip" *ngIf="activeTooltip() === 'freeCash'" (click)="$event.stopPropagation()">
                <div class="tooltip-content">
                  <p><strong>📌 Ý nghĩa:</strong> {{ kpiTooltips.freeCash.meaning }}</p>
                  <p><strong>📐 Công thức:</strong> {{ kpiTooltips.freeCash.formula }}</p>
                  <p><strong>📊 Nguồn:</strong> {{ kpiTooltips.freeCash.source }}</p>
                  <p><strong>⚠️ Lưu ý:</strong> {{ kpiTooltips.freeCash.note }}</p>
                </div>
                <button class="tooltip-close" (click)="hideTooltip()">✕</button>
              </div>
            </div>

            <div class="cfo-card burn" (click)="openDrilldown('monthlyBurn')">
              <span class="cfo-icon">🔥</span>
              <span class="cfo-label">Monthly Burn</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.monthlyBurn) }}</span>
            </div>

            <div class="cfo-card runway" [class.safe]="cfoDashboard()!.runwayMonths >= 6"
                 [class.ok]="cfoDashboard()!.runwayMonths >= 3 && cfoDashboard()!.runwayMonths < 6"
                 [class.warning]="cfoDashboard()!.runwayMonths >= 1 && cfoDashboard()!.runwayMonths < 3"
                 [class.danger]="cfoDashboard()!.runwayMonths < 1">
              <div class="cfo-card-header">
                <span class="cfo-icon">⏱️</span>
                <span class="cfo-info" (click)="showTooltip('runway'); $event.stopPropagation()" title="Xem công thức">ⓘ</span>
              </div>
              <span class="cfo-label">Runway</span>
              <span class="cfo-value">{{ cfoDashboard()!.runwayMonths | number:'1.1-1' }} tháng</span>
              <span class="cfo-status">
                {{ cfoDashboard()!.runwayMonths >= 6 ? '🟢 An toàn' : 
                   cfoDashboard()!.runwayMonths >= 3 ? '🟡 Khá ổn' : 
                   cfoDashboard()!.runwayMonths >= 1 ? '🟠 Rủi ro' : '🔴 Nguy hiểm' }}
              </span>
              <div class="kpi-tooltip" *ngIf="activeTooltip() === 'runway'" (click)="$event.stopPropagation()">
                <div class="tooltip-content">
                  <p><strong>📌 Ý nghĩa:</strong> {{ kpiTooltips.runway.meaning }}</p>
                  <p><strong>📐 Công thức:</strong> {{ kpiTooltips.runway.formula }}</p>
                  <p><strong>📊 Nguồn:</strong> {{ kpiTooltips.runway.source }}</p>
                  <p><strong>⚠️ Lưu ý:</strong> {{ kpiTooltips.runway.note }}</p>
                </div>
                <button class="tooltip-close" (click)="hideTooltip()">✕</button>
              </div>
            </div>

            <div class="cfo-card ads" (click)="navigateTo('/finance/ad-group-daily-report')">
              <span class="cfo-icon">📈</span>
              <span class="cfo-label">Ads Budget (7D)</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.adsBudgetApproved) }}</span>
              <span class="cfo-hint" *ngIf="cfoDashboard()!.adsBudgetApproved === 0">Chưa đủ Survival</span>
            </div>

            <div class="cfo-card owner" (click)="navigateTo('/owner-fund')">
              <span class="cfo-icon">👤</span>
              <span class="cfo-label">Owner Withdrawable</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.ownerWithdrawable) }}</span>
              <span class="cfo-hint" *ngIf="cfoDashboard()!.ownerWithdrawable === 0">Runway chưa đủ 3 tháng</span>
            </div>

            <div class="cfo-card forecast" [class.danger]="cfoDashboard()!.forecast7DLowPoint.amount < 0"
                 [class.warning]="cfoDashboard()!.forecast7DLowPoint.amount < cfoDashboard()!.monthlyBurn * 3"
                 (click)="openDrilldown('forecast')">
              <span class="cfo-icon">⚠️</span>
              <span class="cfo-label">Low Point (T+{{ cfoDashboard()!.forecast7DLowPoint.day }})</span>
              <span class="cfo-value">{{ formatCurrency(cfoDashboard()!.forecast7DLowPoint.amount) }}</span>
              <span class="cfo-status" *ngIf="cfoDashboard()!.forecast7DLowPoint.amount < 0">🚨 CASH CRUNCH</span>
            </div>
          </div>

          <!-- TOTAL DEBT OUTSTANDING - Thông tin tham khảo -->
          <div class="debt-info-panel" *ngIf="cfoDashboard()!.totalDebtOutstanding">
            <div class="debt-info-header">
              <span class="debt-icon">💳</span>
              <span class="debt-label">Tổng Dư Nợ Vay (Tham khảo)</span>
              <span class="debt-info-badge" (click)="showTooltip('totalDebt')" title="Xem giải thích">ⓘ</span>
            </div>
            <div class="debt-info-content">
              <span class="debt-value">{{ formatCurrency(cfoDashboard()!.totalDebtOutstanding) }}</span>
              <span class="debt-hint">Toàn bộ khoản vay chưa trả (không giới hạn 14 ngày)</span>
              <a class="debt-link" routerLink="/loans">Quản lý khoản vay →</a>
            </div>
            <div class="kpi-tooltip" *ngIf="activeTooltip() === 'totalDebt'" (click)="$event.stopPropagation()">
              <div class="tooltip-content">
                <p><strong>📌 Ý nghĩa:</strong> Tổng dư nợ gốc của tất cả khoản vay đang hoạt động</p>
                <p><strong>📐 Khác với Committed:</strong> Committed chỉ tính nợ đến hạn trong 14 ngày</p>
                <p><strong>📊 Nguồn:</strong> LoanContract.principalRemaining</p>
                <p><strong>⚠️ Lưu ý:</strong> Đây là thông tin tham khảo, không ảnh hưởng Free Cash</p>
              </div>
              <button class="tooltip-close" (click)="hideTooltip()">✕</button>
            </div>
          </div>
        </section>

        <!-- DRILL-DOWN DRAWER -->
        <div class="drilldown-drawer" *ngIf="activeDrilldown()" (click)="closeDrilldown()">
          <div class="drilldown-content" (click)="$event.stopPropagation()">
            <div class="drilldown-header">
              <h3>{{ getDrilldownTitle() }}</h3>
              <button class="btn-close" (click)="closeDrilldown()">✕</button>
            </div>

            <div class="drilldown-body" *ngIf="activeDrilldown() === 'committedCash' && cfoFullMetrics()">
              <p class="drilldown-formula">Committed = Labor + Ops + Agent + Tax + Debt (14 ngày)</p>
              <table class="breakdown-table">
                <thead>
                  <tr><th>Hạng mục</th><th>Số tiền</th><th>Hành động</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>👷 Lương nhân công</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.committedBreakdown.labor) }}</td>
                    <td><a routerLink="/costs/labor1">Xem chi tiết →</a></td>
                  </tr>
                  <tr>
                    <td>🏢 Chi phí vận hành</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.committedBreakdown.operations) }}</td>
                    <td><a routerLink="/costs/other">Xem chi tiết →</a></td>
                  </tr>
                  <tr>
                    <td>🤝 Đại lý</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.committedBreakdown.agents) }}</td>
                    <td><a routerLink="/payments/agent">Xem chi tiết →</a></td>
                  </tr>
                  <tr>
                    <td>💳 Nợ vay</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.committedBreakdown.loanPayment) }}</td>
                    <td><a routerLink="/loans">Xem chi tiết →</a></td>
                  </tr>
                  <tr>
                    <td>📋 Thuế</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.committedBreakdown.tax) }}</td>
                    <td>-</td>
                  </tr>
                  <tr class="total-row">
                    <td><strong>TỔNG</strong></td>
                    <td><strong>{{ formatCurrency(cfoFullMetrics()!.committedBreakdown.total) }}</strong></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="drilldown-body" *ngIf="activeDrilldown() === 'monthlyBurn' && cfoFullMetrics()">
              <p class="drilldown-formula">Burn = Lương core + Vận hành bắt buộc + Trả nợ</p>
              <table class="breakdown-table">
                <thead>
                  <tr><th>Hạng mục</th><th>Số tiền/tháng</th><th>Ghi chú</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>👷 Lương core</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.monthlyBurnBreakdown.laborCore) }}</td>
                    <td>Nhân sự chủ chốt</td>
                  </tr>
                  <tr>
                    <td>🏢 Vận hành bắt buộc</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.monthlyBurnBreakdown.operationsMandatory) }}</td>
                    <td>Thuê văn phòng, điện, nước...</td>
                  </tr>
                  <tr>
                    <td>💳 Trả nợ</td>
                    <td>{{ formatCurrency(cfoFullMetrics()!.monthlyBurnBreakdown.loanPayment) }}</td>
                    <td>Gốc + lãi hàng tháng</td>
                  </tr>
                  <tr class="total-row">
                    <td><strong>TỔNG BURN</strong></td>
                    <td><strong>{{ formatCurrency(cfoFullMetrics()!.monthlyBurnBreakdown.total) }}</strong></td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="drilldown-body" *ngIf="(activeDrilldown() === 'freeCash' || activeDrilldown() === 'bankBalance') && cfoFullMetrics()">
              <p class="drilldown-formula">Free Cash = Bank Balance - Committed Cash</p>
              <div class="cash-equation-visual">
                <div class="eq-item bank">
                  <span class="eq-label">🏦 Bank Balance</span>
                  <span class="eq-value">{{ formatCurrency(cfoFullMetrics()!.bankBalance) }}</span>
                </div>
                <span class="eq-operator">−</span>
                <div class="eq-item committed">
                  <span class="eq-label">📌 Committed</span>
                  <span class="eq-value">{{ formatCurrency(cfoFullMetrics()!.committedCash) }}</span>
                </div>
                <span class="eq-operator">=</span>
                <div class="eq-item free">
                  <span class="eq-label">🚀 Free Cash</span>
                  <span class="eq-value">{{ formatCurrency(cfoFullMetrics()!.freeCash) }}</span>
                </div>
              </div>
              <div class="survival-info">
                <p><strong>Survival Floor:</strong> {{ formatCurrency(cfoFullMetrics()!.survivalFloor) }} (3 tháng burn)</p>
                <p><strong>Available After Survival:</strong> {{ formatCurrency(cfoFullMetrics()!.availableAfterSurvival) }}</p>
              </div>
            </div>

            <div class="drilldown-body" *ngIf="activeDrilldown() === 'forecast' && forecast7D()">
              <p class="drilldown-formula">Dự báo dựa trên: chi phí ads, lương, vận hành, thu từ NCC (× 80% rủi ro)</p>
              <div class="forecast-chart-mini">
                <div class="bar" *ngFor="let day of forecast7D()!.days"
                     [class.low-point]="day.forecastBank === forecast7D()!.lowPoint"
                     [class.danger]="day.forecastBank < 0"
                     [style.height.%]="getBarHeight(day.forecastBank)">
                  <span class="bar-label">T+{{ day.day }}</span>
                </div>
              </div>
              <p class="low-point-info">
                📍 Low Point: <strong>{{ formatCurrency(forecast7D()!.lowPoint) }}</strong> @ T+{{ forecast7D()!.lowPointDay }}
              </p>
            </div>
          </div>
        </div>

        <!-- FORECAST TABLE -->
        <section class="section section-forecast-table" *ngIf="forecast7D()">
          <div class="section-header">
            <h2 class="section-title">📅 DỰ BÁO DÒNG TIỀN 7 NGÀY</h2>
            <span class="section-hint">
              {{ forecast7D()!.isCashCrunch ? '🚨 CASH CRUNCH - Cần hành động ngay!' : 
                 forecast7D()!.isSurvivalRisk ? '⚠️ RỦI RO SỐNG CÒN' : '✅ Dòng tiền ổn định' }}
            </span>
          </div>
          <div class="forecast-table-wrapper">
            <table class="forecast-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th [title]="forecastTooltips.expectedIn.tooltip">{{ forecastTooltips.expectedIn.label }} <span class="th-info">ⓘ</span></th>
                  <th [title]="forecastTooltips.expectedOut.tooltip">{{ forecastTooltips.expectedOut.label }} <span class="th-info">ⓘ</span></th>
                  <th [title]="forecastTooltips.forecastBank.tooltip">{{ forecastTooltips.forecastBank.label }} <span class="th-info">ⓘ</span></th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                <tr class="today-row">
                  <td><strong>T0 (Hôm nay)</strong></td>
                  <td>-</td>
                  <td>-</td>
                  <td class="balance-cell">{{ formatCurrency(cfoDashboard()!.bankBalance) }}</td>
                  <td>🟢 Số dư hiện tại</td>
                </tr>
                <tr *ngFor="let day of forecast7D()!.days" 
                    [class.low-point]="day.forecastBank === forecast7D()!.lowPoint"
                    [class.danger]="day.forecastBank < 0"
                    [class.warning]="day.forecastBank < cfoDashboard()!.monthlyBurn * 3 && day.forecastBank >= 0">
                  <td><strong>T+{{ day.day }}</strong></td>
                  <td class="inflow-cell">{{ day.expectedIn > 0 ? '+' : '' }}{{ formatCurrency(day.expectedIn) }}</td>
                  <td class="outflow-cell">-{{ formatCurrency(day.expectedOut) }}</td>
                  <td class="balance-cell" [class.negative]="day.forecastBank < 0">
                    {{ formatCurrency(day.forecastBank) }}
                  </td>
                  <td>
                    {{ day.note || '' }}
                    <span *ngIf="day.forecastBank === forecast7D()!.lowPoint" class="low-point-badge" title="Điểm thấp nhất trong 7 ngày - cần theo dõi kỹ ngày này">📍 LOW POINT</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="forecast-summary-row">
            <div class="summary-item">
              <span class="s-label">Low Point:</span>
              <span class="s-value" [class.danger]="forecast7D()!.lowPoint < 0">
                {{ formatCurrency(forecast7D()!.lowPoint) }} @ T+{{ forecast7D()!.lowPointDay }}
              </span>
            </div>
            <div class="summary-item">
              <span class="s-label">Số dư cuối T+7:</span>
              <span class="s-value">{{ formatCurrency(forecast7D()!.endBalance) }}</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  `,
  styles: [`
    :host { display: block; color: #c9d1d9; }
    .dashboard { padding: 16px; background: #0d1117; min-height: 100vh; }
    .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .subtitle { color: #8b949e; font-size: 12px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .data-status { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .status-time { color: #8b949e; }
    .status-pill { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; cursor: help; background: rgba(88,166,255,0.15); color: #58a6ff; }
    .data-status.partial .status-pill { background: rgba(210,153,34,0.15); color: #d29922; }
    .data-status.error .status-pill { background: rgba(248,81,73,0.15); color: #f85149; }
    .btn-help, .btn-refresh { background: #161b22; border: 1px solid #30363d; color: #c9d1d9; border-radius: 6px; padding: 6px 8px; cursor: pointer; }
    .btn-help:hover, .btn-refresh:hover { border-color: #58a6ff; }
    .spin { display: inline-block; animation: spin 0.8s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }

    .help-panel { background: #0f1720; border: 1px solid #30363d; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
    .help-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .help-steps { display: grid; gap: 10px; }
    .step { display: grid; grid-template-columns: 32px 1fr; gap: 10px; align-items: center; }
    .step-num { width: 28px; height: 28px; background: #58a6ff; color: #0d1117; border-radius: 6px; display: grid; place-items: center; font-weight: 700; }
    .help-notes h4 { margin: 12px 0 6px; color: #f0f6fc; font-size: 13px; }
    .help-legend { margin-top: 16px; padding-top: 12px; border-top: 1px solid #30363d; }
    .legend-inline { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #8b949e; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
    .dot.safe { background: #3fb950; } .dot.watch { background: #58a6ff; } .dot.warning { background: #d29922; } .dot.danger { background: #f85149; }

    .module-health-bar { background: rgba(22,27,34,0.6); border: 1px solid #21262d; border-radius: 8px; padding: 8px 16px; margin-bottom: 16px; }
    .health-modules { display: flex; gap: 16px; flex-wrap: wrap; }
    .health-module { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #8b949e; }
    .mod-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #8b949e; }
    .health-module.ok .mod-status-dot { background: #3fb950; }
    .health-module.partial .mod-status-dot { background: #d29922; }
    .health-module.error .mod-status-dot, .health-module.timeout .mod-status-dot { background: #f85149; }

    .action-panel { background: linear-gradient(135deg, #1c2128 0%, #161b22 100%); border: 1px solid #30363d; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .action-count { font-size: 11px; color: #8b949e; background: rgba(139,148,158,0.1); padding: 2px 8px; border-radius: 10px; }
    .action-list { display: flex; flex-direction: column; gap: 10px; }
    .action-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: rgba(22,27,34,0.5); border-radius: 8px; border-left: 3px solid #8b949e; }
    .action-item.critical { border-left-color: #f85149; background: rgba(248,81,73,0.05); }
    .action-item.high { border-left-color: #f0883e; background: rgba(240,136,62,0.05); }
    .action-item.medium { border-left-color: #d29922; }
    .action-item.low { border-left-color: #3fb950; }
    .action-priority-badge { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 3px; }
    .action-item.critical .action-priority-badge { background: #f85149; color: #fff; }
    .action-item.high .action-priority-badge { background: #f0883e; color: #fff; }
    .action-item.medium .action-priority-badge { background: #d29922; color: #0d1117; }
    .action-item.low .action-priority-badge { background: #238636; color: #fff; }
    .action-content p { margin: 0 0 6px 0; color: #8b949e; font-size: 12px; line-height: 1.4; }
    .action-reason { font-size: 11px; color: #58a6ff; }
    .action-btn { background: transparent; border: 1px solid #30363d; border-radius: 6px; padding: 6px 12px; color: #58a6ff; font-size: 11px; cursor: pointer; }
    .action-btn:hover { background: rgba(56,139,253,0.1); border-color: #58a6ff; }

    /* Action fallback */
    .action-fallback { border: 1px dashed #30363d; background: rgba(22,27,34,0.4); }
    .action-fallback-text { color: #8b949e; font-size: 12px; margin: 0 0 10px 0; }

    .loading-overlay { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(13,17,23,0.7); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; z-index:999; }
    .spinner { width:32px; height:32px; border:3px solid #30363d; border-top-color:#58a6ff; border-radius:50%; animation: spin 1s linear infinite; }

    .dash-content { display: flex; flex-direction: column; gap: 20px; }
    .section { background: #0f1720; border: 1px solid #21262d; border-radius: 12px; padding: 16px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
    .section-title { margin: 0; font-size: 16px; color: #f0f6fc; }
    .section-hint { color: #8b949e; font-size: 12px; }

    .cfo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .cfo-card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
    .cfo-card:hover { border-color: #58a6ff; }
    .cfo-card-header { display: flex; justify-content: space-between; align-items: center; }
    .cfo-icon { font-size: 18px; }
    .cfo-label { color: #8b949e; font-size: 12px; }
    .cfo-value { font-size: 18px; font-weight: 700; color: #f0f6fc; }
    .cfo-hint, .cfo-status { font-size: 11px; color: #8b949e; }
    .cfo-card.runway.safe { border-color: #3fb950; }
    .cfo-card.runway.warning { border-color: #d29922; }
    .cfo-card.runway.danger { border-color: #f85149; }
    .kpi-tooltip { position: relative; }
    .tooltip-content { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 10px; box-shadow: 0 8px 20px rgba(0,0,0,0.4); }
    .tooltip-close { position: absolute; top: 4px; right: 4px; background: transparent; border: none; color: #8b949e; cursor: pointer; }

    .drilldown-drawer { position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(13,17,23,0.8); z-index:1000; display:flex; justify-content:center; align-items:center; padding:20px; }
    .drilldown-content { background: #161b22; border:1px solid #30363d; border-radius:12px; width:100%; max-width:600px; max-height:80vh; overflow-y:auto; animation: slideUp 0.3s ease-out; }
    @keyframes slideUp { from { opacity:0; transform: translateY(20px);} to { opacity:1; transform: translateY(0);} }
    .drilldown-header { display:flex; justify-content: space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #21262d; position: sticky; top:0; background:#161b22; }
    .drilldown-body { padding:20px; }
    .drilldown-formula { background: rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.2); border-radius:6px; padding:10px 14px; color:#58a6ff; font-size:12px; margin-bottom:16px; }
    .breakdown-table { width:100%; border-collapse: collapse; font-size:13px; }
    .breakdown-table th, .breakdown-table td { padding:10px 12px; text-align:left; border-bottom:1px solid #21262d; }
    .breakdown-table th { background: rgba(22,27,34,0.8); color:#8b949e; font-weight:600; font-size:11px; }
    .breakdown-table td:nth-child(2) { text-align:right; font-weight:600; color:#f0f6fc; }
    .breakdown-table a { color:#58a6ff; text-decoration:none; font-size:11px; }
    .breakdown-table a:hover { text-decoration: underline; }
    .breakdown-table .total-row { background: rgba(56,139,253,0.05); }
    .cash-equation-visual { display:flex; align-items:center; justify-content:center; gap:16px; padding:20px; flex-wrap:wrap; }
    .eq-item { text-align:center; padding:16px 20px; border-radius:8px; min-width:120px; }
    .eq-item.bank { background: rgba(88,166,255,0.1); border:1px solid rgba(88,166,255,0.3); }
    .eq-item.committed { background: rgba(210,153,34,0.1); border:1px solid rgba(210,153,34,0.3); }
    .eq-item.free { background: rgba(63,185,80,0.1); border:1px solid rgba(63,185,80,0.3); }
    .eq-label { display:block; font-size:11px; color:#8b949e; margin-bottom:4px; }
    .eq-value { font-size:16px; font-weight:700; color:#f0f6fc; }
    .eq-operator { font-size:24px; color:#8b949e; }
    .survival-info { background: rgba(22,27,34,0.5); border-radius:8px; padding:16px; margin-top:16px; }

    .forecast-table-wrapper { overflow-x:auto; }
    .forecast-table { width:100%; border-collapse: collapse; }
    .forecast-table th, .forecast-table td { padding:10px; border-bottom:1px solid #21262d; text-align:left; font-size:13px; }
    .forecast-table th { color:#8b949e; font-weight:600; }
    .today-row { background: rgba(56,139,253,0.05); }
    .balance-cell { font-weight:700; }
    .balance-cell.negative { color:#f85149; }
    .inflow-cell { color:#3fb950; }
    .outflow-cell { color:#f0883e; }
    .low-point-badge { background:#d29922; color:#0d1117; padding:2px 6px; border-radius:6px; margin-left:6px; font-size:11px; }
    .forecast-summary-row { display:flex; gap:16px; margin-top:12px; flex-wrap:wrap; }
    .summary-item { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:10px 12px; display:flex; gap:6px; align-items:center; }
    .s-label { color:#8b949e; font-size:12px; }
    .s-value { font-weight:700; color:#f0f6fc; }
    .s-value.danger { color:#f85149; }

    /* Critical Alert Banner */
    .critical-alert-banner { background: linear-gradient(135deg, rgba(248,81,73,0.15) 0%, rgba(248,81,73,0.05) 100%); border: 2px solid #f85149; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 16px; animation: pulse-border 2s infinite; }
    @keyframes pulse-border { 0%, 100% { border-color: #f85149; } 50% { border-color: #da3633; } }
    .alert-icon { font-size: 32px; animation: shake 0.5s ease-in-out infinite; }
    @keyframes shake { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-5deg); } 75% { transform: rotate(5deg); } }
    .alert-content { flex: 1; }
    .alert-title { color: #f85149; font-size: 16px; display: block; margin-bottom: 4px; }
    .alert-message { color: #c9d1d9; font-size: 13px; margin: 0; }
    .alert-metrics { display: flex; gap: 16px; }
    .alert-metrics .metric { text-align: center; padding: 8px 16px; background: rgba(13,17,23,0.5); border-radius: 8px; }
    .alert-metrics .m-label { display: block; font-size: 10px; color: #8b949e; text-transform: uppercase; }
    .alert-metrics .m-value { font-size: 16px; font-weight: 700; color: #f0f6fc; }
    .alert-metrics .m-value.danger { color: #f85149; }
    .alert-action-btn { background: #f85149; color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .alert-action-btn:hover { background: #da3633; }

    /* Enhanced Action Panel */
    .action-panel.critical-mode { border: 2px solid #f85149; background: linear-gradient(135deg, rgba(248,81,73,0.08) 0%, #161b22 100%); }
    .action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .action-header-left { display: flex; align-items: center; gap: 12px; }
    .action-header h3 { margin: 0; }
    .action-status-badge { font-size: 10px; padding: 3px 8px; border-radius: 10px; font-weight: 600; text-transform: uppercase; }
    .action-status-badge.danger { background: rgba(248,81,73,0.2); color: #f85149; }
    .action-status-badge.warning { background: rgba(210,153,34,0.2); color: #d29922; }
    .action-status-badge.ok { background: rgba(63,185,80,0.2); color: #3fb950; }

    /* Recovery Summary */
    .recovery-summary { background: rgba(88,166,255,0.08); border: 1px solid rgba(88,166,255,0.2); border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
    .recovery-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; color: #58a6ff; font-size: 13px; }
    .recovery-icon { font-size: 18px; }
    .recovery-targets { display: flex; gap: 20px; flex-wrap: wrap; }
    .target-item { display: flex; gap: 8px; align-items: center; }
    .target-label { color: #8b949e; font-size: 12px; }
    .target-value { color: #3fb950; font-weight: 700; font-size: 14px; }

    /* Action Item Enhanced */
    .action-item { display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: rgba(22,27,34,0.5); border-radius: 10px; border-left: 4px solid #8b949e; position: relative; }
    .action-number { position: absolute; top: -8px; left: -8px; width: 20px; height: 20px; background: #30363d; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #f0f6fc; }
    .action-details { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .action-impact { font-size: 11px; color: #3fb950; }

    /* Quick Actions */
    .quick-actions { margin-top: 16px; padding-top: 16px; border-top: 1px solid #30363d; }
    .quick-header { font-size: 12px; color: #8b949e; margin-bottom: 10px; }
    .quick-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
    .quick-btn { background: #21262d; border: 1px solid #30363d; border-radius: 8px; padding: 10px 16px; color: #c9d1d9; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .quick-btn:hover { border-color: #58a6ff; background: #30363d; }
    .quick-btn.pause-ads { border-color: #f85149; color: #f85149; }
    .quick-btn.pause-ads:hover { background: rgba(248,81,73,0.1); }
    .quick-btn.collect { border-color: #3fb950; color: #3fb950; }
    .quick-btn.collect:hover { background: rgba(63,185,80,0.1); }
    .quick-btn.review { border-color: #d29922; color: #d29922; }
    .quick-btn.review:hover { background: rgba(210,153,34,0.1); }

    /* Debt Info Panel - Tham khảo */
    .debt-info-panel { margin-top: 16px; padding: 14px 16px; background: linear-gradient(135deg, rgba(139,148,158,0.08) 0%, rgba(22,27,34,0.5) 100%); border: 1px dashed #30363d; border-radius: 10px; }
    .debt-info-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .debt-icon { font-size: 18px; }
    .debt-label { color: #8b949e; font-size: 12px; font-weight: 600; }
    .debt-info-badge { cursor: pointer; color: #58a6ff; font-size: 12px; }
    .debt-info-content { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .debt-value { font-size: 20px; font-weight: 700; color: #f0f6fc; }
    .debt-hint { font-size: 11px; color: #8b949e; flex: 1; }
    .debt-link { color: #58a6ff; text-decoration: none; font-size: 12px; font-weight: 500; }
    .debt-link:hover { text-decoration: underline; }
  `]
})
export class FinancialControlComponent implements OnInit {
  private service = inject(FinancialControlService);
  private router = inject(Router);

  loading = signal(false);
  data = signal<FinancialControlData | null>(null);
  cfoDashboard = signal<CFODashboard | null>(null);
  forecast7D = signal<Forecast7DResult | null>(null);

  moduleHealth = signal<ModuleHealthResult | null>(null);
  actionSuggestions = signal<ActionSuggestionsResult | null>(null);
  cfoFullMetrics = signal<CFOFullMetrics | null>(null);
  activeDrilldown = signal<string | null>(null);
  actionError = signal<string | null>(null);

  showHelp = signal(false);
  activeTooltip = signal<string | null>(null);

  kpiTooltips = KPI_TOOLTIPS;
  forecastTooltips = FORECAST_COLUMN_TOOLTIPS;
  ceoGuide = CEO_GUIDE;

  moduleHealthList = computed(() => {
    const mh = this.moduleHealth();
    if (!mh) return [];
    const modules = mh.modules as any;
    return Object.keys(modules).map(key => ({ name: key, ...modules[key] }));
  });

  dataStatus = computed(() => {
    const d = this.data();
    if (!d) return 'error';
    const hasIssues = d.alerts?.some(a => a.message?.includes('timeout') || a.message?.includes('error'));
    return hasIssues ? 'partial' : 'ok';
  });

  ngOnInit() {
    this.loadData();
  }

  toggleHelp() { this.showHelp.update(v => !v); }
  showTooltip(key: string) { this.activeTooltip.set(this.activeTooltip() === key ? null : key); }
  hideTooltip() { this.activeTooltip.set(null); }

  getDataStatusTooltip(): string {
    const status = this.dataStatus();
    switch (status) {
      case 'ok': return 'Tất cả module hoạt động bình thường.';
      case 'partial': return 'Một số module timeout/error/missing. Số liệu có thể không đầy đủ.';
      case 'error': return 'Không thể lấy dữ liệu từ server.';
      default: return '';
    }
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    if (Math.abs(value) < 0.5) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
  }

  loadData() {
    this.loading.set(true);
    this.service.loadDashboardData().subscribe({
      next: (result) => {
        this.data.set(result);
        if (result.cfoDashboard) this.cfoDashboard.set(result.cfoDashboard);
        this.loading.set(false);
        this.loadCFOData();
      },
      error: (err) => {
        console.error('Failed to load financial control data:', err);
        this.service.getMockData().subscribe({
          next: (mockData) => { this.data.set(mockData); this.loading.set(false); },
          error: () => this.loading.set(false)
        });
        // Even if legacy overview fail, still try to load CFO data (actions/banner/module health)
        this.loadCFOData();
      }
    });
  }

  loadCFOData() {
    this.service.getCFODashboard().subscribe({ next: (dashboard) => this.cfoDashboard.set(dashboard), error: (err) => console.error('Failed to load CFO dashboard:', err) });
    this.service.getForecast7D().subscribe({ next: (forecast) => this.forecast7D.set(forecast), error: (err) => console.error('Failed to load forecast 7D:', err) });
    this.service.getModuleHealth().subscribe({ next: (health) => this.moduleHealth.set(health), error: (err) => console.error('Failed to load module health:', err) });

    // Actions: capture error to display fallback reason
    this.service.getActionSuggestions().subscribe({
      next: (actions) => {
        this.actionError.set(null);
        this.actionSuggestions.set(actions);
      },
      error: (err) => {
        console.error('Failed to load action suggestions:', err);
        this.actionError.set(err?.message || 'Không thể tải action suggestions');
        this.actionSuggestions.set(null);
      }
    });

    this.service.getCFOFullMetrics().subscribe({ next: (metrics) => this.cfoFullMetrics.set(metrics), error: (err) => console.error('Failed to load CFO full metrics:', err) });
  }

  refresh() { this.loadData(); }

  getCommittedPercent(): number {
    const d = this.data();
    if (!d || d.cashClarity.bankBalance <= 0) return 0;
    return (d.cashClarity.committedCash / d.cashClarity.bankBalance) * 100;
  }

  getFreeCashPercent(): number {
    const d = this.data();
    if (!d || d.cashClarity.bankBalance <= 0) return 0;
    return (d.cashClarity.freeCash / d.cashClarity.bankBalance) * 100;
  }

  getTrendBarHeight(value: number): number {
    const d = this.data();
    if (!d) return 0;
    const max = Math.max(...d.cashClarity.trend7Days.map(t => t.freeCash));
    const min = Math.min(...d.cashClarity.trend7Days.map(t => t.freeCash)) * 0.8;
    if (max === min) return 50;
    return ((value - min) / (max - min)) * 100;
  }

  getAllocatedCash(): number {
    const d = this.data();
    if (!d) return 0;
    return d.overallStatus.adsFundBalance + this.getReserveFund() + this.getOwnerFund();
  }

  getReserveFund(): number {
    const d = this.data();
    if (!d) return 0;
    const reserveFund = d.funds.find(f => f.name.includes('Dự trữ') || f.name.includes('Reserve') || f.name.includes('Survival'));
    return reserveFund?.currentBalance || 0;
  }

  getOwnerFund(): number {
    const d = this.data();
    if (!d) return 0;
    const ownerFund = d.funds.find(f => f.name.includes('Owner') || f.name.includes('Chủ'));
    return ownerFund?.currentBalance || 0;
  }

  getUnallocatedCash(): number {
    const d = this.data();
    if (!d) return 0;
    return d.overallStatus.freeCash - this.getAllocatedCash();
  }

  getTooltip(key: keyof KpiTooltipsType): TooltipContent { return this.kpiTooltips[key]; }
  getTooltipMeaning(key: keyof KpiTooltipsType): string { return this.kpiTooltips[key]?.meaning || ''; }
  getTooltipFormula(key: keyof KpiTooltipsType): string { return this.kpiTooltips[key]?.formula || ''; }
  getTooltipSource(key: keyof KpiTooltipsType): string { return this.kpiTooltips[key]?.source || ''; }
  getTooltipNote(key: keyof KpiTooltipsType): string { return this.kpiTooltips[key]?.note || ''; }

  getModuleIcon(name: string): string {
    const icons: { [key: string]: string } = { labor: '👷', operations: '📦', supplier: '🏭', agent: '🛒', debt: '💳', ads: '📣', tax: '🏛️' };
    return icons[name] || '📊';
  }

  getModuleName(name: string): string {
    const names: { [key: string]: string } = { labor: 'Nhân công', operations: 'Vận hành', supplier: 'Nhà CC', agent: 'Đại lý', debt: 'Nợ', ads: 'Quảng cáo', tax: 'Thuế' };
    return names[name] || name;
  }

  getPriorityLabel(priority: string): string {
    const labels: { [key: string]: string } = { critical: 'KHẨN CẤP', high: 'QUAN TRỌNG', medium: 'CẦN LÀM', low: 'GỢI Ý' };
    return labels[priority] || priority.toUpperCase();
  }

  navigateTo(route: string): void {
    if (route.startsWith('/')) { this.router.navigate([route]); }
    else { this.router.navigate(['/', route]); }
  }

  openDrilldown(kpi: string): void { this.activeDrilldown.set(kpi); }
  closeDrilldown(): void { this.activeDrilldown.set(null); }

  getDrilldownTitle(): string {
    const dd = this.activeDrilldown();
    if (!dd) return '';
    const titles: { [key: string]: string } = {
      bankBalance: '🏦 Chi tiết Bank Balance',
      committedCash: '💰 Chi tiết Committed Cash (14 ngày)',
      monthlyBurn: '🔥 Chi tiết Monthly Burn',
      freeCash: '💵 Chi tiết Free Cash',
      forecast: '📈 Chi tiết Forecast 7 ngày'
    };
    return titles[dd] || 'Chi tiết';
  }

  getBarHeight(value: number): number {
    const fm = this.cfoFullMetrics();
    if (!fm || !fm.forecast7D || !fm.forecast7D.days || fm.forecast7D.days.length === 0) return 50;
    const values = fm.forecast7D.days.map((f: any) => f.forecastBank);
    const max = Math.max(...values);
    const min = Math.min(0, Math.min(...values));
    if (max === min) return 50;
    return Math.max(10, ((value - min) / (max - min)) * 100);
  }

  isLowPoint(day: any): boolean {
    const fm = this.cfoFullMetrics();
    if (!fm || !fm.forecast7D || !fm.forecast7D.days || fm.forecast7D.days.length === 0) return false;
    const minBank = Math.min(...fm.forecast7D.days.map((f: any) => f.forecastBank));
    return day.forecastBank === minBank;
  }

  // ═══════════════════════════════════════════════════════════
  // UI/UX ENHANCEMENT METHODS
  // ═══════════════════════════════════════════════════════════

  /**
   * Check if current status is critical (danger/cash crunch)
   */
  isCriticalStatus(): boolean {
    const actions = this.actionSuggestions();
    const cfo = this.cfoDashboard();
    const forecast = this.forecast7D();
    
    // Check from CFO Dashboard first (doesn't depend on actions API)
    if (cfo) {
      if (cfo.runwayMonths < 1) return true;
      if (cfo.forecast7DLowPoint && cfo.forecast7DLowPoint.amount < 0) return true;
    }
    
    // Then check forecast
    if (forecast?.isCashCrunch) return true;
    
    // Finally check actions if available
    if (actions?.actions?.some(a => a.priority === 'critical')) return true;
    
    return false;
  }

  /**
   * Get critical alert title based on status
   */
  getCriticalAlertTitle(): string {
    const forecast = this.forecast7D();
    const cfo = this.cfoDashboard();
    
    if (forecast?.isCashCrunch) {
      return '🚨 CASH CRUNCH - Số dư sẽ âm trong 7 ngày tới!';
    }
    if (cfo && cfo.runwayMonths < 1) {
      return '⚠️ RUNWAY NGUY HIỂM - Chỉ còn ' + Math.round(cfo.runwayMonths * 30) + ' ngày hoạt động!';
    }
    return '⚠️ CẦN HÀNH ĐỘNG NGAY';
  }

  /**
   * Get critical alert message
   */
  getCriticalAlertMessage(): string {
    const forecast = this.forecast7D();
    const cfo = this.cfoDashboard();
    
    if (forecast?.isCashCrunch) {
      return `Dự báo số dư thấp nhất: ${this.formatCurrency(forecast.lowPoint)} @ T+${forecast.lowPointDay}. Cần cắt giảm chi tiêu hoặc thu hồi công nợ ngay.`;
    }
    if (cfo && cfo.runwayMonths < 1) {
      return `Monthly Burn: ${this.formatCurrency(cfo.monthlyBurn)} > Free Cash: ${this.formatCurrency(cfo.freeCash)}. Không đủ tiền vận hành 1 tháng.`;
    }
    return 'Tình hình tài chính cần được xử lý ngay để tránh gián đoạn hoạt động.';
  }

  /**
   * Get overall status class for action panel
   */
  getOverallStatusClass(): string {
    const actions = this.actionSuggestions();
    if (!actions) return 'ok';
    
    if (actions.basedOnStatus.isCashCrunch || actions.basedOnStatus.runway === 'danger') {
      return 'danger';
    }
    if (actions.basedOnStatus.isSurvivalRisk || actions.basedOnStatus.runway === 'warning') {
      return 'warning';
    }
    return 'ok';
  }

  /**
   * Get overall status label
   */
  getOverallStatusLabel(): string {
    const actions = this.actionSuggestions();
    if (!actions) return 'Đang tải...';
    
    if (actions.basedOnStatus.isCashCrunch) return 'CASH CRUNCH';
    if (actions.basedOnStatus.runway === 'danger') return 'NGUY HIỂM';
    if (actions.basedOnStatus.isSurvivalRisk) return 'RỦI RO';
    if (actions.basedOnStatus.runway === 'warning') return 'CẢNH BÁO';
    return 'ỔN ĐỊNH';
  }

  /**
   * Calculate recovery target - how much more free cash needed
   */
  getRecoveryTarget(): number {
    const cfo = this.cfoDashboard();
    const fm = this.cfoFullMetrics();
    if (!cfo || !fm) return 0;
    
    // Target: Get runway to at least 3 months
    const targetFreeCash = cfo.monthlyBurn * 3;
    const needed = targetFreeCash - cfo.freeCash;
    return Math.max(0, needed);
  }

  /**
   * Calculate target burn rate to survive with current cash
   */
  getTargetBurn(): number {
    const cfo = this.cfoDashboard();
    if (!cfo || cfo.freeCash <= 0) return 0;
    
    // Target: 3 months runway with current free cash
    return cfo.freeCash / 3;
  }

  /**
   * Scroll to action panel
   */
  scrollToActions(): void {
    const el = document.getElementById('action-panel');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
