/**
 * File: ad-group-profit/ad-group-profit.controller.ts
 * Mục đích: API endpoints cho báo cáo lợi nhuận nhóm quảng cáo
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdGroupProfitService } from './ad-group-profit.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';

@Controller('ad-group-profit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdGroupProfitController {
  constructor(private readonly adGroupProfitService: AdGroupProfitService) {}

  /**
   * GET /ad-group-profit/report
   * Lấy báo cáo lợi nhuận theo nhóm quảng cáo theo ngày
   */
  @Get('report')
  @RequirePermissions('reports')
  async getReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.adGroupProfitService.getAdGroupProfitReport({ from, to, agentId });
  }

  /**
   * GET /ad-group-profit/stats
   * Lấy thống kê tổng quan
   */
  @Get('stats')
  @RequirePermissions('reports')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agentId') agentId?: string,
  ) {
    return this.adGroupProfitService.getSummaryStats({ from, to, agentId });
  }
}
