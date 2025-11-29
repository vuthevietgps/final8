import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PurchaseOrderApi, CreatePODto } from './purchase-order.service';
import { SupplierService } from '../supplier/supplier.service';
import { ProductService } from '../product/product.service';

@Component({
  selector: 'app-purchase-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
  <div class="page">
    <h2>Tạo đơn nhập</h2>
    <div class="form">
      <label>Nhà cung cấp
        <select [(ngModel)]="supplierId">
          <option value="">-- Chọn --</option>
          <option *ngFor="let s of suppliers()" [value]="s._id">{{s.fullName}}</option>
        </select>
      </label>

      <div class="items">
        <div class="item" *ngFor="let it of items; let i = index">
          <select [(ngModel)]="it.productId" (change)="onSelectProduct(i)">
            <option value="">-- Sản phẩm --</option>
            <option *ngFor="let p of products()" [value]="p._id">{{ p.name }}</option>
          </select>
          <input type="number" min="0" step="0.0001" [(ngModel)]="it.quantity" placeholder="Số lượng" />
          <input type="number" min="0" step="0.01" [(ngModel)]="it.unitPrice" placeholder="Đơn giá" />
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
    .items{display:flex;flex-direction:column;gap:8px}
    .item{display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:center}
    .btn{background:#2563eb;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;border:none}
    .btn.secondary{background:#6b7280}
  `]
})
export class PurchaseFormComponent implements OnInit {
  suppliers = signal<any[]>([]);
  products = signal<any[]>([]);
  supplierId = '';
  items: Array<{ productId: string; productNameSnap?: string; quantity: number; unitPrice: number; }> = [];

  constructor(private api: PurchaseOrderApi, private supApi: SupplierService, private prodApi: ProductService, private router: Router) {}

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
}
