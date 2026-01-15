import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { LoanService, LoanContract, LoanRepayment } from './loan.service';

@Component({
  selector: 'app-loan-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loan-detail.component.html',
  styleUrls: ['./loan-detail.component.css']
})
export class LoanDetailComponent implements OnInit {
  loan = signal<LoanContract | null>(null);
  repayments = signal<LoanRepayment[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private route: ActivatedRoute, private loanService: LoanService) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.load(id);
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

  formatCurrency(n: number | undefined) { return new Intl.NumberFormat('vi-VN').format(n || 0); }
}
