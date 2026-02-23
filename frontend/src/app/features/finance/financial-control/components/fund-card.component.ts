import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FundStatus } from '../models/financial-control.model';

@Component({
  selector: 'app-fund-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fund-card" [class]="fund.threshold.status">
      <!-- Header -->
      <div class="fund-header">
        <span class="fund-icon">{{ fund.icon }}</span>
        <div class="fund-title">
          <h3>{{ fund.name }}</h3>
          <p class="fund-desc">{{ fund.description }}</p>
        </div>
        <span class="status-badge" [class]="fund.threshold.status">
          {{ fund.threshold.status | uppercase }}
        </span>
      </div>

      <!-- Current Balance -->
      <div class="fund-balance">
        <span class="balance-value">{{ fund.currentBalance | number:'1.0-0' }}₫</span>
      </div>

      <!-- Metrics Grid -->
      <div class="fund-metrics">
        <div class="metric" [class.positive]="fund.yesterdayDelta > 0" [class.negative]="fund.yesterdayDelta < 0">
          <span class="metric-label">Δ Yesterday</span>
          <span class="metric-value">
            {{ fund.yesterdayDelta > 0 ? '+' : '' }}{{ fund.yesterdayDelta | number:'1.0-0' }}₫
          </span>
        </div>
        <div class="metric">
          <span class="metric-label">7-day Proj.</span>
          <span class="metric-value">{{ fund.projection7Days | number:'1.0-0' }}₫</span>
        </div>
      </div>

      <!-- Threshold Bar -->
      <div class="threshold-section">
        <div class="threshold-bar">
          <div class="threshold-fill" [style.width.%]="getThresholdPercent()"></div>
          <div class="threshold-marker" [style.left.%]="getMinThresholdPercent()" *ngIf="fund.threshold.min > 0"></div>
        </div>
        <div class="threshold-labels">
          <span>Min: {{ fund.threshold.min | number:'1.0-0' }}₫</span>
          <span>Max: {{ fund.threshold.max | number:'1.0-0' }}₫</span>
        </div>
      </div>

      <!-- Usage Rules (Tooltip on hover) -->
      <div class="usage-rules">
        <div class="rule allowed" *ngIf="fund.usageRules.allowedFor.length">
          <span class="rule-icon">✓</span>
          <span class="rule-text">{{ fund.usageRules.allowedFor.join(', ') }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fund-card {
      background: #161b22;
      border-radius: 12px;
      padding: 16px;
      border-left: 4px solid #30363d;
      transition: all 0.2s ease;
    }

    .fund-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .fund-card.safe { border-left-color: #3fb950; }
    .fund-card.warning { border-left-color: #d29922; }
    .fund-card.danger { border-left-color: #f85149; }

    /* Header */
    .fund-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 12px;
    }

    .fund-icon {
      font-size: 24px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    }

    .fund-title {
      flex: 1;
    }

    .fund-title h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: #e6edf3;
    }

    .fund-desc {
      margin: 2px 0 0;
      font-size: 11px;
      color: #8b949e;
    }

    .status-badge {
      font-size: 9px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .status-badge.safe { background: rgba(63,185,80,0.15); color: #3fb950; }
    .status-badge.warning { background: rgba(210,153,34,0.15); color: #d29922; }
    .status-badge.danger { background: rgba(248,81,73,0.15); color: #f85149; }

    /* Balance */
    .fund-balance {
      margin-bottom: 12px;
    }

    .balance-value {
      font-size: 24px;
      font-weight: 700;
      color: #e6edf3;
    }

    /* Metrics */
    .fund-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 12px;
    }

    .metric {
      background: rgba(255,255,255,0.03);
      padding: 8px;
      border-radius: 6px;
    }

    .metric-label {
      display: block;
      font-size: 10px;
      color: #8b949e;
      margin-bottom: 2px;
    }

    .metric-value {
      font-size: 13px;
      font-weight: 600;
      color: #e6edf3;
    }

    .metric.positive .metric-value { color: #3fb950; }
    .metric.negative .metric-value { color: #f85149; }

    /* Threshold */
    .threshold-section {
      margin-bottom: 10px;
    }

    .threshold-bar {
      height: 6px;
      background: #30363d;
      border-radius: 3px;
      position: relative;
      overflow: visible;
    }

    .threshold-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .fund-card.safe .threshold-fill { background: #3fb950; }
    .fund-card.warning .threshold-fill { background: #d29922; }
    .fund-card.danger .threshold-fill { background: #f85149; }

    .threshold-marker {
      position: absolute;
      top: -3px;
      width: 2px;
      height: 12px;
      background: #f85149;
      border-radius: 1px;
    }

    .threshold-labels {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #6e7681;
      margin-top: 4px;
    }

    /* Usage Rules */
    .usage-rules {
      border-top: 1px solid #21262d;
      padding-top: 8px;
    }

    .rule {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
    }

    .rule-icon {
      color: #3fb950;
    }

    .rule-text {
      color: #8b949e;
    }
  `]
})
export class FundCardComponent {
  @Input() fund!: FundStatus;

  getThresholdPercent(): number {
    if (this.fund.threshold.max <= 0) return 0;
    return Math.min(100, (this.fund.currentBalance / this.fund.threshold.max) * 100);
  }

  getMinThresholdPercent(): number {
    if (this.fund.threshold.max <= 0) return 0;
    return (this.fund.threshold.min / this.fund.threshold.max) * 100;
  }
}
