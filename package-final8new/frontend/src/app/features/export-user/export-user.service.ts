/**
 * File: features/export-user/export-user.service.ts
 * Mục đích: Gọi API export người dùng và xử lý dữ liệu trả về (tải file).
 */
/**
 * Export User Service - Service xử lý export users ra CSV ở frontend
 * 
 * Chức năng:
 * - Gọi API backend để lấy CSV data
 * - Download file CSV về máy user
 * - Lấy thống kê users để hiển thị
 * - Preview CSV content trước khi export
 */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserRole } from '../user/user.model';
import { environment } from '../../../environments/environment';

// Interface cho response thống kê
export interface UserStats {
  total: number;
  byRole: Record<UserRole, number>;
  exportDate: string;
}

// Interface cho preview CSV
export interface CsvPreview {
  header: string[];
  preview: string[][];
  totalRows: number;
  previewRows: number;
  filters: {
    role: string | null;
    activeOnly: boolean;
  };
}

// Interface cho export options
export interface ExportOptions {
  role?: UserRole;
  activeOnly?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExportUserService {
  private apiUrl = `${environment.apiUrl}/export-users`;

  constructor(private http: HttpClient) {}

  /**
   * Lấy thống kê users để hiển thị trước khi export
   * @returns Observable<UserStats>
   */
  getUsersStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.apiUrl}/stats`);
  }

  /**
   * Preview CSV content để user xem trước
   * @param options - Export options (role, activeOnly)
   * @returns Observable<CsvPreview>
   */
  previewCsvExport(options: ExportOptions = {}): Observable<CsvPreview> {
    let params = new HttpParams();
    
    if (options.role) {
      params = params.set('role', options.role);
    }
    
    if (options.activeOnly) {
      params = params.set('activeOnly', 'true');
    }

    return this.http.get<CsvPreview>(`${this.apiUrl}/preview`, { params });
  }

  /**
   * Export users ra file CSV và tự động download
   * @param options - Export options (role, activeOnly)
   * @returns Promise<void>
   */
  async exportUsersToCSV(options: ExportOptions = {}): Promise<void> {
    try {
      // Tạo URL với query parameters
      let url = `${this.apiUrl}/csv`;
      const queryParams: string[] = [];
      
      if (options.role) {
        queryParams.push(`role=${encodeURIComponent(options.role)}`);
      }
      
      if (options.activeOnly) {
        queryParams.push('activeOnly=true');
      }
      
      if (queryParams.length > 0) {
        url += '?' + queryParams.join('&');
      }

      // Fetch CSV data từ backend
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Lấy CSV content
      const csvContent = await response.text();
      
      // Tạo filename dựa trên options
      const filename = this.generateFilename(options);
      
      // Download file
      this.downloadCsvFile(csvContent, filename);
      
    } catch (error) {
      console.error('Error exporting users to CSV:', error);
      throw new Error('Không thể xuất file CSV. Vui lòng thử lại.');
    }
  }

  /**
   * Download CSV content thành file
   * @param csvContent - CSV string content
   * @param filename - Tên file để download
   */
  private downloadCsvFile(csvContent: string, filename: string): void {
    // Tạo Blob với UTF-8 BOM để Excel hiển thị tiếng Việt đúng
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Tạo URL để download
    const url = window.URL.createObjectURL(blob);
    
    // Tạo thẻ a ẩn để trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // Thêm vào DOM, click và remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup URL
    window.URL.revokeObjectURL(url);
  }

  /**
   * Generate filename dựa trên export options
   * @param options - Export options
   * @returns Filename string
   */
  private generateFilename(options: ExportOptions): string {
    const timestamp = this.getCurrentDateString();
    
    if (options.role) {
      const roleDisplayName = this.getRoleDisplayName(options.role);
      return `users_${roleDisplayName}_${timestamp}.csv`;
    } else if (options.activeOnly) {
      return `users_active_${timestamp}.csv`;
    } else {
      return `users_all_${timestamp}.csv`;
    }
  }

  /**
   * Convert UserRole thành tên file-friendly
   * @param role - UserRole enum
   * @returns Display name cho filename
   */
  private getRoleDisplayName(role: UserRole): string {
    const roleNames = {
      [UserRole.DIRECTOR]: 'Giam_Doc',
      [UserRole.MANAGER]: 'Quan_Ly', 
      [UserRole.EMPLOYEE]: 'Nhan_Vien',
      [UserRole.INTERNAL_AGENT]: 'Dai_Ly_Noi_Bo',
      [UserRole.EXTERNAL_AGENT]: 'Dai_Ly_Ben_Ngoai',
      [UserRole.INTERNAL_SUPPLIER]: 'Nha_Cung_Cap_Noi_Bo',
      [UserRole.EXTERNAL_SUPPLIER]: 'Nha_Cung_Cap_Ben_Ngoai'
    };
    
    return roleNames[role] || role;
  }

  /**
   * Lấy current date string cho filename
   * @returns Date string format YYYYMMDD_HHMMSS
   */
  private getCurrentDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /**
   * Convert UserRole thành tên hiển thị tiếng Việt
   * @param role - UserRole enum
   * @returns Tên vai trò bằng tiếng Việt
   */
  getRoleDisplayNameVietnamese(role: UserRole): string {
    const roleNames = {
      [UserRole.DIRECTOR]: 'Giám Đốc',
      [UserRole.MANAGER]: 'Quản Lý',
      [UserRole.EMPLOYEE]: 'Nhân Viên',
      [UserRole.INTERNAL_AGENT]: 'Đại Lý Nội Bộ',
      [UserRole.EXTERNAL_AGENT]: 'Đại Lý Bên Ngoài',
      [UserRole.INTERNAL_SUPPLIER]: 'Nhà Cung Cấp Nội Bộ',
      [UserRole.EXTERNAL_SUPPLIER]: 'Nhà Cung Cấp Bên Ngoài'
    };
    
    return roleNames[role] || role;
  }
}
