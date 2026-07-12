import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards, Logger, Res } from '@nestjs/common';
import { Response } from 'express';
import { AgentReceivableService } from './agent-receivable.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions, Roles } from '../auth/decorators/auth.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FeatureModule } from '../plan/feature-module.decorator';
import { UserRole } from '../user/user.enum';

/**
 * @deprecated Use /api/agent-payables instead
 *
 * CFO Spec v3.1: Route này vẫn hoạt động nhưng nên migrate sang /api/agent-payables
 * vì "payables" đúng góc nhìn công ty (tiền mình phải trả agent).
 */
@FeatureModule('agent-receivable')
@Controller('agent-receivables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentReceivableController {
  private readonly logger = new Logger(AgentReceivableController.name);

  constructor(private readonly service: AgentReceivableService) {}

  private addDeprecationHeader(res: Response) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/agent-payables>; rel="successor-version"');
    res.setHeader('X-Deprecation-Notice', 'Please migrate to /api/agent-payables');
  }

  /**
   * GET /agent-receivables/summary/payment
   * @deprecated Use /api/agent-payables/summary/cashflow instead
   */
  @Get('summary/payment')
  @RequirePermissions('quotes')
  async getPaymentSummary(@Res({ passthrough: true }) res: Response) {
    this.addDeprecationHeader(res);
    this.logger.warn('Deprecated endpoint called: GET /agent-receivables/summary/payment. Use /api/agent-payables/summary/cashflow');
    return this.service.getPaymentSummary();
  }

  /**
   * GET /agent-receivables/summary/cashflow
   * @deprecated Use /api/agent-payables/summary/cashflow instead
   */
  @Get('summary/cashflow')
  @RequirePermissions('quotes')
  async getCashflowSummary(@Query('windowDays') windowDays?: string, @Res({ passthrough: true }) res?: Response) {
    if (res) this.addDeprecationHeader(res);
    return this.service.getCashflowSummary(windowDays ? parseInt(windowDays, 10) : 14);
  }

  @Get('statements')
  @RequirePermissions('quotes')
  async listStatements(
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listStatements(agentId, from, to, status);
  }

  @Get('summary')
  @RequirePermissions('quotes')
  receivableSummary(
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getAgentReceivableSummary({ agentId, from, to });
  }

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

  @Post('statements/:id/payments')
  @RequirePermissions('quotes')
  addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto, @Body('createdBy') createdBy?: string) {
    return this.service.addPayment(id, dto, createdBy);
  }

  @Patch('statements/:id/close')
  @RequirePermissions('quotes')
  closeStatement(@Param('id') id: string) {
    return this.service.closeStatement(id);
  }

  @Patch('statements/:id/reopen')
  @RequirePermissions('quotes')
  @Roles(UserRole.DIRECTOR)
  reopenStatement(@Param('id') id: string) {
    return this.service.reopenStatement(id);
  }
}
