import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierStatement } from '../../supplier-payable.service';
import { PaymentModalState } from '../../state/payment-modal.state';

/**
 * Modal for adding payment to statement
 * Handles payment form and file uploads
 */
@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [PaymentModalState],
  template: `
    <div class="modal-overlay" *ngIf="modalState.isOpen()" (click)="modalState.close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>💰 Thêm thanh toán</h3>
          <button class="close-btn" (click)="modalState.close()">✕</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Số tiền *</label>
            <input 
              type="number" 
              [(ngModel)]="form.amount"
              (ngModelChange)="updateForm('amount', $event)"
              min="0" 
              placeholder="0" 
            />
          </div>

          <div class="form-group">
            <label>Ngày thanh toán *</label>
            <input 
              type="date" 
              [(ngModel)]="form.paidAt"
              (ngModelChange)="updateForm('paidAt', $event)"
            />
          </div>

          <div class="form-group">
            <label>Phương thức</label>
            <select 
              [(ngModel)]="form.method"
              (ngModelChange)="updateForm('method', $event)"
            >
              <option value="Cash">Tiền mặt</option>
              <option value="Bank Transfer">Chuyển khoản</option>
              <option value="Check">Séc</option>
              <option value="Other">Khác</option>
            </select>
          </div>

          <div class="form-group">
            <label>Mã tham chiếu</label>
            <input 
              type="text" 
              [(ngModel)]="form.reference"
              (ngModelChange)="updateForm('reference', $event)"
              placeholder="Mã GD, số séc..." 
            />
          </div>

          <div class="form-group">
            <label>Ghi chú</label>
            <textarea 
              [(ngModel)]="form.notes"
              (ngModelChange)="updateForm('notes', $event)"
              placeholder="Ghi chú thêm..."
            ></textarea>
          </div>

          <div class="form-group">
            <label>Tài liệu đính kèm (tối đa 5 files)</label>
            <input 
              type="file" 
              multiple 
              (change)="onFileSelect($event)"
              [disabled]="files.length >= 5"
            />
            <div class="file-list" *ngIf="files.length > 0">
              <div class="file-item" *ngFor="let file of files; let i = index">
                <span>📎 {{ file.name }} ({{ formatFileSize(file.size) }})</span>
                <button type="button" class="remove-file" (click)="removeFile(i)">✕</button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn-secondary" (click)="modalState.close()">Hủy</button>
          <button type="button" class="btn-primary" (click)="onSubmit()">Thêm thanh toán</button>
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
      max-height: 90vh;
      overflow: auto;
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

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
    }

    .form-group textarea {
      min-height: 80px;
      resize: vertical;
    }

    .file-list {
      margin-top: 8px;
    }

    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: #f3f4f6;
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .remove-file {
      background: none;
      border: none;
      color: #ef4444;
      cursor: pointer;
      font-size: 18px;
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

    .btn-primary {
      padding: 8px 16px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-primary:hover {
      background: #2563eb;
    }
  `]
})
export class PaymentModalComponent {
  @Output() submit = new EventEmitter<any>();

  constructor(public modalState: PaymentModalState) {}

  get form() {
    return this.modalState.form();
  }

  get files() {
    return this.modalState.files();
  }

  updateForm(field: string, value: any) {
    this.modalState.updateForm({ [field]: value });
  }

  onFileSelect(event: any) {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length > 0) {
      this.modalState.addFiles(files);
    }
  }

  removeFile(index: number) {
    this.modalState.removeFile(index);
  }

  onSubmit() {
    const formData = this.form;
    if (!formData.amount || formData.amount <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    const documents = this.files.map(f => f.name);
    this.submit.emit({
      ...formData,
      documents: documents.length ? documents : undefined
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
