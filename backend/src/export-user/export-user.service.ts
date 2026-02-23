/**
 * File: export-user.service.ts
 * Mục đích: Triển khai logic xuất dữ liệu người dùng (đọc DB, chuyển đổi, ghi file).
 */
/**
 * Export User Service - Service xử lý logic xuất dữ liệu User ra CSV
 * 
 * Chức năng:
 * - Query tất cả users từ database
 * - Convert data thành format CSV
 * - Tạo CSV content với encoding UTF-8 BOM
 * - Support filter theo role, trạng thái active
 * - Format date theo chuẩn Việt Nam
 */

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../user/user.schema';
import { UserRole } from '../user/user.enum';

@Injectable()
export class ExportUserService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Xuất tất cả users ra CSV
   * @returns CSV content as string với UTF-8 BOM
   */
  async exportAllUsersToCSV(): Promise<string> {
    // Lấy tất cả users từ database, sắp xếp theo tên
    const users = await this.userModel.find().sort({ fullName: 1 }).exec();
    
    return this.convertUsersToCSV(users);
  }

  /**
   * Xuất users theo role ra CSV
   * @param role - UserRole cần filter
   * @returns CSV content as string
   */
  async exportUsersByRoleToCSV(role: UserRole): Promise<string> {
    const users = await this.userModel
      .find({ role })
      .sort({ fullName: 1 })
      .exec();
    
    return this.convertUsersToCSV(users);
  }

  /**
   * Xuất chỉ users đang hoạt động ra CSV
   * @returns CSV content as string
   */
  async exportActiveUsersToCSV(): Promise<string> {
    const users = await this.userModel
      .find({ isActive: true })
      .sort({ fullName: 1 })
      .exec();
    
    return this.convertUsersToCSV(users);
  }

  /**
   * Convert mảng users thành CSV string
   * @param users - Mảng user documents
   * @returns CSV content với header và data
   */
  private convertUsersToCSV(users: UserDocument[]): string {
    // Định nghĩa header columns cho CSV
    const headers = [
      'STT',
      'Họ và Tên',
      'Email', 
      'Số Điện Thoại',
      'Vai Trò',
      'Địa Chỉ',
      'Trạng Thái',
      'Phòng Ban ID',
      'Manager ID',
      'Ghi Chú',
  'Google Drive Link',
      'Ngày Tạo',
      'Ngày Cập Nhật'
    ];

    // Tạo CSV content bắt đầu với UTF-8 BOM và header
    let csvContent = '\uFEFF'; // UTF-8 BOM để Excel hiển thị tiếng Việt đúng
    csvContent += headers.join(',') + '\n';

    // Convert từng user thành CSV row
    users.forEach((user, index) => {
      const row = [
        index + 1, // STT
        this.escapeCsvValue(user.fullName),
        this.escapeCsvValue(user.email),
        this.escapeCsvValue(user.phone || ''),
        this.escapeCsvValue(this.getRoleDisplayName(user.role)),
        this.escapeCsvValue(user.address || ''),
        user.isActive ? 'Hoạt động' : 'Không hoạt động',
        this.escapeCsvValue(user.departmentId || ''),
        this.escapeCsvValue(user.managerId || ''),
        this.escapeCsvValue(user.notes || ''),
  this.escapeCsvValue((user as any).googleDriveLink || ''),
        this.formatDate(user.createdAt),
        this.formatDate(user.updatedAt)
      ];
      
      csvContent += row.join(',') + '\n';
    });

    return csvContent;
  }

  /**
   * Escape CSV values để tránh lỗi khi có dấu phay, xuống dòng
   * @param value - Giá trị cần escape
   * @returns Giá trị đã được escape cho CSV
   */
  private escapeCsvValue(value: string): string {
    if (!value) return '';
    
    // Nếu có dấu phẩy, dấu ngoặc kép, hoặc xuống dòng thì wrap bằng dấu ngoặc kép
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      // Escape dấu ngoặc kép bằng cách double nó
      return '"' + value.replace(/"/g, '""') + '"';
    }
    
    return value;
  }

  /**
   * Convert UserRole enum thành tên hiển thị tiếng Việt
   * @param role - UserRole enum value
   * @returns Tên vai trò bằng tiếng Việt
   */
  private getRoleDisplayName(role: UserRole): string {
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

  /**
   * Format date thành string theo định dạng DD/MM/YYYY HH:mm:ss
   * @param date - Date object hoặc undefined
   * @returns Formatted date string
   */
  private formatDate(date: Date | undefined): string {
    if (!date) return '';
    
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Lấy tổng số users trong hệ thống (để hiển thị thống kê)
   * @returns Số lượng users
   */
  async getTotalUsersCount(): Promise<number> {
    return await this.userModel.countDocuments().exec();
  }

  /**
   * Lấy số users theo từng role (để hiển thị thống kê)
   * @returns Object chứa số lượng users theo từng role
   */
  async getUsersCountByRole(): Promise<Record<UserRole, number>> {
    const pipeline = [
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ];
    
    const result = await this.userModel.aggregate(pipeline).exec();
    
    // Initialize với 0 cho tất cả roles
    const countByRole = Object.values(UserRole).reduce((acc, role) => {
      acc[role] = 0;
      return acc;
    }, {} as Record<UserRole, number>);
    
    // Fill actual counts
    result.forEach(item => {
      countByRole[item._id] = item.count;
    });
    
    return countByRole;
  }
}
