/**
 * Product Profit Report Component
 * Hiển thị báo cáo lợi nhuận sản phẩm theo ngày từ dữ liệu Summary5 với biểu đồ tăng trưởng
 */
import { Component, OnInit, computed, signal, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { 
  ProductProfitFilter, 
  ProductProfitReport, 
  ProductProfitRow,
  Product,
  ProductChartData,
  ChartDataPoint
} from './models/product-profit.interface';
import { ProductProfitReportService } from './product-profit-report.service';

@Component({
  selector: 'app-product-profit-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-profit-report.component.html',
  styleUrls: ['./product-profit-report.component.css']
})
export class ProductProfitReportComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  // Signals cho reactive state
  report = signal<ProductProfitReport | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  availableYears = signal<number[]>([]);
  products = signal<Product[]>([]);

  // Chart state
  showChartModal = signal(false);
  selectedProductChart = signal<ProductChartData | null>(null);

  // Filter state
  filter = signal<ProductProfitFilter>({
    period: '30days'
  });

  // Period options
  periodOptions = [
    { value: 'week', label: 'Tuần gần nhất' },
    { value: '10days', label: '10 ngày gần nhất' },
    { value: '30days', label: '30 ngày gần nhất' },
    { value: 'lastMonth', label: 'Tháng trước' },
    { value: 'thisMonth', label: 'Tháng này' },
    { value: 'custom', label: 'Tùy chọn' }
  ];

  // Computed values
  isCustomPeriod = computed(() => this.filter().period === 'custom');
  hasData = computed(() => (this.report()?.data?.length || 0) > 0);
  
  constructor(
    private productProfitService: ProductProfitReportService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await this.loadInitialData();
    await this.loadReport();
  }

  ngAfterViewInit() {
    // Chart canvas sẽ được khởi tạo khi modal mở
  }

  /**
   * Load dữ liệu ban đầu
   */
  async loadInitialData() {
    try {
      // Load available years
      const yearsResponse = await firstValueFrom(this.productProfitService.getAvailableYears());
      this.availableYears.set(yearsResponse.years);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  /**
   * Load báo cáo
   */
  async loadReport() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const reportData = await firstValueFrom(
        this.productProfitService.getProductProfitReport(this.filter())
      );
      this.report.set(reportData);
    } catch (error) {
      this.error.set('Có lỗi xảy ra khi tải dữ liệu báo cáo');
      console.error('Error loading report:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Update filter và reload report
   */
  updateFilter(key: keyof ProductProfitFilter, value: any) {
    this.filter.update(f => ({ ...f, [key]: value }));
    this.loadReport();
  }

  /**
   * Update year filter
   */
  updateFilterYear(event: Event) {
    const target = event.target as HTMLSelectElement;
    const value = target.value ? +target.value : undefined;
    this.updateFilter('year', value);
  }

  /**
   * Update period filter
   */
  updateFilterPeriod(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.updateFilter('period', target.value);
  }

  /**
   * Update product name filter
   */
  updateFilterProductName(event: Event) {
    const target = event.target as HTMLInputElement;
    this.updateFilter('productName', target.value || undefined);
  }

  /**
   * Update from date filter
   */
  updateFilterFromDate(event: Event) {
    const target = event.target as HTMLInputElement;
    this.updateFilter('fromDate', target.value);
  }

  /**
   * Update to date filter
   */
  updateFilterToDate(event: Event) {
    const target = event.target as HTMLInputElement;
    this.updateFilter('toDate', target.value);
  }

  /**
   * Reset filter về mặc định
   */
  resetFilter() {
    this.filter.set({
      period: '30days'
    });
    this.loadReport();
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
   * Format date for display
   */
  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit'
    });
  }

  /**
   * Get profit class for styling
   */
  getProfitClass(profit: number): string {
    if (profit > 0) return 'profit-positive';
    if (profit < 0) return 'profit-negative';
    return 'profit-zero';
  }

  /**
   * Export to CSV
   */
  exportToCSV() {
    const reportData = this.report();
    if (!reportData || !reportData.data.length) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    const headers = ['Sản phẩm', ...reportData.dates.map(d => this.formatDate(d)), 'Tổng lợi nhuận'];
    const rows = reportData.data.map(row => [
      row.productName,
      ...reportData.dates.map(date => row.dailyProfits[date] || 0),
      row.totalProfit
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bao-cao-loi-nhuan-san-pham-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  /**
   * Hiển thị biểu đồ cho sản phẩm
   */
  showChart(productRow: ProductProfitRow) {
    const reportData = this.report();
    if (!reportData) return;

    // Tạo dữ liệu biểu đồ từ productRow
    const chartData: ChartDataPoint[] = reportData.dates.map(date => ({
      date,
      profit: productRow.dailyProfits[date] || 0,
      revenue: 0, // Sẽ cần tính từ API nếu muốn hiển thị
      cost: 0     // Sẽ cần tính từ API nếu muốn hiển thị
    }));

    this.selectedProductChart.set({
      productId: productRow.productId,
      productName: productRow.productName,
      chartData
    });

    this.showChartModal.set(true);

    // Vẽ biểu đồ sau khi modal đã hiển thị
    setTimeout(() => this.drawChart(), 100);
  }

  /**
   * Đóng modal biểu đồ
   */
  closeChart() {
    this.showChartModal.set(false);
    this.selectedProductChart.set(null);
  }

  /**
   * Vẽ biểu đồ trên canvas
   */
  private drawChart() {
    const chartData = this.selectedProductChart();
    if (!chartData || !this.chartCanvas) return;

    const canvas = this.chartCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { chartData: data } = chartData;
    if (!data.length) return;

    // Chart dimensions and padding
    const padding = 60;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;

    // Find min/max values for scaling
    const profits = data.map(d => d.profit);
    const minProfit = Math.min(...profits, 0);
    const maxProfit = Math.max(...profits, 0);
    const range = maxProfit - minProfit || 1;

    // Draw axes
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

    // Draw zero line if needed
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

    // Draw profit line
    if (data.length > 1) {
      ctx.strokeStyle = '#28a745';
      ctx.lineWidth = 3;
      ctx.beginPath();

      data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((point.profit - minProfit) / range) * chartHeight;
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // Draw data points
      ctx.fillStyle = '#28a745';
      data.forEach((point, index) => {
        const x = padding + (index / (data.length - 1)) * chartWidth;
        const y = padding + chartHeight - ((point.profit - minProfit) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    // X-axis labels (dates)
    data.forEach((point, index) => {
      const x = padding + (index / Math.max(data.length - 1, 1)) * chartWidth;
      const label = this.formatDate(point.date);
      ctx.fillText(label, x, canvas.height - 20);
    });

    // Y-axis labels (profits)
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = minProfit + (range * i / 5);
      const y = padding + chartHeight - (i / 5) * chartHeight;
      ctx.fillText(this.formatCurrency(value), padding - 10, y + 4);
    }

    // Chart title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Biểu đồ lợi nhuận: ${chartData.productName}`, canvas.width / 2, 30);
  }

  /**
   * Tính tổng lợi nhuận của sản phẩm đang xem biểu đồ
   */
  getTotalProfit(): number {
    const chartData = this.selectedProductChart();
    if (!chartData) return 0;
    return chartData.chartData.reduce((sum, point) => sum + point.profit, 0);
  }

  /**
   * Tính lợi nhuận trung bình/ngày
   */
  getAverageProfit(): number {
    const chartData = this.selectedProductChart();
    if (!chartData || !chartData.chartData.length) return 0;
    return this.getTotalProfit() / chartData.chartData.length;
  }

  /**
   * Tìm ngày có lợi nhuận cao nhất
   */
  getBestDay(): string {
    const chartData = this.selectedProductChart();
    if (!chartData || !chartData.chartData.length) return 'N/A';
    
    const bestDay = chartData.chartData.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );
    
    return `${this.formatDate(bestDay.date)} (${this.formatCurrency(bestDay.profit)})`;
  }
}
