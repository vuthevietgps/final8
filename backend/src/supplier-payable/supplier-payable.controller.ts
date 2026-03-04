import { Body, Controller, Delete, Get, Header, HttpCode, HttpStatus, Param, Patch, Post, Query, Res, UseGuards, ValidationPipe, UnauthorizedException, Request } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from './decorators/roles.decorator';
import { SupplierPayableService } from './supplier-payable.service';
import { CreateSupplierPayableDto } from './dto/create-supplier-payable.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { CreateStatementDto } from './dto/create-statement.dto';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { RolesGuard as CustomRolesGuard } from './guards/roles.guard';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('supplier-payable')
@Controller('supplier-payables')
@UseGuards(JwtAuthGuard, RolesGuard, CustomRolesGuard)
export class SupplierPayableController {
  constructor(
    private readonly service: SupplierPayableService,
    private readonly jwtService: JwtService
  ) {}

  @Post()
  @RequirePermissions('purchase-costs')
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreateSupplierPayableDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('purchase-costs')
  list(
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({ supplierId, status, from, to, page: Number(page || 1), limit: Number(limit || 50) });
  }

  @Get('statement/by-supplier')
  @RequirePermissions('purchase-costs')
  statement(
    @Query('supplierId') supplierId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.statement({ supplierId, from, to });
  }

  @Post('statements')
  @RequirePermissions('purchase-costs')
  upsertStatement(@Body(new ValidationPipe({ whitelist: true, transform: true })) dto: CreateStatementDto) {
    return this.service.upsertStatement(dto);
  }

  @Get('statements')
  @RequirePermissions('purchase-costs')
  listStatements(
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listStatements({ supplierId, from, to, status });
  }

  /**
   * GET /supplier-payables/statements/summary/payment
   * @deprecated Use /summary/cashflow instead
   */
  @Get('statements/summary/payment')
  @RequirePermissions('purchase-costs')
  getPaymentSummary() {
    return this.service.getPaymentSummary();
  }

  /**
   * GET /supplier-payables/summary/cashflow
   * Tổng hợp hoa hồng NCC cho Financial Control (AR)
   * NCC trả tiền cho mình sau khi giao hàng thành công
   */
  @Get('summary/cashflow')
  @RequirePermissions('purchase-costs')
  getCashflowSummary() {
    return this.service.getCashflowSummary();
  }

  @Get('statements/:id')
  @RequirePermissions('purchase-costs')
  getStatement(@Param('id') id: string) {
    return this.service.getStatement(id);
  }

  @Post('statements/:id/payments')
  @RequirePermissions('purchase-costs')
  addStatementPayment(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: AddPaymentDto) {
    return this.service.addStatementPayment(id, dto);
  }

  @Patch('statements/:id/close')
  @RequirePermissions('purchase-costs')
  closeStatement(@Param('id') id: string) {
    return this.service.closeStatement(id);
  }

  /**
   * Reopen closed statement - Director only
   * Cho phép Giám đốc mở lại kỳ đã chốt để điều chỉnh khi có bất thường
   */
  @Patch('statements/:id/reopen')
  @RequirePermissions('purchase-costs')
  @Roles('director') // Chỉ Giám đốc mới được phép reopen
  reopenStatement(@Param('id') id: string, @Request() req: any) {
    return this.service.reopenStatement(id);
  }

  @Get('statements/:id/pdf')
  @Public() // Bypass JWT guard, we'll validate token manually from query
  async exportStatementPDF(
    @Param('id') id: string,
    @Query('format') format: string,
    @Query('token') token: string,
    @Res() res: Response
  ) {
    // Validate token from query string (for window.open compatibility)
    if (!token) {
      throw new UnauthorizedException('Token không được cung cấp');
    }
    
    try {
      // Verify JWT token with secret
      // Note: In production, JWT_SECRET must be set via environment
      const secret = process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production';
      const decoded = this.jwtService.verify(token, { secret });
      
      // Check payload has user id (JWT uses 'sub' field)
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Token không hợp lệ');
      }
    } catch (error) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    
    const html = await this.service.generateStatementPDF(id);
    
    // TODO: Add real PDF generation with puppeteer/pdfkit
    // For now: return HTML for preview in browser
    if (format === 'download') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="statement-${id}.html"`);
    } else {
      // Preview mode (default)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    
    return res.send(html);
  }

  @Get(':id')
  @RequirePermissions('purchase-costs')
  get(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/payments')
  @RequirePermissions('purchase-costs')
  addPayment(@Param('id') id: string, @Body(new ValidationPipe({ whitelist: true, transform: true })) dto: AddPaymentDto) {
    return this.service.addPayment(id, dto);
  }

  @Get('export/csv')
  @RequirePermissions('purchase-costs')
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @Res() res: Response,
    @Query('supplierId') supplierId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    const csv = await this.service.exportCsv({ supplierId, from, to, status });
    return res.send(csv);
  }

  @Delete(':id')
  @RequirePermissions('purchase-costs')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
