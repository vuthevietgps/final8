/**
 * File: features/product-category/product-category.component.ts
 * Mục đích: Giao diện quản lý Nhóm Sản phẩm - inline editing như Trạng thái giao hàng.
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductCategoryService } from './product-category.service';
import { 
  ProductCategory, 
  CreateProductCategoryDto,
  ProductCategoryStats 
} from './models/product-category.interface';

@Component({
  selector: 'app-product-category',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="product-category-page">
    <div class="toolbar">
      <div class="left">
        <h2>📦 Nhóm Sản Phẩm</h2>
      </div>
      <div class="right">
        <button class="btn btn-primary" (click)="addNew()">➕ Thêm mới</button>
        <button class="btn" (click)="refresh()">🔄 Làm mới</button>
      </div>
    </div>

    <div class="table-wrapper" *ngIf="!isLoading(); else loadingTpl">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tên nhóm</th>
            <th>Mã</th>
            <th>Icon</th>
            <th>Màu sắc</th>
            <th>Mô tả</th>
            <th>Số SP</th>
            <th>Thứ tự</th>
            <th>Ghi chú</th>
            <th>Hoạt động</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let cat of categories(); trackBy: trackById">
            <td>
              <input class="form-control input-inline" [value]="cat.name" (blur)="updateField(cat, 'name', $any($event.target).value)" placeholder="Tên nhóm">
            </td>
            <td>
              <input class="form-control input-inline" [value]="cat.code || ''" (blur)="updateField(cat, 'code', $any($event.target).value)" placeholder="Mã">
            </td>
            <td>
              <select class="form-control input-inline" [value]="cat.icon" (change)="updateField(cat, 'icon', $any($event.target).value)">
                <option value="📦">📦 Hộp</option>
                <option value="📱">📱 Điện tử</option>
                <option value="👕">👕 Thời trang</option>
                <option value="🏠">🏠 Gia dụng</option>
                <option value="📚">📚 Sách</option>
                <option value="⚽">⚽ Thể thao</option>
                <option value="🎮">🎮 Game</option>
                <option value="🍔">🍔 Thực phẩm</option>
                <option value="💄">💄 Làm đẹp</option>
                <option value="🚗">🚗 Ô tô</option>
              </select>
            </td>
            <td>
              <input type="color" class="form-control input-color" [value]="cat.color" (change)="updateField(cat, 'color', $any($event.target).value)">
            </td>
            <td>
              <input class="form-control input-inline" [value]="cat.description || ''" (blur)="updateField(cat, 'description', $any($event.target).value)" placeholder="Mô tả">
            </td>
            <td>
              <input type="number" class="form-control input-inline input-number" [value]="cat.productCount || 0" (blur)="updateField(cat, 'productCount', +$any($event.target).value)" min="0">
            </td>
            <td>
              <input type="number" class="form-control input-inline input-number" [value]="cat.order || 0" (blur)="updateField(cat, 'order', +$any($event.target).value)" min="0">
            </td>
            <td>
              <input class="form-control input-inline" [value]="cat.notes || ''" (blur)="updateField(cat, 'notes', $any($event.target).value)" placeholder="Ghi chú">
            </td>
            <td>
              <input type="checkbox" class="form-check-input" [checked]="cat.isActive" (change)="updateField(cat, 'isActive', $any($event.target).checked)">
            </td>
            <td>
              <button class="btn btn-sm btn-danger" (click)="remove(cat._id!)">Xóa</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ng-template #loadingTpl>
      <div class="loading">Đang tải...</div>
    </ng-template>

    <div *ngIf="error()" class="error">{{ error() }}</div>
  </div>
  `,
  styles: [`
    .product-category-page { padding: 16px; }
    .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .toolbar .left { display: flex; align-items: center; }
    .toolbar .right { display: flex; gap: 8px; }
    .table-wrapper { overflow: auto; border: 1px solid #e5e7eb; border-radius: 6px; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th, .data-table td { border: 1px solid #e5e7eb; padding: 8px; }
    .data-table th { background: #f8fafc; font-weight: 600; }
    .input-inline { width: 100%; border: none; background: transparent; padding: 4px; }
    .input-inline:focus { background: #f8f9fa; border: 1px solid #007bff; }
    .input-color { width: 50px; height: 30px; border: none; cursor: pointer; }
    .input-number { width: 90px; }
    .form-check-input { transform: scale(1.2); }
    .btn { padding: 6px 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 4px; }
    .btn-primary { background: #007bff; color: white; border-color: #007bff; }
    .btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
    .btn-sm { padding: 4px 8px; font-size: 12px; }
    .loading, .error { padding: 16px; text-align: center; }
    .error { color: #dc3545; }
    .data-table tbody tr:hover { background: #f9fafb; }
  `]
})
export class ProductCategoryComponent implements OnInit {
  private svc = inject(ProductCategoryService);

  categories = signal<ProductCategory[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.svc.getAll().subscribe({
      next: (list) => { this.categories.set(list); this.isLoading.set(false); },
      error: (e) => { this.error.set(e?.message || 'Lỗi tải dữ liệu'); this.isLoading.set(false); }
    });
  }

  refresh(): void { this.load(); }

  addNew(): void {
    const data: CreateProductCategoryDto = {
      name: 'Nhóm mới',
      description: 'Mô tả nhóm sản phẩm',
      color: '#3498db',
      icon: '📦',
      isActive: true,
      order: this.categories().length + 1,
      productCount: 0,
      code: '',
      notes: ''
    };
    this.svc.create(data).subscribe({
      next: (created) => { this.categories.update(list => [created, ...list]); },
      error: (e) => { this.error.set('Lỗi khi thêm nhóm: ' + (e?.message || e)); }
    });
  }

  updateField(cat: ProductCategory, field: keyof ProductCategory, value: any): void {
    const patch: Partial<ProductCategory> = { [field]: value } as any;
    this.svc.update(cat._id!, patch).subscribe({
      next: (updated) => {
        this.categories.update(list => list.map(i => i._id === updated._id ? updated : i));
      },
      error: (e) => { this.error.set('Lỗi cập nhật: ' + (e?.message || e)); }
    });
  }

  remove(id: string): void {
    if (!confirm('Xóa nhóm sản phẩm này?')) return;
    this.svc.delete(id).subscribe({
      next: () => { this.categories.update(list => list.filter(i => i._id !== id)); },
      error: (e) => { this.error.set('Lỗi xóa: ' + (e?.message || e)); }
    });
  }

  trackById(index: number, item: ProductCategory): string { return item._id!; }
}
