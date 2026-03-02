import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type OpsActionPriority = 'critical' | 'high' | 'medium' | 'low';

interface OpsActionItem {
  actionType: string;
  priority: OpsActionPriority;
  title: string;
  description: string;
  reason: string;
  linkTo?: string;
  amount?: number;
  count?: number;
  entityName?: string;
  entityId?: string;
  generatedAt: string;
}

interface OpsActionsResponse {
  actions: OpsActionItem[];
  totalCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  asOf: string;
  dataSources: { supplierPayable: boolean; agentReceivable: boolean };
}

@Component({
  selector: 'app-ops-action',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ops-dashboard">
      <header class="dash-header">
        <div class="header-left">
          <h1>Việc Cần Làm - Vận Hành</h1>
          <span class="subtitle">Hành động khẩn cấp • NCC, Đại lý, Đơn hàng</span>
        </div>
        <div class="header-right">
          <span class="update-time" *ngIf="response()">
            Cập nhật: {{ response()!.asOf | date:'HH:mm dd/MM' }}
          </span>
          <button class="btn-refresh" (click)="load()" [disabled]="loading()">
            <span [class.spin]="loading()">↻</span>
          </button>
        </div>
      </header>

      <!-- Data Source Status -->
      <div class="data-sources" *ngIf="response()">
        <span class="ds-item" [class.ok]="response()!.dataSources.supplierPayable" [class.fail]="!response()!.dataSources.supplierPayable">NCC</span>
        <span class="ds-item" [class.ok]="response()!.dataSources.agentReceivable" [class.fail]="!response()!.dataSources.agentReceivable">Đại lý</span>
      </div>

      <!-- Critical Alert Banner -->
      <div class="critical-alert-banner" *ngIf="hasCritical()">
        <div class="alert-icon">🚨</div>
        <div class="alert-content">
          <strong>CÓ {{ response()!.criticalCount }} VIỆC KHẨN CẤP CẦN XỬ LÝ NGAY</strong>
          <p>Hệ thống phát hiện các vấn đề nghiêm trọng cần can thiệp lập tức.</p>
        </div>
      </div>

      <!-- Summary Counters -->
      <div class="summary-bar" *ngIf="response() && response()!.totalCount > 0">
        <div class="counter critical" *ngIf="response()!.bySeverity.critical > 0">
          <span class="counter-num">{{ response()!.bySeverity.critical }}</span>
          <span class="counter-label">Khẩn cấp</span>
        </div>
        <div class="counter high" *ngIf="response()!.bySeverity.high > 0">
          <span class="counter-num">{{ response()!.bySeverity.high }}</span>
          <span class="counter-label">Quan trọng</span>
        </div>
        <div class="counter medium" *ngIf="response()!.bySeverity.medium > 0">
          <span class="counter-num">{{ response()!.bySeverity.medium }}</span>
          <span class="counter-label">Cần làm</span>
        </div>
        <div class="counter low" *ngIf="response()!.bySeverity.low > 0">
          <span class="counter-num">{{ response()!.bySeverity.low }}</span>
          <span class="counter-label">Gợi ý</span>
        </div>
      </div>

      <!-- Action List -->
      <div class="action-panel" *ngIf="response() && response()!.actions.length > 0">
        <div class="action-list">
          <div class="action-item" *ngFor="let action of response()!.actions; let i = index" [class]="action.priority">
            <div class="action-number">{{ i + 1 }}</div>
            <div class="action-priority-badge">{{ getPriorityLabel(action.priority) }}</div>
            <div class="action-content">
              <strong>{{ action.title }}</strong>
              <p>{{ action.description }}</p>
              <div class="action-details">
                <span class="action-reason">💡 {{ action.reason }}</span>
                <span class="action-impact" *ngIf="action.amount">
                  📊 Số tiền: {{ formatCurrency(action.amount!) }}
                </span>
                <span class="action-count" *ngIf="action.count">
                  📋 Số lượng: {{ action.count }}
                </span>
              </div>
            </div>
            <button class="action-btn" *ngIf="action.linkTo" (click)="navigateTo(action.linkTo!)">
              Xử lý →
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions" *ngIf="response() && response()!.totalCount > 0">
        <div class="quick-header">⚡ Truy cập nhanh:</div>
        <div class="quick-buttons">
          <button class="quick-btn supplier" (click)="navigateTo('/purchases/payables')">💰 Đối soát NCC</button>
          <button class="quick-btn supplier" (click)="navigateTo('/payments/supplier')">💳 Thanh toán NCC</button>
          <button class="quick-btn agent" (click)="navigateTo('/payments/agent')">🤝 Hoa hồng Đại lý</button>
          <button class="quick-btn agent" (click)="navigateTo('/agents/receivables')">📋 Công nợ Đại lý</button>
        </div>
      </div>

      <!-- Empty State -->
      <div class="empty-state" *ngIf="response() && response()!.totalCount === 0">
        <div class="empty-icon">✅</div>
        <h3>Không có việc khẩn cấp</h3>
        <p>Mọi thứ đang ổn định. Hệ thống sẽ tự động cảnh báo khi có vấn đề.</p>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="loading()">
        <div class="spinner"></div>
        <p>Đang tải dữ liệu vận hành...</p>
      </div>

      <!-- Error -->
      <div class="error-state" *ngIf="error()">
        <p>{{ error() }}</p>
        <button class="action-btn" (click)="load()">↻ Thử lại</button>
      </div>
    </div>
  `,
  styles: [`
    .ops-dashboard { max-width: 900px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, sans-serif; }

    .dash-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .header-left h1 { margin: 0; font-size: 22px; font-weight: 700; }
    .subtitle { font-size: 13px; color: #666; }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .update-time { font-size: 12px; color: #888; }
    .btn-refresh { background: none; border: 1px solid #ddd; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 16px; }
    .btn-refresh:hover { background: #f5f5f5; }
    .spin { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .data-sources { display: flex; gap: 8px; margin-bottom: 16px; }
    .ds-item { font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600; }
    .ds-item.ok { background: #e8f5e9; color: #2e7d32; }
    .ds-item.fail { background: #ffebee; color: #c62828; }

    .critical-alert-banner {
      display: flex; align-items: center; gap: 16px;
      background: linear-gradient(135deg, #d32f2f, #b71c1c); color: white;
      padding: 16px 20px; border-radius: 12px; margin-bottom: 20px;
      animation: pulse-border 2s ease-in-out infinite;
    }
    @keyframes pulse-border { 0%, 100% { box-shadow: 0 0 0 0 rgba(211,47,47,0.4); } 50% { box-shadow: 0 0 0 8px rgba(211,47,47,0); } }
    .alert-icon { font-size: 28px; }
    .alert-content strong { font-size: 15px; }
    .alert-content p { margin: 4px 0 0; font-size: 13px; opacity: 0.9; }

    .summary-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .counter { padding: 12px 20px; border-radius: 10px; text-align: center; min-width: 100px; }
    .counter-num { display: block; font-size: 28px; font-weight: 800; }
    .counter-label { font-size: 12px; font-weight: 600; }
    .counter.critical { background: #ffebee; color: #c62828; border: 2px solid #ef5350; }
    .counter.high { background: #fff3e0; color: #e65100; border: 2px solid #ff9800; }
    .counter.medium { background: #fff8e1; color: #f57f17; border: 2px solid #ffc107; }
    .counter.low { background: #e8f5e9; color: #2e7d32; border: 2px solid #4caf50; }

    .action-panel { margin-bottom: 20px; }
    .action-list { display: flex; flex-direction: column; gap: 12px; }
    .action-item {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 16px; border-radius: 10px; background: white;
      border-left: 4px solid #ccc; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: transform 0.15s;
    }
    .action-item:hover { transform: translateX(4px); }
    .action-item.critical { border-left-color: #d32f2f; background: #fff5f5; }
    .action-item.high { border-left-color: #e65100; background: #fff8f0; }
    .action-item.medium { border-left-color: #f57f17; background: #fffdf0; }
    .action-item.low { border-left-color: #2e7d32; background: #f5fff5; }

    .action-number { font-size: 14px; font-weight: 800; color: #999; min-width: 24px; padding-top: 2px; }
    .action-priority-badge {
      font-size: 10px; font-weight: 800; padding: 3px 8px;
      border-radius: 4px; white-space: nowrap; letter-spacing: 0.5px;
    }
    .critical .action-priority-badge { background: #d32f2f; color: white; }
    .high .action-priority-badge { background: #e65100; color: white; }
    .medium .action-priority-badge { background: #f57f17; color: white; }
    .low .action-priority-badge { background: #2e7d32; color: white; }

    .action-content { flex: 1; }
    .action-content strong { font-size: 14px; display: block; margin-bottom: 4px; }
    .action-content p { margin: 0 0 8px; font-size: 13px; color: #555; }
    .action-details { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: #777; }
    .action-reason { flex: 1; min-width: 200px; }

    .action-btn {
      background: #1976d2; color: white; border: none; padding: 8px 16px;
      border-radius: 6px; cursor: pointer; font-size: 13px; white-space: nowrap; font-weight: 600;
      align-self: center;
    }
    .action-btn:hover { background: #1565c0; }

    .quick-actions { margin-bottom: 20px; }
    .quick-header { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
    .quick-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
    .quick-btn {
      padding: 10px 18px; border-radius: 8px; border: 1px solid #ddd;
      background: white; cursor: pointer; font-size: 13px; font-weight: 600;
      transition: all 0.15s;
    }
    .quick-btn:hover { background: #f0f0f0; transform: translateY(-1px); }

    .empty-state { text-align: center; padding: 60px 20px; }
    .empty-icon { font-size: 48px; margin-bottom: 12px; }
    .empty-state h3 { margin: 0 0 8px; color: #2e7d32; }
    .empty-state p { color: #666; font-size: 14px; }

    .loading-overlay { text-align: center; padding: 60px; }
    .spinner { width: 36px; height: 36px; border: 3px solid #eee; border-top-color: #1976d2; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 12px; }

    .error-state { text-align: center; padding: 40px; color: #c62828; }
  `],
})
export class OpsActionComponent implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/ops-actions`;

  loading = signal(false);
  error = signal<string | null>(null);
  response = signal<OpsActionsResponse | null>(null);

  hasCritical = computed(() => (this.response()?.criticalCount ?? 0) > 0);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<OpsActionsResponse>(`${this.apiUrl}/suggestions`).subscribe({
      next: (data) => {
        this.response.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load ops actions:', err);
        this.error.set('Không thể tải dữ liệu. Vui lòng thử lại.');
        this.loading.set(false);
      },
    });
  }

  getPriorityLabel(priority: OpsActionPriority): string {
    const labels: Record<OpsActionPriority, string> = {
      critical: 'KHẨN CẤP',
      high: 'QUAN TRỌNG',
      medium: 'CẦN LÀM',
      low: 'GỢI Ý',
    };
    return labels[priority] || priority.toUpperCase();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  navigateTo(route: string): void {
    if (route.startsWith('/')) {
      this.router.navigate([route]);
    } else {
      this.router.navigate(['/', route]);
    }
  }
}
