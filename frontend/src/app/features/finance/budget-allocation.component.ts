import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

interface AllocationResult {
  totalAvailable: number;
  totalAllocated: number;
  allocations: Array<{
    adGroupId: string;
    adGroupName: string;
    currentBudget: number;
    suggestedBudget: number;
    allocatedBudget: number;
    roi: number;
    profit: number;
    applied: boolean;
    reason?: string;
  }>;
  summary: {
    successCount: number;
    failedCount: number;
    skippedCount: number;
  };
}

interface AllocationStatus {
  availableFunds: number;
  totalSuggestedSpend: number;
  canAfford: boolean;
  deficit: number;
  adGroupCount: number;
  breakdown: {
    collectedRevenue: number;
    loanAvailable: number;
    actualSpent: number;
    reservedTotal: number;
  };
}

@Component({
  selector: 'app-budget-allocation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="header">
        <div>
          <h2>🎯 Tự Động Phân Bổ Ngân Sách</h2>
          <p class="subtitle">Phân bổ nguồn vốn khả dụng vào các nhóm quảng cáo</p>
        </div>
        <button (click)="loadStatus()" [disabled]="loading()">🔄 Tải lại</button>
      </div>

      <!-- Trạng thái hiện tại -->
      <div *ngIf="status()" class="status-section">
        <div class="status-card" [class.warning]="!status()!.canAfford">
          <div class="status-main">
            <div class="status-label">Vốn khả dụng</div>
            <div class="status-value">{{ format(status()!.availableFunds) }} đ</div>
          </div>
          <div class="status-details">
            <div class="detail-row">
              <span>Tổng đề xuất:</span>
              <strong>{{ format(status()!.totalSuggestedSpend) }} đ</strong>
            </div>
            <div class="detail-row">
              <span>Số ad groups:</span>
              <strong>{{ status()!.adGroupCount }}</strong>
            </div>
            <div *ngIf="!status()!.canAfford" class="detail-row warning">
              <span>⚠️ Thiếu:</span>
              <strong>{{ format(status()!.deficit) }} đ</strong>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Chi tiết vốn</h3>
          <div class="breakdown-row positive">
            <span>Thu đã thu:</span>
            <span>+{{ format(status()!.breakdown.collectedRevenue) }} đ</span>
          </div>
          <div class="breakdown-row positive">
            <span>Room vay:</span>
            <span>+{{ format(status()!.breakdown.loanAvailable) }} đ</span>
          </div>
          <div class="breakdown-row negative">
            <span>Đã chi:</span>
            <span>-{{ format(status()!.breakdown.actualSpent) }} đ</span>
          </div>
          <div class="breakdown-row negative">
            <span>Tiền đặt chỗ:</span>
            <span>-{{ format(status()!.breakdown.reservedTotal) }} đ</span>
          </div>
        </div>
      </div>

      <!-- Form cấu hình -->
      <div class="config-section">
        <h3>⚙️ Cấu hình phân bổ</h3>
        <div class="config-grid">
          <label>
            Ngân sách tối thiểu (mỗi ad group)
            <input type="number" [(ngModel)]="minBudget" placeholder="50,000" />
          </label>
          <label>
            Ngân sách tối đa (mỗi ad group)
            <input type="number" [(ngModel)]="maxBudget" placeholder="10,000,000" />
          </label>
          <label>
            Chế độ ưu tiên
            <select [(ngModel)]="priorityMode">
              <option value="roi">ROI (hiệu quả cao nhất)</option>
              <option value="profit">Profit (lợi nhuận cao nhất)</option>
              <option value="equal">Equal (phân đều)</option>
            </select>
          </label>
        </div>
        <div class="action-buttons">
          <button class="btn-preview" (click)="preview()" [disabled]="loading()">
            👁️ Xem trước
          </button>
          <button class="btn-apply" (click)="apply()" [disabled]="loading() || !result()">
            🚀 Áp dụng ngay
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="loading">⏳ Đang xử lý...</div>

      <!-- Kết quả -->
      <div *ngIf="result()" class="result-section">
        <div class="summary-cards">
          <div class="summary-card success">
            <div class="card-value">{{ result()!.summary.successCount }}</div>
            <div class="card-label">✅ Thành công</div>
          </div>
          <div class="summary-card error">
            <div class="card-value">{{ result()!.summary.failedCount }}</div>
            <div class="card-label">❌ Thất bại</div>
          </div>
          <div class="summary-card warning">
            <div class="card-value">{{ result()!.summary.skippedCount }}</div>
            <div class="card-label">⏭️ Bỏ qua</div>
          </div>
          <div class="summary-card info">
            <div class="card-value">{{ format(result()!.totalAllocated) }} đ</div>
            <div class="card-label">💰 Tổng phân bổ</div>
          </div>
        </div>

        <div class="allocations-table">
          <h3>📊 Chi tiết phân bổ</h3>
          <table>
            <thead>
              <tr>
                <th>Ad Group</th>
                <th>Hiện tại</th>
                <th>Đề xuất</th>
                <th>Phân bổ</th>
                <th>ROI</th>
                <th>Profit</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let alloc of result()!.allocations" [class.applied]="alloc.applied">
                <td class="ad-group-cell">
                  <div class="ad-group-name">{{ alloc.adGroupName }}</div>
                  <div class="ad-group-id">{{ alloc.adGroupId }}</div>
                </td>
                <td class="number">{{ format(alloc.currentBudget) }}</td>
                <td class="number">{{ format(alloc.suggestedBudget) }}</td>
                <td class="number highlight">{{ format(alloc.allocatedBudget) }}</td>
                <td class="number">{{ alloc.roi.toFixed(2) }}</td>
                <td class="number">{{ format(alloc.profit) }}</td>
                <td>
                  <span *ngIf="alloc.applied" class="badge success">✅ Đã áp dụng</span>
                  <span *ngIf="!alloc.applied && alloc.reason" class="badge error" [title]="alloc.reason">❌ {{ alloc.reason }}</span>
                  <span *ngIf="!alloc.applied && !alloc.reason" class="badge preview">👁️ Xem trước</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin: 0.25rem 0 0 0; }
    
    .status-section { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; }
    .status-card, .breakdown-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; }
    .status-card.warning { border-left: 4px solid #f59e0b; }
    .status-main { margin-bottom: 1rem; }
    .status-label { font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem; }
    .status-value { font-size: 2rem; font-weight: 700; color: #2563eb; }
    .status-details { display: flex; flex-direction: column; gap: 0.5rem; }
    .detail-row { display: flex; justify-content: space-between; font-size: 0.875rem; }
    .detail-row.warning { color: #f59e0b; font-weight: 600; }
    
    .breakdown-card h3 { margin: 0 0 1rem 0; font-size: 1rem; }
    .breakdown-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; }
    .breakdown-row.positive { color: #10b981; }
    .breakdown-row.negative { color: #ef4444; }
    
    .config-section { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem; }
    .config-section h3 { margin: 0 0 1rem 0; }
    .config-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
    .config-grid label { display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.875rem; }
    .config-grid input, .config-grid select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 6px; }
    
    .action-buttons { display: flex; gap: 1rem; justify-content: flex-end; }
    .btn-preview, .btn-apply { padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .btn-preview { background: #e5e7eb; color: #1f2937; }
    .btn-preview:hover { background: #d1d5db; }
    .btn-apply { background: #10b981; color: white; }
    .btn-apply:hover { background: #059669; }
    .btn-apply:disabled { opacity: 0.5; cursor: not-allowed; }
    
    .loading { text-align: center; padding: 2rem; color: #6b7280; }
    
    .result-section { margin-top: 2rem; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; text-align: center; }
    .summary-card.success { border-left: 4px solid #10b981; }
    .summary-card.error { border-left: 4px solid #ef4444; }
    .summary-card.warning { border-left: 4px solid #f59e0b; }
    .summary-card.info { border-left: 4px solid #3b82f6; }
    .card-value { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; }
    .card-label { font-size: 0.875rem; color: #6b7280; }
    
    .allocations-table { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; }
    .allocations-table h3 { margin: 0 0 1rem 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 600; font-size: 0.875rem; }
    .number { text-align: right; font-family: monospace; }
    .number.highlight { font-weight: 700; color: #2563eb; }
    .ad-group-cell { min-width: 200px; }
    .ad-group-name { font-weight: 600; }
    .ad-group-id { font-size: 0.75rem; color: #6b7280; }
    tr.applied { background: #f0fdf4; }
    
    .badge { padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .badge.success { background: #d1fae5; color: #065f46; }
    .badge.error { background: #fee2e2; color: #991b1b; }
    .badge.preview { background: #dbeafe; color: #1e40af; }

    @media (max-width: 1024px) {
      .status-section { grid-template-columns: 1fr; }
      .config-grid { grid-template-columns: 1fr; }
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class BudgetAllocationComponent implements OnInit {
  private apiUrl = `${environment.apiUrl}/budget-allocation`;

  status = signal<AllocationStatus | null>(null);
  result = signal<AllocationResult | null>(null);
  loading = signal(false);

  minBudget = 50000;
  maxBudget = 10000000;
  priorityMode: 'roi' | 'profit' | 'equal' = 'roi';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadStatus();
  }

  loadStatus() {
    this.loading.set(true);
    this.http.get<AllocationStatus>(`${this.apiUrl}/status`).subscribe({
      next: (data) => {
        this.status.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Load status error:', err);
        this.loading.set(false);
      }
    });
  }

  preview() {
    this.loading.set(true);
    this.result.set(null);

    this.http.get<AllocationResult>(`${this.apiUrl}/preview`, {
      params: {
        minBudget: this.minBudget.toString(),
        maxBudget: this.maxBudget.toString(),
        priorityMode: this.priorityMode
      }
    }).subscribe({
      next: (data) => {
        this.result.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Preview error:', err);
        this.loading.set(false);
        alert('Lỗi xem trước: ' + (err?.error?.message || err.message));
      }
    });
  }

  apply() {
    if (!confirm('Bạn có chắc muốn áp dụng phân bổ ngân sách này?')) return;

    this.loading.set(true);
    this.http.post<AllocationResult>(`${this.apiUrl}/auto`, {
      dryRun: false,
      minBudget: this.minBudget,
      maxBudget: this.maxBudget,
      priorityMode: this.priorityMode
    }).subscribe({
      next: (data) => {
        this.result.set(data);
        this.loading.set(false);
        this.loadStatus(); // Reload status
        
        const msg = `✅ Hoàn thành!\n` +
          `- Thành công: ${data.summary.successCount}\n` +
          `- Thất bại: ${data.summary.failedCount}\n` +
          `- Bỏ qua: ${data.summary.skippedCount}`;
        alert(msg);
      },
      error: (err) => {
        console.error('Apply error:', err);
        this.loading.set(false);
        alert('Lỗi áp dụng: ' + (err?.error?.message || err.message));
      }
    });
  }

  format(amount: number): string {
    return Math.round(amount).toLocaleString('vi-VN');
  }
}
