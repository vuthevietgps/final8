import { Body, Controller, Get, Patch, Post, Query, UseGuards, Param } from '@nestjs/common';
import { CreateSupplierQuoteDto } from './dto/create-supplier-quote.dto';
import { RejectSupplierQuoteDto } from './dto/reject-supplier-quote.dto';
import { UpdateSupplierQuoteDto } from './dto/update-supplier-quote.dto';
import { SupplierQuoteService } from './supplier-quote.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';
import { SupplierQuoteApprovalStatus } from './schemas/supplier-quote.schema';

@FeatureModule('supplier-quote')
@Controller('supplier-quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierQuoteController {
  constructor(private readonly service: SupplierQuoteService) {}

  @Post()
  @RequirePermissions('purchase-costs')
  create(@CurrentUser() currentUser: any, @Body() dto: CreateSupplierQuoteDto) {
    return this.service.create(dto, currentUser);
  }

  @Patch(':id')
  @RequirePermissions('purchase-costs')
  update(
    @CurrentUser() currentUser: any,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierQuoteDto,
  ) {
    return this.service.update(id, dto, currentUser);
  }

  @Patch(':id/approve')
  @RequirePermissions('supplier-quotes.approve')
  approve(@CurrentUser() currentUser: any, @Param('id') id: string) {
    return this.service.approve(id, currentUser);
  }

  @Patch(':id/reject')
  @RequirePermissions('supplier-quotes.approve')
  reject(
    @CurrentUser() currentUser: any,
    @Param('id') id: string,
    @Body() body: RejectSupplierQuoteDto,
  ) {
    return this.service.reject(id, currentUser, body.reason);
  }

  /**
   * Establishes server-authenticated provenance for a legacy quote. The actor
   * claiming it is then ineligible to approve/reject it; a different approver
   * must complete the workflow.
   */
  @Patch(':id/claim-provenance')
  @RequirePermissions('purchase-costs')
  claimProvenance(@CurrentUser() currentUser: any, @Param('id') id: string) {
    return this.service.claimProvenance(id, currentUser);
  }

  @Get()
  @RequirePermissions('purchase-costs')
  findAll(
    @Query('productId') productId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('approvalStatus') approvalStatus?: SupplierQuoteApprovalStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      productId,
      supplierId,
      approvalStatus,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Get('latest')
  @RequirePermissions('purchase-costs')
  latest(
    @Query('productId') productId: string,
    @Query('supplierId') supplierId: string,
  ) {
    return this.service.getLatest(productId, supplierId);
  }

  /**
   * GET /supplier-quotes/effective
   * Lấy quote có hiệu lực tại một thời điểm cụ thể
   */
  @Get('effective')
  @RequirePermissions('purchase-costs')
  getEffective(
    @Query('productId') productId: string,
    @Query('supplierId') supplierId: string,
    @Query('date') date?: string,
  ) {
    const targetDate = date ? new Date(date) : new Date();
    return this.service.getEffectiveAt(productId, supplierId, targetDate);
  }

  /**
   * GET /supplier-quotes/history/:productId/:supplierId
   * Lịch sử giá của sản phẩm từ NCC
   */
  @Get('history/:productId/:supplierId')
  @RequirePermissions('purchase-costs')
  getPriceHistory(
    @Param('productId') productId: string,
    @Param('supplierId') supplierId: string,
  ) {
    return this.service.getPriceHistory(productId, supplierId);
  }

  /**
   * GET /supplier-quotes/by-supplier/:supplierId
   * Tổng quan báo giá của 1 NCC
   */
  @Get('by-supplier/:supplierId')
  @RequirePermissions('purchase-costs')
  getSupplierQuotes(@Param('supplierId') supplierId: string) {
    return this.service.getSupplierQuotes(supplierId);
  }
}
