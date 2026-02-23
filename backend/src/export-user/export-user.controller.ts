/**
 * File: export-user.controller.ts
 * Mục đích: REST API để yêu cầu xuất dữ liệu người dùng.
 */
/**
 * Export User Controller - API endpoints để xuất dữ liệu Users ra CSV
 * 
 * Chức năng:
 * - Định nghĩa các REST API endpoints cho export
 * - Trả về CSV file với proper headers
 * - Support các loại export: all, by role, active only
 * - Set correct content-type và filename cho download
 */

import { Controller, Get, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ExportUserService } from './export-user.service';
import { UserRole } from '../user/user.enum';

@Controller('export-users') // Base route: /export-users
export class ExportUserController {
  constructor(private readonly exportUserService: ExportUserService) {}

  /**
   * GET /export-users/csv - Xuất tất cả users ra CSV
   * @param res - Express Response object
   * @param role - Query param để filter theo role (optional)
   * @param activeOnly - Query param để chỉ lấy users active (optional)
   */
  @Get('csv')
  async exportUsersToCSV(
    @Res() res: Response,
    @Query('role') role?: string,
    @Query('activeOnly') activeOnly?: string
  ) {
    try {
      let csvContent: string;
      let filename: string;

      // Xử lý export theo điều kiện
      if (role && Object.values(UserRole).includes(role as UserRole)) {
        // Export theo role cụ thể
        csvContent = await this.exportUserService.exportUsersByRoleToCSV(role as UserRole);
        const roleDisplayName = this.getRoleDisplayName(role as UserRole);
        filename = `users_${roleDisplayName.replace(/\s+/g, '_')}_${this.getCurrentDateString()}.csv`;
      } else if (activeOnly === 'true') {
        // Export chỉ users đang hoạt động
        csvContent = await this.exportUserService.exportActiveUsersToCSV();
        filename = `users_active_${this.getCurrentDateString()}.csv`;
      } else {
        // Export tất cả users
        csvContent = await this.exportUserService.exportAllUsersToCSV();
        filename = `users_all_${this.getCurrentDateString()}.csv`;
      }

      // Set headers để browser download file CSV
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');

      // Trả về CSV content
      res.status(HttpStatus.OK).send(csvContent);

    } catch (error) {
      console.error('Error exporting users to CSV:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Lỗi khi xuất file CSV',
        error: error.message
      });
    }
  }

  /**
   * GET /export-users/stats - Lấy thống kê users để hiển thị trước khi export
   * @returns Object chứa thống kê số lượng users
   */
  @Get('stats')
  async getUsersStats() {
    try {
      const totalUsers = await this.exportUserService.getTotalUsersCount();
      const countByRole = await this.exportUserService.getUsersCountByRole();

      return {
        total: totalUsers,
        byRole: countByRole,
        exportDate: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting users stats:', error);
      throw error;
    }
  }

  /**
   * GET /export-users/preview - Preview CSV content (first 10 rows) để user xem trước
   * @param role - Query param để filter theo role (optional) 
   * @param activeOnly - Query param để chỉ lấy users active (optional)
   * @returns Object chứa preview data và metadata
   */
  @Get('preview')
  async previewCsvExport(
    @Query('role') role?: string,
    @Query('activeOnly') activeOnly?: string
  ) {
    try {
      let csvContent: string;

      // Generate CSV content theo điều kiện
      if (role && Object.values(UserRole).includes(role as UserRole)) {
        csvContent = await this.exportUserService.exportUsersByRoleToCSV(role as UserRole);
      } else if (activeOnly === 'true') {
        csvContent = await this.exportUserService.exportActiveUsersToCSV();
      } else {
        csvContent = await this.exportUserService.exportAllUsersToCSV();
      }

      // Split CSV thành lines và lấy preview
      const lines = csvContent.split('\n');
      const header = lines[0];
      const previewLines = lines.slice(1, 11); // Lấy 10 dòng đầu (không tính header)
      const totalRows = lines.length - 2; // Trừ header và dòng cuối rỗng

      return {
        header: header.split(','),
        preview: previewLines.filter(line => line.trim()).map(line => line.split(',')),
        totalRows: totalRows,
        previewRows: previewLines.filter(line => line.trim()).length,
        filters: {
          role: role || null,
          activeOnly: activeOnly === 'true'
        }
      };

    } catch (error) {
      console.error('Error previewing CSV export:', error);
      throw error;
    }
  }

  /**
   * Convert UserRole thành tên hiển thị (helper method)
   * @param role - UserRole enum
   * @returns Display name
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
   * Lấy current date string để đặt tên file
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
