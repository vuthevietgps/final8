/**
 * File: ad-group-profit-report/ad-group-profit-report.controller.ts
 * Mục đích: REST API cho báo cáo lợi nhuận nhóm quảng cáo.
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';
import { AdGroupProfitFilterDto } from './dto/ad-group-profit-filter.dto';
import { AdGroupRoiQueryDto } from './dto/ad-group-roi-query.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('ad-group-profit-report')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdGroupProfitReportController {
  constructor(private readonly adGroupProfitReportService: AdGroupProfitReportService) {}

  // GET /ad-group-profit-report
  // Trả về cấu trúc giống product-profit-report: { adGroups, dates, data, summary }
  @Get()
  @RequirePermissions('reports')
  async getAdGroupProfitReport(@Query() filterDto: AdGroupProfitFilterDto) {
    return this.adGroupProfitReportService.getAdGroupProfitReport(filterDto);
  }

  // GET /ad-group-profit-report/years
  @Get('years')
  @RequirePermissions('reports')
  async getAvailableYears() {
    const years = await this.adGroupProfitReportService.getAvailableYears();
    return { years };
  }

  // GET /ad-group-profit-report/summary
  @Get('summary')
  @RequirePermissions('reports')
  async getSummary(@Query() filterDto: AdGroupProfitFilterDto) {
    const report = await this.adGroupProfitReportService.getAdGroupProfitReport(filterDto);
    return {
      summary: report.summary,
      adGroupCount: report.adGroups.length,
      dateRange: {
        from: report.dates[0] || null,
        to: report.dates[report.dates.length - 1] || null,
        totalDays: report.dates.length
      }
    };
  }

    // Bảng 1: Báo cáo chi phí & lợi nhuận nhóm QC theo ngày (từ Summary5)
    @Get('daily')
    @RequirePermissions('reports')
    async getDailyCostProfit(
      @Query('from') from?: string,
      @Query('to') to?: string,
      @Query('adGroupId') adGroupId?: string,
    ) {
      return this.adGroupProfitReportService.getDailyCostProfit({ from, to, adGroupId });
    }

    // Bảng 2: Chi phí ads tối ưu per adGroup
    @Get('optimal-spend')
    @RequirePermissions('reports')
    async getOptimalSpend() {
      return this.adGroupProfitReportService.getOptimalSpendSuggestions();
    }

    // Bảng 3: Lợi nhuận ads 30 ngày gần nhất per adGroup (pivot)
    @Get('profit-30d')
    @RequirePermissions('reports')
    async getProfit30d(@Query('adGroupId') adGroupId?: string) {
      return this.adGroupProfitReportService.getProfit30Days({ adGroupId });
    }

  // Đề xuất scale ads theo chiều ngang (tạo thêm nhóm QC mới)
  @Get('horizontal-scale')
  @RequirePermissions('reports')
  async getHorizontalScaleSuggestions() {
    return this.adGroupProfitReportService.getHorizontalScaleSuggestions();
  }

  @Get('roi-insights')
  @RequirePermissions('reports')
  async getRoiInsights(@Query() query: AdGroupRoiQueryDto) {
    return this.adGroupProfitReportService.getAdGroupRoiInsights(query);
  }

  @Get('cashflow-weekly')
  @RequirePermissions('reports')
  async getCashflowWeekly(@Query() filterDto: AdGroupProfitFilterDto) {
    return this.adGroupProfitReportService.getWeeklyCashflowOverview(filterDto);
  }

  @Get('cashflow-monthly')
  @RequirePermissions('reports')
  async getCashflowMonthly(@Query() filterDto: AdGroupProfitFilterDto) {
    return this.adGroupProfitReportService.getMonthlyCashflowOverview(filterDto);
  }
}
