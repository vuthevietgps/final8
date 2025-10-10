/**
 * Token Recovery Component
 * Provides UI for manual token refresh and recovery options
 */

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TokenStatus {
  id: string;
  status: 'valid' | 'expired' | 'invalid' | 'unknown';
  message: string;
  lastChecked: string;
  fanpageId: string;
  fanpageName: string;
}

@Component({
  selector: 'app-token-recovery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="token-recovery-modal" *ngIf="showModal" (click)="closeModal($event)">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>🔧 Khôi phục Access Token</h3>
          <button class="close-btn" (click)="closeModal()">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="token-info">
            <h4>{{ tokenStatus.fanpageName }}</h4>
            <p class="status-info">
              <span class="status-icon" [ngClass]="getStatusClass()">{{ getStatusIcon() }}</span>
              {{ tokenStatus.message }}
            </p>
            <p class="last-checked">Kiểm tra lần cuối: {{ tokenStatus.lastChecked | date:'dd/MM/yyyy HH:mm' }}</p>
          </div>

          <div class="recovery-methods">
            <h5>Chọn phương pháp khôi phục:</h5>
            
            <!-- Method 1: Manual Token Input -->
            <div class="method-card" [class.active]="selectedMethod === 'manual'">
              <label class="method-radio">
                <input type="radio" [(ngModel)]="selectedMethod" value="manual">
                <span class="method-title">📝 Nhập token mới thủ công</span>
              </label>
              <div class="method-description" *ngIf="selectedMethod === 'manual'">
                <p>Nhập access token mới từ Facebook Developer Console:</p>
                <textarea 
                  [(ngModel)]="newToken" 
                  placeholder="Paste Facebook access token here..."
                  class="token-input"
                  rows="3">
                </textarea>
                <div class="help-links">
                  <a href="https://developers.facebook.com/tools/explorer/" target="_blank">
                    🔗 Facebook Graph API Explorer
                  </a>
                </div>
              </div>
            </div>

            <!-- Method 2: OAuth Reconnect -->
            <div class="method-card" [class.active]="selectedMethod === 'oauth'">
              <label class="method-radio">
                <input type="radio" [(ngModel)]="selectedMethod" value="oauth">
                <span class="method-title">🔐 Kết nối lại Facebook OAuth</span>
              </label>
              <div class="method-description" *ngIf="selectedMethod === 'oauth'">
                <p>Đăng nhập lại Facebook để cấp quyền mới:</p>
                <button class="facebook-login-btn" (click)="initiateOAuth()">
                  <i class="fab fa-facebook"></i> Kết nối với Facebook
                </button>
                <small>Bạn sẽ được chuyển đến Facebook để đăng nhập</small>
              </div>
            </div>

            <!-- Method 3: Backup Token -->
            <div class="method-card" [class.active]="selectedMethod === 'backup'" *ngIf="hasBackupTokens">
              <label class="method-radio">
                <input type="radio" [(ngModel)]="selectedMethod" value="backup">
                <span class="method-title">🔄 Sử dụng token dự phòng</span>
              </label>
              <div class="method-description" *ngIf="selectedMethod === 'backup'">
                <p>Tự động chuyển sang token dự phòng khả dụng</p>
                <div class="backup-info">
                  <i class="fas fa-shield-alt"></i>
                  Có {{ backupTokenCount }} token dự phòng khả dụng
                </div>
              </div>
            </div>
          </div>

          <!-- Recovery Instructions -->
          <div class="instructions" *ngIf="selectedMethod">
            <h5>📋 Hướng dẫn chi tiết:</h5>
            <div [ngSwitch]="selectedMethod">
              <div *ngSwitchCase="'manual'">
                <ol>
                  <li>Truy cập <a href="https://developers.facebook.com/tools/explorer/" target="_blank">Facebook Graph API Explorer</a></li>
                  <li>Chọn ứng dụng của bạn</li>
                  <li>Chọn fanpage: {{ tokenStatus.fanpageName }}</li>
                  <li>Chọn quyền: pages_manage_metadata, pages_messaging</li>
                  <li>Click "Generate Access Token"</li>
                  <li>Copy token và paste vào ô trên</li>
                </ol>
              </div>
              <div *ngSwitchCase="'oauth'">
                <ol>
                  <li>Click nút "Kết nối với Facebook"</li>
                  <li>Đăng nhập tài khoản Facebook quản lý fanpage</li>
                  <li>Cấp quyền cho ứng dụng</li>
                  <li>Hệ thống sẽ tự động cập nhật token mới</li>
                </ol>
              </div>
              <div *ngSwitchCase="'backup'">
                <ol>
                  <li>Hệ thống sẽ tự động chuyển sang token dự phòng</li>
                  <li>Kiểm tra token dự phòng có hợp lệ không</li>
                  <li>Cập nhật fanpage sử dụng token mới</li>
                  <li>Thông báo kết quả chuyển đổi</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeModal()">Hủy</button>
          <button 
            class="btn btn-primary" 
            [disabled]="!canProceed()" 
            (click)="executeRecovery()"
            [class.loading]="isProcessing">
            <span *ngIf="!isProcessing">{{ getActionButtonText() }}</span>
            <span *ngIf="isProcessing">
              <i class="fas fa-spinner fa-spin"></i> Đang xử lý...
            </span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .token-recovery-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }

    .modal-header {
      padding: 20px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .modal-header h3 {
      margin: 0;
      color: #333;
    }

    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #999;
    }

    .modal-body {
      padding: 20px;
    }

    .token-info {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .token-info h4 {
      margin: 0 0 10px 0;
      color: #333;
    }

    .status-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 5px 0;
    }

    .status-icon {
      font-size: 16px;
    }

    .status-icon.valid { color: #28a745; }
    .status-icon.expired { color: #dc3545; }
    .status-icon.invalid { color: #fd7e14; }
    .status-icon.unknown { color: #6c757d; }

    .last-checked {
      color: #666;
      font-size: 14px;
      margin: 5px 0 0 0;
    }

    .recovery-methods h5 {
      margin-bottom: 15px;
      color: #333;
    }

    .method-card {
      border: 2px solid #e9ecef;
      border-radius: 8px;
      margin-bottom: 15px;
      transition: all 0.3s ease;
    }

    .method-card.active {
      border-color: #007bff;
      background: #f8f9ff;
    }

    .method-radio {
      display: block;
      padding: 15px;
      cursor: pointer;
      font-weight: 500;
    }

    .method-radio input[type="radio"] {
      margin-right: 10px;
    }

    .method-description {
      padding: 0 15px 15px 15px;
      border-top: 1px solid #e9ecef;
    }

    .token-input {
      width: 100%;
      min-height: 80px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      margin: 10px 0;
      resize: vertical;
    }

    .facebook-login-btn {
      background: #4267B2;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 10px 0;
    }

    .facebook-login-btn:hover {
      background: #365899;
    }

    .backup-info {
      background: #d4edda;
      color: #155724;
      padding: 10px;
      border-radius: 4px;
      margin: 10px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .help-links a {
      color: #007bff;
      text-decoration: none;
      font-size: 14px;
    }

    .help-links a:hover {
      text-decoration: underline;
    }

    .instructions {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
    }

    .instructions h5 {
      margin-top: 0;
      color: #856404;
    }

    .instructions ol {
      margin-bottom: 0;
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 5px;
      color: #856404;
    }

    .modal-footer {
      padding: 20px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
    }

    .btn-primary {
      background: #007bff;
      color: white;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn.loading {
      position: relative;
    }

    @media (max-width: 768px) {
      .modal-content {
        width: 95%;
        margin: 10px;
      }
      
      .modal-body {
        padding: 15px;
      }
    }
  `]
})
export class TokenRecoveryComponent {
  @Input() showModal = false;
  @Input() tokenStatus: TokenStatus = {
    id: '',
    status: 'unknown',
    message: '',
    lastChecked: '',
    fanpageId: '',
    fanpageName: ''
  };
  @Input() hasBackupTokens = false;
  @Input() backupTokenCount = 0;

  @Output() onClose = new EventEmitter<void>();
  @Output() onRecovery = new EventEmitter<{method: string, data: any}>();

  selectedMethod = 'manual';
  newToken = '';
  isProcessing = false;

  closeModal(event?: Event) {
    if (event && (event.target as HTMLElement).classList.contains('modal-content')) {
      return;
    }
    this.showModal = false;
    this.onClose.emit();
    this.resetForm();
  }

  resetForm() {
    this.selectedMethod = 'manual';
    this.newToken = '';
    this.isProcessing = false;
  }

  getStatusClass(): string {
    return this.tokenStatus.status;
  }

  getStatusIcon(): string {
    switch (this.tokenStatus.status) {
      case 'valid': return '✅';
      case 'expired': return '❌';
      case 'invalid': return '⚠️';
      default: return '⏺';
    }
  }

  canProceed(): boolean {
    if (this.isProcessing) return false;
    
    switch (this.selectedMethod) {
      case 'manual':
        return this.newToken.trim().length > 10;
      case 'oauth':
      case 'backup':
        return true;
      default:
        return false;
    }
  }

  getActionButtonText(): string {
    switch (this.selectedMethod) {
      case 'manual': return '💾 Lưu token mới';
      case 'oauth': return '🔐 Kết nối Facebook';
      case 'backup': return '🔄 Chuyển token dự phòng';
      default: return 'Xử lý';
    }
  }

  async executeRecovery() {
    if (!this.canProceed()) return;

    this.isProcessing = true;

    try {
      const recoveryData = {
        method: this.selectedMethod,
        data: this.getRecoveryData()
      };

      this.onRecovery.emit(recoveryData);
    } catch (error) {
      console.error('Recovery execution failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private getRecoveryData(): any {
    switch (this.selectedMethod) {
      case 'manual':
        return { newToken: this.newToken.trim() };
      case 'oauth':
        return { oauthFlow: true };
      case 'backup':
        return { useBackup: true };
      default:
        return {};
    }
  }

  initiateOAuth() {
    // This would integrate with Facebook SDK
    // For now, just log the action
    console.log('Initiating Facebook OAuth flow...');
    
    // In real implementation:
    // 1. Initialize Facebook SDK
    // 2. Call FB.login() with required permissions
    // 3. Handle success callback with new token
    // 4. Update token in backend
    
    alert('OAuth integration sẽ được implement trong version tiếp theo');
  }
}

export default TokenRecoveryComponent;