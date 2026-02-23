/**
 * File: production-status.controller.ts
 * Mục đích: REST API cho trạng thái sản xuất.
 */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ValidationPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ProductionStatusService } from './production-status.service';
import { CreateProductionStatusDto } from './dto/create-production-status.dto';
import { UpdateProductionStatusDto } from './dto/update-production-status.dto';

/**
 * Controller xử lý các request HTTP cho trạng thái sản xuất
 * Cung cấp các endpoint REST API đầy đủ cho CRUD operations
 */
@Controller('production-status')
export class ProductionStatusController {
  constructor(private readonly productionStatusService: ProductionStatusService) {}

  /**
   * Tạo mới trạng thái sản xuất
   * POST /production-status
   * @param createProductionStatusDto - Dữ liệu trạng thái sản xuất
   * @returns Trạng thái sản xuất vừa được tạo
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(ValidationPipe) createProductionStatusDto: CreateProductionStatusDto) {
    return this.productionStatusService.create(createProductionStatusDto);
  }

  /**
   * Lấy danh sách tất cả trạng thái sản xuất
   * GET /production-status
   * @param isActive - Query parameter để lọc theo trạng thái hoạt động
   * @returns Danh sách trạng thái sản xuất
   */
  @Get()
  findAll(@Query('isActive') isActive?: string) {
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.productionStatusService.findAll(activeFilter);
  }

  /**
   * Lấy thông tin một trạng thái sản xuất theo ID
   * GET /production-status/:id
   * @param id - ID của trạng thái sản xuất
   * @returns Thông tin trạng thái sản xuất
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productionStatusService.findOne(id);
  }

  /**
   * Cập nhật thông tin trạng thái sản xuất
   * PATCH /production-status/:id
   * @param id - ID của trạng thái sản xuất
   * @param updateProductionStatusDto - Dữ liệu cập nhật
   * @returns Trạng thái sản xuất sau khi cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateProductionStatusDto: UpdateProductionStatusDto,
  ) {
    return this.productionStatusService.update(id, updateProductionStatusDto);
  }

  /**
   * Xóa trạng thái sản xuất
   * DELETE /production-status/:id
   * @param id - ID của trạng thái sản xuất cần xóa
   * @returns Thông báo xóa thành công
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.productionStatusService.remove(id);
  }

  /**
   * Cập nhật thứ tự hiển thị cho nhiều trạng thái
   * PATCH /production-status/order/update
   * @param orderUpdates - Mảng các object chứa id và order mới
   * @returns Danh sách trạng thái sau khi cập nhật thứ tự
   */
  @Patch('order/update')
  updateOrder(@Body() orderUpdates: Array<{ id: string; order: number }>) {
    return this.productionStatusService.updateOrder(orderUpdates);
  }

  /**
   * Lấy thống kê trạng thái sản xuất
   * GET /production-status/stats/summary
   * @returns Object chứa thống kê số lượng trạng thái
   */
  @Get('stats/summary')
  getStats() {
    return this.productionStatusService.getStats();
  }
}
