import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PurchaseOrder, PurchaseOrderApi } from './purchase-order.service';

@Component({
  selector: 'app-purchase-receive',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="page" *ngIf="po() as po">
    <div class="header">
      <h2>Nhận hàng - {{ po._id }}</h2>
      <a class="btn" [routerLink]="['/purchases']">Quay lại</a>
    </div>

    <div class="meta">
      <div><strong>Nhà cung cấp:</strong> {{ po.supplierNameSnap || po.supplierId }}</div>
      <div><strong>Trạng thái:</strong> {{ po.status }}</div>
      <div><strong>Tổng:</strong> {{ po.grandTotal | number }}</div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th>SL đặt</th>
          <th>Đã nhận</th>
          <th>Còn lại</th>
          <th>Nhận thêm</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let it of po.items; let i = index">
          <td>{{ it.productNameSnap || it.productId }}</td>
          <td>{{ it.quantity }}</td>
          <td>{{ it.quantityReceived || 0 }}</td>
          <td>{{ (it.quantity - (it.quantityReceived || 0)) | number }}</td>
          <td>
            <input type="number" min="0" step="0.0001" [(ngModel)]="receives[i]" />
          </td>
        </tr>
      </tbody>
    </table>

    <div class="actions">
      <button class="btn primary" (click)="submit()" [disabled]="!hasAnyQty()">Xác nhận nhận hàng</button>
      <button class="btn" (click)="fillRemaining()">Nhận hết phần còn lại</button>
    </div>
  </div>
  `,
  styles: [`
    .page{padding:12px}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .meta{display:flex;gap:16px;margin-bottom:8px}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
    .actions{display:flex;gap:8px;margin-top:12px}
    .btn{background:#6b7280;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
    .btn.primary{background:#2563eb}
  `]
})
export class PurchaseReceiveComponent implements OnInit {
  po = signal<PurchaseOrder | null>(null);
  receives: number[] = [];

  constructor(private route: ActivatedRoute, private api: PurchaseOrderApi, private router: Router) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(id).subscribe({
      next: po => {
        this.po.set(po);
        this.receives = (po.items || []).map(it => Math.max(0, it.quantity - (it.quantityReceived || 0)));
      },
      error: err => alert('Tải PO thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }

  hasAnyQty(){ return this.receives.some(q => Number(q) > 0); }

  fillRemaining(){
    const po = this.po(); if (!po) return;
    this.receives = (po.items || []).map(it => Math.max(0, it.quantity - (it.quantityReceived || 0)));
  }

  submit(){
    const po = this.po(); if (!po) return;
  const items = (po.items || []).map((it, i) => ({ itemId: (it._id || it.productId) as string, qtyReceived: Number(this.receives[i]||0) })).filter(x => x.qtyReceived > 0);
    if (!items.length) return;
    this.api.receive(po._id, items).subscribe({
      next: _ => { alert('Xác nhận nhận hàng thành công'); this.router.navigate(['/purchases']); },
      error: err => alert('Nhận hàng thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }
}
