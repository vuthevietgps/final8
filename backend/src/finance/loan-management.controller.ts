/**
 * LOAN MANAGEMENT CONTROLLER
 * ==========================
 * API endpoints cho quản lý khoản vay cao cấp
 */

import { Controller, Get, Post, Param, Body, Query, Logger } from '@nestjs/common';
import { LoanManagementService } from './loan-management.service';
import { CreateLoanPaymentDto } from './dto/loan-management.dto';

@Controller('loan-management')
export class LoanManagementController {
  private readonly logger = new Logger(LoanManagementController.name);

  constructor(private readonly service: LoanManagementService) {}

  /**
   * GET /api/loan-management/dashboard
   * Dashboard 3 KPIs + chi tiết + gợi ý tối ưu
   */
  @Get('dashboard')
  async getDashboard() {
    this.logger.log('GET /api/loan-management/dashboard');
    return this.service.getDashboard();
  }

  /**
   * GET /api/loan-management/loans/:id/payment-options
   * Lấy các lựa chọn thanh toán cho một khoản vay
   */
  @Get('loans/:id/payment-options')
  async getPaymentOptions(@Param('id') loanId: string) {
    this.logger.log(`GET /api/loan-management/loans/${loanId}/payment-options`);
    return this.service.getPaymentOptions(loanId);
  }

  /**
   * POST /api/loan-management/loans/:id/pay
   * Thực hiện thanh toán khoản vay
   */
  @Post('loans/:id/pay')
  async createPayment(
    @Param('id') loanId: string,
    @Body() dto: CreateLoanPaymentDto,
  ) {
    this.logger.log(`POST /api/loan-management/loans/${loanId}/pay`);
    return this.service.createPayment(loanId, dto);
  }

  /**
   * GET /api/loan-management/loans/:id/payments
   * Lịch sử thanh toán của một khoản vay
   */
  @Get('loans/:id/payments')
  async getPaymentHistory(@Param('id') loanId: string) {
    this.logger.log(`GET /api/loan-management/loans/${loanId}/payments`);
    return this.service.getPaymentHistory(loanId);
  }

  /**
   * GET /api/loan-management/payments
   * Tất cả lịch sử thanh toán
   */
  @Get('payments')
  async getAllPayments(@Query('limit') limit?: string) {
    this.logger.log('GET /api/loan-management/payments');
    return this.service.getAllPayments(limit ? +limit : 50);
  }
}
