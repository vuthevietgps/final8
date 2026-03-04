import { Body, Controller, Get, Post, Query, UseGuards, Param } from '@nestjs/common';
import { CreateSupplierQuoteDto } from './dto/create-supplier-quote.dto';
import { SupplierQuoteService } from './supplier-quote.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('supplier-quote')
@Controller('supplier-quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierQuoteController {
  constructor(private readonly service: SupplierQuoteService) {}

  @Post()
  @RequirePermissions('purchase-costs')
  create(@Body() dto: CreateSupplierQuoteDto) {
    return this.service.create(dto);
  }

  @Get()
  @RequirePermissions('purchase-costs')
  findAll(
    @Query('productId') productId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({ productId, supplierId, page: Number(page), limit: Number(limit) });
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
