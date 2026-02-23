import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards, Res, Request } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TestOrder2Service } from './test-order2.service';
import { CreateTestOrder2Dto } from './dto/create-test-order2.dto';
import { UpdateTestOrder2Dto } from './dto/update-test-order2.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { CreateSupplierPaymentBatchDto, CreateAgentPaymentBatchDto } from './dto/payment-batch.dto';
import { TestOrder2ExportService } from './test-order2-export.service';
import { TestOrder2ExportJsonService } from './test-order2-export-json.service';
import { TestOrder2ImportService } from './test-order2-import.service';
import { Response } from 'express';

@Controller('test-order2')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestOrder2Controller {
  constructor(
    private readonly service: TestOrder2Service,
    private readonly exportService: TestOrder2ExportService,
    private readonly exportJsonService: TestOrder2ExportJsonService,
    private readonly importService: TestOrder2ImportService,
  ) {}

  @Get()
  async findAll(
    @CurrentUser() currentUser: any,
    @Query('q') q?: string,
    @Query('productId') productId?: string,
    @Query('agentId') agentId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('adGroupId') adGroupId?: string,
    @Query('isActive') isActive?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productionStatus') productionStatus?: string,
    @Query('orderStatus') orderStatus?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.service.findAll({
      currentUser,
      q,
      productId,
      agentId,
      supplierId,
      adGroupId,
      isActive,
      from,
      to,
      productionStatus,
      orderStatus,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  @Post()
  async create(@CurrentUser() currentUser: any, @Body() dto: CreateTestOrder2Dto) {
    return this.service.create(dto, currentUser);
  }

  @Post('seed')
  async seed(@Query('count') count?: string) {
    const c = Math.max(1, Math.min(100, Number(count) || 10));
    return this.service.seed(c);
  }

  // ============ DAILY PROFIT REPORT ============
  
  /**
   * Get daily profit report with estimated vs realized
   * GET /test-order2/daily-profit-report?date=2026-01-29
   */
  @Get('daily-profit-report')
  async getDailyProfitReport(@Query('date') date?: string) {
    return this.service.getDailyProfitReport(date);
  }

  /**
   * Get product profit report by date
   * GET /test-order2/product-profit-report?date=2026-01-29
   */
  @Get('product-profit-report')
  async getProductProfitReport(
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getProductProfitReport({ date, from, to });
  }

  // Routes with :id params MUST be placed AFTER specific routes
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  async update(@CurrentUser() currentUser: any, @Param('id') id: string, @Body() dto: UpdateTestOrder2Dto) {
    return this.service.update(id, dto as any, currentUser);
  }

  // Patch only delivery/order status (to mirror docker v10.0 DTO)
  @Patch(':id/delivery-status')
  async updateDeliveryStatus(@Param('id') id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.service.update(id, dto as any);
  }

  @Delete(':id')
  async remove(@CurrentUser() currentUser: any, @Param('id') id: string) {
    return this.service.remove(id, currentUser);
  }

  // Export JSON
  @Get('export/json')
  async exportJson() {
    const { items, count } = await this.exportJsonService.exportJson();
    return { items, count };
  }

  // Export CSV (response as text/csv)
  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const { csv, count } = await this.exportService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="test-order2-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  }

  // Import JSON
  @Post('import')
  async importJson(@Body() body: { items: any[] }) {
    return this.importService.importJson(body);
  }

  // ============ PAYMENT BATCH ENDPOINTS ============

  // Get supplier payment ops summary (dashboard + breakdown)
  @Get('supplier-payment/ops-summary')
  async getSupplierPaymentOpsSummary(
    @Query('supplierId') supplierId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.service.getSupplierPaymentOpsSummary({
      supplierId,
      fromDate,
      toDate
    });
  }

  // Get agent payment ops summary (dashboard + breakdown) - CFO Spec v2.0
  @Get('agent-payment/ops-summary')
  async getAgentPaymentOpsSummary(
    @Query('agentId') agentId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.service.getAgentPaymentOpsSummary({
      agentId,
      fromDate,
      toDate
    });
  }

  // Get orders pending supplier payment
  @Get('payment-pending/supplier')
  async getOrdersPendingSupplierPayment(
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('orderStatus') orderStatus?: string,
  ) {
    return this.service.getOrdersPendingSupplierPayment({
      supplierId,
      from,
      to,
      orderStatus
    });
  }

  // Get orders pending agent payment
  @Get('payment-pending/agent')
  async getOrdersPendingAgentPayment(
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getOrdersPendingAgentPayment({
      agentId,
      from,
      to
    });
  }

  // Create supplier payment batch
  @Post('supplier-payment-batch')
  async createSupplierPaymentBatch(@Body() dto: CreateSupplierPaymentBatchDto) {
    return this.service.createSupplierPaymentBatch(dto);
  }

  // Create agent payment batch
  @Post('agent-payment-batch')
  async createAgentPaymentBatch(@Body() dto: CreateAgentPaymentBatchDto) {
    return this.service.createAgentPaymentBatch(dto);
  }

  // Create agent payment batch with atomic update (CFO Spec v2.0)
  // Chống double-pay, idempotency
  @Post('agent-payment-batch/atomic')
  async createAgentPaymentBatchAtomic(@Body() dto: CreateAgentPaymentBatchDto) {
    return this.service.createAgentPaymentBatchAtomic(dto);
  }

  // Get supplier payment batches
  @Get('payment-batches/supplier')
  async getSupplierPaymentBatches(
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getSupplierPaymentBatches({
      supplierId,
      from,
      to
    });
  }

  // Get agent payment batches
  @Get('payment-batches/agent')
  async getAgentPaymentBatches(
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAgentPaymentBatches({
      agentId,
      from,
      to
    });
  }

  // Get orders in a payment batch
  @Get('payment-batch/:batchId/:type')
  async getOrdersInBatch(
    @Param('batchId') batchId: string,
    @Param('type') type: 'supplier' | 'agent'
  ) {
    return this.service.getOrdersInBatch(batchId, type);
  }

  // Recalculate profits for a single order
  @Post(':id/recalculate-profits')
  async recalculateProfits(@Param('id') id: string) {
    return this.service.recalculateProfits(id);
  }

  // Recalculate quotes for a single order (force refresh based on current orderDate)
  // Use this when orderDate changes and you want to apply the correct quote
  @Post(':id/recalculate-quotes')
  async recalculateQuotes(@Param('id') id: string) {
    return this.service.recalculateQuotes(id);
  }

  // Recalculate profits for all orders (with filters)
  @Post('recalculate-all-profits')
  async recalculateAllProfits(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('supplierId') supplierId?: string,
    @Query('agentId') agentId?: string
  ) {
    return this.service.recalculateAllProfits({ from, to, supplierId, agentId });
  }
}
