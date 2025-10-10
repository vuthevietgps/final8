/**
 * File: features/delivery-status/delivery-status.component.ts
 * Mục đích: Giao diện quản lý Trạng thái giao hàng - chỉnh sửa inline (không form), giống Trạng thái sản xuất.
 */
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DeliveryStatusService } from './delivery-status.service';
import { CreateDeliveryStatusDto, DeliveryStatus } from './models/delivery-status.model';

@Component({
  selector: 'app-delivery-status',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="delivery-status-page">
    <div class="toolbar">
      <div class="left">
        <h2>🚚 Trạng Thái Giao Hàng</h2>
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
            <th>Icon</th>
            <th>Màu sắc</th>
            <th>Mô tả</th>
            <th>Ước tính (ngày)</th>
            <th>Thứ tự</th>
            <th>Ghi chú theo dõi</th>
            <th>Hoạt động</th>
            <th>Cuối</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of deliveryStatuses(); trackBy: trackById">
            <td>
              <input class="form-control input-inline" [value]="s.name" (blur)="updateField(s, 'name', $any($event.target).value)" placeholder="Tên trạng thái">
            </td>
            <td>
              <select class="form-control input-inline" [value]="s.icon" (change)="updateField(s, 'icon', $any($event.target).value)">
                <option value="📦">📦</option>
                <option value="🚚">🚚</option>
                <option value="✈️">✈️</option>
                <option value="🚢">🚢</option>
                <option value="🚛">🚛</option>
                <option value="🏠">🏠</option>
                <option value="📍">📍</option>
                <option value="✅">✅</option>
                <option value="❌">❌</option>
                <option value="🔄">🔄</option>
                <option value="⏰">⏰</option>
                <option value="🎯">🎯</option>
              </select>
            </td>
            <td>
              <input type="color" class="form-control input-color" [value]="s.color" (change)="updateField(s, 'color', $any($event.target).value)">
            </td>
            <td>
              <input class="form-control input-inline" [value]="s.description || ''" (blur)="updateField(s, 'description', $any($event.target).value)" placeholder="Mô tả">
            </td>
            <td>
              <input type="number" class="form-control input-inline input-number" [value]="s.estimatedDays || 0" (blur)="updateField(s, 'estimatedDays', +$any($event.target).value)" min="0">
            </td>
            <td>
              <input type="number" class="form-control input-inline input-number" [value]="s.order || 0" (blur)="updateField(s, 'order', +$any($event.target).value)" min="0">
            </td>
            <td>
              <input class="form-control input-inline" [value]="s.trackingNote || ''" (blur)="updateField(s, 'trackingNote', $any($event.target).value)" placeholder="Ghi chú">
            </td>
            <td>
              <input type="checkbox" class="form-check-input" [checked]="s.isActive" (change)="updateField(s, 'isActive', $any($event.target).checked)">
            </td>
            <td>
              <input type="checkbox" class="form-check-input" [checked]="s.isFinal" (change)="updateField(s, 'isFinal', $any($event.target).checked)">
            </td>
            <td>
              <button class="btn btn-sm btn-danger" (click)="remove(s._id!)">Xóa</button>
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
    .delivery-status-page { padding: 16px; }
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
export class DeliveryStatusComponent implements OnInit {
  private svc = inject(DeliveryStatusService);

  deliveryStatuses = signal<DeliveryStatus[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.svc.getAll().subscribe({
      next: (list) => { this.deliveryStatuses.set(list); this.isLoading.set(false); },
      error: (e) => { this.error.set(e?.message || 'Lỗi tải dữ liệu'); this.isLoading.set(false); }
    });
  }

  refresh(): void { this.load(); }

  addNew(): void {
    const data: CreateDeliveryStatusDto = {
      name: 'Trạng thái mới',
      description: 'Mô tả trạng thái mới',
      color: '#3498db',
      icon: '🚚',
      isActive: true,
      isFinal: false,
      order: this.deliveryStatuses().length,
      estimatedDays: 0,
      trackingNote: ''
    };
    this.svc.create(data).subscribe({
      next: (created) => { this.deliveryStatuses.update(list => [created, ...list]); },
      error: (e) => { this.error.set('Lỗi khi thêm trạng thái: ' + (e?.message || e)); }
    });
  }

  updateField(s: DeliveryStatus, field: keyof DeliveryStatus, value: any): void {
    const patch: Partial<DeliveryStatus> = { [field]: value } as any;
    this.svc.update(s._id!, patch).subscribe({
      next: (updated) => {
        this.deliveryStatuses.update(list => list.map(i => i._id === updated._id ? updated : i));
      },
      error: (e) => { this.error.set('Lỗi cập nhật: ' + (e?.message || e)); }
    });
  }

  remove(id: string): void {
    if (!confirm('Xóa trạng thái này?')) return;
    this.svc.delete(id).subscribe({
      next: () => { this.deliveryStatuses.update(list => list.filter(i => i._id !== id)); },
      error: (e) => { this.error.set('Lỗi xóa: ' + (e?.message || e)); }
    });
  }

  trackById(index: number, item: DeliveryStatus): string { return item._id!; }
}
