import { Component, OnInit, signal, computed, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { SalaryConfigService } from './salary-config.service';
import { SalaryConfig } from './salary-config.model';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

@Component({
  selector: 'app-salary-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
  <div class="container">
    <h2>⚙️ Cấu Hình Lương Theo Giờ</h2>

    <div class="row add-row">
      <div>
        <label>User</label>
        <select [(ngModel)]="newUserId" class="form-control">
          <option value="">-- Chọn user --</option>
          <option *ngFor="let u of users()" [value]="u._id">{{ u.fullName }}</option>
        </select>
      </div>
      <div>
        <label>Lương/Giờ</label>
        <input type="number" min="0" step="1000" class="form-control" [(ngModel)]="newHourlyRate">
      </div>
      <div>
        <button class="btn btn-primary" (click)="addConfig()" [disabled]="!newUserId || newHourlyRate===null">+ Thêm</button>
      </div>
    </div>

    <div class="table-wrapper" *ngIf="!loading() && !error()">
      <table class="table">
        <thead>
          <tr>
            <th>User</th>
            <th>Lương/Giờ</th>
            <th>Ghi chú</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of rows(); trackBy: trackById">
            <td>{{ displayUser(row.userId) }}</td>
            <td>
              <input type="number" min="0" step="1000" [value]="row.hourlyRate"
                (blur)="saveInline(row, $event.target['value'])"
                (keydown.enter)="saveInline(row, $event.target['value'])"
                class="form-control input-inline">
            </td>
            <td>
              <input type="text" [value]="row.notes || ''"
                (blur)="saveInline(row, undefined, $event.target['value'])"
                (keydown.enter)="saveInline(row, undefined, $event.target['value'])"
                class="form-control input-inline">
            </td>
            <td>
              <button class="btn btn-sm btn-danger" (click)="remove(row._id!)">Xóa</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div *ngIf="loading()" class="loading">Đang tải…</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>
  </div>
  `,
  styles: [`
    .container { padding: 16px; }
    .row.add-row { display: flex; gap: 12px; align-items: end; margin-bottom: 12px; }
    .row.add-row > div { min-width: 200px; }
    .table-wrapper { overflow: auto; }
    .input-inline { width: 160px; }
    .loading, .error { padding: 16px; }
  `]
})
export class SalaryConfigComponent implements OnInit {
  private salarySvc = inject(SalaryConfigService);
  private userSvc = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  users = signal<User[]>([]);
  rows = signal<SalaryConfig[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  newUserId: string = '';
  newHourlyRate: number | null = null;

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set(null);
    this.userSvc.getUsers().subscribe({
      next: u => { this.users.set(u); this.cdr.detectChanges(); },
      error: e => { console.error(e); }
    });
    this.salarySvc.list().subscribe({
      next: rows => { this.rows.set(rows); this.loading.set(false); this.cdr.detectChanges(); },
      error: err => { this.error.set('Không tải được dữ liệu'); this.loading.set(false); this.cdr.detectChanges(); }
    });
  }

  addConfig(): void {
    if (!this.newUserId || this.newHourlyRate === null || this.newHourlyRate < 0) return;
    this.salarySvc.create({ userId: this.newUserId, hourlyRate: this.newHourlyRate }).subscribe({
      next: row => {
        // nếu đã tồn tại userId thì backend upsert sẽ trả về row cập nhật
        const others = this.rows().filter(r => (typeof r.userId === 'string' ? r.userId : r.userId['_id']) !== this.newUserId);
        this.rows.set([row, ...others]);
        this.newUserId = '';
        this.newHourlyRate = null;
        this.cdr.detectChanges();
      },
      error: err => { console.error(err); }
    });
  }

  saveInline(row: SalaryConfig, hourly?: any, notes?: string): void {
    const patch: any = {};
    if (hourly !== undefined) {
      const v = Number(hourly);
      if (!isFinite(v) || v < 0) return;
      patch.hourlyRate = v;
    }
    if (notes !== undefined) {
      patch.notes = notes;
    }
    if (Object.keys(patch).length === 0 || !row._id) return;
    this.salarySvc.updateField(row._id, patch).subscribe({
      next: updated => {
        const updatedList = this.rows().map(r => r._id === updated._id ? updated : r);
        this.rows.set(updatedList);
        this.cdr.detectChanges();
      },
      error: err => { console.error(err); }
    });
  }

  remove(id: string): void {
    if (!confirm('Xóa cấu hình lương này?')) return;
    this.salarySvc.remove(id).subscribe({
      next: () => {
        this.rows.set(this.rows().filter(r => r._id !== id));
        this.cdr.detectChanges();
      },
      error: err => { console.error(err); }
    });
  }

  displayUser(userId: any): string {
    if (!userId) return '';
    if (typeof userId === 'object' && userId.fullName) return userId.fullName;
    const u = this.users().find(x => x._id === userId);
    return u?.fullName || userId;
  }

  trackById = (_: number, row: SalaryConfig) => row._id || (typeof row.userId === 'string' ? row.userId : row.userId['_id']);
}
