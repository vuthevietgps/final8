import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CapitalManagementService, DashboardData, RealAvailableFunds, AllocationComputation, BudgetAllocationStatus, CapitalAllocationPolicy } from './capital-management.service';

type FundMode = 'conservative' | 'moderate' | 'aggressive';

@Component({
  selector: 'app-capital-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './capital-management.component.html',
  styleUrl: './capital-management.component.css'
})
export class CapitalManagementComponent implements OnInit {
  private service = inject(CapitalManagementService);

  // State
  currentMode = signal<FundMode>('conservative');
  isLoading = signal(false);
  error = signal<string | null>(null);
  activeTab = signal<'overview' | 'allocation' | 'budget'>('overview');

  // Dashboard data
  funds = signal<RealAvailableFunds | null>(null);
  allocation = signal<AllocationComputation | null>(null);
  budgetStatus = signal<BudgetAllocationStatus | null>(null);
  activePolicy = signal<CapitalAllocationPolicy | null>(null);

  // Dữ liệu phân bổ ngân sách đã gỡ bỏ phần preview/applied; giữ lại trạng thái chính

  // Computed values
  modeLabel = computed(() => {
    const labels = {
      conservative: '🟢 Thanh toán 2 bên',
      moderate: '🟡 Thanh toán 1 bên',
      aggressive: '🔴 Chưa thanh toán'
    };
    return labels[this.currentMode()];
  });

  riskBadgeClass = computed(() => {
    const classes = {
      conservative: 'badge-success',
      moderate: 'badge-warning',
      aggressive: 'badge-danger'
    };
    return classes[this.currentMode()];
  });

  // Allocation chart percentages
  allocationChart = computed(() => {
    const a = this.allocation();
    if (!a || a.cashAvailable <= 0) {
      return { reinvest: 0, safety: 0, personal: 0, longTerm: 0 };
    }
    return {
      reinvest: (a.reinvestmentAmount / a.cashAvailable) * 100,
      safety: (a.safetyReserveAmount / a.cashAvailable) * 100,
      personal: (a.personalIncomeAmount / a.cashAvailable) * 100,
      longTerm: (a.longTermAssetAmount / a.cashAvailable) * 100
    };
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.service.loadDashboard(this.currentMode()).subscribe({
      next: (data: DashboardData) => {
        this.funds.set(data.funds);
        this.allocation.set(data.allocation);
        this.budgetStatus.set(data.budgetStatus);
        this.activePolicy.set(data.activePolicy);
        this.isLoading.set(false);
        
        // Show warning if no funds data
        if (!data.funds) {
          this.error.set('Không thể tải dữ liệu vốn khả dụng. Các tính năng khác có thể vẫn hoạt động.');
        }
      },
      error: (err) => {
        console.error('Failed to load dashboard:', err);
        this.error.set('Không thể tải dữ liệu. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  setMode(mode: FundMode): void {
    if (mode !== this.currentMode()) {
      this.currentMode.set(mode);
      this.loadDashboard();
    }
  }

  setTab(tab: 'overview' | 'allocation' | 'budget'): void {
    this.activeTab.set(tab);
  }

  captureSnapshot(): void {
    const note = prompt('Ghi chú cho snapshot (không bắt buộc):');
    this.service.captureAllocationSnapshot(note || undefined).subscribe({
      next: () => alert('Đã lưu snapshot thành công!'),
      error: (err) => alert('Lỗi khi lưu snapshot: ' + err.message)
    });
  }


  /**
   * Format date để hiển thị
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

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
    return (value * 100).toFixed(1) + '%';
  }
}
