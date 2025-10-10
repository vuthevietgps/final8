/**
 * File: features/ad-group-profit/ad-group-profit.component.ts
 * Mục đích: Component hiển thị báo cáo lợi nhuận theo nhóm quảng cáo theo ngày
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdGroupProfitService } from './ad-group-profit.service';
import { AdGroupProfitReport, AdGroupProfitStats } from './models/ad-group-profit.interface';

@Component({
  selector: 'app-ad-group-profit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-group-profit.component.html',
  styleUrls: ['./ad-group-profit.component.css']
})
export class AdGroupProfitComponent implements OnInit {
  // Signals cho reactive state management
  reports = signal<AdGroupProfitReport[]>([]);
  stats = signal<AdGroupProfitStats>({
    totalProfit: 0,
    totalOrders: 0,
    totalAdGroups: 0,
    avgProfitPerOrder: 0
  });
  loading = signal<boolean>(false);
  error = signal<string>('');

  // Form filters
  filters = {
    from: '',
    to: '',
    agentId: ''
  };

  constructor(private adGroupProfitService: AdGroupProfitService) {
    // Khởi tạo ngày mặc định (7 ngày gần đây)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    this.filters.to = today.toISOString().split('T')[0];
    this.filters.from = weekAgo.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Tải dữ liệu báo cáo và thống kê
   */
  loadData(): void {
    this.loading.set(true);
    this.error.set('');

    // Tải báo cáo
    this.adGroupProfitService.getReport(this.filters).subscribe({
      next: (data) => {
        this.reports.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Lỗi khi tải báo cáo:', err);
        this.error.set('Không thể tải dữ liệu báo cáo');
        this.loading.set(false);
      }
    });

    // Tải thống kê
    this.adGroupProfitService.getStats(this.filters).subscribe({
      next: (data) => {
        this.stats.set(data);
      },
      error: (err) => {
        console.error('Lỗi khi tải thống kê:', err);
      }
    });
  }

  /**
   * Áp dụng bộ lọc
   */
  applyFilters(): void {
    this.loadData();
  }

  /**
   * Đặt lại bộ lọc về mặc định
   */
  resetFilters(): void {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    this.filters = {
      from: weekAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
      agentId: ''
    };
    
    this.loadData();
  }

  /**
   * Xuất dữ liệu ra CSV
   */
  exportToCSV(): void {
    const reports = this.reports();
    if (reports.length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    const headers = [
      'Ngày Tháng',
      'Nhóm Quảng Cáo',
      'ID Nhóm',
      'Chi Phí QC (QC2)',
      'Lợi Nhuận (Summary2)'
    ];

    const csvContent = [
      headers.join(','),
      ...reports.map(report => [
        report.date,
        `"${report.adGroupName}"`,
        `"${report.adGroupId}"`,
        report.adsCost,
        report.totalProfit
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
  link.download = `loi_nhuan_va_chi_phi_quang_cao_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  /**
   * Format number with Vietnamese locale
   */
  formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  /**
   * Format currency with VND
   */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  }

  /**
   * Format date to Vietnamese format
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  }

  /**
   * Get color class for profit value
   */
  getProfitColorClass(profit: number): string {
    if (profit > 0) return 'profit-positive';
    if (profit < 0) return 'profit-negative';
    return 'profit-neutral';
  }

  /**
   * TrackBy function for ngFor optimization
   */
  trackByDate(index: number, item: AdGroupProfitReport): string {
    return `${item.date}_${item.adGroupName}`;
  }
}
