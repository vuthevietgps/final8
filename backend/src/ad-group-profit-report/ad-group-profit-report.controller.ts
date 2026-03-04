import { Controller, Get, Post, Query, Param, UseGuards } from '@nestjs/common';
import { AdGroupProfitReportService } from './ad-group-profit-report.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('ad-group-profit-report')
@Controller('ad-group-profit-report')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('ads-budget')
export class AdGroupProfitReportController {
  constructor(
    private readonly profitReportService: AdGroupProfitReportService
  ) {}

  /**
   * GET /ad-group-profit-report/performance
   * Lấy performance report cho từng ad group
   */
  @Get('performance')
  async getPerformanceReport(@Query() query: {
    startDate?: string;
    endDate?: string;
    adGroupIds?: string;
    minOrders?: string;
  }) {
    const params: any = {};
    
    if (query.startDate) {
      params.startDate = new Date(query.startDate);
    }
    if (query.endDate) {
      params.endDate = new Date(query.endDate);
    }
    if (query.adGroupIds) {
      params.adGroupIds = query.adGroupIds.split(',');
    }
    if (query.minOrders) {
      params.minOrders = parseInt(query.minOrders, 10);
    }

    return this.profitReportService.getAdGroupPerformanceReport(params);
  }

  /**
   * GET /ad-group-profit-report/optimal-spend
   * Lấy gợi ý chi phí tối ưu cho auto budget allocation
   */
  @Get('optimal-spend')
  async getOptimalSpendSuggestions(@Query() query: {
    lookbackDays?: string;
    minROI?: string;
    minProfit?: string;
  }) {
    const params: any = {};
    
    if (query.lookbackDays) {
      params.lookbackDays = parseInt(query.lookbackDays, 10);
    }
    if (query.minROI) {
      params.minROI = parseFloat(query.minROI);
    }
    if (query.minProfit) {
      params.minProfit = parseFloat(query.minProfit);
    }

    return this.profitReportService.getOptimalSpendSuggestions(params);
  }

  /**
   * GET /ad-group-profit-report/summary
   * Lấy tổng quan profit của tất cả ad groups
   */
  @Get('summary')
  async getProfitSummary(@Query() query: {
    startDate?: string;
    endDate?: string;
  }) {
    const params: any = {};
    
    if (query.startDate) {
      params.startDate = new Date(query.startDate);
    }
    if (query.endDate) {
      params.endDate = new Date(query.endDate);
    }

    return this.profitReportService.getProfitSummary(params);
  }

  /**
   * GET /ad-group-profit-report/snapshots/latest
   * Lấy snapshot Optimal Spend mới nhất (cập nhật hàng ngày lúc 06:00)
   * Dùng cho frontend hiển thị gợi ý cho nhân viên
   */
  @Get('snapshots/latest')
  async getLatestSnapshots() {
    return this.profitReportService.getLatestOptimalSpendSnapshots();
  }

  /**
   * GET /ad-group-profit-report/snapshots/:adGroupId/history
   * Lấy lịch sử optimal spend của một ad group (30 ngày)
   */
  @Get('snapshots/:adGroupId/history')
  async getSnapshotHistory(
    @Param('adGroupId') adGroupId: string,
    @Query('days') days?: string
  ) {
    const numDays = days ? parseInt(days, 10) : 30;
    return this.profitReportService.getOptimalSpendHistory(adGroupId, numDays);
  }

  /**
   * POST /ad-group-profit-report/snapshots/update
   * Trigger manual update (cho testing hoặc on-demand)
   */
  @Post('snapshots/update')
  async triggerUpdate() {
    return this.profitReportService.triggerOptimalSpendUpdate();
  }
}
