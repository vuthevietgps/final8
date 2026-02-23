import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderUpdateService, OrderUpdateResult } from './order-update.service';

@Component({
  selector: 'app-order-update',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h1>📝 Cập nhật thông tin đơn hàng</h1>
        <p class="description">
          Tải lên file Excel VTP để cập nhật thông tin đơn hàng từ vận đơn
        </p>
      </div>

      <div class="upload-section">
        <div class="upload-card">
          <div class="upload-area" 
               [class.drag-over]="isDragOver"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event)"
               (click)="fileInput.click()">
            
            <div class="upload-icon">📄</div>
            <h3>Tải lên file Excel</h3>
            <p>Kéo thả file hoặc click để chọn</p>
            <p class="format-info">Hỗ trợ: .xlsx, .xls (Tối đa 10MB)</p>
            
            <input #fileInput 
                   type="file" 
                   (change)="onFileSelected($event)"
                   accept=".xlsx,.xls"
                   style="display: none">
          </div>

          <!-- Selected File Info -->
          <div *ngIf="selectedFile" class="file-info">
            <div class="file-details">
              <span class="file-icon">📁</span>
              <div class="file-name">{{ selectedFile.name }}</div>
              <div class="file-size">{{ getFileSize(selectedFile.size) }}</div>
            </div>
            <div class="button-group">
              <button class="btn btn-secondary" 
                      (click)="previewFile()" 
                      [disabled]="isUploading">
                <span *ngIf="isPreviewing" class="loading-spinner"></span>
                {{ isPreviewing ? 'Đang xem trước...' : 'Xem trước dữ liệu' }}
              </button>
              <button class="btn btn-primary" 
                      (click)="uploadFile()" 
                      [disabled]="isUploading">
                <span *ngIf="isUploading" class="loading-spinner"></span>
                {{ isUploading ? 'Đang xử lý...' : 'Cập nhật đơn hàng' }}
              </button>
            </div>
          </div>

          <!-- Progress Bar -->
          <div *ngIf="isUploading" class="progress-section">
            <div class="progress-header">
              <div class="progress-title">
                <span class="loading-spinner"></span>
                {{ progressMessage }}
              </div>
              <div class="progress-percentage">{{ uploadProgress }}%</div>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="uploadProgress"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Section -->
      <div *ngIf="uploadResult" class="results-section">
        <div class="results-card">
          <h3>📊 Kết quả cập nhật</h3>
          
          <div class="summary-stats">
            <div class="stat-item success">
              <span class="stat-number">{{ uploadResult.successCount || 0 }}</span>
              <span class="stat-label">Thành công</span>
            </div>
            <div class="stat-item warning">
              <span class="stat-number">{{ uploadResult.skippedCount || 0 }}</span>
              <span class="stat-label">Bỏ qua</span>
            </div>
            <div class="stat-item error">
              <span class="stat-number">{{ uploadResult.errorCount || 0 }}</span>
              <span class="stat-label">Lỗi</span>
            </div>
            <div class="stat-item info">
              <span class="stat-number">{{ uploadResult.totalProcessed || 0 }}</span>
              <span class="stat-label">Tổng xử lý</span>
            </div>
          </div>

          <!-- Success Details -->
          <div *ngIf="uploadResult.successCount > 0" class="details-section">
            <h4>✅ Cập nhật thành công</h4>
            <div class="success-list">
              <div *ngFor="let item of uploadResult.successItems" class="result-item success">
                <span class="tracking-number">{{ item.trackingNumber }}</span>
                <span class="customer-name">{{ item.customerName }}</span>
                <span class="updated-fields">{{ item.updatedFields.join(', ') }}</span>
              </div>
            </div>
          </div>

          <!-- Skipped Details -->
          <div *ngIf="uploadResult.skippedCount > 0" class="details-section">
            <h4>⏭️ Đơn hàng bỏ qua</h4>
            <div class="skipped-list">
              <div *ngFor="let item of uploadResult.skippedItems" class="result-item warning">
                <span class="tracking-number">{{ item.trackingNumber }}</span>
                <span class="customer-name">{{ item.customerName }}</span>
                <span class="skip-reason">{{ item.reason }}</span>
              </div>
            </div>
          </div>

          <!-- Error Details -->
          <div *ngIf="uploadResult.errorCount > 0" class="details-section">
            <h4>❌ Lỗi xử lý</h4>
            <div class="error-list">
              <div *ngFor="let error of uploadResult.errors" class="result-item error">
                <span class="row-number">Dòng {{ error.row }}</span>
                <span class="error-message">{{ error.message }}</span>
                <span class="tracking-number">{{ error.trackingNumber || 'N/A' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions-section">
        <div class="instructions-card">
          <h3>📋 Hướng dẫn sử dụng</h3>
          <ul>
            <li><strong>Cột B:</strong> Mã vận đơn (dùng để đối chiếu)</li>
            <li><strong>Cột K:</strong> Tên người nhận</li>
            <li><strong>Cột L:</strong> Địa chỉ người nhận</li>
            <li><strong>Cột M:</strong> Số điện thoại người nhận</li>
            <li><strong>Cột R:</strong> Số tiền COD (sẽ chia đều cho các đơn cùng vận đơn)</li>
            <li><strong>Cột AG:</strong> Trạng thái vận đơn</li>
          </ul>
          <p class="note">
            <strong>Lưu ý:</strong> Hệ thống sẽ tự động đối chiếu mã vận đơn và cập nhật thông tin tương ứng.
            <br>• Chế độ hiện tại: Ghi đè TT Vận đơn từ cột AG cho TẤT CẢ đơn tìm thấy (kể cả đã "Giao thành công")
            <br>• Nếu không tìm thấy mã vận đơn trong hệ thống, đơn hàng sẽ được báo lỗi
          </p>
        </div>
      </div>
    </div>

    <!-- Success Notification -->
    <div class="success-notification" [class.show]="showSuccessNotification">
      <div class="icon">✅</div>
      <div class="content">
        <div class="title">Cập nhật thành công!</div>
        <div class="message">{{ successMessage }}</div>
      </div>
      <button class="close-btn" (click)="closeSuccessNotification()" title="Đóng">
        ✕
      </button>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }

    .page-header {
      margin-bottom: 30px;
    }

    .page-header h1 {
      margin: 0 0 10px 0;
      color: var(--primary-color);
    }

    .description {
      color: var(--text-secondary);
      margin: 0;
    }

    .upload-section {
      margin-bottom: 30px;
    }

    .upload-card {
      background: var(--surface-color);
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .upload-area {
      border: 2px dashed var(--border-color);
      border-radius: 8px;
      padding: 40px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: var(--background-color);
    }

    .upload-area:hover,
    .upload-area.drag-over {
      border-color: var(--primary-color);
      background: var(--primary-light);
    }

    .upload-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }

    .upload-area h3 {
      margin: 0 0 10px 0;
      color: var(--text-primary);
    }

    .upload-area p {
      margin: 5px 0;
      color: var(--text-secondary);
    }

    .format-info {
      font-size: 0.9em;
      color: var(--text-tertiary) !important;
    }

    .file-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding: 15px;
      background: var(--background-color);
      border-radius: 8px;
    }

    .file-details {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .file-icon {
      font-size: 20px;
    }

    .file-name {
      font-weight: 500;
      color: var(--text-primary);
    }

    .file-size {
      font-size: 0.9em;
      color: var(--text-secondary);
    }

    .progress-section {
      margin-top: 20px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--primary-color);
      transition: width 0.3s ease;
    }

    .progress-text {
      text-align: center;
      margin-top: 10px;
      color: var(--text-secondary);
    }

    .results-section {
      margin-bottom: 30px;
    }

    .results-card,
    .instructions-card {
      background: var(--surface-color);
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .results-card h3,
    .instructions-card h3 {
      margin: 0 0 20px 0;
      color: var(--primary-color);
    }

    .summary-stats {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }

    .stat-item {
      flex: 1;
      text-align: center;
      padding: 20px;
      border-radius: 8px;
    }

    .stat-item.success {
      background: rgba(76, 175, 80, 0.1);
      border: 1px solid rgba(76, 175, 80, 0.3);
    }

    .stat-item.error {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.3);
    }

    .stat-item.info {
      background: rgba(33, 150, 243, 0.1);
      border: 1px solid rgba(33, 150, 243, 0.3);
    }

    .stat-item.warning {
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .stat-number {
      display: block;
      font-size: 2em;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .stat-item.success .stat-number {
      color: #4CAF50;
    }

    .stat-item.error .stat-number {
      color: #F44336;
    }

    .stat-item.info .stat-number {
      color: #2196F3;
    }

    .stat-item.warning .stat-number {
      color: #FF9800;
    }

    .stat-label {
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    .details-section {
      margin-bottom: 20px;
    }

    .details-section h4 {
      margin: 0 0 15px 0;
      color: var(--text-primary);
    }

    .result-item {
      display: flex;
      gap: 15px;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 6px;
      font-size: 0.9em;
    }

    .result-item.success {
      background: rgba(76, 175, 80, 0.05);
      border-left: 3px solid #4CAF50;
    }

    .result-item.error {
      background: rgba(244, 67, 54, 0.05);
      border-left: 3px solid #F44336;
    }

    .result-item.warning {
      background: rgba(255, 193, 7, 0.05);
      border-left: 3px solid #FF9800;
    }

    .tracking-number {
      font-weight: 500;
      min-width: 120px;
    }

    .customer-name {
      flex: 1;
      color: var(--text-secondary);
    }

    .updated-fields {
      color: var(--text-tertiary);
      font-size: 0.8em;
    }

    .row-number {
      font-weight: 500;
      min-width: 80px;
      color: var(--text-secondary);
    }

    .error-message {
      flex: 1;
      color: #F44336;
    }

    .skip-reason {
      flex: 1;
      color: #FF9800;
      font-style: italic;
    }

    .instructions-card ul {
      list-style: none;
      padding: 0;
    }

    .instructions-card li {
      margin-bottom: 10px;
      padding-left: 20px;
      position: relative;
    }

    .instructions-card li:before {
      content: "•";
      color: var(--primary-color);
      font-weight: bold;
      position: absolute;
      left: 0;
    }

    .note {
      margin-top: 20px;
      padding: 15px;
      background: rgba(255, 193, 7, 0.1);
      border: 1px solid rgba(255, 193, 7, 0.3);
      border-radius: 6px;
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-dark);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    /* Loading spinner animation */
    .loading-spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Success notification */
    .success-notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 10px;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    }

    .success-notification.show {
      transform: translateX(0);
    }

    .success-notification .icon {
      font-size: 20px;
    }

    .success-notification .content {
      flex: 1;
    }

    .success-notification .title {
      font-weight: bold;
      margin-bottom: 2px;
    }

    .success-notification .message {
      font-size: 0.9em;
      opacity: 0.9;
    }

    .success-notification .close-btn {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    }

    .success-notification .close-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }

    /* Enhanced progress bar */
    .progress-section {
      margin-top: 20px;
      padding: 15px;
      background: var(--background-color);
      border-radius: 8px;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .progress-title {
      font-weight: 500;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-percentage {
      font-weight: bold;
      color: var(--primary-color);
    }

    .progress-bar {
      width: 100%;
      height: 12px;
      background: var(--border-color);
      border-radius: 6px;
      overflow: hidden;
      position: relative;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary-color), #4CAF50);
      transition: width 0.3s ease;
      position: relative;
    }

    .progress-fill::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: progressShine 2s ease-in-out infinite;
    }

    @keyframes progressShine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .progress-text {
      text-align: center;
      margin-top: 10px;
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    /* Enhanced button styles */
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9em;
      font-weight: 500;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-width: 140px;
    }

    .btn-primary {
      background: var(--primary-color);
      color: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-dark);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    .btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .button-group {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .btn-secondary {
      background: #6c757d;
      color: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-secondary:hover:not(:disabled) {
      background: #545b62;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }

    @media (max-width: 768px) {
      .success-notification {
        top: 10px;
        right: 10px;
        left: 10px;
        transform: translateY(-100%);
      }

      .success-notification.show {
        transform: translateY(0);
      }

      .page-container {
        padding: 10px;
      }

      .upload-card,
      .results-card,
      .instructions-card {
        padding: 20px;
      }

      .summary-stats {
        flex-direction: column;
        gap: 10px;
      }

      .file-info {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
      }

      .result-item {
        flex-direction: column;
        gap: 5px;
      }
    }
  `]
})
export class OrderUpdateComponent {
  private orderUpdateService = inject(OrderUpdateService);

  selectedFile: File | null = null;
  isUploading = false;
  uploadProgress = 0;
  progressMessage = '';
  isDragOver = false;
  uploadResult: OrderUpdateResult | null = null;
  showSuccessNotification = false;
  successMessage = '';
  isPreviewing = false;
  previewData: any = null;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.handleFileSelection(file);
    }
  }

  private handleFileSelection(file: File) {
    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('File không được vượt quá 10MB');
      return;
    }

    this.selectedFile = file;
    this.uploadResult = null;
  }

  uploadFile() {
    if (!this.selectedFile) return;

    this.isUploading = true;
    this.uploadProgress = 0;
    this.progressMessage = 'Đang tải lên file...';
    this.uploadResult = null;

    // Enhanced progress simulation
    const progressSteps = [
      { progress: 15, message: 'Đang tải lên file Excel...' },
      { progress: 35, message: 'Đang đọc và phân tích dữ liệu...' },
      { progress: 55, message: 'Đang đối chiếu mã vận đơn...' },
      { progress: 75, message: 'Đang cập nhật thông tin đơn hàng...' },
      { progress: 90, message: 'Đang hoàn thiện kết quả...' }
    ];

    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      if (stepIndex < progressSteps.length) {
        const step = progressSteps[stepIndex];
        this.uploadProgress = step.progress;
        this.progressMessage = step.message;
        stepIndex++;
      }
    }, 800);

  const sub = this.orderUpdateService.updateOrdersFromExcel(this.selectedFile!)
      .subscribe({
      next: (result: OrderUpdateResult) => {
        clearInterval(progressInterval);
        this.uploadProgress = 100;
        this.progressMessage = 'Hoàn thành!';
        
        // Generate success message
        this.successMessage = `Đã xử lý ${result.totalProcessed} vận đơn: ${result.successCount} thành công, ${result.skippedCount} bỏ qua, ${result.errorCount} lỗi`;
        
        setTimeout(() => {
          this.isUploading = false;
          this.uploadResult = result;
          this.selectedFile = null;
          
          // Show success notification
          if (result.successCount > 0) {
            this.showSuccessNotification = true;
            
            // Auto hide after 5 seconds
            setTimeout(() => {
              this.showSuccessNotification = false;
            }, 5000);
          }
        }, 800);
      },
      error: (error: any) => {
        clearInterval(progressInterval);
        this.isUploading = false;
        this.uploadProgress = 0;
        
        // Show error alert
        alert('❌ Có lỗi xảy ra: ' + (error.error?.message || error.message));
      },
      complete: () => {
        clearInterval(progressInterval);
        this.isUploading = false;
      }
    });
  }

  closeSuccessNotification() {
    this.showSuccessNotification = false;
  }

  previewFile() {
    if (!this.selectedFile) return;

    this.isPreviewing = true;
    this.previewData = null;

  this.orderUpdateService.previewExcelData(this.selectedFile!).subscribe({
      next: (result: any) => {
        this.isPreviewing = false;
        this.previewData = result;
        console.log('📋 Preview data:', result);
      },
      error: (error: any) => {
        this.isPreviewing = false;
        alert('Có lỗi xảy ra khi xem trước: ' + (error.error?.message || error.message));
      }
    });
  }

  getFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}