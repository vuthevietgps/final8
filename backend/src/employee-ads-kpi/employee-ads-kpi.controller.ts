/**
 * Employee Ads KPI Controller
 *
 * Endpoints:
 * - GET /employee-ads-kpi - Lấy KPI tất cả nhân viên
 * - GET /employee-ads-kpi/:employeeId - Lấy KPI một nhân viên
 * - GET /employee-ads-kpi/:employeeId/ad-groups - Lấy danh sách ad groups của nhân viên
 * - POST /employee-ads-kpi/assign - Gán nhân viên cho ad group
 * - POST /employee-ads-kpi/bulk-assign - Gán nhân viên cho nhiều ad groups
 * - GET /employee-ads-kpi/employees - Lấy danh sách nhân viên có thể gán
 * - GET /employee-ads-kpi/alerts - Lấy tất cả alerts
 *
 * Daily Budget Adjustment:
 * - GET /employee-ads-kpi/daily-suggestions - Lấy bảng gợi ý chi phí hôm nay
 * - POST /employee-ads-kpi/daily-suggestions/generate - Tạo suggestions thủ công
 * - POST /employee-ads-kpi/daily-suggestions/:adGroupId/confirm - Xác nhận đã chỉnh
 * - POST /employee-ads-kpi/daily-suggestions/bulk-confirm - Bulk confirm
 * - GET /employee-ads-kpi/daily-suggestions/progress/:employeeId - Tiến độ của NV
 * - GET /employee-ads-kpi/daily-suggestions/product-platform-summary - Thống kê
 */
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { RequirePermissions } from '../auth/decorators/auth.decorator';
import { EmployeeAdsKpiService, EmployeeKpiSummary, AdGroupPerformance, KpiAlert } from './employee-ads-kpi.service';
import { ConfirmAdjustmentDto, BulkConfirmDto, GetDailySuggestionsDto } from './dto/daily-adjustment.dto';
import { FeatureModule } from '../plan/feature-module.decorator';

@FeatureModule('employee-ads-kpi')
@Controller('employee-ads-kpi')
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermissions('employee-ads-kpi')
export class EmployeeAdsKpiController {
  constructor(private readonly kpiService: EmployeeAdsKpiService) {}

