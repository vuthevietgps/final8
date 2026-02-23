import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CapitalManagementService } from '../capital-management.service';
import { FundsOverview } from '../models/funds.model';

@Component({
  selector: 'app-funds-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterModule],
  template: `
    <div class="control-dashboard">
      <!-- ===== HEADER ===== -->
      <header class="dash-header">
        <div>
          <h1>Financial Control</h1>
          <span class="subtitle">Cash position & spending authority</span>
        </div>
        <div class="header-right">
          <span class="timestamp" *ngIf="fundsData()">{{ fundsData()!.calculatedAt | date:'HH:mm dd/MM' }}</span>
          <button class="btn-refresh" (click)="loadData()" [disabled]="loading()">
            <span [class.spin]="loading()">↻</span>
          </button>
        </div>
      </header>

      <!-- Loading -->
      <div class="loading-box" *ngIf="loading()">
        <div class="spinner"></div>
        Loading...
      </div>

      <!-- Error -->
      <div class="error-box" *ngIf="error()">
        ⚠️ {{ error() }}
        <button (click)="loadData()">Retry</button>
      </div>

      <!-- ===== MAIN CONTENT ===== -->
      <main *ngIf="fundsData() && !loading()">

        <!-- ////////////////////////////////////////////// -->
        <!-- ZONE 1: SAFETY & PERMISSION (Top priority)    -->
        <!-- ////////////////////////////////////////////// -->
        <section class="zone zone-safety">
          <div class="safety-banner" [class.safe]="canScale()" [class.danger]="!canScale()">
            <div class="safety-icon">{{ canScale() ? '✅' : '⛔' }}</div>
            <div class="safety-text">
              <span class="safety-question">Can we scale ads today?</span>
              <span class="safety-answer">{{ canScale() ? 'YES — Safe to spend' : 'NO — Cashflow restricted' }}</span>
            </div>
            <div class="safety-budget">
              <span class="budget-label">Ads Budget Today</span>
              <span class="budget-value">{{ fundsData()!.formulas.adsBudgetAllowed | number:'1.0-0' }}₫</span>
            </div>
          </div>

          <!-- Ads Decision Logic (always visible) -->
          <div class="ads-logic">
            <div class="logic-formula">
              <span class="formula-title">Decision Logic:</span>
              <code>AdsBudget = MIN( AdsPool, FreeCash )</code>
            </div>
            <div class="logic-values">
              <div class="logic-item">
                <span>Ads Pool (45% capital + 45% profit):</span>
                <span>{{ fundsData()!.adsFund.stock.current | number:'1.0-0' }}₫</span>
              </div>
              <div class="logic-item">
                <span>Free Cash:</span>
                <span>{{ fundsData()!.formulas.tienTuDo | number:'1.0-0' }}₫</span>
              </div>
              <div class="logic-item result" [class.restricted]="isRestrictedByCashflow()">
                <span>→ Allowed:</span>
                <span>{{ fundsData()!.formulas.adsBudgetAllowed | number:'1.0-0' }}₫</span>
              </div>
            </div>
            <div class="restriction-reason" *ngIf="isRestrictedByCashflow()">
              ⚠️ <strong>Restricted by cashflow.</strong> 
              Free cash ({{ fundsData()!.formulas.tienTuDo | number:'1.0-0' }}₫) is less than Ads Pool.
            </div>
          </div>
        </section>

        <!-- ////////////////////////////////////////////// -->
        <!-- ZONE 2: CASH EQUATION (Core visual)           -->
        <!-- ////////////////////////////////////////////// -->
        <section class="zone zone-equation">
          <h2 class="zone-title">Cash Equation</h2>
          <div class="equation-row">
            <div class="eq-box bank">
              <span class="eq-label">🏦 Bank Balance</span>
              <span class="eq-value">{{ fundsData()!.validation.bankBalance | number:'1.0-0' }}₫</span>
              <span class="eq-note">Total cash on hand</span>
            </div>
            <span class="eq-op">−</span>
            <div class="eq-box committed">
              <span class="eq-label">📌 Committed</span>
              <span class="eq-value">{{ fundsData()!.committedCash.stock.current | number:'1.0-0' }}₫</span>
              <span class="eq-note">Has owner, not yet paid</span>
            </div>
            <span class="eq-op">=</span>
            <div class="eq-box free" [class.negative]="fundsData()!.formulas.tienTuDo < 0">
              <span class="eq-label">💵 Free Cash</span>
              <span class="eq-value">{{ fundsData()!.formulas.tienTuDo | number:'1.0-0' }}₫</span>
              <span class="eq-note">Allowed to spend</span>
            </div>
          </div>
        </section>

        <!-- ////////////////////////////////////////////// -->
        <!-- ZONE 3: FOUR FUNDS STATUS                     -->
        <!-- ////////////////////////////////////////////// -->
        <section class="zone zone-funds">
          <h2 class="zone-title">Funds Status</h2>
          <div class="funds-grid">
            
            <!-- Fund 1: Committed Cash -->
            <div class="fund-card" [class]="getStatusClass(fundsData()!.committedCash.threshold.status)">
              <div class="fund-header">
                <span class="fund-icon">📌</span>
                <span class="fund-name">Committed Cash</span>
                <span class="fund-badge">{{ fundsData()!.committedCash.threshold.status | uppercase }}</span>
              </div>
              <div class="fund-stock">{{ fundsData()!.committedCash.stock.current | number:'1.0-0' }}₫</div>
              <div class="fund-meta">
                <div class="meta-row">
                  <span>Δ Yesterday:</span>
                  <span [class.positive]="fundsData()!.committedCash.flow.yesterday < 0"
                        [class.negative]="fundsData()!.committedCash.flow.yesterday > 0">
                    {{ fundsData()!.committedCash.flow.yesterday > 0 ? '+' : '' }}{{ fundsData()!.committedCash.flow.yesterday | number:'1.0-0' }}₫
                  </span>
                </div>
                <div class="meta-row">
                  <span>7-day proj:</span>
                  <span>{{ fundsData()!.committedCash.projection.days7 | number:'1.0-0' }}₫</span>
                </div>
                <div class="meta-row">
                  <span>Threshold:</span>
                  <span>&lt; {{ fundsData()!.committedCash.threshold.max | number:'1.0-0' }}₫</span>
                </div>
              </div>
              <div class="fund-breakdown">
                <div>Wages: {{ fundsData()!.committedCash.breakdown.unpaidLaborCost | number:'1.0-0' }}₫</div>
                <div>OpCost: {{ fundsData()!.committedCash.breakdown.unpaidOtherCost | number:'1.0-0' }}₫</div>
                <div>Agent: {{ fundsData()!.committedCash.breakdown.unpaidAgentCommission | number:'1.0-0' }}₫</div>
              </div>
            </div>

            <!-- Fund 2: Ads Fund -->
            <div class="fund-card" [class]="getStatusClass(fundsData()!.adsFund.threshold.status)">
              <div class="fund-header">
                <span class="fund-icon">📢</span>
                <span class="fund-name">Ads Fund</span>
                <span class="fund-badge">{{ fundsData()!.adsFund.threshold.status | uppercase }}</span>
              </div>
              <div class="fund-stock">{{ fundsData()!.adsFund.stock.current | number:'1.0-0' }}₫</div>
              <div class="fund-meta">
                <div class="meta-row">
                  <span>Δ Yesterday:</span>
                  <span [class.negative]="fundsData()!.adsFund.flow.yesterday < 0">
                    {{ fundsData()!.adsFund.flow.yesterday | number:'1.0-0' }}₫
                  </span>
                </div>
                <div class="meta-row">
                  <span>7-day proj:</span>
                  <span>{{ fundsData()!.adsFund.projection.days7 | number:'1.0-0' }}₫</span>
                </div>
                <div class="meta-row highlight">
                  <span>Days left:</span>
                  <span>{{ fundsData()!.adsFund.dailyBudget.daysRemaining }} days</span>
                </div>
              </div>
              <div class="fund-breakdown">
                <div>45% Capital: {{ fundsData()!.adsFund.breakdown.fromInitialCapital | number:'1.0-0' }}₫</div>
                <div>45% Profit: {{ fundsData()!.adsFund.breakdown.fromReinvestment | number:'1.0-0' }}₫</div>
                <div>Spent: -{{ fundsData()!.adsFund.breakdown.adsSpent | number:'1.0-0' }}₫</div>
              </div>
            </div>

            <!-- Fund 3: Survival Buffer -->
            <div class="fund-card" [class]="getStatusClass(fundsData()!.survivalBuffer.threshold.status)">
              <div class="fund-header">
                <span class="fund-icon">🛡️</span>
                <span class="fund-name">Survival Buffer</span>
                <span class="fund-badge">{{ fundsData()!.survivalBuffer.threshold.status | uppercase }}</span>
              </div>
              <div class="fund-stock">{{ fundsData()!.survivalBuffer.stock.current | number:'1.0-0' }}₫</div>
              <div class="fund-meta">
                <div class="meta-row">
                  <span>Δ Yesterday:</span>
                  <span>{{ fundsData()!.survivalBuffer.flow.yesterday | number:'1.0-0' }}₫</span>
                </div>
                <div class="meta-row">
                  <span>7-day proj:</span>
                  <span>{{ fundsData()!.survivalBuffer.projection.days7 | number:'1.0-0' }}₫</span>
                </div>
                <div class="meta-row highlight">
                  <span>Survival:</span>
                  <span>{{ fundsData()!.survivalBuffer.survivalDays }} days</span>
                </div>
              </div>
              <div class="fund-breakdown">
                <div>20% Profit: {{ fundsData()!.survivalBuffer.breakdown.fromProfit | number:'1.0-0' }}₫</div>
                <div>Used: -{{ fundsData()!.survivalBuffer.breakdown.used | number:'1.0-0' }}₫</div>
                <div>Min threshold: {{ fundsData()!.survivalBuffer.threshold.min | number:'1.0-0' }}₫</div>
              </div>
            </div>

            <!-- Fund 4: Owner Fund -->
            <div class="fund-card" [class]="getStatusClass(fundsData()!.ownerFund.threshold.status)">
              <div class="fund-header">
                <span class="fund-icon">👤</span>
                <span class="fund-name">Owner Equity</span>
                <span class="fund-badge">{{ fundsData()!.ownerFund.threshold.status | uppercase }}</span>
              </div>
              <div class="fund-stock">{{ fundsData()!.ownerFund.stock.current | number:'1.0-0' }}₫</div>
              <div class="fund-meta">
                <div class="meta-row">
                  <span>Δ Yesterday:</span>
                  <span>{{ fundsData()!.ownerFund.flow.yesterday | number:'1.0-0' }}₫</span>
                </div>
                <div class="meta-row">
                  <span>7-day proj:</span>
                  <span>{{ fundsData()!.ownerFund.projection.days7 | number:'1.0-0' }}₫</span>
                </div>
                <div class="meta-row">
                  <span>Can withdraw:</span>
                  <span>{{ fundsData()!.ownerFund.breakdown.retained | number:'1.0-0' }}₫</span>
                </div>
              </div>
              <div class="fund-breakdown">
                <div>20% Profit: {{ fundsData()!.ownerFund.breakdown.fromProfit | number:'1.0-0' }}₫</div>
                <div>Withdrawn: -{{ fundsData()!.ownerFund.breakdown.withdrawn | number:'1.0-0' }}₫</div>
              </div>
            </div>

          </div>
        </section>

        <!-- ////////////////////////////////////////////// -->
        <!-- ZONE 4: PROFIT & REVENUE (Secondary info)     -->
        <!-- ////////////////////////////////////////////// -->
        <section class="zone zone-profit">
          <h2 class="zone-title">Profit Allocation</h2>
          <div class="profit-row">
            <div class="profit-box">
              <span class="profit-label">Net Revenue</span>
              <span class="profit-value">{{ fundsData()!.revenue.realized | number:'1.0-0' }}₫</span>
              <span class="profit-pending" *ngIf="fundsData()!.revenue.pending > 0">
                +{{ fundsData()!.revenue.pending | number:'1.0-0' }}₫ pending
              </span>
            </div>
            <div class="profit-box">
              <span class="profit-label">Net Profit</span>
              <span class="profit-value">{{ fundsData()!.netProfit.realized | number:'1.0-0' }}₫</span>
              <span class="profit-pending" *ngIf="fundsData()!.netProfit.pending > 0">
                +{{ fundsData()!.netProfit.pending | number:'1.0-0' }}₫ pending
              </span>
            </div>
            <div class="profit-box">
              <span class="profit-label">Seed Capital</span>
              <span class="profit-value">{{ fundsData()!.seedCapital.total | number:'1.0-0' }}₫</span>
              <span class="profit-pending">
                Remaining: {{ fundsData()!.seedCapital.remaining | number:'1.0-0' }}₫
              </span>
            </div>
          </div>
          
          <!-- Allocation breakdown -->
          <div class="allocation-visual">
            <div class="alloc-bar">
              <div class="alloc-segment ads" [style.width.%]="45" title="45% Ads"></div>
              <div class="alloc-segment buffer" [style.width.%]="20" title="20% Buffer"></div>
              <div class="alloc-segment owner" [style.width.%]="20" title="20% Owner"></div>
              <div class="alloc-segment asset" [style.width.%]="15" title="15% Long-term"></div>
            </div>
            <div class="alloc-legend">
              <span><i class="dot ads"></i> 45% Ads</span>
              <span><i class="dot buffer"></i> 20% Buffer</span>
              <span><i class="dot owner"></i> 20% Owner</span>
              <span><i class="dot asset"></i> 15% Asset</span>
            </div>
          </div>
        </section>

        <!-- ////////////////////////////////////////////// -->
        <!-- ZONE 5: VALIDATION & ACTIONS                  -->
        <!-- ////////////////////////////////////////////// -->
        <section class="zone zone-footer">
          <div class="validation-box" [class.valid]="fundsData()!.validation.isValid" 
               [class.invalid]="!fundsData()!.validation.isValid">
            <span *ngIf="fundsData()!.validation.isValid">✓ System balanced</span>
            <span *ngIf="!fundsData()!.validation.isValid">
              ⚠️ Mismatch: {{ fundsData()!.validation.difference | number:'1.0-0' }}₫
            </span>
          </div>
          <div class="action-buttons">
            <a class="btn btn-primary" routerLink="/ads-budget" *ngIf="canScale()">
              Allocate Ads Budget →
            </a>
            <a class="btn btn-secondary" routerLink="/finance/capital-management">
              Detailed View
            </a>
          </div>
        </section>

      </main>
    </div>
  `,
  styles: [`
    /* ===== RESET & BASE ===== */
    .control-dashboard {
      min-height: 100vh;
      background: #0d1117;
      color: #e6edf3;
      padding: 16px 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* ===== HEADER ===== */
    .dash-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid #30363d;
      margin-bottom: 16px;
    }
    .dash-header h1 { margin: 0; font-size: 22px; font-weight: 600; }
    .subtitle { color: #8b949e; font-size: 13px; }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .timestamp { color: #8b949e; font-size: 12px; }
    .btn-refresh {
      width: 32px; height: 32px; border-radius: 6px;
      border: 1px solid #30363d; background: transparent;
      color: #e6edf3; font-size: 16px; cursor: pointer;
    }
    .btn-refresh:hover { background: #21262d; }
    .spin { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ===== LOADING & ERROR ===== */
    .loading-box, .error-box {
      text-align: center; padding: 40px;
      background: #161b22; border-radius: 8px;
    }
    .spinner {
      width: 32px; height: 32px; margin: 0 auto 12px;
      border: 3px solid #30363d; border-top-color: #58a6ff;
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    .error-box { color: #f85149; }
    .error-box button {
      margin-top: 12px; padding: 6px 16px;
      background: #21262d; border: 1px solid #30363d;
      color: #e6edf3; border-radius: 6px; cursor: pointer;
    }

    /* ===== ZONES ===== */
    .zone { margin-bottom: 20px; }
    .zone-title {
      font-size: 14px; font-weight: 600; color: #8b949e;
      margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;
    }

    /* ===== ZONE 1: SAFETY ===== */
    .safety-banner {
      display: flex; align-items: center; gap: 16px;
      padding: 16px 20px; border-radius: 8px;
      border: 2px solid #30363d; background: #161b22;
    }
    .safety-banner.safe { border-color: #238636; background: #0d1117; }
    .safety-banner.danger { border-color: #da3633; background: #1c0d0d; }
    .safety-icon { font-size: 36px; }
    .safety-text { flex: 1; }
    .safety-question { display: block; font-size: 13px; color: #8b949e; }
    .safety-answer { display: block; font-size: 20px; font-weight: 600; }
    .safety-banner.safe .safety-answer { color: #3fb950; }
    .safety-banner.danger .safety-answer { color: #f85149; }
    .safety-budget {
      text-align: right; padding: 8px 16px;
      background: rgba(0,0,0,0.3); border-radius: 6px;
    }
    .budget-label { display: block; font-size: 11px; color: #8b949e; }
    .budget-value { font-size: 22px; font-weight: 700; }
    .safety-banner.safe .budget-value { color: #3fb950; }
    .safety-banner.danger .budget-value { color: #f85149; }

    /* Ads Logic */
    .ads-logic {
      margin-top: 12px; padding: 12px 16px;
      background: #161b22; border-radius: 6px;
      border: 1px solid #30363d;
    }
    .logic-formula { margin-bottom: 8px; }
    .formula-title { font-size: 12px; color: #8b949e; margin-right: 8px; }
    .logic-formula code {
      font-family: 'Fira Code', monospace; font-size: 13px;
      background: #0d1117; padding: 4px 8px; border-radius: 4px;
    }
    .logic-values { display: flex; gap: 24px; flex-wrap: wrap; }
    .logic-item { font-size: 13px; }
    .logic-item span:first-child { color: #8b949e; margin-right: 6px; }
    .logic-item.result { font-weight: 600; }
    .logic-item.result.restricted span:last-child { color: #f85149; }
    .restriction-reason {
      margin-top: 10px; padding: 8px 12px;
      background: rgba(248,81,73,0.1); border-radius: 4px;
      font-size: 13px; color: #f85149;
    }

    /* ===== ZONE 2: EQUATION ===== */
    .equation-row {
      display: flex; align-items: center; gap: 8px;
      flex-wrap: wrap; justify-content: center;
    }
    .eq-box {
      flex: 1; min-width: 180px; max-width: 240px;
      padding: 16px; border-radius: 8px;
      background: #161b22; border: 1px solid #30363d;
      text-align: center;
    }
    .eq-box.bank { border-color: #58a6ff; }
    .eq-box.committed { border-color: #d29922; }
    .eq-box.free { border-color: #3fb950; }
    .eq-box.free.negative { border-color: #f85149; }
    .eq-label { display: block; font-size: 13px; color: #8b949e; margin-bottom: 4px; }
    .eq-value { display: block; font-size: 24px; font-weight: 700; }
    .eq-box.bank .eq-value { color: #58a6ff; }
    .eq-box.committed .eq-value { color: #d29922; }
    .eq-box.free .eq-value { color: #3fb950; }
    .eq-box.free.negative .eq-value { color: #f85149; }
    .eq-note { display: block; font-size: 11px; color: #6e7681; margin-top: 4px; }
    .eq-op { font-size: 24px; font-weight: 300; color: #6e7681; padding: 0 4px; }

    /* ===== ZONE 3: FUNDS GRID ===== */
    .funds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
    }
    .fund-card {
      padding: 14px; border-radius: 8px;
      background: #161b22; border-left: 4px solid #30363d;
    }
    .fund-card.safe { border-left-color: #3fb950; }
    .fund-card.warning { border-left-color: #d29922; }
    .fund-card.danger { border-left-color: #f85149; }
    .fund-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .fund-icon { font-size: 18px; }
    .fund-name { font-size: 14px; font-weight: 600; flex: 1; }
    .fund-badge {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: #30363d; text-transform: uppercase;
    }
    .fund-card.safe .fund-badge { background: rgba(63,185,80,0.2); color: #3fb950; }
    .fund-card.warning .fund-badge { background: rgba(210,153,34,0.2); color: #d29922; }
    .fund-card.danger .fund-badge { background: rgba(248,81,73,0.2); color: #f85149; }
    .fund-stock { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
    .fund-meta { font-size: 12px; margin-bottom: 8px; }
    .meta-row { display: flex; justify-content: space-between; padding: 2px 0; }
    .meta-row span:first-child { color: #8b949e; }
    .meta-row.highlight span:last-child { font-weight: 600; color: #58a6ff; }
    .positive { color: #3fb950 !important; }
    .negative { color: #f85149 !important; }
    .fund-breakdown {
      font-size: 11px; color: #6e7681;
      padding-top: 8px; border-top: 1px dashed #30363d;
    }
    .fund-breakdown div { padding: 1px 0; }

    /* ===== ZONE 4: PROFIT ===== */
    .profit-row {
      display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px;
    }
    .profit-box {
      flex: 1; min-width: 160px;
      padding: 12px 16px; border-radius: 6px;
      background: #161b22; border: 1px solid #30363d;
    }
    .profit-label { display: block; font-size: 12px; color: #8b949e; }
    .profit-value { display: block; font-size: 18px; font-weight: 600; }
    .profit-pending { display: block; font-size: 11px; color: #6e7681; }

    /* Allocation bar */
    .allocation-visual { margin-top: 8px; }
    .alloc-bar {
      display: flex; height: 8px; border-radius: 4px; overflow: hidden;
      background: #30363d;
    }
    .alloc-segment { height: 100%; }
    .alloc-segment.ads { background: #58a6ff; }
    .alloc-segment.buffer { background: #3fb950; }
    .alloc-segment.owner { background: #d29922; }
    .alloc-segment.asset { background: #8b949e; }
    .alloc-legend {
      display: flex; gap: 16px; margin-top: 6px;
      font-size: 11px; color: #8b949e;
    }
    .dot {
      display: inline-block; width: 8px; height: 8px;
      border-radius: 2px; margin-right: 4px;
    }
    .dot.ads { background: #58a6ff; }
    .dot.buffer { background: #3fb950; }
    .dot.owner { background: #d29922; }
    .dot.asset { background: #8b949e; }

    /* ===== ZONE 5: FOOTER ===== */
    .zone-footer {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 12px;
      padding-top: 12px; border-top: 1px solid #30363d;
    }
    .validation-box {
      font-size: 12px; padding: 4px 10px; border-radius: 4px;
    }
    .validation-box.valid { background: rgba(63,185,80,0.15); color: #3fb950; }
    .validation-box.invalid { background: rgba(248,81,73,0.15); color: #f85149; }
    .action-buttons { display: flex; gap: 8px; }
    .btn {
      padding: 8px 16px; border-radius: 6px;
      font-size: 13px; font-weight: 500;
      text-decoration: none; cursor: pointer; border: none;
    }
    .btn-primary { background: #238636; color: #fff; }
    .btn-primary:hover { background: #2ea043; }
    .btn-secondary {
      background: transparent; color: #58a6ff;
      border: 1px solid #30363d;
    }
    .btn-secondary:hover { background: #21262d; }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .equation-row { flex-direction: column; }
      .eq-op { transform: rotate(90deg); }
      .safety-banner { flex-direction: column; text-align: center; }
      .safety-budget { text-align: center; }
    }
  `]
})
export class FundsDashboardComponent implements OnInit {
  private service = inject(CapitalManagementService);

  loading = signal(false);
  error = signal<string | null>(null);
  fundsData = signal<FundsOverview | null>(null);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading.set(true);
    this.error.set(null);

    this.service.getFundsOverview().subscribe({
      next: (data) => {
        this.fundsData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading funds:', err);
        this.error.set('Unable to load financial data');
        this.loading.set(false);
      }
    });
  }

  canScale(): boolean {
    const data = this.fundsData();
    if (!data) return false;
    return data.formulas.tienTuDo > 0 &&
           data.formulas.adsBudgetAllowed > 0 &&
           data.survivalBuffer.threshold.status !== 'danger';
  }

  isRestrictedByCashflow(): boolean {
    const data = this.fundsData();
    if (!data) return false;
    return data.formulas.tienTuDo < data.adsFund.stock.current;
  }

  getStatusClass(status: 'safe' | 'warning' | 'danger'): string {
    return status;
  }
}
