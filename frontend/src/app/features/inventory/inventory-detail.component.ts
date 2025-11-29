import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { InventoryApi, InventoryTxRow } from './inventory.service';
import { ProductService } from '../product/product.service';

@Component({
  selector: 'app-inventory-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="page">
    <div class="header">
      <h2>Tồn kho - {{ productName || productId }}</h2>
      <a class="btn" routerLink="/inventory">Quay lại</a>
    </div>

    <div class="actions">
      <button class="btn-secondary" (click)="adjust()">Điều chỉnh</button>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Thời điểm</th>
          <th>Loại</th>
          <th>SL</th>
          <th>Đơn giá</th>
          <th>PO</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let t of txs()">
          <td>{{ t.occurredAt | date:'short' }}</td>
          <td>{{ t.type }}</td>
          <td [class.outbound]="t.quantity<0">{{ t.quantity | number:'1.0-4' }}</td>
          <td>{{ t.unitCost ?? '-' }}</td>
          <td>{{ t.purchaseOrderId || '-' }}</td>
          <td>{{ t.notes || '' }}</td>
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
    .actions{margin-bottom:8px}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
    .btn{background:#6b7280;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
    .btn-secondary{background:#10b981;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
    .pagination{display:flex;gap:8px;align-items:center;justify-content:center;margin-top:12px}
    .outbound{color:#dc2626}
  `]
})
export class InventoryDetailComponent implements OnInit {
  productId!: string;
  productName = '';
  txs = signal<InventoryTxRow[]>([]);
  page = 1;
  limit = 20;
  totalPages = 1;

  constructor(private route: ActivatedRoute, private api: InventoryApi, private productApi: ProductService) {}

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('productId')!;
    // Fetch product name for better UX (non-blocking)
    try { (this.productApi as any).getById ? (this.productApi as any).getById(this.productId).subscribe((p:any)=> this.productName = p?.name || ''): null; } catch {}
    this.load();
  }

  load(){
    this.api.transactions(this.productId, { page: this.page, limit: this.limit }).subscribe({
      next: res => { this.txs.set(res.data||[]); this.totalPages = Math.max(1, Number(res.pagination?.totalPages||1)); },
      error: err => alert('Tải lịch sử tồn kho thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }

  prev(){ if(this.page>1){ this.page--; this.load(); } }
  next(){ if(this.page<this.totalPages){ this.page++; this.load(); } }

  adjust(){
    const qtyStr = prompt('Nhập số lượng điều chỉnh (+/-):', '0');
    if (qtyStr===null) return;
    const qty = Number(qtyStr);
    if (!Number.isFinite(qty) || qty===0) { alert('Số lượng không hợp lệ'); return; }
    let unitCost: number | undefined = undefined;
    if (qty>0) {
      const costStr = prompt('Đơn giá (chỉ cần khi điều chỉnh dương, dùng để cập nhật WAC):', '0');
      if (costStr===null) return; // user cancelled
      const c = Number(costStr);
      if (!Number.isFinite(c) || c<0) { alert('Đơn giá không hợp lệ'); return; }
      unitCost = c;
    }
    const notes = prompt('Ghi chú (tuỳ chọn):', '');
    this.api.adjust({ productId: this.productId, quantity: qty, unitCost, notes: notes||undefined }).subscribe({
      next: _ => { alert('Điều chỉnh thành công'); this.load(); },
      error: err => alert('Điều chỉnh thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }
}