  /**
   * GET /employee-ads-kpi
   * Lấy KPI tất cả nhân viên
   */
  @Get()
  async getAllEmployeesKpi(
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<{
    employees: EmployeeKpiSummary[];
    summary: {
      totalEmployees: number;
      employeesMeetingKpi: number;
      employeesNotMeetingKpi: number;
      overallProfitableRate: number;
    };
  }> {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const employees = await this.kpiService.getAllEmployeesKpi(fromDate, toDate);

    // Calculate summary
    const employeesMeetingKpi = employees.filter(e => e.kpiProfitableRateMet).length;
    const totalProfitable = employees.reduce((sum, e) => sum + e.profitableAdGroups, 0);
    const totalAdGroups = employees.reduce((sum, e) => sum + e.totalAdGroups, 0);

    return {
      employees,
      summary: {
        totalEmployees: employees.length,
        employeesMeetingKpi,
        employeesNotMeetingKpi: employees.length - employeesMeetingKpi,
        overallProfitableRate: totalAdGroups > 0 ? totalProfitable / totalAdGroups : 0
      }
    };
  }

  // =============================================
  // PROFITABLE STATS ENDPOINTS (KPI NHÂN VIÊN)
  // Phải đặt TRƯỚC :employeeId để tránh route conflict
  // =============================================

  /**
   * GET /employee-ads-kpi/profitable-stats/daily
   * Lấy số lượng nhóm có lãi theo ngày, gộp theo platform + product
   */
  @Get('profitable-stats/daily')
  async getProfitableStatsByDay(
    @Query('from') from?: string,
    @Query('fromDate') fromDateAlias?: string,
    @Query('to') to?: string,
    @Query('toDate') toDateAlias?: string,
    @Query('employeeId') employeeId?: string
  ) {
    // Default: last 30 days
    const toDate = to || toDateAlias || new Date().toISOString().split('T')[0];
    const fromDateDefault = new Date();
    fromDateDefault.setDate(fromDateDefault.getDate() - 30);
    const fromDate = from || fromDateAlias || fromDateDefault.toISOString().split('T')[0];

    return this.kpiService.getProfitableStatsByDay(fromDate, toDate, employeeId);
  }

  /**
   * GET /employee-ads-kpi/profitable-stats/monthly
   * Lấy tỷ lệ nhóm có lãi trung bình theo tháng
   */
  @Get('profitable-stats/monthly')
  async getProfitableStatsMonthly(
    @Query('yearMonth') yearMonth?: string,
    @Query('employeeId') employeeId?: string
  ) {
    // Default: current month
    const defaultYearMonth = new Date().toISOString().slice(0, 7);
    return this.kpiService.getProfitableStatsMonthly(yearMonth || defaultYearMonth, employeeId);
  }

  /**
   * GET /employee-ads-kpi/profitable-stats/trend
   * Lấy trend tỷ lệ nhóm có lãi theo ngày (cho chart)
   */
  @Get('profitable-stats/trend')
  async getProfitableRateTrend(
    @Query('from') from?: string,
    @Query('fromDate') fromDateAlias?: string,
    @Query('to') to?: string,
    @Query('toDate') toDateAlias?: string,
    @Query('employeeId') employeeId?: string
  ) {
    // Default: last 30 days
    const toDate = to || toDateAlias || new Date().toISOString().split('T')[0];
    const fromDateDefault = new Date();
    fromDateDefault.setDate(fromDateDefault.getDate() - 30);
    const fromDate = from || fromDateAlias || fromDateDefault.toISOString().split('T')[0];

    return this.kpiService.getProfitableRateTrend(fromDate, toDate, employeeId);
  }

  /**
   * GET /employee-ads-kpi/employees
   * Lấy danh sách nhân viên có thể gán
   */
  @Get('meta/employees')
  async getAssignableEmployees(): Promise<Array<{ _id: string; fullName: string; email: string; role: string }>> {
    return this.kpiService.getAssignableEmployees();
  }

  /**
   * GET /employee-ads-kpi/alerts
   * Lấy tất cả alerts từ tất cả nhân viên
   */
  @Get('meta/alerts')
  async getAllAlerts(
    @Query('from') from?: string,
    @Query('fromDate') fromDateAlias?: string,
    @Query('to') to?: string,
    @Query('toDate') toDateAlias?: string,
    @Query('type') type?: 'WARNING' | 'CRITICAL' | 'INFO'
  ): Promise<{
    alerts: Array<KpiAlert & { employeeId: string; employeeName: string }>;
    summary: {
      critical: number;
      warning: number;
      info: number;
    };
  }> {
    const fromDate = from || fromDateAlias ? new Date(from || fromDateAlias) : undefined;
    const toDate = to || toDateAlias ? new Date(to || toDateAlias) : undefined;

    const employees = await this.kpiService.getAllEmployeesKpi(fromDate, toDate);

    let allAlerts: Array<KpiAlert & { employeeId: string; employeeName: string }> = [];

    for (const emp of employees) {
      for (const alert of emp.alerts) {
        if (!type || alert.type === type) {
          allAlerts.push({
            ...alert,
            employeeId: emp.employeeId,
            employeeName: emp.employeeName
          });
        }
      }
    }

    // Sort by type priority: CRITICAL > WARNING > INFO
    const typePriority = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    allAlerts.sort((a, b) => typePriority[a.type] - typePriority[b.type]);

    return {
      alerts: allAlerts,
      summary: {
        critical: allAlerts.filter(a => a.type === 'CRITICAL').length,
        warning: allAlerts.filter(a => a.type === 'WARNING').length,
        info: allAlerts.filter(a => a.type === 'INFO').length
      }
    };
  }

  /**
   * POST /employee-ads-kpi/assign
   * Gán nhân viên cho một ad group
   */
  @Post('assign')
  async assignEmployee(
    @Body() body: { adGroupId: string; employeeId: string }
  ): Promise<{ success: boolean; message: string }> {
    await this.kpiService.assignEmployeeToAdGroup(body.adGroupId, body.employeeId);
    return {
      success: true,
      message: `Đã gán nhân viên cho nhóm quảng cáo ${body.adGroupId}`
    };
  }

  /**
   * POST /employee-ads-kpi/bulk-assign
   * Gán nhân viên cho nhiều ad groups
   */
  @Post('bulk-assign')
  async bulkAssignEmployee(
    @Body() body: { adGroupIds: string[]; employeeId: string }
  ): Promise<{ success: number; failed: number; message: string }> {
    const result = await this.kpiService.bulkAssignEmployee(body.adGroupIds, body.employeeId);
    return {
      ...result,
      message: `Đã gán ${result.success} nhóm quảng cáo cho nhân viên`
    };
  }

  // =============================================
  // DAILY BUDGET ADJUSTMENT ENDPOINTS
  // =============================================

  /**
   * GET /employee-ads-kpi/daily-suggestions
   * Lấy bảng gợi ý chi phí hôm nay cho nhân viên ads
   */
  @Get('daily-suggestions')
  async getDailySuggestions(
    @Query('date') date?: string,
    @Query('employeeId') employeeId?: string,
    @Query('platform') platform?: 'facebook' | 'google' | 'tiktok',
    @Query('confirmedOnly') confirmedOnly?: string,
    @Query('unconfirmedOnly') unconfirmedOnly?: string
  ) {
    return this.kpiService.getDailySuggestions({
      date,
      employeeId,
      platform,
      confirmedOnly: confirmedOnly === 'true',
      unconfirmedOnly: unconfirmedOnly === 'true'
    });
  }

  /**
   * POST /employee-ads-kpi/daily-suggestions/generate
   * Generate suggestions thủ công (Admin)
   */
  @Post('daily-suggestions/generate')
  async generateDailySuggestions(
    @Body() body: { date?: string }
  ): Promise<{ created: number; updated: number; message: string }> {
    const result = await this.kpiService.generateDailySuggestions(body.date);
    return {
      ...result,
      message: `Đã tạo ${result.created} gợi ý mới, cập nhật ${result.updated} gợi ý`
    };
  }

  /**
   * POST /employee-ads-kpi/daily-suggestions/:adGroupId/confirm
   * Xác nhận đã chỉnh budget cho một ad group
   */
  @Post('daily-suggestions/:adGroupId/confirm')
  async confirmAdjustment(
    @Param('adGroupId') adGroupId: string,
    @Body() dto: ConfirmAdjustmentDto,
    @Query('date') date?: string
  ) {
    const result = await this.kpiService.confirmAdjustment(
      adGroupId,
      dto.confirmedBudget,
      dto.notes,
      date
    );

    if (!result) {
      return {
        success: false,
        message: `Không tìm thấy gợi ý cho nhóm ${adGroupId} ngày ${date || 'hôm nay'}`
      };
    }

    return {
      success: true,
      message: `Đã xác nhận chỉnh budget cho ${result.adGroupName}: ${dto.confirmedBudget.toLocaleString()} VND`,
      data: result
    };
  }

  /**
   * POST /employee-ads-kpi/daily-suggestions/bulk-confirm
   * Bulk confirm nhiều adjustments
   */
  @Post('daily-suggestions/bulk-confirm')
  async bulkConfirmAdjustments(
    @Body() dto: BulkConfirmDto,
    @Query('date') date?: string
  ): Promise<{ success: number; failed: number; message: string }> {
    const result = await this.kpiService.bulkConfirmAdjustments(dto.items, date);
    return {
      ...result,
      message: `Đã xác nhận ${result.success} nhóm, thất bại ${result.failed} nhóm`
    };
  }

  /**
   * GET /employee-ads-kpi/daily-suggestions/progress/:employeeId
   * Lấy tiến độ chỉnh sửa của nhân viên trong ngày
   */
  @Get('daily-suggestions/progress/:employeeId')
  async getEmployeeDailyProgress(
    @Param('employeeId') employeeId: string,
    @Query('date') date?: string
  ) {
    return this.kpiService.getEmployeeDailyProgress(employeeId, date);
  }

  /**
   * GET /employee-ads-kpi/daily-suggestions/product-platform-summary
   * Thống kê theo sản phẩm + platform (KPI monitoring)
   */
  @Get('daily-suggestions/product-platform-summary')
  async getProductPlatformSummary(
    @Query('date') date?: string
  ) {
    return this.kpiService.getProductPlatformSummary(date);
  }

  // =============================================
  // WILDCARD ROUTES - MUST BE LAST to avoid catching
  // static routes like /daily-suggestions, /meta/*
  // =============================================

  /**
   * GET /employee-ads-kpi/:employeeId
   * Lấy KPI một nhân viên cụ thể
   */
  @Get(':employeeId')
  async getEmployeeKpi(
    @Param('employeeId') employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<EmployeeKpiSummary> {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.kpiService.getEmployeeKpi(employeeId, fromDate, toDate);
  }

  /**
   * GET /employee-ads-kpi/:employeeId/ad-groups
   * Lấy danh sách ad groups của một nhân viên với performance
   */
  @Get(':employeeId/ad-groups')
  async getEmployeeAdGroups(
    @Param('employeeId') employeeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<AdGroupPerformance[]> {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.kpiService.getEmployeeAdGroups(employeeId, fromDate, toDate);
  }
}
