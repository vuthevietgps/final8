import { CommonModule } from '@angular/common';
import { Component, computed, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PurchaseService, CreatePurchaseOrderDto } from './purchase.service';
import { Supplier, SupplierService } from '../supplier/supplier.service';
import { ProductService } from '../product/product.service';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page">
    <h2>📦 Quản Lý Nhập Hàng</h2>
    <div class="layout">
      <section class="create">
        <h3>Tạo đơn nhập</h3>
        <div class="field">
          <label>Nhà cung cấp</label>
          <select [ngModel]="supplierId()" (ngModelChange)="supplierId.set($event)">
            <option [ngValue]="''">-- Chọn --</option>
            <option *ngFor="let s of suppliers()" [ngValue]="s._id">{{ s.fullName }} ({{ s.role==='internal_supplier'?'Nội bộ':'Ngoài' }})</option>
          </select>
          <button class="btn" (click)="reloadSuppliers()">Tải NCC</button>
        </div>
        <div class="field">
          <label>Ngày dự kiến nhận</label>
          <input type="date" [ngModel]="expectedDate()" (ngModelChange)="expectedDate.set($event)"/>
        </div>
        <div class="items">
          <div class="item-row" *ngFor="let it of items(); let i=index">
            <input class="pid" placeholder="Tìm sản phẩm..." [ngModel]="it.productId" (ngModelChange)="onProductSearch($event, i)"/>
            <input type="number" min="0" step="0.0001" placeholder="SL" [ngModel]="it.quantity" (ngModelChange)="updateItem(i, { quantity: toNum($event) })"/>
            <input type="number" min="0" step="0.01" placeholder="Đơn giá" [ngModel]="it.unitPrice" (ngModelChange)="updateItem(i, { unitPrice: toNum($event) })"/>
            <button class="btn small" (click)="removeItem(i)">Xóa</button>
          </div>
          <button class="btn" (click)="addItem()">+ Thêm dòng</button>
        </div>
        <div class="fees">
          <label>Phí vận chuyển: <input type="number" min="0" step="0.01" [ngModel]="shippingFee()" (ngModelChange)="shippingFee.set(toNum($event))"/></label>
          <label>Giảm giá: <input type="number" min="0" step="0.01" [ngModel]="discount()" (ngModelChange)="discount.set(toNum($event))"/></label>
          <label>Thuế: <input type="number" min="0" step="0.01" [ngModel]="tax()" (ngModelChange)="tax.set(toNum($event))"/></label>
        </div>
        <div class="summary">Tạm tính: {{ itemsTotal() | number:'1.0-0' }} | Tổng: {{ grandTotal() | number:'1.0-0' }}</div>
        <button class="btn primary" [disabled]="!canCreate()" (click)="create()">Tạo đơn</button>
      </section>
      <section class="list">
        <h3>Danh sách đơn nhập</h3>
        <div class="filters">
          <input placeholder="Lọc theo NCC ID" [ngModel]="listSupplierId()" (ngModelChange)="listSupplierId.set($event); loadList()"/>
          <select [ngModel]="status()" (ngModelChange)="status.set($event); loadList()">
            <option value="">Tất cả</option>
            <option value="draft">Nháp</option>
            <option value="ordered">Đã đặt</option>
            <option value="partially_received">Nhận một phần</option>
            <option value="received">Đã nhận đủ</option>
            <option value="cancelled">Hủy</option>
          </select>
        </div>
        <table class="table">
          <thead>
            <tr><th>Ngày</th><th>NCC</th><th>Số dòng</th><th>Tiền hàng</th><th>Tổng</th><th>TT</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let po of poList()">
              <td>{{ po.createdAt | date:'short' }}</td>
              <td>{{ po.supplierId }}</td>
              <td>{{ po.items?.length }}</td>
              <td>{{ po.itemsTotal | number:'1.0-0' }}</td>
              <td>{{ po.grandTotal | number:'1.0-0' }}</td>
              <td>{{ mapStatus(po.status) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { margin-bottom: 8px; display:flex; gap:8px; align-items:center; }
    .items { display: flex; flex-direction: column; gap: 6px; margin: 8px 0; }
    .item-row { display: grid; grid-template-columns: 1.5fr 0.7fr 0.8fr auto; gap: 6px; }
    .btn { padding: 6px 10px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; border-radius: 6px; }
    .btn.small { padding: 2px 6px; }
    .btn.primary { background: #2563eb; color: white; border-color: #2563eb; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  `]
})
export class PurchaseComponent {
  // Create form signals
  supplierId = signal<string>('');
  expectedDate = signal<string>('');
  items = signal<{ productId: string; quantity: number; unitPrice: number }[]>([{ productId: '', quantity: 1, unitPrice: 0 }]);
  shippingFee = signal<number>(0);
  discount = signal<number>(0);
  tax = signal<number>(0);

  // Lists
  suppliers = signal<Supplier[]>([]);
  poList = signal<any[]>([]);
  listSupplierId = signal<string>('');
  status = signal<string>('');

  itemsTotal = computed(() => this.items().reduce((s, it) => s + (Number(it.quantity)||0) * (Number(it.unitPrice)||0), 0));
  grandTotal = computed(() => Math.max(0, this.itemsTotal() + (this.shippingFee()||0) + (this.tax()||0) - (this.discount()||0)));

  constructor(private api: PurchaseService, private supApi: SupplierService, private prodApi: ProductService) {
    effect(() => {
      this.reloadSuppliers();
      this.loadList();
    });
  }

  toNum(v:any){ const n = Number(v); return isNaN(n)?0:n; }
  mapStatus(s:string){
    switch(s){
      case 'draft': return 'Nháp';
      case 'ordered': return 'Đã đặt';
      case 'partially_received': return 'Nhận một phần';
      case 'received': return 'Đã nhận đủ';
      case 'cancelled': return 'Hủy';
      default: return s;
    }
  }

  canCreate(){ return !!this.supplierId() && this.items().some(it => it.productId && it.quantity>0); }

  addItem(){ this.items.update(arr => [...arr, { productId: '', quantity: 1, unitPrice: 0 }]); }
  removeItem(i:number){ this.items.update(arr => arr.filter((_,idx)=>idx!==i)); }
  updateItem(i:number, patch: Partial<{productId:string; quantity:number; unitPrice:number}>){ this.items.update(arr => arr.map((it,idx)=> idx===i? { ...it, ...patch }: it)); }

  onProductSearch(val:string, i:number){
    // For now just set raw productId; in next step could implement autocomplete searching products
    this.updateItem(i, { productId: val });
  }

  reloadSuppliers(){ this.supApi.list({ active: true, minimal: true }).subscribe(res => this.suppliers.set(res)); }

  create(){
    const dto: CreatePurchaseOrderDto = {
      supplierId: this.supplierId(),
      items: this.items().map(it => ({ productId: it.productId, quantity: it.quantity, unitPrice: it.unitPrice })),
      expectedDeliveryDate: this.expectedDate() || undefined,
      shippingFee: this.shippingFee()||0,
      discount: this.discount()||0,
      tax: this.tax()||0
    };
    this.api.create(dto).subscribe(_=>{ this.resetForm(); this.loadList(); });
  }

  resetForm(){
    this.supplierId.set('');
    this.expectedDate.set('');
    this.items.set([{ productId: '', quantity: 1, unitPrice: 0 }]);
    this.shippingFee.set(0); this.discount.set(0); this.tax.set(0);
  }

  loadList(){
    this.api.list({ supplierId: this.listSupplierId() || undefined, status: this.status() || undefined, page:1, limit:20 }).subscribe(r => this.poList.set(r.data));
  }
}
