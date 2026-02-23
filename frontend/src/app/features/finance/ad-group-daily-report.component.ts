import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { AdGroupDailyReportResponse, TopAdGroup, OptimalSpendSuggestion } from './ad-group-daily-report.model';

@Component({
  selector: 'app-ad-group-daily-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ad-group-daily-report.component.html',
  styleUrls: ['./ad-group-daily-report.component.css']
})
export class AdGroupDailyReportComponent implements OnInit {
  private fb = inject(FormBuilder);
  private service = inject(AdGroupDailyReportService);

  // Signals
  reportData = signal<AdGroupDailyReportResponse | null>(null);
  topAdGroups = signal<TopAdGroup[]>([]);
  optimalSpendSuggestions = signal<OptimalSpendSuggestion[]>([]);
  totalSuggestedSpend = signal<number>(0);
  totalSuggestedSpendWithCap = signal<number>(0);
  totalCurrentSpend = signal<number>(0);
  loading = signal(false);
  syncing = signal(false);
  error = signal<string | null>(null);
  syncMessage = signal<string | null>(null);
  activeTab = signal<'daily' | 'optimal'>('daily');

  // Form
  filterForm = this.fb.group({
    fromDate: [''],
    toDate: [''],
    adGroupId: [''],
    platform: ['']
  });

  topForm = this.fb.group({
    fromDate: [''],
    toDate: [''],
    limit: [10],
    sortBy: ['profit']
  });

  ngOnInit(): void {
    // Set default date range (last 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    this.filterForm.patchValue({
      fromDate: this.formatDate(sevenDaysAgo),
      toDate: this.formatDate(today)
    });

    this.topForm.patchValue({
      fromDate: this.formatDate(sevenDaysAgo),
      toDate: this.formatDate(today)
    });

    this.loadReport();
    this.loadTopAdGroups();
    this.loadOptimalSpendSuggestions();
  }

  setTab(tab: 'daily' | 'optimal'): void {
    this.activeTab.set(tab);
  }

  loadReport(): void {
    this.loading.set(true);
    this.error.set(null);

    const formValue = this.filterForm.value;
    const params: any = {};
    if (formValue.fromDate) params.fromDate = formValue.fromDate;
    if (formValue.toDate) params.toDate = formValue.toDate;
    if (formValue.adGroupId) params.adGroupId = formValue.adGroupId;
    if (formValue.platform) params.platform = formValue.platform;

    this.service.getReport(params).subscribe({
      next: (data) => {
        this.reportData.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Lỗi tải dữ liệu: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  loadTopAdGroups(): void {
    const formValue = this.topForm.value;
    const params: any = {};
    if (formValue.fromDate) params.fromDate = formValue.fromDate;
    if (formValue.toDate) params.toDate = formValue.toDate;
    if (formValue.limit) params.limit = formValue.limit;
    if (formValue.sortBy) params.sortBy = formValue.sortBy;

    this.service.getTopAdGroups(params).subscribe({
      next: (data) => {
        this.topAdGroups.set(data.topAdGroups || []);
      },
      error: (err) => {
        console.error('Error loading top ad groups:', err);
      }
    });
  }

  loadOptimalSpendSuggestions(): void {
    this.service.getOptimalSpendSuggestions().subscribe({
      next: (data) => {
        this.optimalSpendSuggestions.set(data.adGroupSuggestions || []);
        this.totalSuggestedSpend.set(data.totalSuggestedSpend || 0);
        this.totalSuggestedSpendWithCap.set(data.totalSuggestedSpendWithCap || 0);
        this.totalCurrentSpend.set(data.totalCurrentSpend || 0);
      },
      error: (err) => {
        console.error('Error loading optimal spend suggestions:', err);
      }
    });
  }

  onFilterSubmit(): void {
    this.loadReport();
  }

  onTopFormSubmit(): void {
    this.loadTopAdGroups();
  }

  resetFilters(): void {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    this.filterForm.patchValue({
      fromDate: this.formatDate(sevenDaysAgo),
      toDate: this.formatDate(today),
      adGroupId: '',
      platform: ''
    });

    this.loadReport();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(value);
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatPercent(value: number): string {
    return value.toFixed(2) + '%';
  }

  diffPercent = (item: OptimalSpendSuggestion | null | undefined): number | null => {
    if (!item || item.currentAvgSpend === 0) {
      return null;
    }

    return ((item.suggestedSpend - item.currentAvgSpend) / item.currentAvgSpend) * 100;
  };

  dailyDiffPercent = (item: { adsCost?: number; suggestedSpend?: number | null } | null | undefined): number | null => {
    if (!item || item.adsCost === undefined || item.adsCost === 0 || item.suggestedSpend === null || item.suggestedSpend === undefined) {
      return null;
    }

    return ((item.suggestedSpend - item.adsCost) / item.adsCost) * 100;
  };

  syncToday(): void {
    this.syncing.set(true);
    this.syncMessage.set(null);
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = this.formatDate(yesterday);

    this.service.syncData(dateStr).subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.syncMessage.set(`✅ Đồng bộ thành công ${result.recordsProcessed} records cho ngày ${result.date}`);
        setTimeout(() => this.syncMessage.set(null), 5000);
        this.loadReport();
      },
      error: (err) => {
        this.syncing.set(false);
        this.syncMessage.set('❌ Lỗi đồng bộ: ' + err.message);
        setTimeout(() => this.syncMessage.set(null), 5000);
      }
    });
  }
}
