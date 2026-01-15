import { CommonModule } from '@angular/common';
import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReturnReportService } from './return-report.service';
import { ReturnReportFilter, ReturnReportType, ReturnRow } from './return-report.models';

@Component({
  selector: 'app-return-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './return-report.component.html',
  styleUrls: ['./return-report.component.css']
})
export class ReturnReportComponent {
  type = signal<ReturnReportType>('adGroup');
  filter = signal<ReturnReportFilter>({});
  loading = signal(false);
  error = signal('');
  rows = signal<ReturnRow[]>([]);

  summary = computed(() => {
    const data = this.rows();
    if (!data.length) return null;
    return data.reduce((acc, r) => {
      acc.totalOrders += r.totalOrders;
      acc.returnOrders += r.returnOrders;
      acc.totalQty += r.totalQty;
      acc.returnQty += r.returnQty;
      acc.revenue += r.revenue;
      acc.returnRevenue += r.returnRevenue;
      acc.cost += r.cost;
      acc.returnCost += r.returnCost;
      acc.cod += r.cod;
      acc.returnCod += r.returnCod;
      return acc;
    }, {
      totalOrders: 0,
      returnOrders: 0,
      totalQty: 0,
      returnQty: 0,
      revenue: 0,
      returnRevenue: 0,
      cost: 0,
      returnCost: 0,
      cod: 0,
      returnCod: 0,
    });
  });

  constructor(private service: ReturnReportService) {
    // default load last 30 days
    const today = new Date();
    const from = new Date(today.getTime() - 30 * 86400000);
    this.filter.set({
      fromDate: from.toISOString().slice(0, 10),
      toDate: today.toISOString().slice(0, 10),
    });
    this.load();
  }

  setType(t: ReturnReportType) {
    if (this.type() === t) return;
    this.type.set(t);
    this.load();
  }

  setFromDate(v: string) {
    this.filter.update(f => ({ ...f, fromDate: v || undefined }));
  }

  setToDate(v: string) {
    this.filter.update(f => ({ ...f, toDate: v || undefined }));
  }

  refresh() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.error.set('');
    const f = this.filter();
    const obs = this.type() === 'adGroup'
      ? this.service.getByAdGroup(f)
      : this.service.getByProduct(f);
    obs.subscribe({
      next: rows => {
        this.rows.set(rows || []);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.message || 'Không tải được báo cáo');
        this.loading.set(false);
      }
    });
  }

  formatCurrency(v: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
  }

  formatPercent(v: number) {
    return (v * 100).toFixed(1) + '%';
  }
}
