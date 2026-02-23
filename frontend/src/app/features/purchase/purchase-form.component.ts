import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PurchaseOrderApi, CreatePODto } from './purchase-order.service';
import { SupplierService } from '../supplier/supplier.service';
import { ProductService } from '../product/product.service';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="page">
    <h2>Tạo đơn nhập</h2>
    <div class="form">
      <label>Nhà cung cấp
        <select [(ngModel)]="supplierId" (change)="onSupplierChange()">
          <option value="">-- Chọn --</option>
          <option *ngFor="let s of suppliers()" [value]="s._id">{{s.fullName}}</option>
        </select>
      </label>

      <div class="items">
        <div class="header-row">
          <h3>Chi tiết sản phẩm</h3>
          <a class="link-add-product" href="/product" target="_blank" title="Mở trang Sản phẩm trong tab mới để thêm sản phẩm">
            ➕ Tạo sản phẩm mới
          </a>
        </div>
        <div class="table-header">
          <div class="col-product">Sản phẩm</div>
          <div class="col-quantity">Số lượng</div>
          <div class="col-price">Đơn giá</div>
          <div class="col-suggest">Gợi ý giá</div>
          <div class="col-action">Hành động</div>
        </div>
        <div class="item" *ngFor="let it of items; let i = index">
          <select [(ngModel)]="it.productId" (change)="onSelectProduct(i)">
            <option value="">-- Sản phẩm --</option>
            <option *ngFor="let p of products()" [value]="p._id">{{ p.name }}</option>
          </select>
          <input type="number" min="0" step="0.0001" [(ngModel)]="it.quantity" placeholder="Số lượng" />
          <input type="number" min="0" step="0.01" [(ngModel)]="it.unitPrice" placeholder="Đơn giá" />
          <div class="suggest">
            <div class="hint" *ngIf="it.suggestPrice !== undefined">Gần nhất: {{ it.suggestPrice | number:'1.0-0' }}</div>
            <div class="hint" *ngIf="it.suggestStats">(min {{it.suggestStats.min|number:'1.0-0'}} / median {{it.suggestStats.median|number:'1.0-0'}} / max {{it.suggestStats.max|number:'1.0-0'}})</div>
            <button type="button" class="btn-mini" (click)="applySuggest(i)" [disabled]="it.suggestPrice === undefined">Dùng giá gợi ý</button>
          </div>
          <button (click)="removeItem(i)">Xóa</button>
        </div>
        <button (click)="addItem()">+ Thêm dòng</button>
      </div>

      <div class="actions">
        <button class="btn" (click)="save()" [disabled]="!canSave()">Lưu</button>
        <a class="btn secondary" [routerLink]="['/purchases']">Hủy</a>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .page{padding:12px}
    .form{display:flex;flex-direction:column;gap:12px;max-width:900px}
    .items{display:flex;flex-direction:column;gap:0}
    .header-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
    .header-row h3{margin:0;font-size:16px;font-weight:600}
    .link-add-product{color:#2563eb;text-decoration:none;font-size:14px;padding:4px 8px;border-radius:4px;border:1px solid #2563eb;background:#eff6ff}
    .link-add-product:hover{background:#dbeafe}
    .table-header{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr auto;gap:8px;padding:8px;background:#f3f4f6;border-radius:6px 6px 0 0;font-weight:600;font-size:13px;color:#374151}
    .item{display:grid;grid-template-columns:2fr 1fr 1fr 1.4fr auto;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #e5e7eb}
    .item:last-of-type{border-bottom:1px solid #e5e7eb;border-radius:0 0 6px 6px}
    .item select, .item input{padding:6px;border:1px solid #d1d5db;border-radius:4px;font-size:14px}
    .item button{padding:6px 10px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px}
    .item button:hover{background:#dc2626}
    .suggest{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#475569}
    .hint{font-size:12px;color:#475569}
    .btn-mini{padding:4px 8px;background:#10b981;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px}
    .btn-mini:disabled{background:#cbd5e1;color:#475569;cursor:not-allowed}
    .btn{background:#2563eb;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;border:none;cursor:pointer}
    .btn:hover{background:#1d4ed8}
    .btn:disabled{background:#9ca3af;cursor:not-allowed}
    .btn.secondary{background:#6b7280}
    .btn.secondary:hover{background:#4b5563}
  `]
})
export class PurchaseFormComponent implements OnInit {
  suppliers = signal<any[]>([]);
  products = signal<any[]>([]);
  supplierId = '';
  items: Array<{ productId: string; productNameSnap?: string; quantity: number; unitPrice: number; suggestPrice?: number; suggestStats?: any; }> = [];

  constructor(private api: PurchaseOrderApi, private supApi: SupplierService, private prodApi: ProductService, private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    this.supApi.list({ minimal: true, active: true }).subscribe({
      next: s => this.suppliers.set(s),
      error: err => alert('Tải danh sách NCC thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
    this.prodApi.getAll().subscribe({
      next: (p: any) => this.products.set(p),
      error: err => alert('Tải danh sách sản phẩm thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
    this.addItem();
  }

  addItem(){ this.items.push({ productId: '', productNameSnap: '', quantity: 1, unitPrice: 0 }); }
  removeItem(i: number){ this.items.splice(i,1); }
  onSelectProduct(i: number){
    const it = this.items[i];
    const p = this.products().find(x => x._id === it.productId);
    if (p) it.productNameSnap = p.name;
    this.fetchSuggest(i);
  }

  onSupplierChange(){
    this.items.forEach((_, idx) => this.fetchSuggest(idx));
  }

  canSave(){
    return this.supplierId && this.items.length>0 && this.items.every(it => it.productId && it.quantity>0 && it.unitPrice>=0);
  }

  save(){
    const dto: CreatePODto = {
      supplierId: this.supplierId,
      items: this.items.map(it => ({ productId: it.productId, productNameSnap: it.productNameSnap, quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
    };
    this.api.create(dto).subscribe({
      next: po => { alert('Tạo PO thành công'); this.router.navigate(['/purchases']); },
      error: err => alert('Tạo PO thất bại: ' + (err?.error?.message || err?.message || 'Lỗi không xác định'))
    });
  }

  fetchSuggest(i: number){
    const it = this.items[i];
    if (!it.productId || !this.supplierId) { it.suggestPrice = undefined; it.suggestStats = undefined; return; }
    const params = new HttpParams().set('productId', it.productId).set('supplierId', this.supplierId).set('limit', '20');
    this.http.get<any>(`${environment.apiUrl}/purchase-orders/price-history`, { params, withCredentials: true }).subscribe({
      next: res => {
        const latest = res?.stats?.latest;
        it.suggestPrice = latest !== undefined ? Number(latest) : undefined;
        it.suggestStats = res?.stats;
      },
      error: () => {
        it.suggestPrice = undefined;
        it.suggestStats = undefined;
      }
    });
  }

  applySuggest(i: number){
    const it = this.items[i];
    if (it.suggestPrice !== undefined) {
      it.unitPrice = it.suggestPrice;
    }
  }
}
