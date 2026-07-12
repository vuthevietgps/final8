import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LoanService, PaymentOptions, CreatePaymentRequest, PaymentResult } from './loan.service';

@Component({
  selector: 'app-loan-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './loan-payment.component.html',
  styleUrls: ['./loan-payment.component.css']
})
export class LoanPaymentComponent implements OnInit {
  loanId = '';
  private requestedRepaymentId = '';
  options = signal<PaymentOptions | null>(null);
  loading = signal(false);
  submitting = signal(false);
  error = signal<string | null>(null);
  success = signal<PaymentResult | null>(null);

  // Form data
  paymentType = signal<'principal' | 'interest' | 'scheduled' | 'payoff'>('principal');
  amount = signal<number>(0);
  source = signal<'bank_balance' | 'owner_fund'>('bank_balance');
  sourceAccountId = signal<string>('');
  selectedRepaymentId = signal<string>('');
  notes = signal<string>('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private loanService: LoanService
  ) {}

  // Computed values
  maxAmount = computed(() => {
    const opts = this.options();
    if (!opts) return 0;
    
    switch (this.paymentType()) {
      case 'principal':
        return opts.options.principalPayment.maxAmount;
      case 'interest':
        return opts.options.interestPayment.currentMonthInterest;
      case 'scheduled':
        const selected = opts.options.scheduledPayments.find(
          p => p.repaymentId === this.selectedRepaymentId()
        );
        return selected?.total || 0;
      case 'payoff':
        return opts.options.fullPayoff.totalPayoff;
      default:
        return 0;
    }
  });

  availableBalance = computed(() => {
    const opts = this.options();
    if (!opts) return 0;
    
    if (this.source() === 'bank_balance') {
      return opts.sources.bankBalance.available;
    } else {
      const account = opts.sources.ownerFund.accounts.find(
        a => a.id === this.sourceAccountId()
      );
      return account?.balance || opts.sources.ownerFund.available;
    }
  });

  canSubmit = computed(() => {
    const opts = this.options();
    if (!opts) return false;
    if (this.amount() <= 0) return false;
    if (this.amount() > this.availableBalance()) return false;
    if (this.source() === 'owner_fund' && !this.sourceAccountId()) return false;
    if (this.paymentType() === 'scheduled' && !this.selectedRepaymentId()) return false;
    return true;
  });

  estimatedSavings = computed(() => {
    const opts = this.options();
    if (!opts || this.paymentType() !== 'principal') return null;
    
    const rate = opts.loan.interestRate || 0;
    const principal = this.amount();
    const monthlySaved = principal * (rate / 100 / 12);
    const annualSaved = monthlySaved * 12;
    
    return { monthlySaved, annualSaved };
  });

  ngOnInit() {
    this.loanId = this.route.snapshot.paramMap.get('id') || '';
    this.requestedRepaymentId = this.route.snapshot.queryParamMap.get('repaymentId') || '';
    if (this.loanId) {
      this.loadOptions();
    }
  }

  loadOptions() {
    this.loading.set(true);
    this.error.set(null);
    
    this.loanService.getPaymentOptions(this.loanId).subscribe({
      next: (data) => {
        this.options.set(data);
        this.loading.set(false);
        
        // Set default values
        this.amount.set(data.options.principalPayment.suggestedAmount);
        if (data.sources.ownerFund.accounts.length > 0) {
          this.sourceAccountId.set(data.sources.ownerFund.accounts[0].id);
        }
        const requestedRepayment = data.options.scheduledPayments.find(
          payment => payment.repaymentId === this.requestedRepaymentId,
        );
        if (requestedRepayment) {
          this.paymentType.set('scheduled');
          this.selectedRepaymentId.set(requestedRepayment.repaymentId);
          this.amount.set(requestedRepayment.total);
        }
      },
      error: (err) => {
        console.error('Failed to load payment options:', err);
        this.error.set('Không tải được thông tin thanh toán');
        this.loading.set(false);
      }
    });
  }

  onPaymentTypeChange(type: 'principal' | 'interest' | 'scheduled' | 'payoff') {
    this.paymentType.set(type);
    
    // Update amount based on type
    const opts = this.options();
    if (!opts) return;
    
    switch (type) {
      case 'principal':
        this.amount.set(opts.options.principalPayment.suggestedAmount);
        break;
      case 'interest':
        this.amount.set(opts.options.interestPayment.currentMonthInterest);
        break;
      case 'payoff':
        this.amount.set(opts.options.fullPayoff.totalPayoff);
        break;
      case 'scheduled':
        if (opts.options.scheduledPayments.length > 0) {
          const first = opts.options.scheduledPayments[0];
          this.selectedRepaymentId.set(first.repaymentId);
          this.amount.set(first.total);
        }
        break;
    }
  }

  onScheduledPaymentSelect(repaymentId: string) {
    this.selectedRepaymentId.set(repaymentId);
    const opts = this.options();
    const selected = opts?.options.scheduledPayments.find(p => p.repaymentId === repaymentId);
    if (selected) {
      this.amount.set(selected.total);
    }
  }

  onSourceChange(source: 'bank_balance' | 'owner_fund') {
    this.source.set(source);
  }

  submitPayment() {
    if (!this.canSubmit()) return;
    
    this.submitting.set(true);
    this.error.set(null);
    
    const payload: CreatePaymentRequest = {
      paymentType: this.paymentType(),
      amount: this.amount(),
      source: this.source(),
      notes: this.notes() || undefined,
    };
    
    if (this.source() === 'owner_fund') {
      payload.sourceAccountId = this.sourceAccountId();
    }
    
    if (this.paymentType() === 'scheduled') {
      payload.repaymentId = this.selectedRepaymentId();
    }
    
    this.loanService.createPayment(this.loanId, payload).subscribe({
      next: (result) => {
        this.success.set(result);
        this.submitting.set(false);
      },
      error: (err) => {
        console.error('Payment failed:', err);
        this.error.set(err.error?.message || 'Thanh toán thất bại');
        this.submitting.set(false);
      }
    });
  }

  goBack() {
    this.router.navigate(['/loans', this.loanId]);
  }

  goToDashboard() {
    this.router.navigate(['/loans/dashboard']);
  }

  formatCurrency(n: number | undefined): string {
    return new Intl.NumberFormat('vi-VN').format(n || 0);
  }

  formatPercent(n: number | undefined): string {
    return (n || 0).toFixed(1) + '%';
  }
}
