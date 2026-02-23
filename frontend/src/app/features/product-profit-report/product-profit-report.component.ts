import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductProfitReportService, ProductProfitReport, ProductProfit } from './product-profit-report.service';

@Component({
  selector: 'app-product-profit-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-profit-report.component.html',
  styleUrl: './product-profit-report.component.css'
})
export class ProductProfitReportComponent implements OnInit {
  private service = inject(ProductProfitReportService);

  report = signal<ProductProfitReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  
  // Date range selection
  dateMode = signal<'single' | 'range'>('single');
  selectedDate = signal(new Date().toISOString().split('T')[0]);
  fromDate = signal(new Date().toISOString().split('T')[0]);
  toDate = signal(new Date().toISOString().split('T')[0]);

  // Sorting
  sortColumn = signal<keyof ProductProfit>('netProfit');
  sortDirection = signal<'asc' | 'desc'>('desc');

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    this.error.set(null);
    
    const params = this.dateMode() === 'single' 
      ? { date: this.selectedDate() }
      : { from: this.fromDate(), to: this.toDate() };
    
    this.service.getProductProfitReport(params).subscribe({
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

  onDateModeChange(mode: 'single' | 'range') {
    this.dateMode.set(mode);
    this.loadReport();
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(input.value);
    this.loadReport();
  }

  onFromDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.fromDate.set(input.value);
    if (new Date(input.value) <= new Date(this.toDate())) {
      this.loadReport();
    }
  }

  onToDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.toDate.set(input.value);
    if (new Date(this.fromDate()) <= new Date(input.value)) {
      this.loadReport();
    }
  }

  sortBy(column: keyof ProductProfit) {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('desc');
    }
  }

  getSortedProducts(): ProductProfit[] {
    const products = this.report()?.products || [];
    const col = this.sortColumn();
    const dir = this.sortDirection();
    
    return [...products].sort((a, b) => {
      const aVal = a[col];
      const bVal = b[col];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
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

  formatPercent(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'percent',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value / 100);
  }

  getProfitClass(profit: number): string {
    if (profit > 0) return 'positive';
    if (profit < 0) return 'negative';
    return '';
  }
}
