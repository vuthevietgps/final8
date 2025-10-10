/**
 * File: features/import-user/import-user.component.ts
 * Mục đích: UI tải lên file người dùng và hiển thị kết quả nhập.
 */
/**
 * Import User Component - Component xử lý UI import users từ CSV
 * 
 * Chức năng:
 * - Hiển thị modal/dialog import options
 * - Upload CSV file
 * - Validate file trước khi import
 * - Hiển thị kết quả import với statistics
 * - Download template CSV
 * - Hiển thị hướng dẫn import
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  ImportUserService, 
  ImportResult, 
  ImportError, 
  ValidationResult, 
  ImportInstructions 
} from './import-user.service';

@Component({
  selector: 'app-import-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="import-user-container">
      <!-- Import Button -->
      <button 
        class="btn btn-info"
        (click)="openImportModal()"
        [disabled]="isLoading"
        title="Nhập danh sách users từ file CSV">
        <i class="fas fa-upload me-2"></i>
        Nhập CSV
      </button>

      <!-- Import Modal -->
      <div class="modal fade" [class.show]="showModal" [style.display]="showModal ? 'block' : 'none'" 
           tabindex="-1" role="dialog" aria-labelledby="importModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
          <div class="modal-content">
            
            <!-- Modal Header -->
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title" id="importModalLabel">
                <i class="fas fa-upload me-2"></i>
                Nhập Danh Sách Users Từ CSV
              </h5>
              <button type="button" class="btn-close btn-close-white" 
                      (click)="closeModal()" aria-label="Close"></button>
            </div>

            <!-- Modal Body -->
            <div class="modal-body">
              
              <!-- Step 1: Hướng dẫn và Template -->
              <div class="step-section mb-4" *ngIf="currentStep === 1">
                <h6 class="fw-bold mb-3">
                  <i class="fas fa-info-circle me-2"></i>
                  Bước 1: Tải Template và Chuẩn Bị Dữ Liệu
                </h6>
                
                <div class="row">
                  <div class="col-md-6">
                    <div class="template-section p-3 border rounded">
                      <h6 class="fw-bold">Template CSV</h6>
                      <p class="text-muted">Tải template để có format đúng</p>
                      <button class="btn btn-outline-primary" 
                              (click)="downloadTemplate()" 
                              [disabled]="isLoading">
                        <i class="fas fa-download me-2"></i>
                        Tải Template
                      </button>
                    </div>
                  </div>
                  
                  <div class="col-md-6">
                    <div class="instructions-section p-3 border rounded">
                      <h6 class="fw-bold">Yêu Cầu File</h6>
                      <ul class="small mb-0">
                        <li>File định dạng CSV (UTF-8)</li>
                        <li>Kích thước tối đa 5MB</li>
                        <li>Email trùng sẽ ghi đè user cũ</li>
                        <li>Các cột bắt buộc không được trống</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <!-- Hướng dẫn chi tiết -->
                <div class="instructions-detail mt-3" *ngIf="instructions">
                  <div class="accordion" id="instructionsAccordion">
                    <div class="accordion-item">
                      <h2 class="accordion-header">
                        <button class="accordion-button collapsed" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#collapseInstructions">
                          <i class="fas fa-book me-2"></i>
                          Xem Hướng Dẫn Chi Tiết
                        </button>
                      </h2>
                      <div id="collapseInstructions" class="accordion-collapse collapse">
                        <div class="accordion-body">
                          <div class="row">
                            <div class="col-md-6">
                              <h6 class="fw-bold text-danger">Các Cột Bắt Buộc</h6>
                              <div class="small" *ngFor="let col of instructions.requiredColumns">
                                <strong>{{ col.name }}:</strong> {{ col.description }}
                                <br><em>VD: {{ col.example }}</em>
                                <div *ngIf="col.validValues" class="text-muted">
                                  Giá trị hợp lệ: {{ col.validValues.join(', ') }}
                                </div>
                                <hr class="my-2">
                              </div>
                            </div>
                            <div class="col-md-6">
                              <h6 class="fw-bold text-info">Các Cột Tùy Chọn</h6>
                              <div class="small" *ngFor="let col of instructions.optionalColumns">
                                <strong>{{ col.name }}:</strong> {{ col.description }}
                                <br><em>VD: {{ col.example }}</em>
                                <hr class="my-2">
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 2: Upload File -->
              <div class="step-section mb-4" *ngIf="currentStep === 2">
                <h6 class="fw-bold mb-3">
                  <i class="fas fa-cloud-upload-alt me-2"></i>
                  Bước 2: Chọn File CSV
                </h6>
                
                <div class="upload-area p-4 border-2 border-dashed rounded text-center"
                     [class.border-primary]="!selectedFile"
                     [class.border-success]="selectedFile && !validationResult"
                     [class.border-danger]="validationResult && !validationResult.valid"
                     (dragover)="onDragOver($event)"
                     (dragleave)="onDragLeave($event)"
                     (drop)="onDrop($event)">
                  
                  <div *ngIf="!selectedFile">
                    <i class="fas fa-cloud-upload-alt fa-3x text-muted mb-3"></i>
                    <p class="mb-2">Kéo thả file CSV vào đây hoặc</p>
                    <input type="file" #fileInput class="d-none" accept=".csv" 
                           (change)="onFileSelected($event)">
                    <button class="btn btn-outline-primary" (click)="fileInput.click()">
                      Chọn File
                    </button>
                  </div>

                  <div *ngIf="selectedFile" class="selected-file">
                    <i class="fas fa-file-csv fa-2x text-success mb-2"></i>
                    <p class="mb-1 fw-bold">{{ selectedFile.name }}</p>
                    <p class="mb-2 text-muted">{{ formatFileSize(selectedFile.size) }}</p>
                    <button class="btn btn-outline-danger btn-sm" (click)="removeFile()">
                      <i class="fas fa-times me-1"></i>
                      Xóa
                    </button>
                  </div>
                </div>

                <!-- Validation Result -->
                <div *ngIf="validationResult" class="mt-3">
                  <div class="alert" 
                       [class.alert-success]="validationResult.valid"
                       [class.alert-danger]="!validationResult.valid">
                    <div class="d-flex align-items-center">
                      <i class="fas" 
                         [class.fa-check-circle]="validationResult.valid"
                         [class.fa-exclamation-triangle]="!validationResult.valid"
                         [class.text-success]="validationResult.valid"
                         [class.text-danger]="!validationResult.valid"></i>
                      <div class="ms-2">
                        <strong>{{ validationResult.message }}</strong>
                        <div *ngIf="validationResult.valid && validationResult.totalRows" class="small">
                          File hợp lệ với {{ validationResult.totalRows }} dòng dữ liệu
                        </div>
                        <div *ngIf="!validationResult.valid && validationResult.error" class="small">
                          {{ validationResult.error }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 3: Import Results -->
              <div class="step-section mb-4" *ngIf="currentStep === 3 && importResult">
                <h6 class="fw-bold mb-3">
                  <i class="fas fa-chart-bar me-2"></i>
                  Bước 3: Kết Quả Import
                </h6>
                
                <div class="row mb-3">
                  <div class="col-md-3">
                    <div class="stat-card bg-primary text-white p-3 rounded text-center">
                      <div class="h4 mb-1">{{ importResult.total }}</div>
                      <div class="small">Tổng Dòng</div>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="stat-card bg-success text-white p-3 rounded text-center">
                      <div class="h4 mb-1">{{ importResult.success }}</div>
                      <div class="small">Thành Công</div>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="stat-card bg-warning text-white p-3 rounded text-center">
                      <div class="h4 mb-1">{{ importResult.updated }}</div>
                      <div class="small">Cập Nhật</div>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="stat-card bg-danger text-white p-3 rounded text-center">
                      <div class="h4 mb-1">{{ importResult.failed }}</div>
                      <div class="small">Thất Bại</div>
                    </div>
                  </div>
                </div>

                <!-- Success Message -->
                <div *ngIf="importResult.message" class="alert alert-info">
                  <i class="fas fa-info-circle me-2"></i>
                  {{ importResult.message }}
                </div>

                <!-- Error Details -->
                <div *ngIf="importResult.errors && importResult.errors.length > 0" class="errors-section">
                  <h6 class="fw-bold text-danger">Chi Tiết Lỗi:</h6>
                  <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                    <table class="table table-sm table-bordered">
                      <thead class="table-dark">
                        <tr>
                          <th>Dòng</th>
                          <th>Lỗi</th>
                          <th>Dữ Liệu</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr *ngFor="let error of importResult.errors">
                          <td>{{ error.row }}</td>
                          <td class="text-danger">{{ error.error }}</td>
                          <td class="small">{{ error.data | json }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- Loading State -->
              <div class="text-center" *ngIf="isLoading">
                <div class="spinner-border text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <div class="mt-2">{{ loadingMessage }}</div>
              </div>

              <!-- Error Message -->
              <div class="alert alert-danger" *ngIf="errorMessage">
                <i class="fas fa-exclamation-triangle me-2"></i>
                {{ errorMessage }}
              </div>

            </div>

            <!-- Modal Footer -->
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="closeModal()">
                <i class="fas fa-times me-2"></i>
                Đóng
              </button>
              
              <button *ngIf="currentStep === 1" type="button" class="btn btn-primary" 
                      (click)="nextStep()">
                <i class="fas fa-arrow-right me-2"></i>
                Tiếp Theo
              </button>
              
              <button *ngIf="currentStep === 2" type="button" class="btn btn-secondary me-2" 
                      (click)="prevStep()">
                <i class="fas fa-arrow-left me-2"></i>
                Quay Lại
              </button>
              
              <button *ngIf="currentStep === 2" type="button" class="btn btn-info me-2" 
                      (click)="validateFile()" 
                      [disabled]="!selectedFile || isLoading">
                <i class="fas fa-check me-2"></i>
                Kiểm Tra
              </button>
              
              <button *ngIf="currentStep === 2" type="button" class="btn btn-success" 
                      (click)="importUsers()" 
                      [disabled]="!selectedFile || isLoading || (validationResult && !validationResult.valid)">
                <i class="fas fa-upload me-2"></i>
                Import Ngay
              </button>
              
              <button *ngIf="currentStep === 3" type="button" class="btn btn-primary" 
                      (click)="resetImport()">
                <i class="fas fa-redo me-2"></i>
                Import Khác
              </button>
            </div>

          </div>
        </div>
      </div>

      <!-- Modal Backdrop -->
      <div class="modal-backdrop fade" [class.show]="showModal" *ngIf="showModal" 
           (click)="closeModal()"></div>
    </div>
  `,
  styles: [`
    .import-user-container {
      display: inline-block;
    }

    .modal {
      z-index: 1050;
    }

    .modal-backdrop {
      z-index: 1040;
    }

    .upload-area {
      transition: all 0.3s ease;
      min-height: 200px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-area:hover {
      background-color: #f8f9fa;
    }

    .upload-area.drag-over {
      border-color: #007bff !important;
      background-color: #e3f2fd;
    }

    .stat-card {
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .step-section {
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 1rem;
      background: #f8f9fa;
    }

    .template-section,
    .instructions-section {
      height: 100%;
    }

    .selected-file {
      border: 2px dashed #28a745;
      border-radius: 8px;
      padding: 1rem;
      background: #f8fff9;
    }

    .errors-section {
      border: 1px solid #dc3545;
      border-radius: 8px;
      padding: 1rem;
      background: #fff5f5;
    }

    .btn i {
      font-size: 0.875rem;
    }

    .btn-close-white {
      filter: invert(1) grayscale(100%) brightness(200%);
    }

    .accordion-button:not(.collapsed) {
      background-color: #e9ecef;
      color: #495057;
    }
  `]
})
export class ImportUserComponent implements OnInit {
  showModal = false;
  isLoading = false;
  loadingMessage = '';
  errorMessage = '';
  currentStep = 1;
  
  selectedFile: File | null = null;
  validationResult: ValidationResult | null = null;
  importResult: ImportResult | null = null;
  instructions: ImportInstructions | null = null;

  constructor(private importUserService: ImportUserService) {}

  ngOnInit(): void {
    this.loadInstructions();
  }

  /**
   * Mở modal import
   */
  openImportModal(): void {
    this.showModal = true;
    this.resetImport();
  }

  /**
   * Đóng modal import
   */
  closeModal(): void {
    this.showModal = false;
    this.resetImport();
  }

  /**
   * Reset về trạng thái ban đầu
   */
  resetImport(): void {
    this.currentStep = 1;
    this.selectedFile = null;
    this.validationResult = null;
    this.importResult = null;
    this.errorMessage = '';
    this.isLoading = false;
    this.loadingMessage = '';
  }

  /**
   * Chuyển đến step tiếp theo
   */
  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  /**
   * Quay lại step trước
   */
  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  /**
   * Load hướng dẫn import
   */
  async loadInstructions(): Promise<void> {
    try {
      this.importUserService.getImportInstructions().subscribe({
        next: (instructions) => {
          this.instructions = instructions;
        },
        error: (error) => {
          console.error('Error loading instructions:', error);
        }
      });
    } catch (error) {
      console.error('Error loading instructions:', error);
    }
  }

  /**
   * Download CSV template
   */
  async downloadTemplate(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Đang tạo template...';
      
      await this.importUserService.downloadCSVTemplate();
      
    } catch (error) {
      console.error('Error downloading template:', error);
      this.errorMessage = 'Không thể tải template. Vui lòng thử lại.';
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Xử lý khi chọn file
   */
  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      this.handleFileSelection(file);
    }
  }

  /**
   * Xử lý drag over
   */
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.add('drag-over');
  }

  /**
   * Xử lý drag leave
   */
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('drag-over');
  }

  /**
   * Xử lý drop file
   */
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    const uploadArea = event.currentTarget as HTMLElement;
    uploadArea.classList.remove('drag-over');
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileSelection(files[0]);
    }
  }

  /**
   * Xử lý việc chọn file
   */
  private handleFileSelection(file: File): void {
    if (!this.importUserService.isValidCSVFile(file)) {
      this.errorMessage = 'Vui lòng chọn file CSV hợp lệ.';
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      this.errorMessage = 'File quá lớn. Kích thước tối đa là 5MB.';
      return;
    }

    this.selectedFile = file;
    this.validationResult = null;
    this.errorMessage = '';
  }

  /**
   * Xóa file đã chọn
   */
  removeFile(): void {
    this.selectedFile = null;
    this.validationResult = null;
    this.errorMessage = '';
  }

  /**
   * Validate file CSV
   */
  async validateFile(): Promise<void> {
    if (!this.selectedFile) return;

    try {
      this.isLoading = true;
      this.loadingMessage = 'Đang kiểm tra file...';
      this.errorMessage = '';

      this.importUserService.validateCSVFile(this.selectedFile).subscribe({
        next: (result) => {
          this.validationResult = result;
        },
        error: (error) => {
          console.error('Error validating file:', error);
          this.errorMessage = 'Không thể kiểm tra file. Vui lòng thử lại.';
        },
        complete: () => {
          this.isLoading = false;
          this.loadingMessage = '';
        }
      });

    } catch (error) {
      console.error('Error validating file:', error);
      this.errorMessage = 'Không thể kiểm tra file. Vui lòng thử lại.';
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Import users từ CSV
   */
  async importUsers(): Promise<void> {
    if (!this.selectedFile) return;

    try {
      this.isLoading = true;
      this.loadingMessage = 'Đang import users...';
      this.errorMessage = '';

      this.importUserService.importUsersFromCSV(this.selectedFile).subscribe({
        next: (result) => {
          this.importResult = result;
          this.currentStep = 3;
        },
        error: (error) => {
          console.error('Error importing users:', error);
          this.errorMessage = error.error?.message || 'Không thể import users. Vui lòng thử lại.';
        },
        complete: () => {
          this.isLoading = false;
          this.loadingMessage = '';
        }
      });

    } catch (error) {
      console.error('Error importing users:', error);
      this.errorMessage = 'Không thể import users. Vui lòng thử lại.';
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    return this.importUserService.formatFileSize(bytes);
  }
}
