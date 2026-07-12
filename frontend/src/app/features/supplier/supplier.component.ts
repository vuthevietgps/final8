import { CommonModule } from '@angular/common';
import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Supplier, SupplierService } from './supplier.service';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="page">
    <h2>🤝 Nhà Cung Cấp</h2>
    <div class="filters">
  <input [ngModel]="q()" (ngModelChange)="q.set($event)" placeholder="Tìm tên/email/điện thoại/địa chỉ" />
  <label><input type="checkbox" [ngModel]="onlyActive()" (ngModelChange)="onlyActive.set($event)"/> Chỉ nhà cung cấp đang hoạt động</label>
    </div>
    <div class="summary">Tổng: {{ suppliers().length }}</div>
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Email</th>
            <th>Điện thoại</th>
            <th>Địa chỉ</th>
            <th>Loại</th>
            <th>TT</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of suppliers()">
            <td>{{ s.fullName }}</td>
            <td>{{ s.email || '-' }}</td>
            <td>{{ s.phone || '-' }}</td>
            <td>{{ s.address || '-' }}</td>
            <td>
              <span class="pill" [class.internal]="s.role==='internal_supplier'" [class.external]="s.role==='external_supplier'">
                {{ s.role==='internal_supplier' ? 'NCC Nội Bộ' : 'NCC Ngoài' }}
              </span>
            </td>
            <td>
              <span class="pill" [class.active]="s.isActive" [class.inactive]="!s.isActive">{{ s.isActive ? 'Đang hoạt động' : 'Ngưng' }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `,
  styles: [`
    .page { padding: 12px; }
    .filters { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    .filters input[type='text'], .filters input[type='search'] { padding: 6px 8px; min-width: 280px; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border-bottom: 1px solid #e5e7eb; padding: 8px; text-align: left; }
    .pill { padding: 2px 8px; border-radius: 999px; font-size: 12px; }
    .pill.internal { background: #e0f2fe; color: #0369a1; }
    .pill.external { background: #ecfccb; color: #3f6212; }
    .pill.active { background: #dcfce7; color: #166534; }
    .pill.inactive { background: #fee2e2; color: #991b1b; }
    .table-wrapper { overflow: auto; }
  `]
})
export class SupplierComponent {
  suppliers = signal<Supplier[]>([]);
  q = signal<string>('');
  onlyActive = signal<boolean>(true);

  constructor(private api: SupplierService) {
    effect(() => {
      // initial load
      this.refresh();
    });
  }

  refresh() {
    this.api.list({ q: this.q(), active: this.onlyActive(), minimal: false }).subscribe(res => this.suppliers.set(res));
  }
}
