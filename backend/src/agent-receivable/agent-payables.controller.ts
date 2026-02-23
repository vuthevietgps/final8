/**
 * Agent Payables Controller - CFO Spec v3.1
 * 
 * Đây là endpoint chính với naming đúng góc nhìn công ty:
 * - "payables" = tiền mình phải trả agent (AP)
 * 
 * Route cũ /api/agent-receivables vẫn hoạt động nhưng deprecated.
 */
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Headers, Logger } from '@nestjs/common';
import { AgentReceivableService } from './agent-receivable.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('agent-payables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentPayablesController {
  private readonly logger = new Logger(AgentPayablesController.name);

  constructor(private readonly service: AgentReceivableService) {}

  /**
   * GET /api/agent-payables/summary/cashflow
   * Tổng hợp hoa hồng đại lý cho Financial Control (AP)
   * Mình phải trả hoa hồng cho đại lý
   */
  @Get('summary/cashflow')
  @RequirePermissions('quotes')
  getCashflowSummary(@Query('windowDays') windowDays?: string) {
    return this.service.getCashflowSummary(windowDays ? parseInt(windowDays, 10) : 14);
  }

  /**
   * GET /api/agent-payables/statements
   * Danh sách statements
   */
  @Get('statements')
  @RequirePermissions('quotes')
  listStatements(
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listStatements(agentId, from, to, status);
  }

  /**
   * GET /api/agent-payables/summary
   * Tổng hợp công nợ đại lý
   */
  @Get('summary')
  @RequirePermissions('quotes')
  receivableSummary(
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAgentReceivableSummary({ agentId, from, to });
  }

  /**
   * POST /api/agent-payables/statements
   * Tạo hoặc cập nhật statement
   */
  @Post('statements')
  @RequirePermissions('quotes')
  upsertStatement(
    @Body('agentId') agentId: string,
    @Body('periodFrom') periodFrom: string,
    @Body('periodTo') periodTo: string,
    @Body('notes') notes?: string,
  ) {
    return this.service.upsertStatement(agentId, periodFrom, periodTo, notes);
  }

  /**
   * POST /api/agent-payables/statements/:id/payments
   * Thêm payment vào statement
   */
  @Post('statements/:id/payments')
  @RequirePermissions('quotes')
  addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto, @Body('createdBy') createdBy?: string) {
    return this.service.addPayment(id, dto, createdBy);
  }

  /**
   * PATCH /api/agent-payables/statements/:id/close
   * Đóng statement
   */
  @Patch('statements/:id/close')
  @RequirePermissions('quotes')
  closeStatement(@Param('id') id: string) {
    return this.service.closeStatement(id);
  }

  /**
   * PATCH /api/agent-payables/statements/:id/reopen
   * Mở lại statement
   */
  @Patch('statements/:id/reopen')
  @RequirePermissions('quotes')
  reopenStatement(@Param('id') id: string) {
    return this.service.reopenStatement(id);
  }
}
