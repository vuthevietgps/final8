import { Component, OnInit, signal, computed, effect, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { SalaryConfigService } from './salary-config.service';
import { SalaryConfig, AttendanceTier, KpiBonusTier, PunctualityRules } from './salary-config.model';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

@Component({
  selector: 'app-salary-config',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
  <div class="salary-config-page">
    <header class="page-header">
      <h2>⚙️ Cấu Hình Lương Nhân Viên</h2>
      <p class="subtitle">Lương theo giờ • Thưởng chuyên cần • Thưởng KPI • Thưởng/Phạt chấm công</p>
    </header>

    <!-- Add new config -->
    <section class="add-section">
      <h3>➕ Thêm Cấu Hình Mới</h3>
      <div class="add-form">
        <div class="form-group">
          <label>Nhân viên</label>
          <select [(ngModel)]="newUserId" class="form-control">
            <option value="">-- Chọn nhân viên --</option>
            <option *ngFor="let u of availableUsers()" [value]="u._id">{{ u.fullName }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>Chu kỳ lương</label>
          <select [(ngModel)]="newPayrollCycle" class="form-control">
            <option value="monthly">Theo tháng</option>
            <option value="weekly">Theo tuần</option>
          </select>
        </div>
        <div class="form-group">
          <label>Lương/Giờ (đ)</label>
          <input type="number" min="0" step="1000" class="form-control" [(ngModel)]="newHourlyRate" placeholder="VD: 50000">
        </div>
        <button class="btn btn-primary" (click)="addConfig()" [disabled]="!newUserId || newHourlyRate === null">
          ➕ Thêm
        </button>
      </div>
    </section>

    <div *ngIf="loading()" class="loading">Đang tải...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>

    <!-- Salary configs list -->
    <section class="configs-section" *ngIf="!loading() && !error()">
      <div class="config-card" *ngFor="let row of rows(); trackBy: trackById">
        <div class="config-header">
          <div class="employee-info">
            <span class="employee-name">👤 {{ displayUser(row.userId) }}</span>
            <span class="badge" [class.weekly]="row.payrollCycle === 'weekly'">
              {{ row.payrollCycle === 'weekly' ? 'Tuần' : 'Tháng' }}
            </span>
          </div>
          <div class="config-actions">
            <button class="btn btn-sm btn-secondary" (click)="toggleExpand(row._id!)">
              {{ expandedId() === row._id ? '▲ Thu gọn' : '▼ Chi tiết' }}
            </button>
            <button class="btn btn-sm btn-danger" (click)="remove(row._id!)">🗑️</button>
          </div>
        </div>

        <!-- Basic info always visible -->
        <div class="config-summary">
          <div class="summary-item">
            <span class="label">💰 Lương/Giờ:</span>
            <input type="number" min="0" step="1000" [value]="row.hourlyRate" #hourlyInput
              (blur)="saveField(row, 'hourlyRate', hourlyInput.value)"
              class="inline-input">
            <span class="unit">đ</span>
          </div>
          <div class="summary-item" *ngIf="row.attendanceTiers?.length">
            <span class="label">🎯 Chuyên cần:</span>
            <span class="value">{{ row.attendanceTiers.length }} bậc</span>
          </div>
          <div class="summary-item" *ngIf="row.kpiBonusTiers?.length">
            <span class="label">📊 KPI:</span>
            <span class="value">{{ row.kpiBonusTiers.length }} bậc</span>
          </div>
          <div class="summary-item" *ngIf="row.punctualityRules">
            <span class="label">⏰ Chấm công:</span>
            <span class="value">Trước {{ row.punctualityRules.checkInDeadline }}</span>
          </div>
        </div>

        <!-- Expanded detail -->
        <div class="config-detail" *ngIf="expandedId() === row._id">
          <!-- Payroll Cycle -->
          <div class="detail-section">
            <h4>📅 Chu Kỳ Lương</h4>
            <select [value]="row.payrollCycle" #cycleSelect (change)="saveField(row, 'payrollCycle', cycleSelect.value)" class="form-control">
              <option value="monthly">Theo tháng</option>
              <option value="weekly">Theo tuần</option>
            </select>
          </div>

          <!-- Attendance Tiers -->
          <div class="detail-section">
            <h4>🎯 Bậc Thưởng Chuyên Cần</h4>
            <p class="hint">Thưởng dựa trên tổng giờ làm việc trong {{ row.payrollCycle === 'weekly' ? 'tuần' : 'tháng' }}</p>
            <table class="tier-table" *ngIf="row.attendanceTiers?.length">
              <thead>
                <tr>
                  <th>Từ (giờ)</th>
                  <th>Đến (giờ)</th>
                  <th>Thưởng (đ)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let tier of row.attendanceTiers; let i = index">
                  <td><input type="number" [(ngModel)]="tier.minHours" (blur)="saveAttendanceTiers(row)" class="tier-input"></td>
                  <td><input type="number" [(ngModel)]="tier.maxHours" (blur)="saveAttendanceTiers(row)" class="tier-input"></td>
                  <td><input type="number" [(ngModel)]="tier.bonusAmount" (blur)="saveAttendanceTiers(row)" class="tier-input"></td>
                  <td><button class="btn-icon" (click)="removeAttendanceTier(row, i)">❌</button></td>
                </tr>
              </tbody>
            </table>
            <button class="btn btn-sm btn-secondary" (click)="addAttendanceTier(row)">➕ Thêm bậc</button>
          </div>

          <!-- KPI Bonus Tiers -->
          <div class="detail-section">
            <h4>📊 Bậc Thưởng KPI</h4>
            <p class="hint">Thưởng dựa trên % hoàn thành KPI (Giám đốc nhập khi tính lương)</p>
            <table class="tier-table" *ngIf="row.kpiBonusTiers?.length">
              <thead>
                <tr>
                  <th>Từ (%)</th>
                  <th>Đến (%)</th>
                  <th>Thưởng (đ)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let tier of row.kpiBonusTiers; let i = index">
                  <td><input type="number" [(ngModel)]="tier.minPercent" (blur)="saveKpiBonusTiers(row)" class="tier-input"></td>
                  <td><input type="number" [(ngModel)]="tier.maxPercent" (blur)="saveKpiBonusTiers(row)" class="tier-input"></td>
                  <td><input type="number" [(ngModel)]="tier.bonusAmount" (blur)="saveKpiBonusTiers(row)" class="tier-input"></td>
                  <td><button class="btn-icon" (click)="removeKpiBonusTier(row, i)">❌</button></td>
                </tr>
              </tbody>
            </table>
            <button class="btn btn-sm btn-secondary" (click)="addKpiBonusTier(row)">➕ Thêm bậc</button>
          </div>

          <!-- Punctuality Rules -->
          <div class="detail-section">
            <h4>⏰ Quy Tắc Chấm Công</h4>
            <p class="hint">Thưởng đúng giờ / Phạt đi trễ dựa trên thời gian đăng nhập</p>
            <div class="punctuality-form" *ngIf="row.punctualityRules; else noPunctuality">
              <div class="form-row">
                <div class="form-group">
                  <label>Deadline check-in</label>
                  <input type="time" [(ngModel)]="row.punctualityRules.checkInDeadline" (blur)="savePunctualityRules(row)" class="form-control">
                </div>
                <div class="form-group">
                  <label>Ân hạn (phút)</label>
                  <input type="number" min="0" [(ngModel)]="row.punctualityRules.gracePeriodMinutes" (blur)="savePunctualityRules(row)" class="form-control">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Thưởng đúng giờ (đ/ngày)</label>
                  <input type="number" min="0" [(ngModel)]="row.punctualityRules.onTimeBonus" (blur)="savePunctualityRules(row)" class="form-control">
                </div>
                <div class="form-group">
                  <label>Phạt trễ (đ/ngày)</label>
                  <input type="number" min="0" [(ngModel)]="row.punctualityRules.latePenalty" (blur)="savePunctualityRules(row)" class="form-control">
                </div>
              </div>
              <button class="btn btn-sm btn-danger" (click)="removePunctualityRules(row)">🗑️ Xóa quy tắc</button>
            </div>
            <ng-template #noPunctuality>
              <button class="btn btn-sm btn-secondary" (click)="addPunctualityRules(row)">➕ Thêm quy tắc chấm công</button>
            </ng-template>
          </div>

          <!-- Payment Days -->
          <div class="detail-section">
            <h4>📆 Ngày Thanh Toán Lương</h4>
            <p class="hint">Ngày trong tháng sẽ thanh toán lương (dùng để tính dueDate cho Financial Control)</p>
            <div class="payment-days-form">
              <div class="payment-days-list" *ngIf="row.paymentDays?.length">
                <span class="payment-day-tag" *ngFor="let day of row.paymentDays; let i = index">
                  Ngày {{ day }}
                  <button class="btn-icon btn-remove-day" (click)="removePaymentDay(row, i)">×</button>
                </span>
              </div>
              <div class="add-payment-day">
                <input type="number" min="1" max="28" class="tier-input" placeholder="1-28" 
                  #paymentDayInput (keyup.enter)="addPaymentDay(row, paymentDayInput)">
                <button class="btn btn-sm btn-secondary" (click)="addPaymentDay(row, paymentDayInput)">➕ Thêm ngày</button>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div class="detail-section">
            <h4>📝 Ghi Chú</h4>
            <textarea [(ngModel)]="row.notes" (blur)="saveField(row, 'notes', row.notes)" class="form-control" rows="2" placeholder="Ghi chú thêm..."></textarea>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="rows().length === 0">
        <p>Chưa có cấu hình lương nào. Hãy thêm cấu hình mới ở trên.</p>
      </div>
    </section>
  </div>
  `,
  styles: [`
    .salary-config-page { padding: 20px; max-width: 1000px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-header h2 { margin: 0 0 4px 0; }
    .subtitle { color: #666; margin: 0; }

    .add-section { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .add-section h3 { margin: 0 0 12px 0; font-size: 16px; }
    .add-form { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
    .add-form .form-group { min-width: 150px; }
    .add-form label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }
    .form-control { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }

    .configs-section { display: flex; flex-direction: column; gap: 16px; }

    .config-card { background: white; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
    .config-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f5f5f5; }
    .employee-info { display: flex; align-items: center; gap: 12px; }
    .employee-name { font-weight: 600; font-size: 16px; }
    .badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; background: #e3f2fd; color: #1976d2; }
    .badge.weekly { background: #fff3e0; color: #f57c00; }
    .config-actions { display: flex; gap: 8px; }

    .config-summary { display: flex; gap: 24px; padding: 12px 16px; flex-wrap: wrap; border-bottom: 1px solid #eee; }
    .summary-item { display: flex; align-items: center; gap: 8px; }
    .summary-item .label { color: #666; font-size: 13px; }
    .summary-item .value { font-weight: 500; }
    .inline-input { width: 100px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; text-align: right; }
    .unit { color: #666; }

    .config-detail { padding: 16px; }
    .detail-section { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
    .detail-section:last-child { border-bottom: none; margin-bottom: 0; }
    .detail-section h4 { margin: 0 0 8px 0; font-size: 14px; }
    .hint { font-size: 12px; color: #888; margin: 0 0 12px 0; }

    .tier-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .tier-table th, .tier-table td { padding: 8px; text-align: left; border-bottom: 1px solid #eee; }
    .tier-table th { font-size: 12px; color: #666; font-weight: 500; }
    .tier-input { width: 80px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; }

    .punctuality-form { background: #fafafa; padding: 12px; border-radius: 6px; }
    .form-row { display: flex; gap: 16px; margin-bottom: 12px; }
    .form-row .form-group { flex: 1; }
    .form-row label { display: block; font-size: 12px; color: #666; margin-bottom: 4px; }

    .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
    .btn-primary { background: #1976d2; color: white; }
    .btn-primary:hover { background: #1565c0; }
    .btn-secondary { background: #e0e0e0; color: #333; }
    .btn-secondary:hover { background: #d0d0d0; }
    .btn-danger { background: #f44336; color: white; }
    .btn-danger:hover { background: #d32f2f; }
    .btn-sm { padding: 4px 12px; font-size: 12px; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 14px; }

    .loading, .error { padding: 20px; text-align: center; }
    .error { color: #d32f2f; }
    .empty-state { padding: 40px; text-align: center; color: #666; }

    .payment-days-form { display: flex; flex-direction: column; gap: 8px; }
    .payment-days-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .payment-day-tag { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #e3f2fd; color: #1976d2; border-radius: 16px; font-size: 13px; }
    .btn-remove-day { background: none; border: none; color: #1976d2; cursor: pointer; font-size: 16px; padding: 0; margin-left: 2px; }
    .btn-remove-day:hover { color: #d32f2f; }
    .add-payment-day { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
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
  expandedId = signal<string | null>(null);

  newUserId: string = '';
  newPayrollCycle: 'weekly' | 'monthly' = 'monthly';
  newHourlyRate: number | null = null;

  // Chỉ hiển thị users chưa có config
  availableUsers = computed(() => {
    const configuredUserIds = this.rows().map(r => 
      typeof r.userId === 'string' ? r.userId : r.userId._id
    );
    return this.users().filter(u => !configuredUserIds.includes(u._id!));
  });

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
      next: rows => { 
        // Ensure arrays are initialized
        rows.forEach(r => {
          if (!r.attendanceTiers) r.attendanceTiers = [];
          if (!r.kpiBonusTiers) r.kpiBonusTiers = [];
          if (!r.paymentDays) r.paymentDays = [5];
        });
        this.rows.set(rows); 
        this.loading.set(false); 
        this.cdr.detectChanges(); 
      },
      error: err => { this.error.set('Không tải được dữ liệu'); this.loading.set(false); this.cdr.detectChanges(); }
    });
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  addConfig(): void {
    if (!this.newUserId || this.newHourlyRate === null || this.newHourlyRate < 0) return;
    this.salarySvc.create({ 
      userId: this.newUserId, 
      payrollCycle: this.newPayrollCycle,
      hourlyRate: this.newHourlyRate 
    }).subscribe({
      next: row => {
        if (!row.attendanceTiers) row.attendanceTiers = [];
        if (!row.kpiBonusTiers) row.kpiBonusTiers = [];
        if (!row.paymentDays) row.paymentDays = [5];
        const others = this.rows().filter(r => (typeof r.userId === 'string' ? r.userId : r.userId['_id']) !== this.newUserId);
        this.rows.set([row, ...others]);
        this.newUserId = '';
        this.newHourlyRate = null;
        this.cdr.detectChanges();
      },
      error: err => { console.error(err); }
    });
  }

  saveField(row: SalaryConfig, field: string, value: any): void {
    if (!row._id) return;
    const patch: any = {};
    if (field === 'hourlyRate') {
      const v = Number(value);
      if (!isFinite(v) || v < 0) return;
      patch.hourlyRate = v;
    } else if (field === 'payrollCycle') {
      patch.payrollCycle = value;
    } else if (field === 'notes') {
      patch.notes = value;
    }
    if (Object.keys(patch).length === 0) return;
    this.salarySvc.updateField(row._id, patch).subscribe({
      next: updated => {
        if (!updated.attendanceTiers) updated.attendanceTiers = [];
        if (!updated.kpiBonusTiers) updated.kpiBonusTiers = [];
        if (!updated.paymentDays) updated.paymentDays = [5];
        const updatedList = this.rows().map(r => r._id === updated._id ? updated : r);
        this.rows.set(updatedList);
        this.cdr.detectChanges();
      },
      error: err => { console.error(err); }
    });
  }

  // Attendance Tiers
  addAttendanceTier(row: SalaryConfig): void {
    if (!row.attendanceTiers) row.attendanceTiers = [];
    const lastMax = row.attendanceTiers.length > 0 ? row.attendanceTiers[row.attendanceTiers.length - 1].maxHours : 0;
    row.attendanceTiers.push({ minHours: lastMax, maxHours: lastMax + 40, bonusAmount: 0 });
    this.saveAttendanceTiers(row);
  }

  removeAttendanceTier(row: SalaryConfig, index: number): void {
    row.attendanceTiers.splice(index, 1);
    this.saveAttendanceTiers(row);
  }

  saveAttendanceTiers(row: SalaryConfig): void {
    if (!row._id) return;
    this.salarySvc.updateField(row._id, { attendanceTiers: row.attendanceTiers }).subscribe({
      next: () => this.cdr.detectChanges(),
      error: err => console.error(err)
    });
  }

  // KPI Bonus Tiers
  addKpiBonusTier(row: SalaryConfig): void {
    if (!row.kpiBonusTiers) row.kpiBonusTiers = [];
    const lastMax = row.kpiBonusTiers.length > 0 ? row.kpiBonusTiers[row.kpiBonusTiers.length - 1].maxPercent : 0;
    row.kpiBonusTiers.push({ minPercent: lastMax, maxPercent: lastMax + 20, bonusAmount: 0 });
    this.saveKpiBonusTiers(row);
  }

  removeKpiBonusTier(row: SalaryConfig, index: number): void {
    row.kpiBonusTiers.splice(index, 1);
    this.saveKpiBonusTiers(row);
  }

  saveKpiBonusTiers(row: SalaryConfig): void {
    if (!row._id) return;
    this.salarySvc.updateField(row._id, { kpiBonusTiers: row.kpiBonusTiers }).subscribe({
      next: () => this.cdr.detectChanges(),
      error: err => console.error(err)
    });
  }

  // Punctuality Rules
  addPunctualityRules(row: SalaryConfig): void {
    row.punctualityRules = {
      checkInDeadline: '08:30',
      onTimeBonus: 10000,
      latePenalty: 20000,
      gracePeriodMinutes: 5
    };
    this.savePunctualityRules(row);
  }

  removePunctualityRules(row: SalaryConfig): void {
    row.punctualityRules = null;
    if (!row._id) return;
    this.salarySvc.updateField(row._id, { punctualityRules: null }).subscribe({
      next: () => this.cdr.detectChanges(),
      error: err => console.error(err)
    });
  }

  savePunctualityRules(row: SalaryConfig): void {
    if (!row._id) return;
    this.salarySvc.updateField(row._id, { punctualityRules: row.punctualityRules }).subscribe({
      next: () => this.cdr.detectChanges(),
      error: err => console.error(err)
    });
  }

  // Payment Days
  addPaymentDay(row: SalaryConfig, input: HTMLInputElement): void {
    const day = Number(input.value);
    if (!isFinite(day) || day < 1 || day > 28) return;
    if (!row.paymentDays) row.paymentDays = [];
    if (row.paymentDays.includes(day)) return; // Avoid duplicates
    row.paymentDays.push(day);
    row.paymentDays.sort((a, b) => a - b);
    input.value = '';
    this.savePaymentDays(row);
  }

  removePaymentDay(row: SalaryConfig, index: number): void {
    if (!row.paymentDays) return;
    row.paymentDays.splice(index, 1);
    this.savePaymentDays(row);
  }

  savePaymentDays(row: SalaryConfig): void {
    if (!row._id) return;
    this.salarySvc.updateField(row._id, { paymentDays: row.paymentDays }).subscribe({
      next: () => this.cdr.detectChanges(),
      error: err => console.error(err)
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
