/**
 * File: features/labor-cost1/labor-cost1.component.ts
 * Mô tả: UI Chi Phí Nhân Công 1 với 2 tabs:
 *   - Tab 1: Phiên Làm Việc (sessions)
 *   - Tab 2: Phiếu Thanh Toán (statements)
 */
import { Component, OnInit, ChangeDetectorRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LaborCost1Service } from './labor-cost1.service';
import { 
  CreateLaborCost1Dto, 
  LaborCost1, 
  LaborStatementDetail,
  CreateLaborStatementDto,
  AddLaborPaymentDto
} from './labor-cost1.model';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

@Component({
  selector: 'app-labor-cost1',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="container">
    <h2>🧑‍🏭 Chi Phí Nhân Công 1</h2>

    <!-- SUMMARY CARDS -->
    <div class="summary-cards" *ngIf="!loadingSummary() && summaryCards()">
      <div class="card" [class.active]="cardFilter() === 'unassigned'" (click)="filterByCard('unassigned')">
        <div class="card-icon">📦</div>
        <div class="card-content">
          <div class="card-title">Chưa vào phiếu</div>
          <div class="card-value">{{ summaryCards()?.unassigned?.amount || 0 | number:'1.0-0' }} ₫</div>
          <div class="card-detail">{{ summaryCards()?.unassigned?.sessionCount || 0 }} phiên</div>
        </div>
      </div>
      
      <div class="card" [class.active]="cardFilter() === 'inStatement'" (click)="filterByCard('inStatement')">
        <div class="card-icon">📄</div>
        <div class="card-content">
          <div class="card-title">Đang trong phiếu</div>
          <div class="card-value">{{ summaryCards()?.inStatement?.amount || 0 | number:'1.0-0' }} ₫</div>
          <div class="card-detail">{{ summaryCards()?.inStatement?.sessionCount || 0 }} phiên</div>
        </div>
      </div>
      
      <div class="card" [class.active]="cardFilter() === 'paid'" (click)="filterByCard('paid')">
        <div class="card-icon">✅</div>
        <div class="card-content">
          <div class="card-title">Đã chi</div>
          <div class="card-value success">{{ summaryCards()?.paid?.amount || 0 | number:'1.0-0' }} ₫</div>
          <div class="card-detail">{{ summaryCards()?.paid?.sessionCount || 0 }} phiên</div>
        </div>
      </div>
      
      <div class="card danger-card" [class.active]="cardFilter() === 'overdue'" (click)="filterByCard('overdue')">
        <div class="card-icon">⚠️</div>
        <div class="card-content">
          <div class="card-title">Quá hạn + Đến hạn 14d</div>
          <div class="card-value danger">{{ (summaryCards()?.overdue?.amount || 0) + (summaryCards()?.due14d?.amount || 0) | number:'1.0-0' }} ₫</div>
          <div class="card-detail">{{ (summaryCards()?.overdue?.statementCount || 0) + (summaryCards()?.due14d?.statementCount || 0) }} phiếu</div>
        </div>
      </div>
    </div>

    <!-- TABS -->
    <div class="tabs">
      <button class="tab" [class.active]="activeTab() === 'sessions'" (click)="activeTab.set('sessions')">
        📋 Phiên Làm Việc
      </button>
      <button class="tab" [class.active]="activeTab() === 'statements'" (click)="switchTab('statements')">
        💰 Phiếu Thanh Toán
      </button>
    </div>

    <!-- TAB 1: PHIÊN LÀM VIỆC -->
    <div *ngIf="activeTab() === 'sessions'">
      <div class="toolbar">
        <span class="auto-sync-note">💡 Chi phí nhân công được tự động tạo khi logout. Backup: cron job 00:30 hàng ngày.</span>
        <button 
          class="btn btn-primary" 
          *ngIf="selectedSessionIds().size > 0"
          (click)="bulkAssignToStatement()">
          📄 Đưa {{ selectedSessionIds().size }} phiên vào phiếu thanh toán
        </button>
      </div>

      <div class="list" *ngIf="!loading() && !error()">
        <table class="table">
          <thead>
            <tr>
              <th width="30">
                <input type="checkbox" 
                  [checked]="isAllSelected()"
                  (change)="toggleSelectAll()">
              </th>
              <th>Ngày</th>
              <th>Nhân công</th>
              <th>Quản lý</th>
              <th>Phiên</th>
              <th>Giờ đến</th>
              <th>Giờ về</th>
              <th>Giờ làm</th>
              <th>Lương/giờ</th>
              <th>Chi phí chi tiết</th>
              <th>Trạng thái</th>
              <th>Ghi chú</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of filteredRows(); trackBy: trackById">
              <td>
                <input type="checkbox" 
                  [checked]="selectedSessionIds().has(r._id!)"
                  (change)="toggleSelect(r._id!)"
                  [disabled]="r.paid || r.statementId">
              </td>
              <td>
                <input class="form-control input-inline" [value]="toDateDisplay(r.date)"
                  (blur)="saveInline(r, { date: $any($event.target).value })"
                  (keydown.enter)="onEnter($event)"
                  placeholder="dd/MM/yyyy">
              </td>
              <td>
                <span>{{ displayUser(r.userId) }}</span>
              </td>
              <td>{{ getManagerName(r.userId) }}</td>
              <td>{{ r.sessionCount || 1 }}</td>
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
                <span class="badge" [ngClass]="getSessionStatusChip(r).class">
                  {{ getSessionStatusChip(r).label }}
                </span>
              </td>
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
    </div>

    <!-- TAB 2: PHIẾU THANH TOÁN -->
    <div *ngIf="activeTab() === 'statements'">
      <div class="toolbar">
        <button class="btn btn-primary" (click)="openCreateStatementModal()">
          ➕ Tạo Phiếu Thanh Toán
        </button>
      </div>

      <div class="list" *ngIf="!loadingStatements() && !errorStatements()">
        <table class="table">
          <thead>
            <tr>
              <th>Nhân viên</th>
              <th>Kỳ</th>
              <th>Hạn TT</th>
              <th>Trạng thái</th>
              <th>Nợ đầu kỳ</th>
              <th>Lương kỳ</th>
              <th>KPI</th>
              <th>Bonus</th>
              <th>Tổng phải trả</th>
              <th>Đã thanh toán</th>
              <th>Còn nợ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let st of statements(); trackBy: trackByStatementId">
              <td>{{ getEmployeeName(st.employeeId) }}</td>
              <td>{{ st.periodFrom | date:'dd/MM' }} - {{ st.periodTo | date:'dd/MM/yyyy' }}</td>
              <td [class.danger]="isDueSoon(st.dueDate)" [class.warning]="isDueThisWeek(st.dueDate)">
                {{ st.dueDate ? (st.dueDate | date:'dd/MM') : 'N/A' }}
              </td>
              <td>
                <span class="badge" [ngClass]="getStatusClass(st.status)">
                  {{ getStatusLabel(st.status) }}
                </span>
              </td>
              <td>{{ st.openingBalance | number:'1.0-0' }}</td>
              <td>{{ st.periodCost | number:'1.0-0' }}</td>
              <td>
                <span *ngIf="st.kpiPercent !== undefined" class="badge badge-info">
                  {{ st.kpiPercent }}%
                </span>
                <span *ngIf="st.kpiPercent === undefined" class="badge badge-warning">
                  Chưa nhập
                </span>
              </td>
              <td class="text-sm">
                <div>📅 Chuyên cần: +{{ st.attendanceBonus || 0 | number:'1.0-0' }}</div>
                <div>🎯 KPI: +{{ st.kpiBonus || 0 | number:'1.0-0' }}</div>
                <div [class.danger]="(st.punctualityBonus || 0) < 0">⏰ Đúng giờ: {{ st.punctualityBonus || 0 | number:'1.0-0' }}</div>
                <div>➕ Khác: +{{ st.bonus || 0 | number:'1.0-0' }} / -{{ st.deduction || 0 | number:'1.0-0' }}</div>
              </td>
              <td class="font-bold">{{ st.closingBalance + st.statementPaymentTotal | number:'1.0-0' }}</td>
              <td class="success">{{ st.statementPaymentTotal | number:'1.0-0' }}</td>
              <td class="closing-balance" [class.danger]="st.closingBalance > 0">
                {{ st.closingBalance | number:'1.0-0' }}
              </td>
              <td>
                <button class="btn btn-sm" (click)="viewStatementDetail(st)">Chi tiết</button>
                <button class="btn btn-sm btn-warning" *ngIf="st.status === 'draft'" 
                  (click)="openKpiModal(st)">🎯 Nhập KPI</button>
                <button class="btn btn-sm btn-primary" *ngIf="st.status === 'draft'" 
                  (click)="confirmStatement(st._id!)">Duyệt</button>
                <button class="btn btn-sm btn-danger" *ngIf="st.status === 'draft'" 
                  (click)="deleteStatement(st._id!)">Xóa</button>
                <button class="btn btn-sm btn-success" *ngIf="st.status === 'open'" 
                  (click)="openAddPaymentModal(st)">💰 Thanh toán</button>
                <button class="btn btn-sm btn-danger" *ngIf="st.status === 'open'" 
                  (click)="closeStatement(st._id!)">Đóng</button>
              </td>
            </tr>
            <tr *ngIf="statements().length === 0">
              <td colspan="12" style="text-align: center; padding: 24px; color: #999;">
                Chưa có phiếu thanh toán nào. Nhấn "Tạo Phiếu Thanh Toán" để bắt đầu.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="loadingStatements()" class="loading">Đang tải phiếu thanh toán...</div>
      <div *ngIf="errorStatements()" class="error">{{ errorStatements() }}</div>
    </div>

    <!-- MODAL: TẠO PHIẾU THANH TOÁN -->
    <div class="modal" *ngIf="showCreateStatementModal" (click)="closeCreateStatementModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>Tạo Phiếu Thanh Toán Lương</h3>
        <form (ngSubmit)="submitCreateStatement()">
          <div class="form-group">
            <label>Nhân viên *</label>
            <select class="form-control" [(ngModel)]="createStatementForm.employeeId" name="employeeId" required>
              <option value="">-- Chọn nhân viên --</option>
              <option *ngFor="let u of users()" [value]="u._id">{{ u.fullName }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Từ ngày *</label>
            <input type="date" class="form-control" [(ngModel)]="createStatementForm.periodFrom" name="periodFrom" required>
          </div>
          <div class="form-group">
            <label>Đến ngày *</label>
            <input type="date" class="form-control" [(ngModel)]="createStatementForm.periodTo" name="periodTo" required>
          </div>
          <div class="form-group">
            <label>Thưởng</label>
            <input type="number" class="form-control" [(ngModel)]="createStatementForm.bonus" name="bonus">
          </div>
          <div class="form-group">
            <label>Khấu trừ (phạt, bảo hiểm, ...)</label>
            <input type="number" class="form-control" [(ngModel)]="createStatementForm.deduction" name="deduction">
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea class="form-control" [(ngModel)]="createStatementForm.notes" name="notes" rows="2"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn" (click)="closeCreateStatementModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Tạo Phiếu</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: THÊM THANH TOÁN -->
    <div class="modal" *ngIf="showAddPaymentModal" (click)="closeAddPaymentModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>Thanh Toán Lương</h3>
        <div class="statement-info" *ngIf="selectedStatement">
          <p><strong>Nhân viên:</strong> {{ getEmployeeName(selectedStatement.employeeId) }}</p>
          <p><strong>Kỳ:</strong> {{ selectedStatement.periodFrom | date:'dd/MM' }} - {{ selectedStatement.periodTo | date:'dd/MM/yyyy' }}</p>
          <p><strong>Tổng nợ:</strong> <span class="danger">{{ selectedStatement.closingBalance | number:'1.0-0' }} ₫</span></p>
        </div>
        <form (ngSubmit)="submitAddPayment()">
          <div class="form-group">
            <label>Số tiền thanh toán *</label>
            <input type="number" class="form-control" [(ngModel)]="addPaymentForm.amount" name="amount" required>
          </div>
          <div class="form-group">
            <label>Ngày thanh toán *</label>
            <input type="date" class="form-control" [(ngModel)]="addPaymentForm.paidAt" name="paidAt" required>
          </div>
          <div class="form-group">
            <label>Phương thức</label>
            <select class="form-control" [(ngModel)]="addPaymentForm.method" name="method">
              <option value="cash">Tiền mặt</option>
              <option value="bank_transfer">Chuyển khoản</option>
              <option value="e_wallet">Ví điện tử</option>
            </select>
          </div>
          <div class="form-group">
            <label>Mã giao dịch</label>
            <input type="text" class="form-control" [(ngModel)]="addPaymentForm.reference" name="reference">
          </div>
          <div class="form-actions">
            <button type="button" class="btn" (click)="closeAddPaymentModal()">Hủy</button>
            <button type="submit" class="btn btn-primary">Thanh Toán</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: NHẬP KPI -->
    <div class="modal" *ngIf="showKpiModal" (click)="closeKpiModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>🎯 Nhập KPI cho Phiếu Lương</h3>
        <div class="statement-info" *ngIf="selectedStatement">
          <p><strong>Nhân viên:</strong> {{ getEmployeeName(selectedStatement.employeeId) }}</p>
          <p><strong>Kỳ:</strong> {{ selectedStatement.periodFrom | date:'dd/MM' }} - {{ selectedStatement.periodTo | date:'dd/MM/yyyy' }}</p>
          <hr>
          <div class="bonus-preview">
            <div class="preview-row">
              <span>📅 Thưởng chuyên cần:</span>
              <span class="success">+{{ selectedStatement.attendanceBonus || 0 | number:'1.0-0' }} ₫</span>
            </div>
            <div class="preview-row">
              <span>⏰ Thưởng/phạt đúng giờ ({{ selectedStatement.onTimeDays || 0 }} đúng / {{ selectedStatement.lateDays || 0 }} trễ):</span>
              <span [class.success]="(selectedStatement.punctualityBonus || 0) >= 0" [class.danger]="(selectedStatement.punctualityBonus || 0) < 0">
                {{ selectedStatement.punctualityBonus || 0 | number:'1.0-0' }} ₫
              </span>
            </div>
            <div class="preview-row highlight" *ngIf="kpiForm.kpiPercent !== undefined">
              <span>🎯 Thưởng KPI ({{ kpiForm.kpiPercent }}%):</span>
              <span class="success">+{{ previewKpiBonus() | number:'1.0-0' }} ₫</span>
            </div>
          </div>
        </div>
        <form (ngSubmit)="submitKpi()">
          <div class="form-group">
            <label>% Hoàn thành KPI (0-100) *</label>
            <input type="number" class="form-control" 
              [(ngModel)]="kpiForm.kpiPercent" name="kpiPercent" 
              min="0" max="100" required
              placeholder="VD: 85">
            <small class="text-muted">Director đánh giá và nhập % hoàn thành KPI của nhân viên trong kỳ này</small>
          </div>
          <div class="form-actions">
            <button type="button" class="btn" (click)="closeKpiModal()">Hủy</button>
            <button type="submit" class="btn btn-primary" [disabled]="kpiForm.kpiPercent === undefined">Lưu KPI</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: XEM CHI TIẾT STATEMENT -->
    <div class="modal" *ngIf="showViewDetailModal" (click)="closeViewDetailModal()">
      <div class="modal-content large" (click)="$event.stopPropagation()">
        <h3>Chi Tiết Phiếu Thanh Toán</h3>
        <div *ngIf="selectedStatement">
          <div class="statement-header">
            <div><strong>Nhân viên:</strong> {{ getEmployeeName(selectedStatement.employeeId) }}</div>
            <div><strong>Kỳ:</strong> {{ selectedStatement.periodFrom | date:'dd/MM/yyyy' }} - {{ selectedStatement.periodTo | date:'dd/MM/yyyy' }}</div>
            <div><strong>Hạn thanh toán:</strong> 
              <span [class.danger]="isDueSoon(selectedStatement.dueDate)" [class.warning]="isDueThisWeek(selectedStatement.dueDate)">
                {{ selectedStatement.dueDate ? (selectedStatement.dueDate | date:'dd/MM/yyyy') : 'Chưa xác định' }}
              </span>
            </div>
            <div><strong>Trạng thái:</strong> <span class="badge" [ngClass]="getStatusClass(selectedStatement.status)">{{ getStatusLabel(selectedStatement.status) }}</span></div>
          </div>
          
          <div class="statement-summary">
            <div class="summary-row">
              <span>Nợ kỳ trước:</span>
              <span>{{ selectedStatement.openingBalance | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row">
              <span>Lương trong kỳ ({{ selectedStatement.totalWorkHours || 0 | number:'1.1-1' }} giờ × {{ selectedStatement.sessionCount || 0 }} phiên):</span>
              <span>{{ selectedStatement.periodCost | number:'1.0-0' }} ₫</span>
            </div>
            <hr>
            <div class="summary-row">
              <span>📅 Thưởng chuyên cần:</span>
              <span class="success">+{{ selectedStatement.attendanceBonus || 0 | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row">
              <span>🎯 Thưởng KPI ({{ selectedStatement.kpiPercent !== undefined ? selectedStatement.kpiPercent + '%' : 'Chưa nhập' }}):</span>
              <span class="success">+{{ selectedStatement.kpiBonus || 0 | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row">
              <span>⏰ Thưởng/phạt đúng giờ ({{ selectedStatement.onTimeDays || 0 }} đúng / {{ selectedStatement.lateDays || 0 }} trễ):</span>
              <span [class.success]="(selectedStatement.punctualityBonus || 0) >= 0" [class.danger]="(selectedStatement.punctualityBonus || 0) < 0">
                {{ selectedStatement.punctualityBonus || 0 | number:'1.0-0' }} ₫
              </span>
            </div>
            <hr>
            <div class="summary-row">
              <span>➕ Thưởng khác:</span>
              <span class="success">+{{ selectedStatement.bonus | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row">
              <span>➖ Khấu trừ:</span>
              <span class="danger">-{{ selectedStatement.deduction | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row total">
              <span>Tổng phải trả:</span>
              <span>{{ selectedStatement.closingBalance + selectedStatement.statementPaymentTotal | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row">
              <span>Đã thanh toán:</span>
              <span class="success">{{ selectedStatement.statementPaymentTotal | number:'1.0-0' }} ₫</span>
            </div>
            <div class="summary-row remaining">
              <span>Còn nợ:</span>
              <span class="danger">{{ selectedStatement.closingBalance | number:'1.0-0' }} ₫</span>
            </div>
          </div>

          <h4>Lịch sử thanh toán ({{ selectedStatement.payments.length || 0 }})</h4>
          <table class="table">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Số tiền</th>
                <th>Phương thức</th>
                <th>Mã GD</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of selectedStatement.payments">
                <td>{{ p.paidAt | date:'dd/MM/yyyy' }}</td>
                <td>{{ p.amount | number:'1.0-0' }} ₫</td>
                <td>{{ p.method || '-' }}</td>
                <td>{{ p.reference || '-' }}</td>
              </tr>
              <tr *ngIf="!selectedStatement.payments || selectedStatement.payments.length === 0">
                <td colspan="4" style="text-align: center; color: #999;">Chưa có thanh toán</td>
              </tr>
            </tbody>
          </table>

          <h4>Các phiên làm việc ({{ selectedStatement.laborCostIds.length || 0 }})</h4>
          <p style="color: #6c757d; font-size: 13px;">
            💡 Hệ thống tự động gom các phiên chưa thanh toán trong khoảng thời gian đã chọn
          </p>
          
          <table class="table" *ngIf="selectedStatement.laborCosts && selectedStatement.laborCosts.length > 0">
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Giờ vào</th>
                <th>Giờ ra</th>
                <th>Giờ làm</th>
                <th>Lương/giờ</th>
                <th>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let lc of selectedStatement.laborCosts">
                <td>{{ lc.date | date:'dd/MM/yyyy' }}</td>
                <td>{{ lc.startTime }}</td>
                <td>{{ lc.endTime }}</td>
                <td>{{ lc.workHours }}</td>
                <td>{{ lc.hourlyRate | number:'1.0-0' }}</td>
                <td>{{ lc.cost | number:'1.0-0' }} ₫</td>
              </tr>
              <tr style="font-weight: 600; background: #f8f9fa;">
                <td colspan="3">Tổng cộng</td>
                <td>{{ selectedStatement.totalWorkHours }}</td>
                <td></td>
                <td>{{ selectedStatement.periodCost | number:'1.0-0' }} ₫</td>
              </tr>
            </tbody>
          </table>
          
          <div *ngIf="!selectedStatement.laborCosts || selectedStatement.laborCosts.length === 0" style="padding: 16px; text-align: center; color: #999; background: #f8f9fa; border-radius: 4px; margin-top: 8px;">
            Không có phiên làm việc nào trong kỳ này
          </div>
        </div>
        <div class="form-actions">
          <button class="btn" (click)="closeViewDetailModal()">Đóng</button>
        </div>
      </div>
    </div>

    <div *ngIf="loading()" class="loading">Đang tải...</div>
    <div *ngIf="error()" class="error">{{ error() }}</div>
  </div>
  `,
  styles: [`
    .container { padding: 16px; }
    
    /* Summary Cards */
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; align-items: center; gap: 16px; }
    .card:hover { transform: translateY(-4px); box-shadow: 0 8px 12px rgba(0,0,0,0.15); }
    .card.active { transform: translateY(-4px); box-shadow: 0 8px 20px rgba(0,0,0,0.25); border: 3px solid #fbbf24; }
    .card:nth-child(1) { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .card:nth-child(2) { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .card:nth-child(3) { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .card.danger-card { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    .card-icon { font-size: 36px; opacity: 0.9; }
    .card-content { flex: 1; }
    .card-title { font-size: 13px; opacity: 0.9; margin-bottom: 4px; text-transform: uppercase; font-weight: 500; }
    .card-value { font-size: 24px; font-weight: 700; margin-bottom: 2px; }
    .card-detail { font-size: 12px; opacity: 0.8; }
    
    /* Tabs */
    .tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 2px solid #dee2e6; }
    .tab { padding: 10px 20px; background: transparent; border: none; cursor: pointer; font-size: 14px; color: #6c757d; border-bottom: 3px solid transparent; transition: all 0.2s; }
    .tab:hover { color: #007bff; }
    .tab.active { color: #007bff; border-bottom-color: #007bff; font-weight: 600; }
    
    .toolbar { margin-bottom: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .auto-sync-note { font-size: 13px; color: #6c757d; font-style: italic; background: #f0f9ff; padding: 6px 12px; border-radius: 4px; border: 1px solid #bae6fd; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table th, .table td { border: 1px solid #eee; padding: 6px 8px; }
    .table th { background: #f8f9fa; font-weight: 600; }
    .input-inline { width: 100%; border: none; background: transparent; }
    .input-inline:focus { background: #f8f9fa; border: 1px solid #007bff; }
    .summary { margin-top: 24px; }
    .loading, .error { padding: 16px; text-align: center; }
    .error { color: #dc3545; }
    
    /* Badges */
    .badge { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
    .badge-draft { background: #e9ecef; color: #495057; }
    .badge-open { background: #fff3cd; color: #856404; }
    .badge-closed { background: #d4edda; color: #155724; }
    
    .closing-balance.danger { color: #dc3545; font-weight: 600; }
    .font-bold { font-weight: 600; }
    
    /* Buttons */
    .btn { padding: 6px 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 4px; font-size: 13px; }
    .btn:hover { background: #f8f9fa; }
    .btn-primary { background: #007bff; color: white; border-color: #007bff; }
    .btn-primary:hover { background: #0056b3; }
    .btn-success { background: #28a745; color: white; border-color: #28a745; }
    .btn-danger { background: #dc3545; color: white; border-color: #dc3545; }
    .btn-warning { background: #ffc107; color: #212529; border-color: #ffc107; }
    .btn-sm { padding: 4px 8px; font-size: 12px; }
    
    /* Modal */
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 24px; border-radius: 8px; min-width: 500px; max-width: 90vw; max-height: 90vh; overflow-y: auto; }
    .modal-content.large { min-width: 800px; }
    .modal-content h3 { margin: 0 0 16px 0; }
    
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 4px; font-weight: 600; font-size: 13px; }
    .form-control { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
    .form-control:focus { border-color: #007bff; outline: none; }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
    
    .statement-info { background: #f8f9fa; padding: 12px; border-radius: 4px; margin-bottom: 16px; }
    .statement-info p { margin: 4px 0; }
    .statement-info hr { border: none; border-top: 1px solid #dee2e6; margin: 12px 0; }
    
    .bonus-preview { margin-top: 8px; }
    .preview-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
    .preview-row.highlight { background: #fff3cd; padding: 8px; border-radius: 4px; font-weight: 600; }
    
    .badge-info { background: #17a2b8; color: white; }
    .badge-warning { background: #ffc107; color: #212529; }
    
    .text-sm { font-size: 12px; line-height: 1.6; }
    .text-muted { color: #6c757d; font-size: 12px; display: block; margin-top: 4px; }
    
    .statement-header { display: flex; gap: 24px; margin-bottom: 16px; padding: 12px; background: #f8f9fa; border-radius: 4px; flex-wrap: wrap; }
    
    .statement-summary { background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 16px; margin-bottom: 24px; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .summary-row.total { font-weight: 600; font-size: 15px; border-top: 2px solid #dee2e6; margin-top: 8px; padding-top: 12px; }
    .summary-row.remaining { font-weight: 600; font-size: 16px; border-top: 2px solid #dc3545; margin-top: 8px; padding-top: 12px; }
    
    .success { color: #28a745; }
    .danger { color: #dc3545; }
    
    h4 { margin: 24px 0 12px 0; font-size: 15px; font-weight: 600; }
    
    .paid-at { font-size: 11px; color: #6c757d; margin-top: 2px; }
  `]
})
export class LaborCost1Component implements OnInit {
  private laborSvc = inject(LaborCost1Service);
  private userSvc = inject(UserService);
  private cdr = inject(ChangeDetectorRef);

  // Work sessions data
  users = signal<User[]>([]);
  rows = signal<LaborCost1[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  private saving = new Set<string>();

  // Statements data
  statements = signal<LaborStatementDetail[]>([]);
  loadingStatements = signal<boolean>(false);
  errorStatements = signal<string | null>(null);
  
  // Summary cards
  summaryCards = signal<any | null>(null);
  loadingSummary = signal<boolean>(false);
  
  // Filter state
  cardFilter = signal<string | null>(null); // 'unassigned', 'inStatement', 'paid', 'overdue'
  dateFilter = signal<string>('all'); // 'today', '7days', 'month', 'all'
  
  // Bulk selection for adding to statement
  selectedSessionIds = signal<Set<string>>(new Set());
  
  // Tab state
  activeTab = signal<'sessions' | 'statements'>('sessions');
  
  // Modal states
  showCreateStatementModal = false;
  showAddPaymentModal = false;
  showViewDetailModal = false;
  showKpiModal = false;
  
  // Form models
  createStatementForm = {
    employeeId: '',
    periodFrom: '',
    periodTo: '',
    bonus: 0,
    deduction: 0,
    notes: ''
  };
  
  // KPI form
  kpiForm = {
    kpiPercent: undefined as number | undefined
  };
  
  addPaymentForm = {
    amount: 0,
    paidAt: '',
    method: 'bank_transfer',
    reference: ''
  };
  
  selectedStatement: LaborStatementDetail | null = null;

  ngOnInit(): void { 
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true); 
    this.error.set(null);
    
    // Load summary cards
    this.loadSummaryCards();
    
    this.userSvc.getUsers().subscribe({ 
      next: u => this.users.set(u), 
      error: e => console.error(e) 
    });
    this.laborSvc.list().subscribe({
      next: rs => { 
        this.rows.set(rs); 
        this.loading.set(false); 
        this.cdr.detectChanges(); 
      },
      error: _ => { 
        this.error.set('Không tải được dữ liệu'); 
        this.loading.set(false); 
        this.cdr.detectChanges(); 
      }
    });
  }

  loadSummaryCards(): void {
    this.loadingSummary.set(true);
    this.laborSvc.getSummaryCards().subscribe({
      next: cards => {
        this.summaryCards.set(cards);
        this.loadingSummary.set(false);
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('Error loading summary cards:', err);
        this.loadingSummary.set(false);
      }
    });
  }

  private toIsoDateFromDDMMYYYY(s: string): string {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return s;
    const dd = Number(m[1]); 
    const MM = Number(m[2]); 
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, MM - 1, dd);
    const yyyy2 = d.getFullYear();
    const mm2 = String(d.getMonth() + 1).padStart(2, '0');
    const dd2 = String(d.getDate()).padStart(2, '0');
    return `${yyyy2}-${mm2}-${dd2}`;
  }

  addNew(): void {
    if (this.users().length === 0) {
      this.error.set('Vui lòng thêm user trước khi tạo chi phí nhân công');
      return;
    }
    
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    
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
    this.laborSvc.remove(id).subscribe({ 
      next: _ => { 
        this.rows.set(this.rows().filter(x => x._id !== id)); 
        this.cdr.detectChanges(); 
      } 
    });
  }

  getManagerName(userRef: any): string {
    const userId = this.getUserId(userRef);
    const u = this.users().find(x => x._id === userId);
    if (!u?.managerId) return '';
    const manager = this.users().find(x => x._id === u.managerId);
    return manager?.fullName || '';
  }

  markPaid(row: LaborCost1): void {
    if (!row._id || row.paid) return;
    if (!confirm('Xác nhận đã chi khoản lương này?')) return;
    this.laborSvc.markPaid(row._id).subscribe({
      next: updated => {
        const newRows = this.rows().map(r => r._id === updated._id ? updated : r);
        this.rows.set(newRows);
        this.cdr.detectChanges();
      },
      error: err => { 
        console.error(err); 
        alert('Không đánh dấu thanh toán được'); 
      }
    });
  }

  displayUser(userId: any): string {
    if (!userId) return '';
    if (typeof userId === 'object') {
      if (userId.fullName) return userId.fullName;
      if (userId.email) return userId.email;
      if (userId._id) return String(userId._id);
      return 'N/A';
    }
    const u = this.users().find(x => x._id === userId);
    return u?.fullName || String(userId);
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
    e.preventDefault();
    const el = e.target as HTMLInputElement;
    if (el && el.blur) el.blur();
  }

  saveInline(r: LaborCost1, patch: any): void {
    if (!r._id) return;
    if (patch.date) {
      const iso = this.toIsoDateFromDDMMYYYY(String(patch.date).trim());
      patch = { ...patch, date: iso };
    }
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

  // ========= STATEMENTS TAB METHODS =========
  
  switchTab(tab: 'sessions' | 'statements'): void {
    this.activeTab.set(tab);
    if (tab === 'statements' && this.statements().length === 0) {
      this.loadStatements();
    }
  }

  loadStatements(): void {
    this.loadingStatements.set(true);
    this.errorStatements.set(null);
    this.laborSvc.listStatements().subscribe({
      next: (data) => {
        this.statements.set(data);
        this.loadingStatements.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.errorStatements.set('Không tải được danh sách phiếu thanh toán');
        this.loadingStatements.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  openCreateStatementModal(): void {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    this.createStatementForm = {
      employeeId: this.users()[0]?._id || '',
      periodFrom: `${yyyy}-${mm}-01`,
      periodTo: `${yyyy}-${mm}-${dd}`,
      bonus: 0,
      deduction: 0,
      notes: ''
    };
    this.showCreateStatementModal = true;
    
    // Hiển thị số phiên sẽ được gom (để user biết có data hay không)
    this.previewUnpaidSessions();
  }
  
  previewUnpaidSessions(): void {
    if (!this.createStatementForm.employeeId || !this.createStatementForm.periodFrom || !this.createStatementForm.periodTo) {
      return;
    }
    
    // Đếm số phiên chưa thanh toán trong kỳ (từ tab sessions)
    const employeeId = this.createStatementForm.employeeId;
    const from = new Date(this.createStatementForm.periodFrom);
    const to = new Date(this.createStatementForm.periodTo);
    
    const unpaidInPeriod = this.rows().filter(r => {
      const userId = typeof r.userId === 'object' ? r.userId._id : r.userId;
      const rowDate = new Date(r.date);
      return userId === employeeId && 
             rowDate >= from && 
             rowDate <= to &&
             !r.paid;
    });
    
    console.log(`Preview: ${unpaidInPeriod.length} unpaid sessions found for employee ${employeeId} in period ${this.createStatementForm.periodFrom} - ${this.createStatementForm.periodTo}`);
  }

  closeCreateStatementModal(): void {
    this.showCreateStatementModal = false;
  }

  submitCreateStatement(): void {
    const dto: CreateLaborStatementDto = {
      employeeId: this.createStatementForm.employeeId,
      periodFrom: this.createStatementForm.periodFrom,
      periodTo: this.createStatementForm.periodTo,
      bonus: this.createStatementForm.bonus,
      deduction: this.createStatementForm.deduction,
      notes: this.createStatementForm.notes
    };

    this.laborSvc.createStatement(dto).subscribe({
      next: (created) => {
        this.statements.set([created, ...this.statements()]);
        this.closeCreateStatementModal();
        this.cdr.detectChanges();
        alert('Tạo phiếu thanh toán thành công!');
      },
      error: (err) => {
        console.error(err);
        alert(`Lỗi: ${err.error?.message || err.message || 'Không thể tạo phiếu'}`);
      }
    });
  }

  viewStatementDetail(statement: LaborStatementDetail): void {
    // Gọi API để lấy chi tiết đầy đủ (bao gồm laborCosts)
    this.laborSvc.getStatement(statement._id!).subscribe({
      next: (detail) => {
        this.selectedStatement = detail;
        this.showViewDetailModal = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        alert('Không thể tải chi tiết phiếu');
      }
    });
  }

  closeViewDetailModal(): void {
    this.showViewDetailModal = false;
    this.selectedStatement = null;
  }

  // ============================================
  // KPI MODAL METHODS
  // ============================================
  
  openKpiModal(statement: LaborStatementDetail): void {
    this.selectedStatement = statement;
    this.kpiForm.kpiPercent = statement.kpiPercent;
    this.showKpiModal = true;
    this.cdr.detectChanges();
  }

  closeKpiModal(): void {
    this.showKpiModal = false;
    this.kpiForm.kpiPercent = undefined;
  }

  previewKpiBonus(): number {
    // Đây là preview đơn giản, backend sẽ tính chính xác
    // Trong thực tế nên gọi API để lấy kpiBonus dự kiến
    return 0; // Sẽ được update sau khi submit
  }

  submitKpi(): void {
    if (this.kpiForm.kpiPercent === undefined || !this.selectedStatement?._id) return;
    
    this.laborSvc.updateKpi(this.selectedStatement._id, {
      kpiPercent: this.kpiForm.kpiPercent
    }).subscribe({
      next: (updated) => {
        this.statements.set(this.statements().map(s => s._id === updated._id ? updated as LaborStatementDetail : s));
        this.closeKpiModal();
        this.cdr.detectChanges();
        alert(`Đã lưu KPI: ${updated.kpiPercent}% → Thưởng KPI: ${updated.kpiBonus?.toLocaleString() || 0}₫`);
      },
      error: (err) => {
        console.error(err);
        alert(`Lỗi: ${err.error?.message || 'Không thể cập nhật KPI'}`);
      }
    });
  }

  confirmStatement(id: string): void {
    const statement = this.statements().find(s => s._id === id);
    
    // Kiểm tra đã nhập KPI chưa
    if (statement && statement.kpiPercent === undefined) {
      const skipKpi = confirm('Phiếu chưa được nhập KPI. Bạn muốn:\n\n- OK: Duyệt phiếu mà không cần KPI\n- Cancel: Quay lại nhập KPI');
      if (!skipKpi) {
        this.openKpiModal(statement);
        return;
      }
      // Nếu chọn OK, skip KPI check
      this.laborSvc.confirmStatement(id, undefined, true).subscribe({
        next: (updated) => {
          this.statements.set(this.statements().map(s => s._id === id ? updated as LaborStatementDetail : s));
          this.cdr.detectChanges();
          alert('Đã duyệt phiếu (không có KPI)!');
        },
        error: (err) => {
          console.error(err);
          alert(`Lỗi: ${err.error?.message || 'Không thể xác nhận'}`);
        }
      });
      return;
    }
    
    if (!confirm('Xác nhận duyệt phiếu? (Không thể sửa KPI sau khi duyệt)')) return;
    
    this.laborSvc.confirmStatement(id).subscribe({
      next: (updated) => {
        this.statements.set(this.statements().map(s => s._id === id ? updated as LaborStatementDetail : s));
        this.cdr.detectChanges();
        alert('Đã duyệt phiếu thành công!');
      },
      error: (err) => {
        console.error(err);
        alert(`Lỗi: ${err.error?.message || 'Không thể xác nhận'}`);
      }
    });
  }

  deleteStatement(id: string): void {
    if (!confirm('Xóa phiếu này? Các phiên làm việc sẽ trẻ về trạng thái chưa thanh toán.')) return;
    
    this.laborSvc.deleteStatement(id).subscribe({
      next: () => {
        this.statements.set(this.statements().filter(s => s._id !== id));
        this.cdr.detectChanges();
        alert('Đã xóa phiếu!');
      },
      error: (err) => {
        console.error(err);
        alert(`Lỗi: ${err.error?.message || 'Không thể xóa'}`);
      }
    });
  }

  openAddPaymentModal(statement: LaborStatementDetail): void {
    this.selectedStatement = statement;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    this.addPaymentForm = {
      amount: statement.closingBalance - statement.statementPaymentTotal,
      paidAt: `${yyyy}-${mm}-${dd}`,
      method: 'bank_transfer',
      reference: ''
    };
    this.showAddPaymentModal = true;
  }

  closeAddPaymentModal(): void {
    this.showAddPaymentModal = false;
    this.selectedStatement = null;
  }

  submitAddPayment(): void {
    if (!this.selectedStatement?._id) return;
    
    const dto: AddLaborPaymentDto = {
      amount: this.addPaymentForm.amount,
      paidAt: this.addPaymentForm.paidAt,
      method: this.addPaymentForm.method,
      reference: this.addPaymentForm.reference
    };

    this.laborSvc.addPayment(this.selectedStatement._id, dto).subscribe({
      next: (updated) => {
        this.statements.set(this.statements().map(s => s._id === updated._id ? updated : s));
        this.closeAddPaymentModal();
        this.cdr.detectChanges();
        alert('Đã ghi nhận thanh toán!');
      },
      error: (err) => {
        console.error(err);
        alert(`Lỗi: ${err.error?.message || 'Không thể thêm payment'}`);
      }
    });
  }

  closeStatement(id: string): void {
    if (!confirm('Đóng phiếu này (chuyển sang trạng thái Closed)?')) return;
    
    this.laborSvc.closeStatement(id).subscribe({
      next: (updated) => {
        this.statements.set(this.statements().map(s => s._id === id ? updated : s));
        this.cdr.detectChanges();
        alert('Đã đóng phiếu!');
      },
      error: (err) => {
        console.error(err);
        alert(`Lỗi: ${err.error?.message || 'Không thể đóng phiếu'}`);
      }
    });
  }

  getEmployeeName(userId: any): string {
    // Handle if already populated as object
    if (userId && typeof userId === 'object') {
      if (userId.fullName) return userId.fullName;
      if (userId.email) return userId.email;
      if (userId._id) userId = userId._id; // Extract ID and continue
      else return 'N/A';
    }
    
    // Find by ID
    const user = this.users().find(u => u._id === userId);
    return user?.fullName || (userId ? String(userId) : 'N/A');
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'draft': return 'Nháp';
      case 'open': return 'Chờ thanh toán';
      case 'closed': return 'Đã đóng';
      default: return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'draft': return 'badge-draft';
      case 'open': return 'badge-open';
      case 'closed': return 'badge-closed';
      default: return '';
    }
  }

  isDueSoon(dueDate: string | Date | undefined): boolean {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 2 && diff >= 0; // Due within 2 days
  }

  isDueThisWeek(dueDate: string | Date | undefined): boolean {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 2 && diff <= 7; // Due within 3-7 days
  }

  /**
   * Filter sessions/statements by clicking on summary cards
   */
  filterByCard(type: string): void {
    if (this.cardFilter() === type) {
      // Toggle off if clicking the same card
      this.cardFilter.set(null);
    } else {
      this.cardFilter.set(type);
    }
    
    // Switch to appropriate tab
    if (type === 'overdue') {
      this.activeTab.set('statements');
    } else {
      this.activeTab.set('sessions');
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Get status chip for a session
   */
  getSessionStatusChip(session: LaborCost1): { label: string; class: string } {
    if (session.paid) {
      return { label: 'Đã chi', class: 'badge-closed' };
    }
    if (session.statementId) {
      return { label: 'Trong phiếu', class: 'badge-open' };
    }
    return { label: 'Chưa vào phiếu', class: 'badge-draft' };
  }

  /**
   * Computed: filtered rows based on card selection
   */
  filteredRows = computed(() => {
    const all = this.rows();
    const filter = this.cardFilter();
    
    if (!filter) return all;
    
    switch (filter) {
      case 'unassigned':
        return all.filter(r => !r.statementId && !r.paid);
      case 'inStatement':
        return all.filter(r => r.statementId && !r.paid);
      case 'paid':
        return all.filter(r => r.paid);
      default:
        return all;
    }
  });

  /**
   * Toggle select session
   */
  toggleSelect(id: string): void {
    const current = this.selectedSessionIds();
    const newSet = new Set(current);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    this.selectedSessionIds.set(newSet);
  }

  /**
   * Toggle select all visible sessions
   */
  toggleSelectAll(): void {
    const all = this.filteredRows().filter(r => !r.paid && !r.statementId);
    const current = this.selectedSessionIds();
    
    if (this.isAllSelected()) {
      // Deselect all
      this.selectedSessionIds.set(new Set());
    } else {
      // Select all selectable
      const newSet = new Set(all.map(r => r._id!));
      this.selectedSessionIds.set(newSet);
    }
  }

  /**
   * Check if all visible sessions are selected
   */
  isAllSelected(): boolean {
    const selectable = this.filteredRows().filter(r => !r.paid && !r.statementId);
    if (selectable.length === 0) return false;
    return selectable.every(r => this.selectedSessionIds().has(r._id!));
  }

  /**
   * Bulk assign selected sessions to a new statement
   */
  bulkAssignToStatement(): void {
    const selectedIds = Array.from(this.selectedSessionIds());
    if (selectedIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 phiên làm việc');
      return;
    }
    
    // Get the first session to determine employee
    const firstSession = this.rows().find(r => r._id === selectedIds[0]);
    if (!firstSession) return;
    
    const employeeId = this.getUserId(firstSession.userId);
    
    // Verify all selected sessions belong to same employee
    const allSameEmployee = selectedIds.every(id => {
      const session = this.rows().find(r => r._id === id);
      return session && this.getUserId(session.userId) === employeeId;
    });
    
    if (!allSameEmployee) {
      alert('Tất cả phiên được chọn phải cùng 1 nhân viên');
      return;
    }
    
    // Open create statement modal with pre-filled employee
    this.createStatementForm.employeeId = employeeId;
    this.showCreateStatementModal = true;
  }

  trackByStatementId = (_: number, s: LaborStatementDetail) => s._id;
}
