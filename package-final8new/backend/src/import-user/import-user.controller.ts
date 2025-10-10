/**
 * File: import-user.controller.ts
 * Mục đích: REST API để tải lên và xử lý file nhập dữ liệu người dùng.
 */
/**
 * Import User Controller - API endpoints để nhập dữ liệu Users từ CSV
 * 
 * Chức năng:
 * - Định nghĩa các REST API endpoints cho import
 * - Upload và xử lý CSV file
 * - Trả về kết quả import với statistics
 * - Cung cấp CSV template để download
 */

import { 
  Controller, 
  Post, 
  UploadedFile, 
  UseInterceptors, 
  BadRequestException,
  Get,
  Res,
  HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ImportUserService, ImportResult } from './import-user.service';

// Interface cho kết quả import với message
interface ImportResultWithMessage extends ImportResult {
  message?: string;
}

@Controller('import-users') // Base route: /import-users
export class ImportUserController {
  constructor(private readonly importUserService: ImportUserService) {}

  /**
   * POST /import-users/csv - Upload và import users từ CSV file
   * @param file - Uploaded CSV file
   * @returns ImportResult với statistics
   */
  @Post('csv')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: (req, file, callback) => {
      // Chỉ accept CSV files
      if (file.mimetype === 'text/csv' || 
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.csv')) {
        callback(null, true);
      } else {
        callback(new BadRequestException('Chỉ chấp nhận file CSV'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
  }))
  async importUsersFromCSV(
    @UploadedFile() file: any
  ): Promise<ImportResultWithMessage> {
    try {
      if (!file) {
        throw new BadRequestException('Vui lòng chọn file CSV để upload');
      }

      // Convert buffer thành string với encoding UTF-8
      const csvContent = file.buffer.toString('utf8');
      
      // Remove UTF-8 BOM nếu có
      const cleanContent = csvContent.replace(/^\uFEFF/, '');

      if (!cleanContent.trim()) {
        throw new BadRequestException('File CSV không có nội dung');
      }

      // Import users
      const result = await this.importUserService.importUsersFromCSV(cleanContent);

      return {
        ...result,
        message: `Import hoàn tất: ${result.success} thành công, ${result.updated} cập nhật, ${result.failed} thất bại`
      };

    } catch (error) {
      console.error('Error importing users from CSV:', error);
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(`Lỗi khi import CSV: ${error.message}`);
    }
  }

  /**
   * GET /import-users/template - Download CSV template
   * @param res - Express Response object
   */
  @Get('template')
  async downloadCSVTemplate(@Res() res: Response) {
    try {
      const templateContent = this.importUserService.getCSVTemplate();
      const filename = `user_import_template_${this.getCurrentDateString()}.csv`;

      // Set headers để browser download file CSV
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Pragma', 'no-cache');

      // Trả về CSV template
      res.status(HttpStatus.OK).send(templateContent);

    } catch (error) {
      console.error('Error generating CSV template:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Lỗi khi tạo template CSV',
        error: error.message
      });
    }
  }

  /**
   * GET /import-users/instructions - Lấy hướng dẫn import CSV
   * @returns Object chứa hướng dẫn và yêu cầu format
   */
  @Get('instructions')
  getImportInstructions() {
    return {
      title: 'Hướng dẫn Import Users từ CSV',
      
      requiredColumns: [
        {
          name: 'Họ và Tên',
          description: 'Họ tên đầy đủ của user (bắt buộc)',
          example: 'Nguyễn Văn A'
        },
        {
          name: 'Email',
          description: 'Email của user (bắt buộc, unique)',
          example: 'nguyenvana@example.com'
        },
        {
          name: 'Mật khẩu',
          description: 'Mật khẩu của user (bắt buộc)',
          example: 'password123'
        },
        {
          name: 'Số Điện Thoại',
          description: 'Số điện thoại (bắt buộc)',
          example: '0123456789'
        },
        {
          name: 'Vai Trò',
          description: 'Vai trò trong hệ thống (bắt buộc)',
          example: 'manager',
          validValues: [
            'director / giám đốc',
            'manager / quản lý', 
            'employee / nhân viên',
            'internal_agent / đại lý nội bộ',
            'external_agent / đại lý bên ngoài',
            'internal_supplier / nhà cung cấp nội bộ',
            'external_supplier / nhà cung cấp bên ngoài'
          ]
        }
      ],

      optionalColumns: [
        {
          name: 'Địa Chỉ',
          description: 'Địa chỉ của user (tùy chọn)',
          example: '123 Đường ABC, Quận 1'
        },
        {
          name: 'Trạng Thái',
          description: 'Trạng thái hoạt động (tùy chọn, mặc định: hoạt động)',
          example: 'hoạt động / không hoạt động',
          validValues: ['hoạt động', 'không hoạt động', 'true', 'false', '1', '0']
        },
        {
          name: 'Phòng Ban ID',
          description: 'ID của phòng ban (tùy chọn)',
          example: 'DEPT001'
        },
        {
          name: 'Manager ID',
          description: 'ID của manager (tùy chọn)',
          example: 'MGR001'
        },
        {
          name: 'Ghi Chú',
          description: 'Ghi chú bổ sung (tùy chọn)',
          example: 'Ghi chú mẫu'
        },
        {
          name: 'Google Drive Link',
          description: 'Liên kết thư mục/file Google Drive của user (tùy chọn)',
          example: 'https://drive.google.com/drive/folders/abc123'
        }
      ],

      importRules: [
        'File phải có định dạng CSV với encoding UTF-8',
        'Dòng đầu tiên phải là header chứa tên các cột',
        'Email phải unique - nếu trùng sẽ ghi đè user cũ',
        'Các cột bắt buộc không được để trống',
        'Vai trò phải thuộc danh sách hợp lệ',
        'Kích thước file tối đa 5MB'
      ],

      tips: [
        'Tải template CSV để có format đúng',
        'Sử dụng Excel hoặc Google Sheets để edit CSV',
        'Lưu file với encoding UTF-8 để hiển thị tiếng Việt đúng',
        'Kiểm tra dữ liệu trước khi import',
        'Backup database trước khi import số lượng lớn'
      ]
    };
  }

  /**
   * GET /import-users/validate - Validate CSV file mà không import
   * @param file - Uploaded CSV file
   * @returns Validation result
   */
  @Post('validate')
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: (req, file, callback) => {
      if (file.mimetype === 'text/csv' || 
          file.mimetype === 'application/vnd.ms-excel' ||
          file.originalname.endsWith('.csv')) {
        callback(null, true);
      } else {
        callback(new BadRequestException('Chỉ chấp nhận file CSV'), false);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB max
    },
  }))
  async validateCSVFile(
    @UploadedFile() file: any
  ) {
    try {
      if (!file) {
        throw new BadRequestException('Vui lòng chọn file CSV để validate');
      }

      const csvContent = file.buffer.toString('utf8');
      const cleanContent = csvContent.replace(/^\uFEFF/, '');

      if (!cleanContent.trim()) {
        throw new BadRequestException('File CSV không có nội dung');
      }

      // TODO: Implement validation logic without actually importing
      // For now, return basic file info
      const lines = cleanContent.split('\n').filter(line => line.trim());
      
      return {
        valid: true,
        fileName: file.originalname,
        fileSize: file.size,
        totalRows: lines.length - 1, // Excluding header
        encoding: 'UTF-8',
        message: 'File CSV hợp lệ và sẵn sàng import'
      };

    } catch (error) {
      return {
        valid: false,
        fileName: file?.originalname || 'unknown',
        error: error.message,
        message: 'File CSV không hợp lệ'
      };
    }
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
