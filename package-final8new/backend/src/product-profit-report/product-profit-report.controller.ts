/**
 * File: product-profit-report/product-profit-report.controller.ts
 * Mục đích: Controller API cho báo cáo lợi nhuận sản phẩm theo ngày từ Summary5
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ProductProfitReportService } from './product-profit-report.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('product-profit-report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductProfitReportController {
  constructor(private readonly productProfitReportService: ProductProfitReportService) {}

  /**
   * API lấy báo cáo lợi nhuận sản phẩm theo ngày
   * GET /product-profit-report
   */
  @Get()
  @RequirePermissions('reports')
  async getProductProfitReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productName') productName?: string,
  ) {
    return this.productProfitReportService.getProductProfitReport({ from, to, productName });
  }

  /**
   * API lấy danh sách năm có dữ liệu
   * GET /product-profit-report/years
   */
  @Get('years')
  @RequirePermissions('reports')
  async getAvailableYears() {
    const years = await this.productProfitReportService.getAvailableYears();
    return { years };
  }

  /**
   * API lấy thống kê tổng quan
   * GET /product-profit-report/summary
   */
  @Get('summary')
  @RequirePermissions('reports')
  async getSummary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('productName') productName?: string,
  ) {
    const report = await this.productProfitReportService.getProductProfitReport({ from, to, productName });
    return {
      summary: report.summary,
      productCount: report.data.length,
      dateRange: {
        from: report.dateRange.from,
        to: report.dateRange.to,
        totalDays: report.dates.length
      }
    };
  }
}
