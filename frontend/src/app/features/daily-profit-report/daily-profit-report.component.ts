import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DailyProfitReportService, DailyProfitReport } from './daily-profit-report.service';

@Component({
  selector: 'app-daily-profit-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-profit-report.component.html',
  styleUrl: './daily-profit-report.component.css'
})
export class DailyProfitReportComponent implements OnInit {
  private service = inject(DailyProfitReportService);

  report = signal<DailyProfitReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedDate = signal(new Date().toISOString().split('T')[0]);

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    this.error.set(null);
    
    this.service.getDailyProfitReport(this.selectedDate()).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Không thể tải báo cáo: ' + (err.error?.message || err.message));
        this.loading.set(false);
      }
    });
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(input.value);
    this.loadReport();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }
}
