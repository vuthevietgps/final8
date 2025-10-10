/**
 * File: order-status.controller.ts
 * Mục đích: REST API cho trạng thái đơn hàng.
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
import { OrderStatusService } from './order-status.service';
import { CreateOrderStatusDto } from './dto/create-order-status.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

/**
 * Controller xử lý các request HTTP cho trạng thái đơn hàng
 * Cung cấp các endpoint REST API đầy đủ cho CRUD operations
 */
@Controller('order-status')
export class OrderStatusController {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  /**
   * Tạo mới trạng thái đơn hàng
   * POST /order-status
   * @param createOrderStatusDto - Dữ liệu trạng thái đơn hàng
   * @returns Trạng thái đơn hàng vừa được tạo
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(ValidationPipe) createOrderStatusDto: CreateOrderStatusDto) {
    return this.orderStatusService.create(createOrderStatusDto);
  }

  /**
   * Lấy danh sách tất cả trạng thái đơn hàng
   * GET /order-status
   * @param isActive - Query parameter để lọc theo trạng thái hoạt động
   * @param isFinal - Query parameter để lọc theo trạng thái cuối
   * @returns Danh sách trạng thái đơn hàng
   */
  @Get()
  findAll(
    @Query('isActive') isActive?: string,
    @Query('isFinal') isFinal?: string
  ) {
    const activeFilter = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    const finalFilter = isFinal === 'true' ? true : isFinal === 'false' ? false : undefined;
    return this.orderStatusService.findAll(activeFilter, finalFilter);
  }

  /**
   * Lấy thông tin một trạng thái đơn hàng theo ID
   * GET /order-status/:id
   * @param id - ID của trạng thái đơn hàng
   * @returns Thông tin trạng thái đơn hàng
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orderStatusService.findOne(id);
  }

  /**
   * Cập nhật thông tin trạng thái đơn hàng
   * PATCH /order-status/:id
   * @param id - ID của trạng thái đơn hàng
   * @param updateOrderStatusDto - Dữ liệu cập nhật
   * @returns Trạng thái đơn hàng sau khi cập nhật
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateOrderStatusDto: UpdateOrderStatusDto,
  ) {
    return this.orderStatusService.update(id, updateOrderStatusDto);
  }

  /**
   * Xóa trạng thái đơn hàng
   * DELETE /order-status/:id
   * @param id - ID của trạng thái đơn hàng cần xóa
   * @returns Thông báo xóa thành công
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.orderStatusService.remove(id);
  }

  /**
   * Cập nhật thứ tự hiển thị cho nhiều trạng thái
   * PATCH /order-status/order/update
   * @param orderUpdates - Mảng các object chứa id và order mới
   * @returns Danh sách trạng thái sau khi cập nhật thứ tự
   */
  @Patch('order/update')
  updateOrder(@Body() orderUpdates: Array<{ id: string; order: number }>) {
    return this.orderStatusService.updateOrder(orderUpdates);
  }

  /**
   * Lấy thống kê trạng thái đơn hàng
   * GET /order-status/stats/summary
   * @returns Object chứa thống kê số lượng trạng thái
   */
  @Get('stats/summary')
  getStats() {
    return this.orderStatusService.getStats();
  }

  /**
   * Lấy trạng thái theo workflow (processing -> final)
   * GET /order-status/workflow/statuses
   * @returns Object chứa trạng thái xử lý và trạng thái cuối
   */
  @Get('workflow/statuses')
  getWorkflowStatuses() {
    return this.orderStatusService.getWorkflowStatuses();
  }
}
