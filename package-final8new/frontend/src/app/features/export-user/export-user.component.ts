/**
 * File: features/export-user/export-user.component.ts
 * Mục đích: UI kích hoạt xuất dữ liệu người dùng (chọn tham số, gọi service).
 */
/**
 * Export User Component - Component xử lý UI export users ra CSV
 * 
 * Chức năng:
 * - Hiển thị modal/dialog export options
 * - Cho phép user chọn filter (role, active only)
 * - Preview CSV content trước khi export
 * - Hiển thị thống kê users
 * - Trigger download CSV file
 */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportUserService, UserStats, CsvPreview, ExportOptions } from './export-user.service';
import { UserRole } from '../user/user.model';

@Component({
  selector: 'app-export-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="export-user-container">
      <!-- Export Button (sẽ được đặt cạnh nút Thêm User) -->
      <button 
        class="btn btn-success"
        (click)="openExportModal()"
        [disabled]="isLoading"
        title="Xuất danh sách users ra file CSV">
        <i class="fas fa-download me-2"></i>
        Xuất CSV
      </button>

      <!-- Export Modal -->
      <div class="modal fade" [class.show]="showModal" [style.display]="showModal ? 'block' : 'none'" 
           tabindex="-1" role="dialog" aria-labelledby="exportModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
          <div class="modal-content">
            
            <!-- Modal Header -->
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title" id="exportModalLabel">
                <i class="fas fa-download me-2"></i>
                Xuất Danh Sách Users Ra CSV
              </h5>
              <button type="button" class="btn-close btn-close-white" 
                      (click)="closeModal()" aria-label="Close"></button>
            </div>

            <!-- Modal Body -->
            <div class="modal-body">
              
              <!-- Thống kê Users -->
              <div class="stats-section mb-4" *ngIf="userStats">
                <h6 class="fw-bold mb-3">
                  <i class="fas fa-chart-bar me-2"></i>
                  Thống Kê Users
                </h6>
                <div class="row">
                  <div class="col-md-4">
                    <div class="stat-card bg-primary text-white p-3 rounded">
                      <div class="h4 mb-1">{{ userStats.total }}</div>
                      <div class="small">Tổng Users</div>
                    </div>
                  </div>
                  <div class="col-md-8">
                    <div class="role-stats">
                      <div class="row">
                        <div class="col-6 mb-2" *ngFor="let role of getUserRoles()">
                          <div class="d-flex justify-content-between">
                            <span class="small">{{ getRoleDisplayName(role) }}:</span>
                            <span class="fw-bold">{{ userStats.byRole[role] || 0 }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Export Options -->
              <div class="export-options mb-4">
                <h6 class="fw-bold mb-3">
                  <i class="fas fa-filter me-2"></i>
                  Tùy Chọn Export
                </h6>
                
                <!-- Filter by Role -->
                <div class="mb-3">
                  <label class="form-label">Lọc theo vai trò:</label>
                  <select class="form-select" [(ngModel)]="exportOptions.role">
                    <option value="">Tất cả vai trò</option>
                    <option [value]="role" *ngFor="let role of getUserRoles()">
                      {{ getRoleDisplayName(role) }}
                    </option>
                  </select>
                </div>

                <!-- Active Only -->
                <div class="form-check mb-3">
                  <input class="form-check-input" type="checkbox" id="activeOnly" 
                         [(ngModel)]="exportOptions.activeOnly">
                  <label class="form-check-label" for="activeOnly">
                    Chỉ users đang hoạt động
                  </label>
                </div>
              </div>

              <!-- Preview Section -->
              <div class="preview-section" *ngIf="csvPreview">
                <h6 class="fw-bold mb-3">
                  <i class="fas fa-eye me-2"></i>
                  Preview ({{ csvPreview.previewRows }}/{{ csvPreview.totalRows }} dòng)
                </h6>
                
                <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
                  <table class="table table-sm table-bordered">
                    <thead class="table-dark sticky-top">
                      <tr>
                        <th *ngFor="let header of csvPreview.header">{{ header }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of csvPreview.preview">
                        <td *ngFor="let cell of row" class="small">
                          {{ cell.replace(/"/g, '') }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
                Hủy
              </button>
              <button type="button" class="btn btn-info me-2" 
                      (click)="loadPreview()" [disabled]="isLoading">
                <i class="fas fa-eye me-2"></i>
                Xem Preview
              </button>
              <button type="button" class="btn btn-success" 
                      (click)="exportToCsv()" [disabled]="isLoading">
                <i class="fas fa-download me-2"></i>
                Tải Xuống CSV
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
    .export-user-container {
      display: inline-block;
    }

    .modal {
      z-index: 1050;
    }

    .modal-backdrop {
      z-index: 1040;
    }

    .stat-card {
      text-align: center;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .role-stats {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      max-height: 120px;
      overflow-y: auto;
    }

    .table th {
      font-size: 0.875rem;
      white-space: nowrap;
    }

    .table td {
      font-size: 0.8rem;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .btn i {
      font-size: 0.875rem;
    }

    .export-options {
      background: #f8f9fa;
      padding: 1rem;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .preview-section {
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 1rem;
      background: #fff;
    }

    .btn-close-white {
      filter: invert(1) grayscale(100%) brightness(200%);
    }
  `]
})
export class ExportUserComponent implements OnInit {
  showModal = false;
  isLoading = false;
  loadingMessage = '';
  errorMessage = '';
  
  userStats: UserStats | null = null;
  csvPreview: CsvPreview | null = null;
  
  exportOptions: ExportOptions = {
    role: undefined,
    activeOnly: false
  };

  constructor(private exportUserService: ExportUserService) {}

  ngOnInit(): void {
    // Component có thể được init mà không cần load data ngay
  }

  /**
   * Mở modal export và load thống kê users
   */
  async openExportModal(): Promise<void> {
    this.showModal = true;
    this.errorMessage = '';
    this.csvPreview = null;
    
    // Reset export options
    this.exportOptions = {
      role: undefined,
      activeOnly: false
    };

    await this.loadUserStats();
  }

  /**
   * Đóng modal export
   */
  closeModal(): void {
    this.showModal = false;
    this.csvPreview = null;
    this.errorMessage = '';
  }

  /**
   * Load thống kê users từ backend
   */
  async loadUserStats(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Đang tải thống kê users...';
      
      this.exportUserService.getUsersStats().subscribe({
        next: (stats) => {
          this.userStats = stats;
        },
        error: (error) => {
          console.error('Error loading user stats:', error);
          this.errorMessage = 'Không thể tải thống kê users. Vui lòng thử lại.';
        },
        complete: () => {
          this.isLoading = false;
          this.loadingMessage = '';
        }
      });
      
    } catch (error) {
      console.error('Error loading user stats:', error);
      this.errorMessage = 'Không thể tải thống kê users. Vui lòng thử lại.';
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Load preview CSV content
   */
  async loadPreview(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Đang tạo preview CSV...';
      this.errorMessage = '';
      
      this.exportUserService.previewCsvExport(this.exportOptions).subscribe({
        next: (preview) => {
          this.csvPreview = preview;
        },
        error: (error) => {
          console.error('Error loading CSV preview:', error);
          this.errorMessage = 'Không thể tạo preview CSV. Vui lòng thử lại.';
        },
        complete: () => {
          this.isLoading = false;
          this.loadingMessage = '';
        }
      });
      
    } catch (error) {
      console.error('Error loading CSV preview:', error);
      this.errorMessage = 'Không thể tạo preview CSV. Vui lòng thử lại.';
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  /**
   * Export users ra CSV và download file
   */
  async exportToCsv(): Promise<void> {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Đang tạo và tải xuống file CSV...';
      this.errorMessage = '';
      
      await this.exportUserService.exportUsersToCSV(this.exportOptions);
      
      // Thành công - đóng modal sau 1 giây
      this.loadingMessage = 'Tải xuống thành công!';
      setTimeout(() => {
        this.closeModal();
      }, 1000);
      
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Không thể xuất file CSV. Vui lòng thử lại.';
    } finally {
      setTimeout(() => {
        this.isLoading = false;
        this.loadingMessage = '';
      }, 1000);
    }
  }

  /**
   * Lấy danh sách tất cả UserRoles
   * @returns Array of UserRole
   */
  getUserRoles(): UserRole[] {
    return Object.values(UserRole);
  }

  /**
   * Convert UserRole thành tên hiển thị tiếng Việt
   * @param role - UserRole enum
   * @returns Display name
   */
  getRoleDisplayName(role: UserRole): string {
    return this.exportUserService.getRoleDisplayNameVietnamese(role);
  }
}
