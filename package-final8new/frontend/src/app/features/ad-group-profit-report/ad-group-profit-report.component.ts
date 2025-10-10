/**
 * File: features/ad-group-profit-report/ad-group-profit-report.component.ts
 * Mục đích: Component báo cáo lợi nhuận quảng cáo theo ngày (giống sản phẩm)
 */
import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize } from 'rxjs';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';
import { AdGroupDailyReport, AdGroupDailyRow, AdGroupDailyFilter, PeriodOption } from './models/ad-group-profit-report.model';
import { AdGroupService } from '../ad-group/ad-group.service';
import { ProductService } from '../product/product.service';
import { UserService } from '../user/user.service';

@Component({
  selector: 'app-ad-group-profit-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-group-profit-report.component.html',
  styleUrls: ['./ad-group-profit-report.component.css']
})
export class AdGroupProfitReportComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Signals for reactive state management
  report = signal<AdGroupDailyReport | null>(null);
  summary = signal<any>({});
  loading = signal<boolean>(false);
  error = signal<string>('');

  // Filter options
  adGroups = signal<any[]>([]);
  products = signal<any[]>([]);
  users = signal<any[]>([]);

  // Query parameters
  query: AdGroupDailyFilter = {
    period: '30days'
  };

  // Period options for dropdown
  periodOptions: PeriodOption[] = [
    { value: 'week', label: '7 ngày gần nhất' },
    { value: '10days', label: '10 ngày gần nhất' },
    { value: '30days', label: '30 ngày gần nhất' },
    { value: 'lastMonth', label: 'Tháng trước' },
    { value: 'thisMonth', label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chỉnh' }
  ];

  // Computed properties
  hasData = computed(() => !!this.report()?.data?.length);
  isCustomPeriod = computed(() => this.query.period === 'custom');

  // Date window slider state
  windowSize = signal<number>(30);
  startIndex = signal<number>(0);
  visibleDates = computed<string[]>(() => {
    const r = this.report();
    if (!r || !r.dates?.length) return [];
    const size = Math.max(1, Math.min(this.windowSize(), r.dates.length));
    const maxStart = Math.max(0, r.dates.length - size);
    const start = Math.max(0, Math.min(this.startIndex(), maxStart));
    return r.dates.slice(start, start + size);
  });

  maxStartIndex = computed<number>(() => {
    const len = this.report()?.dates?.length || 0;
    const size = Math.max(1, Math.min(this.windowSize(), len));
    return Math.max(0, len - size);
  });

  constructor(
    private profitReportService: AdGroupProfitReportService,
    private adGroupService: AdGroupService,
    private productService: ProductService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadFilterOptions();
    this.loadReport();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load filter options (ad groups, products, users)
   */
  loadFilterOptions(): void {
    // Load ad groups
    this.adGroupService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (adGroups: any[]) => this.adGroups.set(adGroups),
        error: (error: any) => console.error('Error loading ad groups:', error)
      });

    // Load products
    this.productService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products: any[]) => this.products.set(products),
        error: (error: any) => console.error('Error loading products:', error)
      });

    // Load users
    this.userService.getUsers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (users: any[]) => this.users.set(users),
        error: (error: any) => console.error('Error loading users:', error)
      });
  }

  /**
   * Load profit report data
   */
  loadReport(): void {
    this.loading.set(true);
    this.error.set('');

    this.profitReportService.getReport(this.query)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response: AdGroupDailyReport) => {
          this.report.set(response);
          this.summary.set(response.summary);
        },
        error: (error) => {
          this.error.set('Có lỗi xảy ra khi tải báo cáo: ' + error.message);
          console.error('Error loading report:', error);
        }
      });
  }

  /**
   * Handle period change
   */
  onPeriodChange(value: PeriodOption['value']): void {
    this.query.period = value;
    // Clear custom dates when not using custom period
    if (this.query.period !== 'custom') {
      this.query.fromDate = undefined;
      this.query.toDate = undefined;
    }
    this.loadReport();
  }

  /**
   * Handle filter change
   */
  onAdGroupChange(value: string): void {
    this.query.adGroupId = value || undefined;
    this.loadReport();
  }

  /**
   * Handle custom date change
   */
  setFromDate(value: string): void {
    this.query.fromDate = value || undefined;
    if (this.query.period !== 'custom') this.query.period = 'custom';
    if (this.query.fromDate && this.query.toDate) this.loadReport();
  }

  setToDate(value: string): void {
    this.query.toDate = value || undefined;
    if (this.query.period !== 'custom') this.query.period = 'custom';
    if (this.query.fromDate && this.query.toDate) this.loadReport();
  }

  /**
   * Date window slider handlers
   */
  setWindowSize(value: number): void {
    this.windowSize.set(Number(value));
    // Clamp startIndex if it exceeds bounds
    const r = this.report();
    if (r) {
      const maxStart = Math.max(0, r.dates.length - this.windowSize());
      if (this.startIndex() > maxStart) this.startIndex.set(maxStart);
    }
  }

  setStartIndex(value: number): void {
    const r = this.report();
    if (!r) { this.startIndex.set(0); return; }
    const size = Math.max(1, Math.min(this.windowSize(), r.dates.length));
    const maxStart = Math.max(0, r.dates.length - size);
    this.startIndex.set(Math.max(0, Math.min(Number(value), maxStart)));
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
  this.query = { period: '30days' };
    this.loadReport();
  }

  /**
   * Chart modal state & behavior (giống trang sản phẩm)
   */
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  showChartModal = signal(false);
  selectedAdGroupChart = signal<{
    adGroupId: string;
    adGroupName: string;
    chartData: { date: string; profit: number; revenue: number; cost: number }[];
  } | null>(null);

  showChart(row: AdGroupDailyRow): void {
    const r = this.report();
    if (!r) return;

    const chartData = r.dates.map(d => ({
      date: d,
      profit: row.dailyProfits[d] || 0,
      revenue: 0,
      cost: 0
    }));

    this.selectedAdGroupChart.set({
      adGroupId: row.adGroupId,
      adGroupName: row.adGroupName,
      chartData
    });

    this.showChartModal.set(true);

    // Delay to ensure canvas is in DOM
    setTimeout(() => this.drawChart(), 100);
  }

  closeChart(): void {
    this.showChartModal.set(false);
    this.selectedAdGroupChart.set(null);
  }

  getProfitClass(value: number): string {
    if (value > 0) return 'profit-positive';
    if (value < 0) return 'profit-negative';
    return 'profit-zero';
  }

  private drawChart(): void {
    const chart = this.selectedAdGroupChart();
    if (!chart || !this.chartCanvas) return;
    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const data = chart.chartData;
    if (!data.length) return;

    const padding = 60;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;

    const profits = data.map(d => d.profit);
    const minProfit = Math.min(...profits, 0);
    const maxProfit = Math.max(...profits, 0);
    const range = maxProfit - minProfit || 1;

    // Axes
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();

    // Zero line
    if (minProfit < 0) {
      const zeroY = padding + chartHeight - ((-minProfit / range) * chartHeight);
      ctx.strokeStyle = '#999';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding, zeroY);
      ctx.lineTo(padding + chartWidth, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Profit line
    if (data.length > 1) {
      ctx.strokeStyle = '#28a745';
      ctx.lineWidth = 3;
      ctx.beginPath();
      data.forEach((p, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((p.profit - minProfit) / range) * chartHeight;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Points
      ctx.fillStyle = '#28a745';
      data.forEach((p, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((p.profit - minProfit) / range) * chartHeight;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    data.forEach((p, i) => {
      const x = padding + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const label = this.formatDate(p.date);
      ctx.fillText(label, x, canvas.height - 20);
    });

    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = minProfit + (range * i / 5);
      const y = padding + chartHeight - (i / 5) * chartHeight;
      ctx.fillText(this.formatCurrency(value), padding - 10, y + 4);
    }

    // Title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Biểu đồ lợi nhuận: ${chart.adGroupName}`, canvas.width / 2, 30);
  }

  getTotalChartProfit(): number {
    const c = this.selectedAdGroupChart();
    if (!c) return 0;
    return c.chartData.reduce((s, p) => s + p.profit, 0);
  }

  getAverageChartProfit(): number {
    const c = this.selectedAdGroupChart();
    if (!c || !c.chartData.length) return 0;
    return this.getTotalChartProfit() / c.chartData.length;
  }

  getBestChartDay(): string {
    const c = this.selectedAdGroupChart();
    if (!c || !c.chartData.length) return 'N/A';
    const best = c.chartData.reduce((b, cur) => cur.profit > b.profit ? cur : b);
    return `${this.formatDate(best.date)} (${this.formatCurrency(best.profit)})`;
  }

  /**
   * Export report to Excel
   */
  exportToCSV(): void {
    const r = this.report();
    if (!r || !r.data.length) return;
    const headers = ['Nhóm quảng cáo', ...r.dates.map(d => this.formatDate(d)), 'Tổng lợi nhuận'];
    const rows = r.data.map(row => [
      row.adGroupName,
      ...r.dates.map(d => row.dailyProfits[d] || 0),
      row.totalProfit
    ]);
    const csv = [headers, ...rows].map(line => line.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bao-cao-loi-nhuan-quang-cao-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  /**
   * Format percentage
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }
}
