import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LoanService, LoanContract } from './loan.service';

@Component({
  selector: 'app-loan-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './loan-list.component.html',
  styleUrls: ['./loan-list.component.css']
})
export class LoanListComponent implements OnInit {
  loans = signal<LoanContract[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  filterStatus = signal<string>('');

  constructor(private loanService: LoanService) {}

  totalPrincipal = computed(() => this.loans().reduce((s, l) => s + (l.principal || 0), 0));
  totalRemaining = computed(() => this.loans().reduce((s, l) => s + (l.principalRemaining || 0), 0));

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.loanService.listLoans(this.filterStatus() || undefined).subscribe({
      next: (data) => { this.loans.set(data || []); this.loading.set(false); },
      error: (err) => { console.error(err); this.error.set('Không tải được danh sách khoản vay'); this.loading.set(false); }
    });
  }

  onFilterChange(status: string) {
    this.filterStatus.set(status);
    this.load();
  }

  formatCurrency(n: number | undefined) { return new Intl.NumberFormat('vi-VN').format(n || 0); }
}
