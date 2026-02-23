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

interface CapitalFlow {
  initialCapital: number;
  loanAmount: number;
  totalCapital: number;
  adsSpent: number;
  revenue: number;
  netProfit: number;
  reinvestment: {
    daily: number;
    used: number;
    available: number;
    accumulated: number;
  };
  safetyReserve: {
    daily: number;
    accumulated: number;
  };
  personalIncome: {
    daily: number;
    accumulated: number;
  };
  longTermAsset: {
    daily: number;
    accumulated: number;
  };
  policy: {
    name: string;
    reinvestmentRatio: number;
    safetyReserveRatio: number;
    personalIncomeRatio: number;
    longTermAssetRatio: number;
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
          <p class="subtitle">Theo dõi vốn từ nguồn → Ads → Lợi nhuận → Phân bổ tái đầu tư</p>
        </div>
        <button (click)="loadAll()" [disabled]="loading()">🔄 Tải lại</button>
      </div>

      <div *ngIf="loading()" class="loading">⏳ Đang tải...</div>
      <div *ngIf="error()" class="error-banner">❌ {{ error() }}</div>

      <!-- FLOW DIAGRAM -->
      <div *ngIf="capitalFlow()" class="flow-diagram">
        
        <!-- BƯỚC 1: Nguồn Vốn -->
        <div class="flow-box">
          <div class="flow-title">🏦 Nguồn Vốn Ban Đầu</div>
          <div class="flow-content">
            <div class="flow-metric">
              <span>Vốn ban đầu:</span>
              <strong>{{ format(capitalFlow()!.initialCapital) }} đ</strong>
            </div>
            <div class="flow-metric positive">
              <span>+ Vay:</span>
              <strong>{{ format(capitalFlow()!.loanAmount) }} đ</strong>
            </div>
            <div class="flow-metric total">
              <span>= Tổng vốn:</span>
              <strong>{{ format(capitalFlow()!.totalCapital) }} đ</strong>
            </div>
          </div>
        </div>

        <div class="flow-arrow">↓</div>

        <!-- BƯỚC 2: Phân Bổ Ngân Sách → Ads -->
        <div class="flow-box highlight">
          <div class="flow-title">🎯 [Phân Bổ Ngân Sách] → Chạy Ads</div>
          <div class="flow-content">
            <div class="flow-metric negative">
              <span>Đã chi Ads:</span>
              <strong>{{ format(capitalFlow()!.adsSpent) }} đ</strong>
            </div>
            <div class="flow-metric">
              <span>Còn lại:</span>
              <strong>{{ format(capitalFlow()!.totalCapital - capitalFlow()!.adsSpent) }} đ</strong>
            </div>
          </div>
        </div>

        <div class="flow-arrow">↓</div>

        <!-- BƯỚC 3: Đơn Hàng → Doanh Thu → Lợi Nhuận -->
        <div class="flow-box">
          <div class="flow-title">📦 Đơn Hàng → 💵 Doanh Thu → 💰 Lợi Nhuận Thuần</div>
          <div class="flow-content">
            <div class="flow-metric">
              <span>Doanh thu:</span>
              <strong>{{ format(capitalFlow()!.revenue) }} đ</strong>
            </div>
            <div class="flow-metric total positive">
              <span>Lợi nhuận thuần:</span>
              <strong>{{ format(capitalFlow()!.netProfit) }} đ</strong>
              <small>(ROI: {{ calculateROI() }}%)</small>
            </div>
          </div>
        </div>

        <div class="flow-arrow">↓</div>

        <!-- BƯỚC 4: Phân Bổ Lợi Nhuận Thuần -->
        <div class="flow-box highlight">
          <div class="flow-title">🎯 [Phân Bổ Lợi Nhuận Thuần]</div>
          <div class="policy-badge">
            Chính sách: {{ capitalFlow()!.policy.name }}
          </div>
          
          <div class="allocation-boxes">
            
            <!-- Tái đầu tư -->
            <div class="alloc-box reinvest">
              <div class="alloc-header">
                <span class="alloc-icon">🔄</span>
                <div class="alloc-title-group">
                  <div class="alloc-title">Tái Đầu Tư</div>
                  <div class="alloc-ratio">{{ capitalFlow()!.policy.reinvestmentRatio }}%</div>
                </div>
              </div>
              <div class="alloc-metrics">
                <div class="alloc-metric">
                  <span>Ngày:</span>
                  <strong class="positive">+{{ format(capitalFlow()!.reinvestment.daily) }} đ</strong>
                </div>
                <div class="alloc-metric">
                  <span>Đã dùng:</span>
                  <strong class="used">-{{ format(capitalFlow()!.reinvestment.used) }} đ</strong>
                </div>
                <div class="alloc-metric highlight">
                  <span>Khả dụng:</span>
                  <strong class="available">{{ format(capitalFlow()!.reinvestment.available) }} đ</strong>
                </div>
                <div class="alloc-metric">
                  <span>Lũy kế:</span>
                  <strong>{{ format(capitalFlow()!.reinvestment.accumulated) }} đ</strong>
                </div>
              </div>
              <div class="alloc-arrow">→ Quay lại [Phân Bổ Ngân Sách]</div>
            </div>

            <!-- Dự phòng -->
            <div class="alloc-box reserve">
              <div class="alloc-header">
                <span class="alloc-icon">🛡️</span>
                <div class="alloc-title-group">
                  <div class="alloc-title">Dự Phòng</div>
                  <div class="alloc-ratio">{{ capitalFlow()!.policy.safetyReserveRatio }}%</div>
                </div>
              </div>
              <div class="alloc-metrics">
                <div class="alloc-metric">
                  <span>Ngày:</span>
                  <strong class="positive">+{{ format(capitalFlow()!.safetyReserve.daily) }} đ</strong>
                </div>
                <div class="alloc-metric highlight">
                  <span>Lũy kế:</span>
                  <strong>{{ format(capitalFlow()!.safetyReserve.accumulated) }} đ</strong>
                </div>
              </div>
            </div>

            <!-- Thu nhập cá nhân -->
            <div class="alloc-box personal">
              <div class="alloc-header">
                <span class="alloc-icon">👤</span>
                <div class="alloc-title-group">
                  <div class="alloc-title">Thu Nhập Cá Nhân</div>
                  <div class="alloc-ratio">{{ capitalFlow()!.policy.personalIncomeRatio }}%</div>
                </div>
              </div>
              <div class="alloc-metrics">
                <div class="alloc-metric">
                  <span>Ngày:</span>
                  <strong class="positive">+{{ format(capitalFlow()!.personalIncome.daily) }} đ</strong>
                </div>
                <div class="alloc-metric highlight">
                  <span>Lũy kế:</span>
                  <strong>{{ format(capitalFlow()!.personalIncome.accumulated) }} đ</strong>
                </div>
              </div>
            </div>

            <!-- Tài sản dài hạn -->
            <div class="alloc-box longterm">
              <div class="alloc-header">
                <span class="alloc-icon">🏠</span>
                <div class="alloc-title-group">
                  <div class="alloc-title">Tài Sản Dài Hạn</div>
                  <div class="alloc-ratio">{{ capitalFlow()!.policy.longTermAssetRatio }}%</div>
                </div>
              </div>
              <div class="alloc-metrics">
                <div class="alloc-metric">
                  <span>Ngày:</span>
                  <strong class="positive">+{{ format(capitalFlow()!.longTermAsset.daily) }} đ</strong>
                </div>
                <div class="alloc-metric highlight">
                  <span>Lũy kế:</span>
                  <strong>{{ format(capitalFlow()!.longTermAsset.accumulated) }} đ</strong>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      <div class="divider"></div>

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
    .page { padding: 1.5rem; max-width: 1600px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid #e5e7eb; }
    .header h2 { margin: 0; color: #1f2937; font-size: 1.5rem; }
    .subtitle { color: #6b7280; font-size: 0.875rem; margin: 0.25rem 0 0 0; }
    
    .loading, .error-banner { 
      padding: 1rem; 
      text-align: center; 
      border-radius: 0.5rem; 
      margin: 1rem 0; 
      font-size: 0.875rem;
    }
    .loading { background: #dbeafe; color: #1e40af; }
    .error-banner { background: #fee2e2; color: #991b1b; }
    
    .divider { 
      border-top: 3px dashed #9ca3af; 
      margin: 2rem 0; 
      position: relative;
    }
    .divider::after {
      content: "THỰC HIỆN PHÂN BỔ";
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: white;
      padding: 0 1rem;
      color: #6b7280;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 1px;
    }

    /* FLOW DIAGRAM */
    .flow-diagram {
      display: flex;
      flex-direction: column;
      gap: 0;
      margin-bottom: 2rem;
    }

    .flow-box {
      background: white;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .flow-box.highlight {
      border-color: #8b5cf6;
      background: linear-gradient(to right, #faf5ff 0%, white 50%);
      border-width: 3px;
    }

    .flow-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 1rem;
    }

    .flow-content {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.75rem;
    }

    .flow-metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.625rem 0.875rem;
      background: #f9fafb;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }

    .flow-metric.total {
      background: #f3e8ff;
      border: 2px solid #8b5cf6;
      font-weight: 600;
    }

    .flow-metric.positive strong { color: #059669; }
    .flow-metric.negative strong { color: #dc2626; }

    .flow-metric small {
      display: block;
      font-size: 0.75rem;
      color: #059669;
      margin-top: 0.25rem;
    }

    .flow-arrow {
      text-align: center;
      font-size: 2.5rem;
      color: #8b5cf6;
      font-weight: bold;
      line-height: 1;
      padding: 0.5rem 0;
    }

    .policy-badge {
      background: #f3f4f6;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      text-align: center;
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 1rem;
    }

    .allocation-boxes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .alloc-box {
      background: white;
      border: 2px solid;
      border-radius: 10px;
      padding: 1rem;
      transition: all 0.2s;
    }

    .alloc-box:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .alloc-box.reinvest {
      border-color: #10b981;
      background: linear-gradient(to bottom, #d1fae5 0%, white 60px);
    }

    .alloc-box.reserve {
      border-color: #f59e0b;
      background: linear-gradient(to bottom, #fef3c7 0%, white 60px);
    }

    .alloc-box.personal {
      border-color: #3b82f6;
      background: linear-gradient(to bottom, #dbeafe 0%, white 60px);
    }

    .alloc-box.longterm {
      border-color: #8b5cf6;
      background: linear-gradient(to bottom, #f3e8ff 0%, white 60px);
    }

    .alloc-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid rgba(0,0,0,0.1);
    }

    .alloc-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .alloc-title-group {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .alloc-title {
      font-size: 1rem;
      font-weight: 600;
      color: #1f2937;
    }

    .alloc-ratio {
      font-size: 1.25rem;
      font-weight: bold;
      color: #8b5cf6;
      background: white;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      border: 2px solid currentColor;
    }

    .alloc-metrics {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .alloc-metric {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      font-size: 0.875rem;
      border-bottom: 1px solid #f3f4f6;
    }

    .alloc-metric:last-child {
      border-bottom: none;
    }

    .alloc-metric.highlight {
      background: rgba(16, 185, 129, 0.1);
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin: 0.25rem 0;
      border: 2px solid #10b981;
      border-bottom: 2px solid #10b981;
    }

    .alloc-metric span {
      color: #6b7280;
    }

    .alloc-metric strong {
      font-size: 1rem;
      color: #1f2937;
      font-weight: 600;
    }

    .alloc-metric strong.positive { color: #059669; }
    .alloc-metric strong.used { color: #dc2626; }
    .alloc-metric strong.available { 
      color: #1e40af; 
      font-size: 1.125rem;
    }

    .alloc-arrow {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(0,0,0,0.1);
      text-align: center;
      color: #10b981;
      font-weight: 600;
      font-size: 0.875rem;
    }

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
  capitalFlow = signal<CapitalFlow | null>(null);
  loading = signal(false);
  error = signal('');

  minBudget = 50000;
  maxBudget = 10000000;
  priorityMode: 'roi' | 'profit' | 'equal' = 'roi';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    this.error.set('');

    try {
      await Promise.all([
        this.loadStatus(),
        this.loadCapitalFlow()
      ]);
    } catch (err) {
      console.error('Load all error:', err);
    } finally {
      this.loading.set(false);
    }
  }

  loadStatus() {
    return new Promise((resolve, reject) => {
      this.http.get<AllocationStatus>(`${this.apiUrl}/status`).subscribe({
        next: (data) => {
          this.status.set(data);
          resolve(data);
        },
        error: (err) => {
          console.error('Load status error:', err);
          reject(err);
        }
      });
    });
  }

  async loadCapitalFlow() {
    try {
      const funds = await this.http.get<any>(`${environment.apiUrl}/finance/available-funds`).toPromise();
      const allocation = await this.http.get<any>(`${environment.apiUrl}/capital-allocation/compute`).toPromise();
      const reinvestBudget = await this.http.get<any>(`${environment.apiUrl}/capital-allocation/reinvestment-budget`).toPromise();
      const snapshotsResponse = await this.http.get<any[]>(`${environment.apiUrl}/capital-allocation/snapshots?limit=1000`).toPromise();
      const snapshots = snapshotsResponse || [];

      const accumulatedSafetyReserve = snapshots.reduce((sum, s) => sum + (s.safetyReserveAmount || 0), 0);
      const accumulatedPersonalIncome = snapshots.reduce((sum, s) => sum + (s.personalIncomeAmount || 0), 0);
      const accumulatedLongTermAsset = snapshots.reduce((sum, s) => sum + (s.longTermAssetAmount || 0), 0);

      this.capitalFlow.set({
        initialCapital: funds.breakdown?.collectedRevenue || 0,
        loanAmount: funds.breakdown?.loanAvailable || 0,
        totalCapital: funds.available || 0,
        adsSpent: funds.breakdown?.actualSpent || 0,
        revenue: funds.breakdown?.collectedRevenue || 0,
        netProfit: allocation.totalNetProfit || 0,
        reinvestment: {
          daily: allocation.reinvestmentAmount || 0,
          used: reinvestBudget.totalUsed || 0,
          available: reinvestBudget.available || 0,
          accumulated: reinvestBudget.totalAllocated || 0
        },
        safetyReserve: {
          daily: allocation.safetyReserveAmount || 0,
          accumulated: accumulatedSafetyReserve
        },
        personalIncome: {
          daily: allocation.personalIncomeAmount || 0,
          accumulated: accumulatedPersonalIncome
        },
        longTermAsset: {
          daily: allocation.longTermAssetAmount || 0,
          accumulated: accumulatedLongTermAsset
        },
        policy: {
          name: allocation.policyName || 'Default Policy',
          reinvestmentRatio: allocation.ratios?.reinvestmentRatio || 45,
          safetyReserveRatio: allocation.ratios?.safetyReserveRatio || 25,
          personalIncomeRatio: allocation.ratios?.personalIncomeRatio || 20,
          longTermAssetRatio: allocation.ratios?.longTermAssetRatio || 10
        }
      });
    } catch (err: any) {
      this.error.set(err.error?.message || 'Không thể tải dữ liệu luồng vốn');
      console.error('Load capital flow error:', err);
    }
  }

  calculateROI(): string {
    const cf = this.capitalFlow();
    if (!cf || cf.adsSpent === 0) return '0';
    return ((cf.netProfit / cf.adsSpent) * 100).toFixed(1);
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
        this.loadAll(); // Reload all data
        
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
