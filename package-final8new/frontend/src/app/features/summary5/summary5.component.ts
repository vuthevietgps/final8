import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Summary5Service } from './summary5.service';
import { Summary5, Summary5Filter, Summary5Stats } from './models/summary5.interface';

@Component({
  selector: 'app-summary5',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './summary5.component.html',
  styleUrls: ['./summary5.component.css']
})
export class Summary5Component implements OnInit {
  data = signal<Summary5[]>([]);
  stats = signal<Summary5Stats | null>(null);
  loading = signal(false);
  syncLoading = signal(false);
  sync7DaysLoading = signal(false);
  refreshLoading = signal(false);
  error = signal<string | null>(null);
  lastSynced = signal<number | null>(null);
  successMessage = signal<string | null>(null);

  filter = signal<Summary5Filter>({ page: 1, limit: 50, sortBy: 'orderDate', sortOrder: 'desc' });
  totalRecords = signal(0);
  currentPage = signal(1);
  totalPages = signal(0);
  searchTerm = signal('');
  showFilters = signal(false);

  filteredData = computed(() => {
    const t = this.searchTerm().toLowerCase();
    if (!t) return this.data();
    return this.data().filter(x =>
      x.customerName?.toLowerCase().includes(t) ||
      x.agentName?.toLowerCase().includes(t) ||
      x.product?.toLowerCase().includes(t)
    );
  });

  constructor(private svc: Summary5Service) {}

  ngOnInit() { this.load(); this.loadStats(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.svc.findAll(this.filter()).subscribe({
      next: (res) => { 
        this.data.set(res.data); 
        this.totalRecords.set(res.total); 
        this.currentPage.set(res.page); 
        this.totalPages.set(res.totalPages); 
        this.loading.set(false); 
      },
      error: (e) => { 
        this.error.set(e.message || 'Lỗi tải dữ liệu'); 
        this.loading.set(false); 
      }
    });
  }

  loadStats() {
    const { startDate, endDate } = this.filter();
    this.error.set(null);
    // Stats support optional date-range; align with current filters if set
    this.svc.getStats(startDate, endDate).subscribe({
      next: s => this.stats.set(s),
      error: e => this.error.set(e.message || 'Lỗi tải thống kê')
    });
  }

  sync() {
    this.syncLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    const { startDate, endDate } = this.filter();
    this.svc.sync(startDate, endDate).subscribe({
      next: (res) => { 
        this.lastSynced.set(res?.synced ?? 0); 
        this.successMessage.set(`Đồng bộ thành công! Đã xử lý ${res?.synced || 0} bản ghi.`);
        this.refresh(); 
        this.syncLoading.set(false); 
        // Auto hide success message after 3 seconds
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (e) => { 
        this.error.set(e.message || 'Lỗi đồng bộ'); 
        this.syncLoading.set(false); 
      }
    });
  }
  refresh() { 
    this.refreshLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    
    // Load both data and stats
    Promise.all([
      this.svc.findAll(this.filter()).toPromise(),
      this.svc.getStats(this.filter().startDate, this.filter().endDate).toPromise()
    ]).then(([dataRes, statsRes]) => {
      if (dataRes) {
        this.data.set(dataRes.data); 
        this.totalRecords.set(dataRes.total); 
        this.currentPage.set(dataRes.page); 
        this.totalPages.set(dataRes.totalPages);
      }
      if (statsRes) {
        this.stats.set(statsRes);
      }
      this.successMessage.set('Làm mới dữ liệu thành công!');
      this.refreshLoading.set(false);
      // Auto hide success message after 2 seconds
      setTimeout(() => this.successMessage.set(null), 2000);
    }).catch((error) => {
      this.error.set(error.message || 'Lỗi làm mới dữ liệu');
      this.refreshLoading.set(false);
    });
  }

  syncLast7Days() {
    this.sync7DaysLoading.set(true);
    this.error.set(null);
    this.successMessage.set(null);
    
    // Compute last 7 days (inclusive today)
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const toISODate = (d: Date) => d.toISOString().slice(0, 10);
    
    // Update filters to last 7 days
    this.filter.update(f => ({ ...f, startDate: toISODate(start), endDate: toISODate(end) }));
    
    // Trigger sync for this range
    this.svc.sync(toISODate(start), toISODate(end)).subscribe({
      next: (res) => { 
        this.lastSynced.set(res?.synced ?? 0); 
        this.successMessage.set(`Đồng bộ 7 ngày thành công! Đã xử lý ${res?.synced || 0} bản ghi từ ${toISODate(start)} đến ${toISODate(end)}.`);
        this.refresh(); 
        this.sync7DaysLoading.set(false); 
        // Auto hide success message after 4 seconds (longer text)
        setTimeout(() => this.successMessage.set(null), 4000);
      },
      error: (e) => { 
        this.error.set(e.message || 'Lỗi đồng bộ 7 ngày'); 
        this.sync7DaysLoading.set(false); 
      }
    });
  }
  updateFilter(field: keyof Summary5Filter, value: any) {
    this.filter.update(f => ({ ...f, [field]: value, page: 1 }));
    this.load();
    this.loadStats();
  }

  goToPage(p: number) { if (p < 1) return; this.filter.update(f => ({ ...f, page: p })); this.load(); }
  changePageSize(limit: number) { const n = Number(limit)||50; this.filter.update(f => ({ ...f, limit: n, page: 1 })); this.load(); }
  displayFrom(): number { const total = this.totalRecords(); if (!total) return 0; const limit = this.filter().limit || 50; return (this.currentPage()-1)*limit + 1; }
  displayTo(): number { const total = this.totalRecords(); if (!total) return 0; const limit = this.filter().limit || 50; const to = this.currentPage()*limit; return to>total?total:to; }
  formatCurrency(n: number) { return (n||0).toLocaleString('vi-VN') + ' ₫'; }
  formatDate(s: string) { return new Date(s).toLocaleDateString('vi-VN'); }
}
