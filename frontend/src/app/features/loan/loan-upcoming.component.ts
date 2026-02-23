import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LoanService, LoanRepayment } from './loan.service';

@Component({
  selector: 'app-loan-upcoming',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loan-upcoming.component.html',
  styleUrls: ['./loan-upcoming.component.css']
})
export class LoanUpcomingComponent implements OnInit {
  repayments = signal<LoanRepayment[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private loanService: LoanService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.loanService.listUpcomingRepayments(14).subscribe({
      next: (data) => { this.repayments.set(data || []); this.loading.set(false); },
      error: (err) => { console.error(err); this.error.set('Không tải được danh sách đến hạn'); this.loading.set(false); }
    });
  }

  formatCurrency(n: number | undefined) { return new Intl.NumberFormat('vi-VN').format(n || 0); }
}
