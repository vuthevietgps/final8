import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, Pipe, PipeTransform } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PurchaseOrder, PurchaseOrderApi } from './purchase-order.service';
import { SupplierService } from '../supplier/supplier.service';

// Pipe để chuyển status sang tiếng Việt
@Pipe({
  name: 'statusVN',
  standalone: true
})
export class StatusVNPipe implements PipeTransform {
  transform(status: string): string {
    const statusMap: { [key: string]: string } = {
      'draft': 'Dự thảo',
      'ordered': 'Đã đặt',
      'partially_received': 'Nhận một phần',
      'received': 'Đã nhận',
      'cancelled': 'Hủy'
    };
    return statusMap[status] || status;
  }
}

@Component({
  selector: 'app-purchase-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, StatusVNPipe],
  template: `
  <div class="page">
    <div class="header">
      <h2>📥 Nhập Hàng</h2>
      <a class="btn" [routerLink]="['/purchases/new']">+ Tạo đơn nhập</a>
    </div>
    <div class="filters">
      <select [(ngModel)]="supplierId" (change)="load()">
        <option value="">-- Nhà cung cấp --</option>
        <option *ngFor="let s of suppliers()" [value]="s._id">{{s.fullName}}</option>
      </select>
      <select [(ngModel)]="status" (change)="load()">
        <option value="">-- Tất cả trạng thái --</option>
        <option value="draft">Nháp</option>
        <option value="ordered">Đã đặt</option>
        <option value="partially_received">Nhận một phần</option>
        <option value="received">Đã nhận</option>
        <option value="cancelled">Hủy</option>
      </select>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Số PO</th>
          <th>Ngày</th>
          <th>Nhà cung cấp</th>
          <th>SL dòng</th>
          <th>Thành tiền</th>
          <th>Trạng thái</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let po of data()">
          <td><strong>{{ po.poNumber || po._id }}</strong></td>
          <td>{{ po.createdAt | date:'short' }}</td>
          <td>{{ supplierMap().get(po.supplierId) || po.supplierNameSnap || 'N/A' }}</td>
          <td>{{ (po.items && po.items.length) || 0 }}</td>
          <td>{{ po.grandTotal | number }}</td>
          <td><span class="status-badge">{{ po.status | statusVN }}</span></td>
          <td class="actions">
            <a [routerLink]="['/purchases', po._id]">Xem</a>
            <a [routerLink]="['/purchases', po._id, 'receive']">Nhận</a>
            <button *ngIf="canQuickReceive(po)" class="btn-secondary" (click)="quickReceive(po)">Nhận hết</button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  `,
  styles: [`
    .page{padding:12px}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .filters{display:flex;gap:8px;margin-bottom:8px}
    .table{width:100%;border-collapse:collapse}
    .table th,.table td{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left}
    .btn{background:#2563eb;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none}
    .actions{display:flex;gap:8px;align-items:center}
    .btn-secondary{background:#10b981;color:#fff;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
    .status-badge{display:inline-block;padding:4px 8px;border-radius:4px;font-size:13px;font-weight:600;background:#e0f2fe;color:#0369a1}
    .status-badge{background:#dbeafe;color:#1e40af}
  `]
})
export class PurchaseListComponent implements OnInit {
  data = signal<PurchaseOrder[]>([]);
  suppliers = signal<any[]>([]);
  supplierId = '';
  status = '';
  supplierMap = signal<Map<string, string>>(new Map());

  constructor(private api: PurchaseOrderApi, private suppliersApi: SupplierService) {}

  ngOnInit(): void {
    this.suppliersApi.list({ minimal: true, active: true }).subscribe(s => {
      this.suppliers.set(s);
      // Tạo map id -> name để dễ lookup
      const map = new Map();
      s.forEach(supplier => map.set(supplier._id, supplier.fullName));
      this.supplierMap.set(map);
    });
    this.load();
  }

  load(){
    this.api.list({ supplierId: this.supplierId || undefined, status: this.status || undefined }).subscribe({
      next: res => this.data.set(res.data),
      error: err => alert('Tải danh sách PO thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }

  canQuickReceive(po: PurchaseOrder): boolean {
    if (!po.items || !po.items.length) return false;
    if (po.status === 'received' || po.status === 'cancelled') return false;
    return po.items.some(it => (it.quantity - (it.quantityReceived || 0)) > 0);
  }

  quickReceive(po: PurchaseOrder) {
    const items = (po.items || [])
      .map(it => ({ itemId: (it._id || it.productId) as string, qtyReceived: Math.max(0, it.quantity - (it.quantityReceived || 0)) }))
      .filter(x => x.qtyReceived > 0);
    if (!items.length) return;
    this.api.receive(po._id, items).subscribe({
      next: () => { alert('Đã nhận hàng thành công'); this.load(); },
      error: err => alert('Nhận hàng thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }
}
