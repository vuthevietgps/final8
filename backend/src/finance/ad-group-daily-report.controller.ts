import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';
import { GetAdGroupDailyReportDto } from './dto/ad-group-daily-report.dto';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('ad-group-daily-report')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('ads-budget')
export class AdGroupDailyReportController {
  constructor(private readonly service: AdGroupDailyReportService) {}

  /**
   * POST /ad-group-daily-report/sync
   * Đồng bộ dữ liệu từ ordertest2 cho một ngày cụ thể
   */
  @Post('sync')
  syncData(@Query('date') date?: string) {
    return this.service.syncFromOrderTest2(date);
  }

  /**
   * GET /ad-group-daily-report
   * Báo cáo chi phí và lợi nhuận nhóm quảng cáo theo ngày (kèm gợi ý chi phí tối ưu)
   */
  @Get()
  getReport(@Query() dto: GetAdGroupDailyReportDto) {
    return this.service.getReportWithSuggestions({
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      adGroupId: dto.adGroupId,
      platform: dto.platform
    });
  }

  /**
   * GET /ad-group-daily-report/optimal-spend
   * Lấy gợi ý chi phí tối ưu cho tất cả ad groups
   * Dựa trên thuật toán lợi nhuận biên giảm dần
   */
  @Get('optimal-spend')
  getOptimalSpendSuggestions() {
    return this.service.getOptimalSpendSuggestions();
  }

  /**
   * GET /ad-group-daily-report/top
   * Top ad groups theo lợi nhuận thuần
   */
  @Get('top')
  getTopAdGroups(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'profit' | 'adsCost'
  ) {
    return this.service.getTopAdGroups({
      fromDate,
      toDate,
      limit: limit ? parseInt(limit, 10) : 10,
      sortBy: sortBy || 'profit'
    });
  }
}
