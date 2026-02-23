import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LaborCost1Service } from './labor-cost1.service';
import { LaborStatementService } from './labor-statement.service';
import { CreateLaborCost1Dto } from './dto/create-labor-cost1.dto';
import { UpdateLaborCost1Dto } from './dto/update-labor-cost1.dto';
import { CreateLaborStatementDto } from './dto/create-labor-statement.dto';
import { AddLaborPaymentDto } from './dto/add-labor-payment.dto';
import { UpdateKpiDto } from './dto/update-kpi.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('labor-cost1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LaborCost1Controller {
  constructor(
    private readonly service: LaborCost1Service,
    private readonly statementService: LaborStatementService,
  ) {}

  @Get()
  @RequirePermissions('labor-costs')
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @RequirePermissions('labor-costs')
  create(@Body() dto: CreateLaborCost1Dto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('labor-costs')
  update(@Param('id') id: string, @Body() dto: UpdateLaborCost1Dto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('labor-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post('generate-from-sessions')
  @RequirePermissions('labor-costs')
  generateFromSessionLogs(
    @Query('userId') userId?: string,
    @Query('date') date?: string
  ) {
    return this.service.generateFromSessionLogs(userId, date);
  }

  @Patch(':id/pay')
  @RequirePermissions('labor-costs')
  markPaid(@Param('id') id: string) {
    return this.service.markPaid(id);
  }

  // ============================================
  // LABOR STATEMENT ENDPOINTS (Phiếu thanh toán lương)
  // ============================================

  /**
   * POST /labor-cost1/statements
   * Tạo phiếu thanh toán lương mới
   */
  @Post('statements')
  @RequirePermissions('labor-costs')
  createStatement(@Body() dto: CreateLaborStatementDto) {
    return this.statementService.createStatement(dto);
  }

  /**
   * GET /labor-cost1/statements
   * Lấy danh sách phiếu thanh toán lương
   */
  @Get('statements')
  @RequirePermissions('labor-costs')
  listStatements(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('periodFrom') periodFrom?: string,
    @Query('periodTo') periodTo?: string,
  ) {
    return this.statementService.listStatements({
      employeeId,
      status,
      periodFrom,
      periodTo,
    });
  }

  /**
   * GET /labor-cost1/statements/:id
   * Lấy chi tiết phiếu thanh toán lương
   */
  @Get('statements/:id')
  @RequirePermissions('labor-costs')
  getStatement(@Param('id') id: string) {
    return this.statementService.getStatement(id);
  }

  /**
   * PATCH /labor-cost1/statements/:id/kpi
   * Cập nhật KPI cho phiếu lương (Director/Manager nhập)
   * Bước 2 trong workflow: Tạo phiếu → Nhập KPI → Duyệt → Thanh toán
   */
  @Patch('statements/:id/kpi')
  @RequirePermissions('labor-costs')
  updateKpi(
    @Param('id') id: string,
    @Body() dto: UpdateKpiDto,
  ) {
    return this.statementService.updateKpi(id, dto);
  }

  /**
   * POST /labor-cost1/statements/:id/confirm
   * Xác nhận phiếu (draft → open)
   * Yêu cầu: KPI phải được nhập trước
   */
  @Post('statements/:id/confirm')
  @RequirePermissions('labor-costs')
  confirmStatement(
    @Param('id') id: string,
    @Body('confirmedBy') confirmedBy?: string,
    @Body('skipKpiCheck') skipKpiCheck?: boolean,
  ) {
    return this.statementService.confirmStatement(id, confirmedBy, skipKpiCheck);
  }

  /**
   * POST /labor-cost1/statements/:id/payments
   * Thêm thanh toán vào phiếu
   */
  @Post('statements/:id/payments')
  @RequirePermissions('labor-costs')
  addPayment(
    @Param('id') id: string,
    @Body() dto: AddLaborPaymentDto,
  ) {
    return this.statementService.addPayment(id, dto);
  }

  /**
   * PATCH /labor-cost1/statements/:id/close
   * Đóng phiếu (open → closed)
   */
  @Patch('statements/:id/close')
  @RequirePermissions('labor-costs')
  closeStatement(
    @Param('id') id: string,
    @Body('closedBy') closedBy?: string,
  ) {
    return this.statementService.closeStatement(id, closedBy);
  }

  /**
   * PATCH /labor-cost1/statements/:id/reopen
   * Mở lại phiếu (closed → open)
   */
  @Patch('statements/:id/reopen')
  @RequirePermissions('labor-costs')
  reopenStatement(@Param('id') id: string) {
    return this.statementService.reopenStatement(id);
  }

  /**
   * DELETE /labor-cost1/statements/:id
   * Xóa phiếu thanh toán (chỉ xóa được draft)
   */
  @Delete('statements/:id')
  @RequirePermissions('labor-costs')
  deleteStatement(@Param('id') id: string) {
    return this.statementService.deleteStatement(id);
  }

  /**
   * GET /labor-cost1/statements/summary/total-unpaid
   * Tổng tiền lương chưa thanh toán (cho Committed Cash)
   */
  @Get('statements/summary/total-unpaid')
  @RequirePermissions('labor-costs')
  getTotalUnpaid() {
    return this.statementService.getTotalUnpaidLabor();
  }

  /**
   * GET /labor-cost1/statements/summary/payment
   * @deprecated Use /summary/cashflow instead
   */
  @Get('statements/summary/payment')
  @RequirePermissions('labor-costs')
  getPaymentSummary() {
    return this.statementService.getPaymentSummary();
  }

  /**
   * GET /labor-cost1/summary/cashflow
   * Tổng hợp chi phí lương cho Financial Control (AP)
   */
  @Get('summary/cashflow')
  @RequirePermissions('labor-costs')
  getCashflowSummary(@Query('windowDays') windowDays?: string) {
    return this.statementService.getCashflowSummary(windowDays ? parseInt(windowDays, 10) : 14);
  }

  /**
   * GET /labor-cost1/statements/summary/by-employee
   * Tổng hợp theo nhân viên
   */
  @Get('statements/summary/by-employee')
  @RequirePermissions('labor-costs')
  getSummaryByEmployee() {
    return this.statementService.getSummaryByEmployee();
  }

  /**
   * GET /labor-cost1/summary/cards
   * 4 cards tổng quan cho UI
   */
  @Get('summary/cards')
  @RequirePermissions('labor-costs')
  getSummaryCards() {
    return this.service.getSummaryCards();
  }
}
