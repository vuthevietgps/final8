import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PurchaseService } from './purchase.service';
import { SupplierService } from '../supplier/supplier.service';

interface SupplierProductRow {
  supplierId: string;
  supplierName?: string;
  productId: string;
  productName?: string;
  totalQuantityReceived: number;
  totalCostReceived: number;
  orderCount: number;
  lastReceivedAt?: string;
}

@Component({
  selector: 'app-purchase-supplier-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page">
    <h2>📊 Báo cáo nhà cung cấp theo sản phẩm</h2>
    <p class="hint" style="margin-top: -8px;">Mặc định hiển thị dữ liệu 3 tháng gần đây. Xóa ngày để xem tất cả.</p>
    
    <div *ngIf="loading" class="hint">⏳ Đang tải dữ liệu...</div>
    <div *ngIf="!loading && rows.length === 0" class="hint">Không có dữ liệu</div>

    <div class="filters" *ngIf="!loading">
      <label>
        Từ ngày
        <input type="date" [(ngModel)]="from" (change)="load()" />
      </label>
      <label>
        Đến ngày
        <input type="date" [(ngModel)]="to" (change)="load()" />
      </label>
      <label>
        ID nhà cung cấp (tùy chọn)
        <input type="text" [(ngModel)]="supplierId" placeholder="(không bắt buộc)" (change)="load()" />
      </label>
      <label>
        ID sản phẩm (tùy chọn)
        <input type="text" [(ngModel)]="productId" placeholder="(không bắt buộc)" (change)="load()" />
      </label>
      <button (click)="clearDates()" style="background: #6b7280;">Xóa ngày (xem tất cả)</button>
    </div>

    <div class="table-wrapper" *ngIf="rows.length">
      <table>
        <thead>
          <tr>
            <th>Nhà cung cấp</th>
            <th>Sản phẩm</th>
            <th>SL đã nhận</th>
            <th>Tổng chi phí nhập</th>
            <th>Số PO</th>
            <th>Nhận gần nhất</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows">
            <td>
              <div class="cell-title">{{ supplierMap.get(r.supplierId) || r.supplierName || r.supplierId }}</div>
              <div class="cell-sub" *ngIf="r.supplierId">ID: {{ r.supplierId }}</div>
            </td>
            <td>
              <div class="cell-title">{{ r.productName || r.productId }}</div>
              <div class="cell-sub" *ngIf="r.productId">ID: {{ r.productId }}</div>
            </td>
            <td class="num">{{ r.totalQuantityReceived | number:'1.0-0' }}</td>
            <td class="num">{{ r.totalCostReceived | number:'1.0-0' }}</td>
            <td class="num">{{ r.orderCount }}</td>
            <td>{{ r.lastReceivedAt ? (r.lastReceivedAt | date:'short') : '' }}</td>
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
    input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; }
    button { padding: 8px 12px; border: none; border-radius: 6px; background: #2563eb; color: #fff; cursor: pointer; }
    button:hover { background: #1d4ed8; }
    .table-wrapper { overflow: auto; border: 1px solid #e5e7eb; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    .num { text-align: right; white-space: nowrap; }
    .cell-title { font-weight: 600; }
    .cell-sub { font-size: 11px; color: #6b7280; }
    .hint { color: #6b7280; font-size: 13px; }
  `]
})
export class PurchaseSupplierReportComponent implements OnInit {
  from?: string;
  to?: string;
  supplierId?: string;
  productId?: string;
  rows: SupplierProductRow[] = [];
  loading = false;
  supplierMap = new Map<string, string>();

  constructor(
    private purchaseService: PurchaseService, 
    private supplierService: SupplierService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Set mặc định: 3 tháng gần đây để tránh tải quá nhiều dữ liệu
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(today.getMonth() - 3);
    
    this.from = threeMonthsAgo.toISOString().split('T')[0];
    this.to = today.toISOString().split('T')[0];
    
    // Nạp danh sách NCC để map ID -> tên
    this.supplierService.list({ minimal: true, active: true }).subscribe({
      next: suppliers => suppliers.forEach(s => this.supplierMap.set(s._id, s.fullName))
    });
    
    // Tự động tải dữ liệu 3 tháng gần đây
    this.load();
  }

  load() {
    this.loading = true;
    this.rows = [];
    console.log('[SupplierReport] Loading with params:', { from: this.from, to: this.to, supplierId: this.supplierId, productId: this.productId });
    this.purchaseService
      .supplierProductReport({ from: this.from, to: this.to, supplierId: this.supplierId, productId: this.productId })
      .subscribe({
        next: (data) => { 
          console.log('[SupplierReport] Success, rows:', data?.length || 0);
          this.rows = data || []; 
          this.loading = false;
          this.cdr.detectChanges(); // Force UI update
        },
        error: (err) => { 
          console.error('[SupplierReport] Error:', err);
          this.rows = []; 
          this.loading = false;
          this.cdr.detectChanges(); // Force UI update
        },
        complete: () => {
          console.log('[SupplierReport] Observable completed');
        }
      });
  }

  clearDates() {
    this.from = undefined;
    this.to = undefined;
    this.load();
  }
}
