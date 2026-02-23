import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LoanService, LoanDashboard, LoanDetail, LoanAlert } from './loan.service';

@Component({
  selector: 'app-loan-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loan-dashboard.component.html',
  styleUrls: ['./loan-dashboard.component.css']
})
export class LoanDashboardComponent implements OnInit {
  dashboard = signal<LoanDashboard | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedDueWindow = signal<7 | 14 | 30>(14);

  constructor(
    private loanService: LoanService,
    private router: Router
  ) {}

  // Computed values
  dueAmount = computed(() => {
    const d = this.dashboard();
    if (!d) return 0;
    switch (this.selectedDueWindow()) {
      case 7: return d.due7Days;
      case 14: return d.due14Days;
      case 30: return d.due30Days;
      default: return d.due14Days;
    }
  });

  criticalAlerts = computed(() => 
    this.dashboard()?.alerts.filter(a => a.severity === 'critical') || []
  );

  warningAlerts = computed(() => 
    this.dashboard()?.alerts.filter(a => a.severity === 'warning') || []
  );

  infoAlerts = computed(() => 
    this.dashboard()?.alerts.filter(a => a.severity === 'info') || []
  );

  hasOptimizationSuggestion = computed(() => 
    this.dashboard()?.optimization?.earlyPaymentSuggestion?.available || false
  );

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading.set(true);
    this.error.set(null);
    
    this.loanService.getLoanDashboard().subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load loan dashboard:', err);
        this.error.set('Không tải được dữ liệu khoản vay');
        this.loading.set(false);
      }
    });
  }

  setDueWindow(days: 7 | 14 | 30) {
    this.selectedDueWindow.set(days);
  }

  goToPayment(loanId: string) {
    this.router.navigate(['/loans', loanId, 'pay']);
  }

  goToDetail(loanId: string) {
    this.router.navigate(['/loans', loanId]);
  }

  goToCreate() {
    this.router.navigate(['/loans/new']);
  }

  formatCurrency(n: number | undefined): string {
    return new Intl.NumberFormat('vi-VN').format(n || 0);
  }

  formatPercent(n: number | undefined): string {
    return (n || 0).toFixed(1) + '%';
  }

  getAlertIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'warning': return '🟡';
      case 'info': return '🔵';
      default: return '⚪';
    }
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'active': return '✅ Đang vay';
      case 'draft': return '📝 Nháp';
      case 'closed': return '🔒 Đã đóng';
      default: return status;
    }
  }

  getDisbursementBadge(status: string): string {
    switch (status) {
      case 'pending': return '⏳ Chưa giải ngân';
      case 'partial': return '🔄 Giải ngân một phần';
      case 'fully': return '✅ Đã giải ngân';
      default: return status;
    }
  }
}
