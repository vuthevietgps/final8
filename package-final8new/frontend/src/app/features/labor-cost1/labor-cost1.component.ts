/**
 * File: features/labor-cost1/labor-cost1.component.ts
 * Mô tả: UI Chi Phí Nhân Công 1 - danh sách + form thêm mới + bảng tổng hợp theo ngày.
 */
import { Component, OnInit, ChangeDetectorRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LaborCost1Service } from './labor-cost1.service';
import { CreateLaborCost1Dto, LaborCost1 } from './labor-cost1.model';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

@Component({
  selector: 'app-labor-cost1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="container">
    <h2>🧑‍🏭 Chi Phí Nhân Công 1</h2>

    <div class="toolbar">
      <button class="btn btn-primary" (click)="addNew()">+ Thêm mới</button>
      <button class="btn btn-success" (click)="generateFromSessions()" [disabled]="generating()">
        {{ generating() ? '🔄 Đang tạo...' : '🤖 Tạo từ Session Logs' }}
      </button>
    </div>

    <div class="list" *ngIf="!loading() && !error()">
      <table class="table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nhân công</th>
            <th>Giờ đến</th>
            <th>Giờ về</th>
            <th>Giờ làm</th>
            <th>Lương/giờ</th>
            <th>Chi phí chi tiết</th>
            <th>Ghi chú</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let r of rows(); trackBy: trackById">
            <td>
              <input class="form-control input-inline" [value]="toDateDisplay(r.date)"
                (blur)="saveInline(r, { date: $any($event.target).value })"
                (keydown.enter)="onEnter($event)"
                placeholder="dd/MM/yyyy">
            </td>
            <td>
              <select class="form-control input-inline"
                [value]="getUserId(r.userId)"
                (change)="saveInline(r, { userId: $any($event.target).value })">
                <option value="">-- Chọn user --</option>
                <option *ngFor="let u of users()" [value]="u._id">{{ u.fullName }}</option>
              </select>
            </td>
            <td>
              <input class="form-control input-inline" [value]="r.startTime"
                (blur)="saveInline(r, { startTime: $any($event.target).value })"
                (keydown.enter)="onEnter($event)" placeholder="HH:mm">
            </td>
            <td>
              <input class="form-control input-inline" [value]="r.endTime"
                (blur)="saveInline(r, { endTime: $any($event.target).value })"
                (keydown.enter)="onEnter($event)" placeholder="HH:mm">
            </td>
            <td>{{ r.workHours }}</td>
            <td>{{ r.hourlyRate | number:'1.0-0' }}</td>
            <td>{{ r.cost | number:'1.0-0' }}</td>
            <td>
              <input class="form-control input-inline" [value]="r.notes || ''"
                (blur)="saveInline(r, { notes: $any($event.target).value })"
                (keydown.enter)="onEnter($event)">
            </td>
            <td><button class="btn btn-sm btn-danger" (click)="remove(r._id!)">Xóa</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="summary" *ngIf="!loading() && !error()">
      <h3>Tổng hợp theo ngày</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Ngày tháng</th>
            <th>Chi Phí Nhân Công (tổng)</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let s of summaryByDay(); trackBy: trackByDay">
            <td>{{ s.date }}</td>
            <td>{{ s.total | number:'1.0-0' }}</td>
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
    .toolbar { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border: 1px solid #eee; padding: 6px 8px; }
    .input-inline { width: 100%; border: none; background: transparent; }
    .input-inline:focus { background: #f8f9fa; border: 1px solid #007bff; }
    .summary { margin-top: 24px; }
    .loading, .error { padding: 16px; text-align: center; }
    .error { color: #dc3545; }
    .btn { padding: 6px 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 4px; }
    .btn-primary { background: #007bff; color: white; border-color: #007bff; }
    .btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
    .btn-sm { padding: 4px 8px; font-size: 12px; }
  `]
})
export class LaborCost1Component implements OnInit {
  private laborSvc = inject(LaborCost1Service);
  private userSvc = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  users = signal<User[]>([]);
  rows = signal<LaborCost1[]>([]);
  loading = signal<boolean>(false);
  generating = signal<boolean>(false);
  error = signal<string | null>(null);
  private saving = new Set<string>();

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading.set(true); this.error.set(null);
    this.userSvc.getUsers().subscribe({ next: u => this.users.set(u), error: e => console.error(e) });
    this.laborSvc.list().subscribe({
      next: rs => { this.rows.set(rs); this.loading.set(false); this.cdr.detectChanges(); },
      error: _ => { this.error.set('Không tải được dữ liệu'); this.loading.set(false); this.cdr.detectChanges(); }
    });
  }

  private toIsoDateFromDDMMYYYY(s: string): string {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return s; // fallback nếu user nhập ISO
    const dd = Number(m[1]); const MM = Number(m[2]); const yyyy = Number(m[3]);
    const d = new Date(yyyy, MM - 1, dd);
    const yyyy2 = d.getFullYear();
    const mm2 = String(d.getMonth() + 1).padStart(2, '0');
    const dd2 = String(d.getDate()).padStart(2, '0');
    return `${yyyy2}-${mm2}-${dd2}`;
  }

  addNew(): void {
    // Kiểm tra có user nào không
    if (this.users().length === 0) {
      this.error.set('Vui lòng thêm user trước khi tạo chi phí nhân công');
      return;
    }
    
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    
    // Lấy user đầu tiên làm mặc định
    const defaultUserId = this.users()[0]._id;
    if (!defaultUserId) {
      this.error.set('User không hợp lệ');
      return;
    }
    
    const dto: CreateLaborCost1Dto = {
      date: `${yyyy}-${mm}-${dd}`,
      userId: defaultUserId, 
      startTime: '08:00',
      endTime: '17:00',
      notes: '',
    };
    
    this.laborSvc.create(dto).subscribe({
      next: r => { 
        this.rows.set([r, ...this.rows()]); 
        this.cdr.detectChanges(); 
      },
      error: err => { 
        console.error(err);
        this.error.set(`Lỗi khi thêm chi phí: ${err.message || err}`);
      }
    });
  }

  remove(id: string): void {
    if (!confirm('Xóa bản ghi này?')) return;
    this.laborSvc.remove(id).subscribe({ next: _ => { this.rows.set(this.rows().filter(x => x._id !== id)); this.cdr.detectChanges(); } });
  }

  generateFromSessions(): void {
    this.generating.set(true);
    this.error.set(null);
    
    // Tạo từ session logs cho tất cả users và tất cả ngày
    this.laborSvc.generateFromSessionLogs().subscribe({
      next: result => {
        this.generating.set(false);
        console.log('Generate result:', result);
        
        if (result.created > 0) {
          // Reload data to show new records
          this.loadAll();
          alert(`✅ Đã tạo thành công ${result.created} bản ghi chi phí nhân công từ session logs!`);
        } else {
          alert(`ℹ️ ${result.message}\n\nChi tiết: ${result.results?.map((r: any) => `${r.status}: ${r.reason || 'OK'}`).join('\n') || 'Không có dữ liệu'}`);
        }
      },
      error: err => {
        this.generating.set(false);
        console.error('Generate error:', err);
        this.error.set(`Lỗi khi tạo từ session logs: ${err.message || err}`);
      }
    });
  }

  displayUser(userId: any): string {
    if (!userId) return '';
    if (typeof userId === 'object' && userId.fullName) return userId.fullName;
    const u = this.users().find(x => x._id === userId);
    return u?.fullName || userId;
  }

  getUserId(userId: any): string {
    if (!userId) return '';
    return typeof userId === 'object' ? (userId._id || userId.id || '') : userId;
  }

  toDateDisplay(d: any): string {
    const date = new Date(d);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  summaryByDay = computed(() => {
    const map = new Map<string, number>();
    for (const r of this.rows()) {
      const key = this.toDateDisplay(r.date);
      map.set(key, (map.get(key) || 0) + (r.cost || 0));
    }
    return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
  });

  trackById = (_: number, r: LaborCost1) => r._id;
  trackByDay = (_: number, s: { date: string; total: number }) => s.date;

  onEnter(e: Event) {
    // Accept generic Event to align with Angular's template typing for (keydown.enter)
    e.preventDefault();
    const el = e.target as HTMLInputElement;
    if (el && el.blur) el.blur(); // chỉ lưu ở blur để tránh gọi đôi
  }

  saveInline(r: LaborCost1, patch: any): void {
    if (!r._id) return;
    // Chuẩn hóa date từ dd/MM/yyyy -> yyyy-MM-dd
    if (patch.date) {
      const iso = this.toIsoDateFromDDMMYYYY(String(patch.date).trim());
      patch = { ...patch, date: iso };
    }
    // Bỏ qua nếu không có thay đổi
    const same = (
      (patch.startTime === undefined || patch.startTime === r.startTime) &&
      (patch.endTime === undefined || patch.endTime === r.endTime) &&
      (patch.notes === undefined || patch.notes === r.notes) &&
      (patch.userId === undefined || this.getUserId(r.userId) === patch.userId) &&
      (patch.date === undefined)
    );
    if (same) return;

    if (this.saving.has(r._id)) return;
    this.saving.add(r._id);
    this.laborSvc.update(r._id, patch).subscribe({
      next: updated => {
        this.rows.set(this.rows().map(x => x._id === updated._id ? updated : x));
        this.saving.delete(r._id!);
        this.cdr.detectChanges();
      },
      error: err => {
        console.error(err);
        this.saving.delete(r._id!);
      }
    });
  }
}
