import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupplierStatement } from '../../supplier-payable.service';

/**
 * Confirmation modal for closing statement
 * Warns user about irreversible action
 */
@Component({
  selector: 'app-confirm-close-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" *ngIf="isOpen" (click)="close.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>⚠️ Xác nhận chốt kỳ</h3>
          <button class="close-btn" (click)="close.emit()">✕</button>
        </div>

        <div class="modal-body">
          <p><strong>Bạn có chắc muốn chốt kỳ đối soát này?</strong></p>
          <p>Sau khi chốt:</p>
          <ul>
            <li>Không thể thêm thanh toán mới</li>
            <li>Không thể cập nhật số liệu</li>
            <li>Kỳ này sẽ được lưu vĩnh viễn</li>
          </ul>
          
          <div class="statement-info" *ngIf="statement">
            <div class="info-row">
              <span>Kỳ:</span>
              <strong>{{ statement.periodFrom | date:'dd/MM/yyyy' }} - {{ statement.periodTo | date:'dd/MM/yyyy' }}</strong>
            </div>
            <div class="info-row">
              <span>Số dư cuối kỳ:</span>
              <strong>{{ statement.closingBalance | number:'1.0-0' }} VND</strong>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" (click)="close.emit()">Hủy</button>
          <button type="button" class="btn-danger" (click)="confirm.emit()">🔒 Chốt kỳ</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-header h3 {
      margin: 0;
      color: #dc2626;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
    }

    .modal-body {
      padding: 20px;
    }

    .modal-body ul {
      margin: 12px 0;
      padding-left: 20px;
    }

    .modal-body li {
      margin: 4px 0;
    }

    .statement-info {
      margin-top: 16px;
      padding: 12px;
      background: #f3f4f6;
      border-radius: 4px;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      margin: 8px 0;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 20px;
      border-top: 1px solid #e5e7eb;
    }

    .btn-secondary {
      padding: 8px 16px;
      background: #e5e7eb;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-danger {
      padding: 8px 16px;
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-danger:hover {
      background: #b91c1c;
    }
  `]
})
export class ConfirmCloseModalComponent {
  @Input() isOpen = false;
  @Input() statement: SupplierStatement | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
