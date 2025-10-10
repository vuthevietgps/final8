/**
 * Component: Báo cáo Dự kiến vs Thực tế (Lợi nhuận & Chi phí quảng cáo)
 */
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfitForecastService } from './profit-forecast.service';
import { ProfitForecastRow, ProfitForecastSummaryResult } from './models/profit-forecast.interface';

@Component({
  selector: 'app-profit-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="pf-page">
    <div class="pf-toolbar">
      <div class="left">
        <h2>🔮 Dự Kiến vs Thực Tế (Ad Group)</h2>
      </div>
      <div class="filters">
        <label>From: <input type="date" [(ngModel)]="from" (change)="reload()"></label>
        <label>To: <input type="date" [(ngModel)]="to" (change)="reload()"></label>
        <label>AdGroup ID: <input type="text" [(ngModel)]="adGroupId" placeholder="Tùy chọn" (keyup.enter)="reload()"></label>
        <button class="btn" (click)="reload()">🔄 Tải</button>
        <button class="btn" (click)="exportCsv()" [disabled]="forecast().length===0">💾 CSV</button>
        <button class="btn" (click)="runSnapshot()" [disabled]="isRunningSnapshot()">📸 Snapshot</button>
      </div>
    </div>

    <div class="summary" *ngIf="summaryResult()?.summary as s">
      <div class="card">
        <div class="title">Khoảng: {{ s.range.from }} → {{ s.range.to }}</div>
        <div class="metrics-grid">
          <div><span>Matured Doanh Thu</span><strong>{{ s.maturedRevenue | number }}</strong></div>
          <div><span>Matured Lợi Nhuận</span><strong>{{ s.maturedProfit | number }}</strong></div>
          <div><span>Projected Doanh Thu</span><strong>{{ s.projectedRevenue | number }}</strong></div>
          <div><span>Projected Lợi Nhuận</span><strong>{{ s.projectedProfit | number }}</strong></div>
          <div><span>Chi Phí QC</span><strong>{{ s.spend | number }}</strong></div>
          <div><span>Blended Doanh Thu</span><strong>{{ s.blendedRevenue | number }}</strong></div>
          <div><span>Blended Lợi Nhuận</span><strong>{{ s.blendedProfit | number }}</strong></div>
          <div><span>Matured ROAS</span><strong>{{ s.maturedROAS }}</strong></div>
          <div><span>Blended ROAS</span><strong>{{ s.blendedROAS }}</strong></div>
          <div><span>Blended Margin</span><strong>{{ (s.blendedMargin * 100) | number:'1.0-2' }}%</strong></div>
        </div>
      </div>
    </div>

    <div class="table-wrapper" *ngIf="!loading(); else loadingTpl">
      <table class="data-table" *ngIf="forecast().length > 0; else emptyTpl">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>AdGroup</th>
            <th>Matured Doanh Thu</th>
            <th>Matured Lợi Nhuận</th>
            <th>Projected Doanh Thu</th>
            <th>Projected Lợi Nhuận</th>
            <th>Blended Doanh Thu</th>
            <th>Blended Lợi Nhuận</th>
            <th>Chi Phí</th>
            <th>Matured ROAS</th>
            <th>Blended ROAS</th>
            <th>Conf.</th>
            <th>Calib.Err</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of forecast(); trackBy: trackRow">
            <td>{{ r.date }}</td>
            <td>{{ r.adGroupId }}</td>
            <td class="num">{{ r.maturedRevenue | number }}</td>
            <td class="num">{{ r.maturedProfit | number }}</td>
            <td class="num proj">{{ r.projectedRevenue | number }}</td>
            <td class="num proj">{{ r.projectedProfit | number }}</td>
            <td class="num">{{ r.blendedRevenue | number }}</td>
            <td class="num">{{ r.blendedProfit | number }}</td>
            <td class="num cost">{{ r.spend | number }}</td>
            <td class="num">{{ r.maturedROAS }}</td>
            <td class="num">{{ r.blendedROAS }}</td>
            <td class="num" [title]="'Confidence'">{{ r.confidence }}</td>
            <td class="num" [title]="'Calibration Error'">{{ r.calibrationError }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ng-template #loadingTpl>
      <div class="loading">Đang tải dữ liệu...</div>
    </ng-template>
    <ng-template #emptyTpl>
      <div class="empty">Không có dữ liệu.</div>
    </ng-template>

    <div *ngIf="error()" class="error-box">{{ error() }}</div>
  </div>
  `,
  styles: [`
    .pf-page { padding:16px; display:flex; flex-direction:column; gap:16px; }
    .pf-toolbar { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center; }
    .filters { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .filters label { font-size:13px; display:flex; flex-direction:column; gap:4px; }
    .filters input[type=date], .filters input[type=text] { padding:4px 6px; min-width:140px; }
    .btn { padding:6px 10px; background:#fff; border:1px solid #ccc; border-radius:4px; cursor:pointer; }
    .btn:hover { background:#f3f4f6; }
    .summary .card { background: var(--card-bg, #fff); border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; }
    .summary .title { font-weight:600; margin-bottom:8px; }
    .metrics-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; }
    .metrics-grid div { background: var(--metric-bg, #f8fafc); padding:6px 8px; border-radius:6px; display:flex; flex-direction:column; gap:2px; font-size:12px; }
    .metrics-grid span { color:#555; }
    .metrics-grid strong { font-size:13px; }
    .table-wrapper { overflow:auto; border:1px solid #e5e7eb; border-radius:6px; }
    table.data-table { width:100%; border-collapse:collapse; font-size:13px; }
    .data-table th, .data-table td { border:1px solid #e5e7eb; padding:6px 8px; text-align:left; }
    .data-table th { background:#f1f5f9; position:sticky; top:0; z-index:1; }
    .data-table td.num { text-align:right; font-variant-numeric: tabular-nums; }
    .data-table td.proj { background:var(--proj-bg,#fff7ed); }
    .data-table td.cost { background:var(--cost-bg,#fef2f2); }
    .loading, .empty { padding:24px; text-align:center; color:#666; }
    .error-box { border:1px solid #dc2626; background:#fee2e2; padding:12px; border-radius:6px; color:#991b1b; }
    @media (prefers-color-scheme: dark) {
      .summary .card { background:#1f2937; border-color:#374151; }
      .metrics-grid div { background:#111827; }
      .table-wrapper { border-color:#374151; }
      .data-table th, .data-table td { border-color:#374151; }
      .data-table th { background:#1f2937; }
      .data-table td.proj { background:#3b2f1a; }
      .data-table td.cost { background:#3b1f1f; }
    }
  `]
})
export class ProfitForecastComponent implements OnInit {
  private svc = inject(ProfitForecastService);

  from: string = this.toISO(new Date(Date.now() - 14 * 86400000));
  to: string = this.toISO(new Date());
  adGroupId: string = '';

  forecast = signal<ProfitForecastRow[]>([]);
  summaryResult = signal<ProfitForecastSummaryResult | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  isRunningSnapshot = signal(false);

  ngOnInit(): void { this.reload(); }

  toISO(d: Date): string { return d.toISOString().split('T')[0]; }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    const params = { from: this.from, to: this.to, adGroupId: this.adGroupId?.trim() || undefined };
    this.svc.getForecastWithCost(params).subscribe({
      next: rows => {
        this.forecast.set(rows);
        this.svc.getSummary(params).subscribe({
          next: sum => { this.summaryResult.set(sum); this.loading.set(false); },
          error: e2 => { this.error.set('Lỗi summary: ' + (e2?.message || e2)); this.loading.set(false); }
        });
      },
      error: e => { this.error.set('Lỗi tải forecast: ' + (e?.message || e)); this.loading.set(false); }
    });
  }

  runSnapshot(): void {
    this.isRunningSnapshot.set(true);
    const params = { from: this.from, to: this.to, adGroupId: this.adGroupId?.trim() || undefined };
    this.svc.runSnapshots(params).subscribe({
      next: r => { this.isRunningSnapshot.set(false); this.reload(); },
      error: e => { this.error.set('Snapshot lỗi: ' + (e?.message || e)); this.isRunningSnapshot.set(false); }
    });
  }

  exportCsv(): void {
    const rows = this.forecast();
    if (!rows.length) return;
    const header = ['date','adGroupId','maturedRevenue','maturedProfit','projectedRevenue','projectedProfit','blendedRevenue','blendedProfit','spend','maturedROAS','blendedROAS','confidence','calibrationError'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push([
        r.date,
        r.adGroupId,
        r.maturedRevenue,
        r.maturedProfit,
        r.projectedRevenue,
        r.projectedProfit,
        r.blendedRevenue,
        r.blendedProfit,
        r.spend,
        r.maturedROAS,
        r.blendedROAS,
        r.confidence,
        r.calibrationError
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `profit-forecast-${this.from}_to_${this.to}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  trackRow(i: number, r: ProfitForecastRow) { return r.date + '::' + r.adGroupId; }
}
