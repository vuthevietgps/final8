/**
 * File: features/production-status/production-status.component.ts
 * Purpose: Inline CRUD UI for production statuses.
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionStatusService } from './production-status.service';
import {
  ProductionStatus,
  CreateProductionStatus,
  UpdateProductionStatus,
} from './models/production-status.model';

@Component({
  selector: 'app-production-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="production-status-page">
      <div class="toolbar">
        <div class="left">
          <h2>🏭 Trạng Thái Sản Xuất</h2>
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
              <th>Tên trạng thái</th>
              <th>Màu sắc</th>
              <th>Mô tả</th>
              <th>Thứ tự</th>
              <th>Hoạt động</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let status of productionStatuses(); trackBy: trackById">
              <td>
                <input
                  class="form-control input-inline"
                  [value]="status.name"
                  (blur)="updateField(status, 'name', $any($event.target).value)"
                  placeholder="Tên trạng thái"
                />
              </td>
              <td>
                <input
                  type="color"
                  class="form-control input-color"
                  [value]="status.color"
                  (change)="updateField(status, 'color', $any($event.target).value)"
                />
              </td>
              <td>
                <input
                  class="form-control input-inline"
                  [value]="status.description || ''"
                  (blur)="updateField(status, 'description', $any($event.target).value)"
                  placeholder="Mô tả"
                />
              </td>
              <td>
                <input
                  type="number"
                  class="form-control input-inline input-number"
                  [value]="status.order || 0"
                  (blur)="updateField(status, 'order', +$any($event.target).value)"
                  min="0"
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  class="form-check-input"
                  [checked]="status.isActive"
                  (change)="updateField(status, 'isActive', $any($event.target).checked)"
                />
              </td>
              <td>
                <button class="btn btn-sm btn-danger" (click)="remove(status._id)">Xóa</button>
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
    .production-status-page { padding: 16px; }
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
    .input-number { width: 80px; }
    .form-check-input { transform: scale(1.2); }
    .btn { padding: 6px 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 4px; }
    .btn-primary { background: #007bff; color: white; border-color: #007bff; }
    .btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
    .btn-sm { padding: 4px 8px; font-size: 12px; }
    .loading, .error { padding: 16px; text-align: center; }
    .error { color: #dc3545; }
    .data-table tbody tr:hover { background: #f9fafb; }
  `],
})
export class ProductionStatusComponent implements OnInit {
  private readonly draftBaseName = 'Trạng thái mới';

  productionStatuses = signal<ProductionStatus[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor(private productionStatusService: ProductionStatusService) {}

  ngOnInit(): void {
    this.loadProductionStatuses();
  }

  loadProductionStatuses(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.productionStatusService.getProductionStatuses().subscribe({
      next: (statuses) => {
        this.productionStatuses.set(statuses);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.error.set(error.message || 'Lỗi tải dữ liệu');
        this.isLoading.set(false);
      },
    });
  }

  refresh(): void {
    this.loadProductionStatuses();
  }

  addNew(): void {
    const data: CreateProductionStatus = {
      name: this.getNextDraftName(),
      color: '#007bff',
      description: '',
      order: this.productionStatuses().length,
      isActive: true,
    };

    this.productionStatusService.createProductionStatus(data).subscribe({
      next: (created) => {
        this.productionStatuses.update((list) => [created, ...list]);
      },
      error: (error) => {
        this.error.set('Lỗi khi thêm trạng thái: ' + (error.message || error));
      },
    });
  }

  updateField(status: ProductionStatus, field: keyof ProductionStatus, value: unknown): void {
    const updateData: UpdateProductionStatus = { [field]: value };

    this.productionStatusService.updateProductionStatus(status._id, updateData).subscribe({
      next: (updated) => {
        this.productionStatuses.update((list) =>
          list.map((item) => (item._id === status._id ? updated : item)),
        );
      },
      error: (error) => {
        this.error.set('Lỗi cập nhật: ' + (error.message || error));
      },
    });
  }

  remove(id: string): void {
    if (!confirm('Xóa trạng thái này?')) return;

    this.productionStatusService.deleteProductionStatus(id).subscribe({
      next: () => {
        this.productionStatuses.update((list) => list.filter((item) => item._id !== id));
      },
      error: (error) => {
        this.error.set('Lỗi xóa: ' + (error.message || error));
      },
    });
  }

  trackById(index: number, item: ProductionStatus): string {
    return item._id;
  }

  private getNextDraftName(): string {
    const names = new Set(
      this.productionStatuses()
        .map((status) => status.name?.trim().toLowerCase())
        .filter((name): name is string => !!name),
    );

    if (!names.has(this.draftBaseName.toLowerCase())) {
      return this.draftBaseName;
    }

    let index = 2;
    while (names.has(`${this.draftBaseName} ${index}`.toLowerCase())) {
      index++;
    }

    return `${this.draftBaseName} ${index}`;
  }
}
