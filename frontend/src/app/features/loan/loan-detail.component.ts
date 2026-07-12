import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoanService, LoanContract, LoanRepayment } from './loan.service';

@Component({
  selector: 'app-loan-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './loan-detail.component.html',
  styleUrls: ['./loan-detail.component.css']
})
export class LoanDetailComponent implements OnInit {
  loan = signal<LoanContract | null>(null);
  repayments = signal<LoanRepayment[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Modal giải ngân
  showDisbursementModal = false;
  disbursementForm = { amount: 0, date: '', notes: '' };
  disbursementLoading = false;

  // Modal trả nợ
  showPaymentModal = false;
  selectedRepayment: LoanRepayment | null = null;
  paymentForm = { paidDate: '', referenceId: '', notes: '' };
  paymentLoading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanService: LoanService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.load(id);
    // Set default date
    this.disbursementForm.date = new Date().toISOString().split('T')[0];
    this.paymentForm.paidDate = new Date().toISOString().split('T')[0];
  }

  load(id: string) {
    this.loading.set(true);
    this.error.set(null);
    this.loanService.getLoan(id).subscribe({
      next: (loan) => { this.loan.set(loan); this.loading.set(false); },
      error: (err) => { console.error(err); this.error.set('Không tải được khoản vay'); this.loading.set(false); }
    });
    this.loanService.listRepayments(id).subscribe({
      next: (data) => this.repayments.set(data || []),
      error: (err) => { console.error(err); }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // GIẢI NGÂN
  // ═══════════════════════════════════════════════════════════

  openDisbursementModal() {
    const loan = this.loan();
    if (!loan) return;
    this.disbursementForm.amount = (loan.principal || 0) - (loan.disbursedAmount || 0);
    this.showDisbursementModal = true;
  }

  closeDisbursementModal() {
    this.showDisbursementModal = false;
  }

  submitDisbursement() {
    const loan = this.loan();
    if (!loan?._id || this.disbursementForm.amount <= 0) return;

    this.disbursementLoading = true;
    this.loanService.recordDisbursement(loan._id, {
      amount: this.disbursementForm.amount,
      date: this.disbursementForm.date || undefined,
      notes: this.disbursementForm.notes || undefined,
    }).subscribe({
      next: (updated) => {
        this.loan.set(updated);
        this.disbursementLoading = false;
        this.showDisbursementModal = false;
      },
      error: (err) => {
        console.error(err);
        this.disbursementLoading = false;
        alert('Lỗi khi ghi nhận giải ngân');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════
  // TRẢ NỢ
  // ═══════════════════════════════════════════════════════════

  openPaymentModal(rep: LoanRepayment) {
    const loanId = this.loan()?._id;
    if (!loanId || !rep._id) return;
    void this.router.navigate(['/loans', loanId, 'pay'], {
      queryParams: { repaymentId: rep._id },
    });
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.selectedRepayment = null;
  }

  submitPayment() {
    const rep = this.selectedRepayment;
    if (!rep?._id) return;

    this.paymentLoading = true;
    this.loanService.markRepaymentPaid(rep._id, {
      paidDate: this.paymentForm.paidDate || undefined,
      referenceId: this.paymentForm.referenceId || undefined,
      notes: this.paymentForm.notes || undefined,
    }).subscribe({
      next: () => {
        this.paymentLoading = false;
        this.showPaymentModal = false;
        // Reload data
        const id = this.loan()?._id;
        if (id) this.load(id);
      },
      error: (err) => {
        console.error(err);
        this.paymentLoading = false;
        alert('Lỗi khi ghi nhận thanh toán');
      }
    });
  }

  getDisbursementStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      pending: '⏳ Chưa giải ngân',
      partial: '🔄 Giải ngân một phần',
      fully: '✅ Đã giải ngân đầy đủ'
    };
    return labels[status || 'pending'] || '⏳ Chưa giải ngân';
  }

  isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  formatCurrency(n: number | undefined) { return new Intl.NumberFormat('vi-VN').format(n || 0); }
}
