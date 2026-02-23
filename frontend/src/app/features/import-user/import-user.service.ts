/**
 * File: features/import-user/import-user.service.ts
 * Mục đích: Gọi API import người dùng (upload file) và theo dõi trạng thái xử lý.
 */
/**
 * Import User Service - Service xử lý import users từ CSV ở frontend
 * 
 * Chức năng:
 * - Upload CSV file lên backend
 * - Lấy kết quả import với statistics
 * - Download CSV template
 * - Validate CSV file trước khi import
 * - Lấy hướng dẫn import
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Interface cho kết quả import
export interface ImportResult {
  total: number;
  success: number;
  updated: number;
  failed: number;
  errors: ImportError[];
  message?: string;
}

// Interface cho lỗi import
export interface ImportError {
  row: number;
  data: any;
  error: string;
}

// Interface cho validation result
export interface ValidationResult {
  valid: boolean;
  fileName: string;
  fileSize?: number;
  totalRows?: number;
  encoding?: string;
  error?: string;
  message: string;
}

// Interface cho hướng dẫn import
export interface ImportInstructions {
  title: string;
  requiredColumns: ColumnInfo[];
  optionalColumns: ColumnInfo[];
  importRules: string[];
  tips: string[];
}

interface ColumnInfo {
  name: string;
  description: string;
  example: string;
  validValues?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class ImportUserService {
  private apiUrl = `${environment.apiUrl}/import-users`;

  constructor(private http: HttpClient) {}

  /**
   * Upload và import users từ CSV file
   * @param file - CSV file để upload
   * @returns Observable<ImportResult>
   */
  importUsersFromCSV(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ImportResult>(`${this.apiUrl}/csv`, formData);
  }

  /**
   * Validate CSV file mà không import
   * @param file - CSV file để validate
   * @returns Observable<ValidationResult>
   */
  validateCSVFile(file: File): Observable<ValidationResult> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<ValidationResult>(`${this.apiUrl}/validate`, formData);
  }

  /**
   * Lấy hướng dẫn import CSV
   * @returns Observable<ImportInstructions>
   */
  getImportInstructions(): Observable<ImportInstructions> {
    return this.http.get<ImportInstructions>(`${this.apiUrl}/instructions`);
  }

  /**
   * Download CSV template
   * @returns Promise<void>
   */
  async downloadCSVTemplate(): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/template`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const csvContent = await response.text();
      const filename = `user_import_template_${this.getCurrentDateString()}.csv`;
      
      this.downloadFile(csvContent, filename, 'text/csv');
      
    } catch (error) {
      console.error('Error downloading CSV template:', error);
      throw new Error('Không thể tải template CSV. Vui lòng thử lại.');
    }
  }

  /**
   * Download file content
   * @param content - File content
   * @param filename - Filename
   * @param mimeType - MIME type
   */
  private downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    window.URL.revokeObjectURL(url);
  }

  /**
   * Validate file format
   * @param file - File to validate
   * @returns Boolean
   */
  isValidCSVFile(file: File): boolean {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/csv'
    ];
    
    return validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
  }
    
  /**
   * Format file size cho display
   * @param bytes - File size in bytes
   * @returns Formatted size string
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Lấy current date string
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
}
