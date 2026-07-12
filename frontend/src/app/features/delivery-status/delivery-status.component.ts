/**
 * File: features/delivery-status/delivery-status.component.ts
 * Purpose: Inline CRUD UI for delivery statuses.
 */
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
              <th>Thứ tự</th>
              <th title="Kích hoạt">✓</th>
              <th title="Trạng thái kết thúc">Cuối</th>
              <th title="Trigger thanh toán NCC + hoa hồng">💰</th>
              <th title="Trạng thái hoàn hàng">↩️</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let status of deliveryStatuses(); trackBy: trackById"
              [class.payment-trigger]="status.isPaymentTrigger"
            >
              <td>
                <input
                  class="form-control input-inline"
                  [value]="status.name"
                  (blur)="updateField(status, 'name', $any($event.target).value)"
                  placeholder="Tên trạng thái"
                />
              </td>
              <td>
                <select
                  class="form-control input-inline"
                  [value]="status.icon"
                  (change)="updateField(status, 'icon', $any($event.target).value)"
                >
                  <option *ngIf="!hasIconOption(status.icon)" [value]="status.icon">{{ status.icon }}</option>
                  <option *ngFor="let option of iconOptions" [value]="option.value">
                    {{ option.label }}
                  </option>
                </select>
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
                <input
                  type="checkbox"
                  class="form-check-input"
                  [checked]="status.isFinal"
                  (change)="updateField(status, 'isFinal', $any($event.target).checked)"
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  class="form-check-input"
                  [checked]="status.isPaymentTrigger"
                  (change)="updateField(status, 'isPaymentTrigger', $any($event.target).checked)"
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  class="form-check-input"
                  [checked]="status.isReturnStatus"
                  (change)="updateField(status, 'isReturnStatus', $any($event.target).checked)"
                />
              </td>
              <td>
                <button class="btn btn-sm btn-danger" (click)="remove(status._id!)">Xóa</button>
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
    .data-table tbody tr.payment-trigger { background: #ecfdf5; border-left: 3px solid #22c55e; }
    .data-table tbody tr.payment-trigger:hover { background: #dcfce7; }
  `],
})
export class DeliveryStatusComponent implements OnInit {
  private readonly svc = inject(DeliveryStatusService);
  private readonly draftBaseName = 'Trạng thái mới';

  readonly iconOptions = [
    { value: 'box', label: '📦 Box' },
    { value: 'truck', label: '🚚 Truck' },
    { value: 'check', label: '✅ Check' },
    { value: 'return', label: '↩️ Return' },
    { value: 'cross', label: '❌ Cross' },
    { value: 'refresh', label: '🔄 Refresh' },
    { value: '📦', label: '📦 Legacy' },
    { value: '🚚', label: '🚚 Legacy' },
    { value: '✅', label: '✅ Legacy' },
    { value: '↩️', label: '↩️ Legacy' },
    { value: '❌', label: '❌ Legacy' },
    { value: '🔄', label: '🔄 Legacy' },
  ];

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
      next: (list) => {
        this.deliveryStatuses.set(list);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.error.set(error?.message || 'Lỗi tải dữ liệu');
        this.isLoading.set(false);
      },
    });
  }

  refresh(): void {
    this.load();
  }

  addNew(): void {
    const data: CreateDeliveryStatusDto = {
      name: this.getNextDraftName(),
      description: 'Mô tả trạng thái mới',
      color: '#3498db',
      icon: 'truck',
      isActive: true,
      isFinal: false,
      isPaymentTrigger: false,
      isReturnStatus: false,
      order: this.deliveryStatuses().length,
    };

    this.svc.create(data).subscribe({
      next: (created) => {
        this.deliveryStatuses.update((list) => [created, ...list]);
      },
      error: (error) => {
        this.error.set('Lỗi khi thêm trạng thái: ' + (error?.message || error));
      },
    });
  }

  updateField(status: DeliveryStatus, field: keyof DeliveryStatus, value: unknown): void {
    const patch: Partial<DeliveryStatus> = { [field]: value } as Partial<DeliveryStatus>;
    this.svc.update(status._id!, patch).subscribe({
      next: (updated) => {
        this.deliveryStatuses.update((list) =>
          list.map((item) => (item._id === updated._id ? updated : item)),
        );
      },
      error: (error) => {
        this.error.set('Lỗi cập nhật: ' + (error?.message || error));
      },
    });
  }

  remove(id: string): void {
    if (!confirm('Xóa trạng thái này?')) return;
    this.svc.delete(id).subscribe({
      next: () => {
        this.deliveryStatuses.update((list) => list.filter((item) => item._id !== id));
      },
      error: (error) => {
        this.error.set('Lỗi xóa: ' + (error?.message || error));
      },
    });
  }

  hasIconOption(icon: string): boolean {
    return this.iconOptions.some((option) => option.value === icon);
  }

  trackById(index: number, item: DeliveryStatus): string {
    return item._id!;
  }

  private getNextDraftName(): string {
    const names = new Set(
      this.deliveryStatuses()
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
