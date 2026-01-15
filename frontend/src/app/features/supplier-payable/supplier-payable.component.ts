import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupplierPayableService, SupplierPayable } from './supplier-payable.service';

@Component({
  selector: 'app-supplier-payable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page">
    <h2>📊 Công nợ nhà cung cấp</h2>
    <div class="filters">
      <label>
        Supplier ID
        <input type="text" [(ngModel)]="supplierId" placeholder="Nhập ID hoặc để trống" />
      </label>
      <label>
        Trạng thái
        <select [(ngModel)]="status">
          <option value="">Tất cả</option>
          <option value="unpaid">Chưa trả</option>
          <option value="partial">Thanh toán một phần</option>
          <option value="paid">Đã tất toán</option>
        </select>
      </label>
      <label>
        Từ ngày
        <input type="date" [(ngModel)]="from" />
      </label>
      <label>
        Đến ngày
        <input type="date" [(ngModel)]="to" />
      </label>
      <button (click)="load()">Tải</button>
    </div>

    <div *ngIf="loading" class="hint">Đang tải...</div>
    <div *ngIf="!loading && rows.length === 0" class="hint">Không có dữ liệu</div>

    <div class="table-wrapper" *ngIf="rows.length">
      <table>
        <thead>
          <tr>
            <th>Nhà cung cấp</th>
            <th>Tổng phải trả</th>
            <th>Đã thanh toán</th>
            <th>Còn lại</th>
            <th>Trạng thái</th>
            <th>Hạn thanh toán</th>
            <th>Thanh toán</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows">
            <td>
              <div class="cell-title">{{ r.supplierName || r.supplierId }}</div>
              <div class="cell-sub">ID: {{ r.supplierId }}</div>
            </td>
            <td class="num">{{ r.totalAmount | number:'1.0-0' }}</td>
            <td class="num">{{ r.amountPaid | number:'1.0-0' }}</td>
            <td class="num">{{ r.balance | number:'1.0-0' }}</td>
            <td>{{ r.status }}</td>
            <td>{{ r.dueDate ? (r.dueDate | date:'shortDate') : '' }}</td>
            <td>
              <form class="pay-form" (ngSubmit)="addPayment(r)" #f="ngForm">
                <input type="number" min="0" step="1000" [(ngModel)]="payAmount[r._id]" name="amount-{{r._id}}" placeholder="Số tiền" required />
                <input type="date" [(ngModel)]="payDate[r._id]" name="date-{{r._id}}" required />
                <button type="submit">Thanh toán</button>
              </form>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `,
  styles: [`
    .page { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; }
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; align-items: end; }
    label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
    input, select { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 8px 12px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .table-wrapper { overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .num { text-align: right; white-space: nowrap; }
    .cell-title { font-weight: 600; }
    .cell-sub { font-size: 11px; color: #6b7280; }
    .hint { color: #6b7280; font-size: 13px; }
    .pay-form { display: grid; grid-template-columns: 1fr 1fr auto; gap: 6px; align-items: center; }
    .pay-form input { min-width: 120px; }
  `]
})
export class SupplierPayableComponent implements OnInit {
  supplierId = '';
  status = '';
  from?: string;
  to?: string;
  rows: SupplierPayable[] = [];
  loading = false;
  payAmount: Record<string, number> = {};
  payDate: Record<string, string> = {};

  constructor(private service: SupplierPayableService) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading = true;
    this.service.list({ supplierId: this.supplierId || undefined, status: this.status || undefined, from: this.from, to: this.to })
      .subscribe({
        next: (res) => {
          this.rows = res.data || [];
          this.loading = false;
        },
        error: () => {
          this.rows = [];
          this.loading = false;
        }
      });
  }

  addPayment(row: SupplierPayable) {
    const amount = this.payAmount[row._id];
    const paidAt = this.payDate[row._id];
    if (!amount || !paidAt) return;
    this.service.addPayment(row._id, { amount, paidAt })
      .subscribe({
        next: (updated) => {
          // refresh row locally
          this.rows = this.rows.map(r => r._id === updated._id ? updated : r);
          this.payAmount[row._id] = 0;
          this.payDate[row._id] = '';
        },
        error: () => {}
      });
  }
}
