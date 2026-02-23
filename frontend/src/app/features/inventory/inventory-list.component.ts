import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { InventoryApi, InventorySummaryRow } from './inventory.service';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="page">
    <div class="header">
      <h2>🏬 Tồn kho</h2>
      <div class="filters">
        <input [(ngModel)]="q" (keyup.enter)="load()" placeholder="Tìm theo tên sản phẩm" />
        <button class="btn" (click)="load()">Tìm</button>
      </div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th>Tồn hiện tại</th>
          <th>Giá vốn TB (WAC)</th>
          <th>Cập nhật</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of rows()">
          <td>{{ r.productName || r.productId }}</td>
          <td>{{ r.onHand | number:'1.0-4' }}</td>
          <td>{{ r.avgCost | number }}</td>
          <td>{{ r.updatedAt | date:'short' }}</td>
          <td class="actions">
            <a [routerLink]="['/inventory', r.productId]">Xem chi tiết</a>
            <button class="btn-secondary" (click)="adjust(r)">Điều chỉnh</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="pagination">
      <button (click)="prev()" [disabled]="page<=1">‹ Trước</button>
      <span>Trang {{ page }} / {{ totalPages }}</span>
      <button (click)="next()" [disabled]="page>=totalPages">Sau ›</button>
    </div>
  </div>
  `,
  styles: [`
    .page{padding:12px}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .filters{display:flex;gap:8px}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
    .actions{display:flex;gap:8px}
    .btn{background:#2563eb;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
    .btn-secondary{background:#10b981;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
    .pagination{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:12px}
  `]
})
export class InventoryListComponent implements OnInit {
  rows = signal<InventorySummaryRow[]>([]);
  q = '';
  page = 1;
  limit = 20;
  totalPages = 1;

  constructor(private api: InventoryApi) {}

  ngOnInit(): void { this.load(); }

  load(){
    this.api.summary({ q: this.q || undefined, page: this.page, limit: this.limit }).subscribe({
      next: res => { this.rows.set(res.data||[]); this.totalPages = Math.max(1, Number(res.pagination?.totalPages||1)); },
      error: err => alert('Tải tồn kho thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }

  prev(){ if(this.page>1){ this.page--; this.load(); } }
  next(){ if(this.page<this.totalPages){ this.page++; this.load(); } }

  adjust(r: InventorySummaryRow){
    const qtyStr = prompt('Nhập số lượng điều chỉnh (+/-):', '0');
    if (qtyStr===null) return;
    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty===0) { alert('Số lượng không hợp lệ'); return; }
    let unitCost: number | undefined = undefined;
    if (qty>0) {
      const costStr = prompt('Đơn giá (chỉ cần khi điều chỉnh dương, dùng để cập nhật WAC):', String(Math.round(r.avgCost||0)));
      if (costStr===null) return; // user cancelled
      const c = Number(costStr);
      if (!Number.isFinite(c) || c<0) { alert('Đơn giá không hợp lệ'); return; }
      unitCost = c;
    }
    const notes = prompt('Ghi chú (tuỳ chọn):', '');
    this.api.adjust({ productId: r.productId, quantity: qty, unitCost, notes: notes||undefined }).subscribe({
      next: _ => { alert('Điều chỉnh tồn kho thành công'); this.load(); },
      error: err => alert('Điều chỉnh thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }
}
