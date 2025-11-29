/**
 * File: order-update/order-update.controller.ts
 * Mục đích: REST Controller cho chức năng cập nhật thông tin đơn hàng từ file Excel
 */
import { 
  Controller, 
  Post, 
  UploadedFile, 
  UseInterceptors,
  BadRequestException,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrderUpdateService } from './order-update.service';
import { ProcessResult } from './dto/update-order-from-excel.dto';

@Controller('order-update')
export class OrderUpdateController {
  constructor(private readonly orderUpdateService: OrderUpdateService) {}

  /**
   * API cập nhật thông tin đơn hàng từ file Excel VTP
   * POST /order-update/excel
   */
  @Post('excel')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async updateOrdersFromExcel(
    @UploadedFile() file: Express.Multer.File
  ): Promise<ProcessResult> {
    // Validation file
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file Excel để tải lên');
    }

    // Kiểm tra định dạng file
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException('Chỉ chấp nhận file Excel (.xlsx hoặc .xls)');
    }

    // Kiểm tra kích thước file (10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File không được vượt quá 10MB');
    }

    try {
      const result = await this.orderUpdateService.processExcelFile(file);
      return result;
    } catch (error) {
      throw new BadRequestException(
        `Lỗi xử lý file Excel: ${error.message}`
      );
    }
  }

  /**
   * API kiểm tra trạng thái đơn hàng có thể cập nhật
   * POST /order-update/check-status
   */
  @Post('check-status')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async checkUpdateableOrders(
    @UploadedFile() file: Express.Multer.File
  ): Promise<{
    updatable: number;
    completed: number;
    notFound: number;
    total: number;
  }> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file Excel để kiểm tra');
    }

    try {
      return await this.orderUpdateService.checkUpdateableStatus(file);
    } catch (error) {
      throw new BadRequestException(
        `Lỗi kiểm tra trạng thái: ${error.message}`
      );
    }
  }

  /**
   * API preview dữ liệu Excel (không cập nhật database)
   * POST /order-update/preview
   */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async previewExcelData(
    @UploadedFile() file: Express.Multer.File
  ): Promise<{
    sampleData: any[];
    totalRows: number;
    mappingInfo: any;
  }> {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file Excel để preview');
    }

    try {
      return await this.orderUpdateService.previewExcelData(file);
    } catch (error) {
      throw new BadRequestException(
        `Lỗi preview Excel: ${error.message}`
      );
    }
  }
}