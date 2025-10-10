/**
 * File: customer/customer.controller.ts
 * Mục đích: Controller xử lý HTTP requests cho Khách Hàng.
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
  UseGuards,
  HttpStatus,
  HttpCode
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/auth.decorator';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * Đồng bộ khách hàng từ TestOrder2
   */
  @Post('sync')
  @Roles('customers')
  @HttpCode(HttpStatus.OK)
  async syncFromOrders() {
    await this.customerService.syncCustomersFromOrders();
    return {
      success: true,
      message: 'Customer sync completed successfully'
    };
  }

  /**
   * Cập nhật thời gian còn lại cho tất cả khách hàng
   */
  @Post('update-remaining-days')
  @Roles('customers')
  @HttpCode(HttpStatus.OK)
  async updateRemainingDays() {
    await this.customerService.updateRemainingDays();
    return {
      success: true,
      message: 'Remaining days updated successfully'
    };
  }

  /**
   * Lấy thống kê khách hàng
   */
  @Get('stats')
  @Roles('customers')
  async getStats() {
    return this.customerService.getStats();
  }

  /**
   * Lấy danh sách khách hàng
   */
  @Get()
  @Roles('customers')
  async findAll(@Query() query: any) {
    return this.customerService.findAll(query);
  }

  /**
   * Lấy khách hàng theo ID
   */
  @Get(':id')
  @Roles('customers')
  async findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  /**
   * Vô hiệu hóa khách hàng
   */
  @Patch(':id/disable')
  @Roles('customers')
  async disable(@Param('id') id: string) {
    return this.customerService.disable(id);
  }

  /**
   * Kích hoạt lại khách hàng
   */
  @Patch(':id/enable')
  @Roles('customers')
  async enable(@Param('id') id: string) {
    return this.customerService.enable(id);
  }

  /**
   * Cập nhật thông tin khách hàng
   */
  @Patch(':id')
  @Roles('customers')
  async update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customerService.update(id, updateCustomerDto);
  }

  /**
   * Xóa khách hàng
   */
  @Delete(':id')
  @Roles('customers')
  async remove(@Param('id') id: string) {
    await this.customerService.remove(id);
    return {
      success: true,
      message: 'Customer deleted successfully'
    };
  }
}