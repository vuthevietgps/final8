/**
 * File: import-user.service.ts
 * Mục đích: Nghiệp vụ nhập dữ liệu người dùng (phân tích file, validate, lưu DB).
 */
/**
 * Import User Service - Service xử lý logic nhập dữ liệu User từ CSV
 * 
 * Chức năng:
 * - Parse CSV file thành User objects
 * - Validate dữ liệu từng row
 * - Insert hoặc update users vào database
 * - Ghi đè users nếu trùng email
 * - Trả về kết quả import với statistics
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/user.schema';
import { UserRole } from '../user/user.enum';
import { CreateUserDto } from '../user/dto/create-user.dto';

// Interface cho kết quả import
export interface ImportResult {
  total: number;           // Tổng số rows đã xử lý
  success: number;         // Số users import thành công
  updated: number;         // Số users đã được cập nhật (ghi đè)
  failed: number;          // Số rows import thất bại
  errors: ImportError[];   // Chi tiết lỗi từng row
}

// Interface cho lỗi import từng row
export interface ImportError {
  row: number;             // Số thứ tự row (1-based)
  data: any;               // Data gốc của row
  error: string;           // Mô tả lỗi
}

// Interface cho parsed CSV row
interface ParsedUserRow {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  address?: string;
  isActive?: boolean;
  departmentId?: string;
  managerId?: string;
  notes?: string;
  googleDriveLink?: string;
}

@Injectable()
export class ImportUserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Import users từ CSV content
   * @param csvContent - String content của CSV file
   * @returns ImportResult với thống kê import
   */
  async importUsersFromCSV(csvContent: string): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      success: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    try {
      // Parse CSV content thành rows
      const rows = this.parseCSVContent(csvContent);
      result.total = rows.length;

      // Xử lý từng row
      for (let i = 0; i < rows.length; i++) {
        const rowNumber = i + 2; // +2 vì bỏ header và index bắt đầu từ 0
        const row = rows[i];

        try {
          // Validate và convert row thành User object
          const userData = this.validateAndConvertRow(row, rowNumber);
          
          // Kiểm tra user đã tồn tại chưa (theo email)
          const existingUser = await this.userModel.findOne({ email: userData.email }).exec();
          
          if (existingUser) {
            // Update existing user (ghi đè)
            await this.userModel.updateOne(
              { email: userData.email },
              { $set: userData }
            ).exec();
            result.updated++;
          } else {
            // Tạo user mới
            const newUser = new this.userModel(userData);
            await newUser.save();
            result.success++;
          }

        } catch (error) {
          // Ghi lại lỗi cho row này
          result.failed++;
          result.errors.push({
            row: rowNumber,
            data: row,
            error: error.message || 'Unknown error'
          });
        }
      }

    } catch (error) {
      throw new BadRequestException(`Lỗi khi xử lý file CSV: ${error.message}`);
    }

    return result;
  }

  /**
   * Parse CSV content thành array of objects
   * @param csvContent - Raw CSV string
   * @returns Array of parsed row objects
   */
  private parseCSVContent(csvContent: string): ParsedUserRow[] {
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('File CSV phải có ít nhất 1 dòng header và 1 dòng dữ liệu');
    }

    // Parse header để lấy column mapping
    const headers = this.parseCSVRow(lines[0]);
    const headerMap = this.createHeaderMap(headers);

    // Parse data rows
    const dataRows: ParsedUserRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVRow(lines[i]);
      
      if (values.length === 0 || values.every(v => !v.trim())) {
        continue; // Skip empty rows
      }

      const rowData = this.mapRowToUser(values, headerMap);
      dataRows.push(rowData);
    }

    return dataRows;
  }

  /**
   * Parse một dòng CSV thành array values
   * @param line - CSV line string
   * @returns Array of values
   */
  private parseCSVRow(line: string): string[] {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          currentValue += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // End of value
        values.push(currentValue.trim());
        currentValue = '';
        i++;
      } else {
        currentValue += char;
        i++;
      }
    }

    // Add last value
    values.push(currentValue.trim());
    
    return values;
  }

  /**
   * Tạo mapping từ header names đến column indices
   * @param headers - Array of header names
   * @returns Object mapping header names to indices
   */
  private createHeaderMap(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    
    // Mapping các header names có thể có (support cả tiếng Việt và tiếng Anh)
    const headerMappings = {
      fullName: ['fullname', 'full_name', 'họ và tên', 'tên', 'name', 'fullName'],
      email: ['email', 'e-mail', 'email address'],
      password: ['password', 'mật khẩu', 'pass'],
      phone: ['phone', 'số điện thoại', 'điện thoại', 'sdt', 'phone number'],
      role: ['role', 'vai trò', 'chức vụ', 'position'],
      address: ['address', 'địa chỉ', 'addr'],
      isActive: ['isactive', 'is_active', 'trạng thái', 'active', 'status'],
      departmentId: ['departmentid', 'department_id', 'phòng ban', 'department'],
      managerId: ['managerid', 'manager_id', 'quản lý', 'manager'],
  notes: ['notes', 'ghi chú', 'note', 'remark'],
  googleDriveLink: ['google drive link', 'drive', 'googleDriveLink', 'link drive', 'link google drive']
    };

    // Tìm index cho từng field
    Object.keys(headerMappings).forEach(field => {
      const possibleNames = headerMappings[field];
      const index = headers.findIndex(header => 
        possibleNames.some(name => 
          header.toLowerCase().replace(/\s+/g, '').includes(name.toLowerCase().replace(/\s+/g, ''))
        )
      );
      if (index !== -1) {
        map[field] = index;
      }
    });

    // Validate required fields
    const requiredFields = ['fullName', 'email', 'password', 'phone', 'role'];
    const missingFields = requiredFields.filter(field => map[field] === undefined);
    
    if (missingFields.length > 0) {
      throw new Error(`Không tìm thấy các cột bắt buộc: ${missingFields.join(', ')}`);
    }

    return map;
  }

  /**
   * Map array values thành User object theo header mapping
   * @param values - Array of row values
   * @param headerMap - Header mapping object
   * @returns ParsedUserRow object
   */
  private mapRowToUser(values: string[], headerMap: Record<string, number>): ParsedUserRow {
    const getValue = (field: string): string => {
      const index = headerMap[field];
      return index !== undefined ? values[index]?.trim() || '' : '';
    };

    return {
      fullName: getValue('fullName'),
      email: getValue('email'),
      password: getValue('password'),
      phone: getValue('phone'),
      role: getValue('role'),
      address: getValue('address') || undefined,
      isActive: this.parseBoolean(getValue('isActive')),
      departmentId: getValue('departmentId') || undefined,
      managerId: getValue('managerId') || undefined,
  notes: getValue('notes') || undefined,
  googleDriveLink: getValue('googleDriveLink') || undefined,
    };
  }

  /**
   * Validate và convert parsed row thành CreateUserDto
   * @param row - ParsedUserRow object
   * @param rowNumber - Row number cho error reporting
   * @returns CreateUserDto object
   */
  private validateAndConvertRow(row: ParsedUserRow, rowNumber: number): CreateUserDto {
    const errors: string[] = [];

    // Validate required fields
    if (!row.fullName) errors.push('Họ tên không được để trống');
    if (!row.email) errors.push('Email không được để trống');
    if (!row.password) errors.push('Mật khẩu không được để trống');
    if (!row.phone) errors.push('Số điện thoại không được để trống');
    if (!row.role) errors.push('Vai trò không được để trống');

    // Validate email format
    if (row.email && !this.isValidEmail(row.email)) {
      errors.push('Email không đúng định dạng');
    }

    // Validate role
    if (row.role && !this.isValidRole(row.role)) {
      errors.push(`Vai trò "${row.role}" không hợp lệ. Các vai trò hợp lệ: ${Object.values(UserRole).join(', ')}`);
    }

    if (errors.length > 0) {
      throw new Error(`Dòng ${rowNumber}: ${errors.join(', ')}`);
    }

    return {
      fullName: row.fullName,
      email: row.email,
      password: row.password,
      phone: row.phone,
      role: this.convertToUserRole(row.role),
      address: row.address,
      isActive: row.isActive !== undefined ? row.isActive : true,
      departmentId: row.departmentId,
      managerId: row.managerId,
  notes: row.notes,
  googleDriveLink: row.googleDriveLink,
    };
  }

  /**
   * Validate email format
   * @param email - Email string
   * @returns Boolean
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate role value
   * @param role - Role string
   * @returns Boolean
   */
  private isValidRole(role: string): boolean {
    const validRoles = [
      ...Object.values(UserRole),
      'giám đốc', 'quản lý', 'nhân viên', 'đại lý nội bộ', 'đại lý bên ngoài',
      'nhà cung cấp nội bộ', 'nhà cung cấp bên ngoài'
    ];
    
    return validRoles.some(validRole => 
      validRole.toLowerCase() === role.toLowerCase()
    );
  }

  /**
   * Convert role string thành UserRole enum
   * @param role - Role string
   * @returns UserRole enum
   */
  private convertToUserRole(role: string): UserRole {
    const roleMap: Record<string, UserRole> = {
      'director': UserRole.DIRECTOR,
      'giám đốc': UserRole.DIRECTOR,
      'manager': UserRole.MANAGER,
      'quản lý': UserRole.MANAGER,
      'employee': UserRole.EMPLOYEE,
      'nhân viên': UserRole.EMPLOYEE,
      'internal_agent': UserRole.INTERNAL_AGENT,
      'đại lý nội bộ': UserRole.INTERNAL_AGENT,
      'external_agent': UserRole.EXTERNAL_AGENT,
      'đại lý bên ngoài': UserRole.EXTERNAL_AGENT,
      'internal_supplier': UserRole.INTERNAL_SUPPLIER,
      'nhà cung cấp nội bộ': UserRole.INTERNAL_SUPPLIER,
      'external_supplier': UserRole.EXTERNAL_SUPPLIER,
      'nhà cung cấp bên ngoài': UserRole.EXTERNAL_SUPPLIER,
    };

    const normalizedRole = role.toLowerCase();
    return roleMap[normalizedRole] || role as UserRole;
  }

  /**
   * Parse boolean value từ string
   * @param value - String value
   * @returns Boolean hoặc undefined
   */
  private parseBoolean(value: string): boolean | undefined {
    if (!value) return undefined;
    
    const truthy = ['true', '1', 'yes', 'y', 'có', 'hoạt động', 'active'];
    const falsy = ['false', '0', 'no', 'n', 'không', 'không hoạt động', 'inactive'];
    
    const normalized = value.toLowerCase().trim();
    
    if (truthy.includes(normalized)) return true;
    if (falsy.includes(normalized)) return false;
    
    return undefined;
  }

  /**
   * Validate CSV template và trả về sample data
   * @returns Sample CSV content
   */
  getCSVTemplate(): string {
    const headers = [
      'Họ và Tên',
      'Email',
      'Mật khẩu',
      'Số Điện Thoại',
      'Vai Trò',
      'Địa Chỉ',
      'Trạng Thái',
      'Phòng Ban ID',
      'Manager ID',
  'Ghi Chú',
  'Google Drive Link'
    ];

    const sampleData = [
      'Nguyễn Văn A,nguyenvana@example.com,password123,0123456789,manager,"123 Đường ABC, Quận 1",hoạt động,DEPT001,MGR001,Ghi chú mẫu,https://drive.google.com/drive/folders/abc123'
    ];

    return '\uFEFF' + headers.join(',') + '\n' + sampleData.join('\n');
  }
}
