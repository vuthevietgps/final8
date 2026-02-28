/**
 * Employee Ads KPI Service
 * 
 * KPI Targets:
 * - 70% nhóm ads phải có lợi nhuận dương
 * - Tối thiểu 4 nhóm quảng cáo có lợi nhuận / 1 nền tảng / 1 sản phẩm
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { User, UserDocument } from '../user/user.schema';
import { AdGroupDailyReport, AdGroupDailyReportDocument } from '../finance/schemas/ad-group-daily-report.schema';
import { DailyBudgetAdjustment, DailyBudgetAdjustmentDocument } from './schemas/daily-budget-adjustment.schema';

// KPI Constants
const KPI_PROFITABLE_RATE_TARGET = 0.70; // 70% nhóm ads phải có lợi nhuận dương
const KPI_MIN_PROFITABLE_GROUPS_PER_PLATFORM_PRODUCT = 4; // Tối thiểu 4 nhóm QC có lợi nhuận

// Interfaces
export interface EmployeeKpiSummary {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  
  // Tổng quan
  totalAdGroups: number;
  profitableAdGroups: number;
  unprofitableAdGroups: number;
  profitableRate: number; // Tỷ lệ nhóm có lợi nhuận
  
  // KPI Status
  kpiProfitableRateTarget: number;
  kpiProfitableRateMet: boolean;
  
  // Chi tiết theo platform
  platformBreakdown: PlatformBreakdown[];
  
  // Cảnh báo
  alerts: KpiAlert[];
  
  // Metrics tổng hợp
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  avgROI: number;
  
  // Thời gian
  periodStart: Date;
  periodEnd: Date;
}

export interface PlatformBreakdown {
  platform: 'facebook' | 'google' | 'tiktok';
  productCategoryId: string;
  productCategoryName?: string;
  
  totalGroups: number;
  profitableGroups: number;
  unprofitableGroups: number;
  
  // KPI: Tối thiểu 4 nhóm có lợi nhuận
  kpiMinGroupsMet: boolean;
  kpiMinGroupsTarget: number;
  
  // Metrics
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  avgROI: number;
}

export interface KpiAlert {
  type: 'WARNING' | 'CRITICAL' | 'INFO';
  code: string;
  message: string;
  details?: any;
  createdAt: Date;
}

export interface AdGroupPerformance {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  productCategoryId: string;
  productCategoryName?: string;
  
  spend: number;
  revenue: number;
  profit: number;
  roi: number;
  isProfitable: boolean;
  
  orders: number;
  successOrders: number;
  returnOrders: number;
  successRate: number;
}

@Injectable()
export class EmployeeAdsKpiService {
  private readonly logger = new Logger(EmployeeAdsKpiService.name);

  constructor(
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(AdGroupDailyReport.name)
    private readonly reportModel: Model<AdGroupDailyReportDocument>,
    @InjectModel(DailyBudgetAdjustment.name)
    private readonly adjustmentModel: Model<DailyBudgetAdjustmentDocument>,
  ) {}

  /**
   * Lấy KPI summary cho một nhân viên
   */
  async getEmployeeKpi(
    employeeId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<EmployeeKpiSummary> {
    // Default: 30 ngày gần nhất
    const now = new Date();
    const periodEnd = toDate || now;
    const periodStart = fromDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Lấy thông tin nhân viên
    const employee = await this.userModel.findById(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    // Lấy tất cả ad groups của nhân viên
    const adGroups = await this.adGroupModel.find({
      assignedEmployeeId: new Types.ObjectId(employeeId),
      isActive: true
    }).populate('productCategoryId');

    // Lấy performance data từ daily reports
    const adGroupIds = adGroups.map(ag => ag.adGroupId);
    const reports = await this.reportModel.find({
      adGroupId: { $in: adGroupIds },
      date: { $gte: periodStart, $lte: periodEnd }
    });

    // Tính toán performance cho từng ad group
    const adGroupPerformances = await this.calculateAdGroupPerformances(adGroups, reports);

    // Tính toán các metrics
    const profitableAdGroups = adGroupPerformances.filter(ag => ag.isProfitable);
    const unprofitableAdGroups = adGroupPerformances.filter(ag => !ag.isProfitable);
    const profitableRate = adGroupPerformances.length > 0 
      ? profitableAdGroups.length / adGroupPerformances.length 
      : 0;

    // Tính platform breakdown
    const platformBreakdown = this.calculatePlatformBreakdown(adGroupPerformances);

    // Tạo alerts
    const alerts = this.generateAlerts(profitableRate, platformBreakdown, adGroupPerformances);

    // Tính tổng metrics
    const totalSpend = adGroupPerformances.reduce((sum, ag) => sum + ag.spend, 0);
    const totalRevenue = adGroupPerformances.reduce((sum, ag) => sum + ag.revenue, 0);
    const totalProfit = adGroupPerformances.reduce((sum, ag) => sum + ag.profit, 0);
    // ROI = (Profit / Spend) * 100 (not ROAS which is Revenue/Spend)
    const avgROI = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;

    return {
      employeeId,
      employeeName: employee.fullName || '',
      employeeEmail: employee.email,
      
      totalAdGroups: adGroupPerformances.length,
      profitableAdGroups: profitableAdGroups.length,
      unprofitableAdGroups: unprofitableAdGroups.length,
      profitableRate,
      
      kpiProfitableRateTarget: KPI_PROFITABLE_RATE_TARGET,
      kpiProfitableRateMet: profitableRate >= KPI_PROFITABLE_RATE_TARGET,
      
      platformBreakdown,
      alerts,
      
      totalSpend,
      totalRevenue,
      totalProfit,
      avgROI,
      
      periodStart,
      periodEnd
    };
  }

  /**
   * Lấy KPI summary cho tất cả nhân viên
   */
  async getAllEmployeesKpi(
    fromDate?: Date,
    toDate?: Date
  ): Promise<EmployeeKpiSummary[]> {
    // Lấy tất cả nhân viên có role employee hoặc manager đang quản lý ad groups
    const employeesWithAdGroups = await this.adGroupModel.aggregate([
      { $match: { assignedEmployeeId: { $exists: true, $ne: null }, isActive: true } },
      { $group: { _id: '$assignedEmployeeId' } }
    ]);

    const employeeIds = employeesWithAdGroups.map(e => e._id.toString());

    const results: EmployeeKpiSummary[] = [];
    for (const employeeId of employeeIds) {
      try {
        const kpi = await this.getEmployeeKpi(employeeId, fromDate, toDate);
        results.push(kpi);
      } catch (error) {
        this.logger.warn(`Failed to get KPI for employee ${employeeId}: ${(error as any).message}`);
      }
    }

    // Sắp xếp theo tỷ lệ profitable giảm dần
    return results.sort((a, b) => b.profitableRate - a.profitableRate);
  }

  /**
   * Lấy danh sách ad groups của một nhân viên với performance
   */
  async getEmployeeAdGroups(
    employeeId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<AdGroupPerformance[]> {
    const now = new Date();
    const periodEnd = toDate || now;
    const periodStart = fromDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const adGroups = await this.adGroupModel.find({
      assignedEmployeeId: new Types.ObjectId(employeeId),
      isActive: true
    }).populate('productCategoryId');

    const adGroupIds = adGroups.map(ag => ag.adGroupId);
    const reports = await this.reportModel.find({
      adGroupId: { $in: adGroupIds },
      date: { $gte: periodStart, $lte: periodEnd }
    });

    return this.calculateAdGroupPerformances(adGroups, reports);
  }

  /**
   * Gán nhân viên phụ trách cho ad group
   */
  async assignEmployeeToAdGroup(
    adGroupId: string,
    employeeId: string
  ): Promise<void> {
    // Verify employee exists
    const employee = await this.userModel.findById(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    // Update ad group
    await this.adGroupModel.updateOne(
      { _id: adGroupId },
      { $set: { assignedEmployeeId: new Types.ObjectId(employeeId) } }
    );

    this.logger.log(`Assigned employee ${employee.fullName || employee.email} to ad group ${adGroupId}`);
  }

  /**
   * Gán nhân viên phụ trách cho nhiều ad groups
   */
  async bulkAssignEmployee(
    adGroupIds: string[],
    employeeId: string
  ): Promise<{ success: number; failed: number }> {
    const employee = await this.userModel.findById(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }

    const result = await this.adGroupModel.updateMany(
      { _id: { $in: adGroupIds.map(id => new Types.ObjectId(id)) } },
      { $set: { assignedEmployeeId: new Types.ObjectId(employeeId) } }
    );

    this.logger.log(`Bulk assigned ${result.modifiedCount} ad groups to ${employee.fullName || employee.email}`);

    return {
      success: result.modifiedCount,
      failed: adGroupIds.length - result.modifiedCount
    };
  }

  /**
   * Lấy danh sách nhân viên có thể gán
   */
  async getAssignableEmployees(): Promise<Array<{ _id: string; fullName: string; email: string; role: string }>> {
    const employees = await this.userModel.find({
      role: { $in: ['employee', 'manager'] },
      isActive: true
    }).select('_id fullName email role');

    return employees.map(e => ({
      _id: e._id.toString(),
      fullName: e.fullName || '',
      email: e.email,
      role: e.role
    }));
  }

  /**
   * Cron job: Kiểm tra KPI hàng ngày và gửi alerts
   */
  @Cron('0 8 * * *', { 
    name: 'check-employee-kpi',
    timeZone: 'Asia/Ho_Chi_Minh' 
  })
  async checkDailyKpi(): Promise<void> {
    this.logger.log('🔍 Running daily KPI check...');

    try {
      const allKpi = await this.getAllEmployeesKpi();
      
      for (const kpi of allKpi) {
        // Log critical alerts
        const criticalAlerts = kpi.alerts.filter(a => a.type === 'CRITICAL');
        for (const alert of criticalAlerts) {
          this.logger.error(`🚨 CRITICAL KPI Alert for ${kpi.employeeName}: ${alert.message}`);
        }

        // Log warnings
        const warnings = kpi.alerts.filter(a => a.type === 'WARNING');
        for (const alert of warnings) {
          this.logger.warn(`⚠️ WARNING KPI Alert for ${kpi.employeeName}: ${alert.message}`);
        }
      }

      // Summary
      const underperforming = allKpi.filter(k => !k.kpiProfitableRateMet);
      if (underperforming.length > 0) {
        this.logger.warn(`📊 ${underperforming.length} nhân viên chưa đạt KPI 70% profitable`);
      }

      this.logger.log(`✅ Daily KPI check completed. ${allKpi.length} employees checked.`);
    } catch (error) {
      this.logger.error('❌ Failed to run daily KPI check:', error);
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private calculateAdGroupPerformances(
    adGroups: AdGroupDocument[],
    reports: AdGroupDailyReportDocument[]
  ): AdGroupPerformance[] {
    // Group reports by adGroupId
    const reportsByAdGroup = new Map<string, AdGroupDailyReportDocument[]>();
    for (const report of reports) {
      const existing = reportsByAdGroup.get(report.adGroupId) || [];
      existing.push(report);
      reportsByAdGroup.set(report.adGroupId, existing);
    }

    return adGroups.map(adGroup => {
      const adGroupReports = reportsByAdGroup.get(adGroup.adGroupId) || [];
      
      // Aggregate metrics using correct field names from schema
      const spend = adGroupReports.reduce((sum, r) => sum + (r.adsCost || 0), 0);
      const profit = adGroupReports.reduce((sum, r) => sum + (r.netProfit || 0), 0);
      
      // Revenue = spend + profit (since profit = revenue - spend)
      const revenue = spend + profit;
      
      // Note: orders tracking is not available in AdGroupDailyReport schema
      // Set default values for now
      const orders = 0;
      const successOrders = 0;
      const returnOrders = 0;
      
      // ROI = (Profit / Spend) * 100 (not ROAS which is Revenue/Spend)
      const roi = spend > 0 ? (profit / spend) * 100 : 0;
      const successRate = orders > 0 ? (successOrders / orders) * 100 : 0;

      const productCategory = adGroup.productCategoryId as any;

      return {
        adGroupId: adGroup.adGroupId,
        adGroupName: adGroup.name,
        platform: adGroup.platform,
        productCategoryId: productCategory?._id?.toString() || '',
        productCategoryName: productCategory?.name || '',
        
        spend,
        revenue,
        profit,
        roi,
        isProfitable: profit > 0,
        
        orders,
        successOrders,
        returnOrders,
        successRate
      };
    });
  }

  private calculatePlatformBreakdown(performances: AdGroupPerformance[]): PlatformBreakdown[] {
    // Group by platform + productCategoryId
    const groups = new Map<string, AdGroupPerformance[]>();
    
    for (const perf of performances) {
      const key = `${perf.platform}|${perf.productCategoryId}`;
      const existing = groups.get(key) || [];
      existing.push(perf);
      groups.set(key, existing);
    }

    const breakdowns: PlatformBreakdown[] = [];
    
    for (const [key, perfs] of groups) {
      const [platform, productCategoryId] = key.split('|');
      const profitableGroups = perfs.filter(p => p.isProfitable);
      
      const totalSpend = perfs.reduce((sum, p) => sum + p.spend, 0);
      const totalRevenue = perfs.reduce((sum, p) => sum + p.revenue, 0);
      
      breakdowns.push({
        platform: platform as 'facebook' | 'google' | 'tiktok',
        productCategoryId,
        productCategoryName: perfs[0]?.productCategoryName,
        
        totalGroups: perfs.length,
        profitableGroups: profitableGroups.length,
        unprofitableGroups: perfs.length - profitableGroups.length,
        
        kpiMinGroupsMet: profitableGroups.length >= KPI_MIN_PROFITABLE_GROUPS_PER_PLATFORM_PRODUCT,
        kpiMinGroupsTarget: KPI_MIN_PROFITABLE_GROUPS_PER_PLATFORM_PRODUCT,
        
        totalSpend,
        totalRevenue,
        totalProfit: totalRevenue - totalSpend,
        // ROI = (Profit / Spend) * 100 (not ROAS)
        avgROI: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0
      });
    }

    return breakdowns.sort((a, b) => b.totalProfit - a.totalProfit);
  }

  private generateAlerts(
    profitableRate: number,
    platformBreakdown: PlatformBreakdown[],
    performances: AdGroupPerformance[]
  ): KpiAlert[] {
    const alerts: KpiAlert[] = [];
    const now = new Date();

    // Alert 1: Tỷ lệ profitable < 70%
    if (profitableRate < KPI_PROFITABLE_RATE_TARGET) {
      const gap = (KPI_PROFITABLE_RATE_TARGET - profitableRate) * 100;
      const severity = profitableRate < 0.5 ? 'CRITICAL' : 'WARNING';
      
      alerts.push({
        type: severity,
        code: 'KPI_PROFITABLE_RATE_NOT_MET',
        message: `Tỷ lệ nhóm QC có lợi nhuận: ${(profitableRate * 100).toFixed(1)}% (target: 70%). Thiếu ${gap.toFixed(1)}%`,
        details: { currentRate: profitableRate, target: KPI_PROFITABLE_RATE_TARGET },
        createdAt: now
      });
    }

    // Alert 2: Platform không đủ 4 nhóm có lợi nhuận
    for (const breakdown of platformBreakdown) {
      if (!breakdown.kpiMinGroupsMet) {
        const severity = breakdown.profitableGroups < 2 ? 'CRITICAL' : 'WARNING';
        
        alerts.push({
          type: severity,
          code: 'KPI_MIN_GROUPS_NOT_MET',
          message: `${breakdown.platform.toUpperCase()} - ${breakdown.productCategoryName || 'Unknown'}: Chỉ có ${breakdown.profitableGroups}/${breakdown.kpiMinGroupsTarget} nhóm QC có lợi nhuận`,
          details: {
            platform: breakdown.platform,
            productCategoryId: breakdown.productCategoryId,
            profitableGroups: breakdown.profitableGroups,
            target: breakdown.kpiMinGroupsTarget
          },
          createdAt: now
        });
      }
    }

    // Alert 3: Ad groups lỗ nặng (ROI < 50%)
    const heavyLossGroups = performances.filter(p => p.spend > 0 && p.roi < 50);
    if (heavyLossGroups.length > 0) {
      alerts.push({
        type: 'WARNING',
        code: 'AD_GROUPS_HEAVY_LOSS',
        message: `${heavyLossGroups.length} nhóm QC có ROI < 50% cần xem xét tắt hoặc tối ưu`,
        details: {
          adGroups: heavyLossGroups.map(g => ({
            name: g.adGroupName,
            roi: g.roi.toFixed(1),
            loss: g.profit
          }))
        },
        createdAt: now
      });
    }

    // Alert 4: Không có ad group nào
    if (performances.length === 0) {
      alerts.push({
        type: 'INFO',
        code: 'NO_AD_GROUPS_ASSIGNED',
        message: 'Chưa có nhóm quảng cáo nào được gán cho nhân viên này',
        createdAt: now
      });
    }

    return alerts;
  }

  // =============================================
  // DAILY BUDGET ADJUSTMENT METHODS
  // =============================================

  /**
   * Tạo/Cập nhật daily suggestions cho tất cả ad groups
   * Chạy tự động lúc 6:30 AM hoặc gọi thủ công
   */
  @Cron('30 6 * * *', {
    name: 'generate-daily-suggestions',
    timeZone: 'Asia/Ho_Chi_Minh'
  })
  async generateDailySuggestions(dateStr?: string): Promise<{ created: number; updated: number }> {
    const today = dateStr || this.getTodayDateString();
    const yesterday = this.getYesterdayDateString(today);
    const threeDaysAgo = this.getDateStringDaysAgo(today, 3);

    this.logger.log(`📊 Generating daily suggestions for ${today}...`);

    // Lấy tất cả ad groups đang active có nhân viên phụ trách
    const adGroups = await this.adGroupModel.find({
      isActive: true,
      assignedEmployeeId: { $exists: true, $ne: null }
    }).populate('productCategoryId');

    let created = 0;
    let updated = 0;

    for (const adGroup of adGroups) {
      try {
        // Lấy report hôm qua
        const yesterdayReport = await this.reportModel.findOne({
          adGroupId: adGroup.adGroupId,
          date: yesterday
        });

        // Lấy report 3 ngày gần nhất để tính average
        const recentReports = await this.reportModel.find({
          adGroupId: adGroup.adGroupId,
          date: { $gte: threeDaysAgo, $lte: yesterday }
        });

        const spendYesterday = yesterdayReport?.adsCost || 0;
        const profitYesterday = yesterdayReport?.netProfit || 0;
        const avgSpendLast3Days = recentReports.length > 0
          ? recentReports.reduce((sum, r) => sum + (r.adsCost || 0), 0) / recentReports.length
          : 0;

        // Tính suggested spend với cap 20% tăng / 30% giảm
        const { suggestedSpend, suggestedSpendCapped, recommendation, reason } = this.calculateSuggestedSpend(
          spendYesterday,
          avgSpendLast3Days,
          profitYesterday
        );

        const productCategory = adGroup.productCategoryId as any;

        // Upsert adjustment
        const result = await this.adjustmentModel.updateOne(
          { date: today, adGroupId: adGroup.adGroupId },
          {
            $set: {
              adGroupName: adGroup.name,
              employeeId: adGroup.assignedEmployeeId,
              platform: adGroup.platform,
              productCategoryId: productCategory?._id,
              productCategoryName: productCategory?.name || '',
              spendYesterday,
              profitYesterday,
              avgSpendLast3Days,
              suggestedSpend,
              suggestedSpendCapped,
              isProfitable: profitYesterday > 0,
              roi: spendYesterday > 0 ? (profitYesterday / spendYesterday) * 100 : 0,
              recommendation,
              recommendationReason: reason,
              // Không overwrite confirmed status nếu đã confirm
            }
          },
          { upsert: true }
        );

        if (result.upsertedCount > 0) created++;
        else if (result.modifiedCount > 0) updated++;
      } catch (err) {
        this.logger.warn(`Failed to generate suggestion for ${adGroup.adGroupId}: ${(err as any).message}`);
      }
    }

    this.logger.log(`✅ Daily suggestions generated: ${created} created, ${updated} updated`);
    return { created, updated };
  }

  /**
   * Lấy danh sách gợi ý chi phí hàng ngày
   */
  async getDailySuggestions(params: {
    date?: string;
    employeeId?: string;
    platform?: 'facebook' | 'google' | 'tiktok';
    confirmedOnly?: boolean;
    unconfirmedOnly?: boolean;
  }): Promise<{
    date: string;
    suggestions: DailyBudgetAdjustmentDocument[];
    summary: {
      total: number;
      confirmed: number;
      unconfirmed: number;
      profitable: number;
      unprofitable: number;
      totalSpendYesterday: number;
      totalSuggestedSpend: number;
    };
  }> {
    const date = params.date || this.getTodayDateString();

    const query: any = { date };

    if (params.employeeId) {
      query.employeeId = new Types.ObjectId(params.employeeId);
    }

    if (params.platform) {
      query.platform = params.platform;
    }

    if (params.confirmedOnly) {
      query.confirmed = true;
    }

    if (params.unconfirmedOnly) {
      query.confirmed = false;
    }

    const suggestions = await this.adjustmentModel.find(query)
      .populate('employeeId', 'fullName email')
      .sort({ platform: 1, productCategoryName: 1, adGroupName: 1 });

    const confirmed = suggestions.filter(s => s.confirmed).length;
    const profitable = suggestions.filter(s => s.isProfitable).length;

    return {
      date,
      suggestions,
      summary: {
        total: suggestions.length,
        confirmed,
        unconfirmed: suggestions.length - confirmed,
        profitable,
        unprofitable: suggestions.length - profitable,
        totalSpendYesterday: suggestions.reduce((sum, s) => sum + s.spendYesterday, 0),
        totalSuggestedSpend: suggestions.reduce((sum, s) => sum + s.suggestedSpendCapped, 0)
      }
    };
  }

  /**
   * Xác nhận đã chỉnh budget cho một ad group
   */
  async confirmAdjustment(
    adGroupId: string,
    confirmedBudget: number,
    notes?: string,
    dateStr?: string
  ): Promise<DailyBudgetAdjustmentDocument | null> {
    const date = dateStr || this.getTodayDateString();

    const result = await this.adjustmentModel.findOneAndUpdate(
      { date, adGroupId },
      {
        $set: {
          confirmed: true,
          confirmedAt: new Date(),
          confirmedBudget,
          notes
        }
      },
      { new: true }
    );

    if (result) {
      this.logger.log(`✅ Confirmed adjustment for ${adGroupId}: ${confirmedBudget.toLocaleString()} VND`);
    }

    return result;
  }

  /**
   * Bulk confirm nhiều adjustments
   */
  async bulkConfirmAdjustments(
    items: Array<{ adGroupId: string; confirmedBudget: number; notes?: string }>,
    dateStr?: string
  ): Promise<{ success: number; failed: number }> {
    const date = dateStr || this.getTodayDateString();
    let success = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const result = await this.confirmAdjustment(item.adGroupId, item.confirmedBudget, item.notes, date);
        if (result) success++;
        else failed++;
      } catch (err) {
        failed++;
        this.logger.warn(`Failed to confirm ${item.adGroupId}: ${(err as any).message}`);
      }
    }

    return { success, failed };
  }

  /**
   * Lấy tiến độ chỉnh sửa của nhân viên trong ngày
   */
  async getEmployeeDailyProgress(employeeId: string, dateStr?: string): Promise<{
    date: string;
    employeeId: string;
    total: number;
    confirmed: number;
    unconfirmed: number;
    progress: number; // 0-100
    platforms: Array<{
      platform: string;
      total: number;
      confirmed: number;
      unconfirmed: number;
    }>;
  }> {
    const date = dateStr || this.getTodayDateString();

    const adjustments = await this.adjustmentModel.find({
      date,
      employeeId: new Types.ObjectId(employeeId)
    });

    const confirmed = adjustments.filter(a => a.confirmed).length;
    const total = adjustments.length;

    // Group by platform
    const platformMap = new Map<string, { total: number; confirmed: number }>();
    for (const adj of adjustments) {
      const existing = platformMap.get(adj.platform) || { total: 0, confirmed: 0 };
      existing.total++;
      if (adj.confirmed) existing.confirmed++;
      platformMap.set(adj.platform, existing);
    }

    const platforms = Array.from(platformMap.entries()).map(([platform, data]) => ({
      platform,
      total: data.total,
      confirmed: data.confirmed,
      unconfirmed: data.total - data.confirmed
    }));

    return {
      date,
      employeeId,
      total,
      confirmed,
      unconfirmed: total - confirmed,
      progress: total > 0 ? Math.round((confirmed / total) * 100) : 100,
      platforms
    };
  }

  /**
   * Thống kê theo sản phẩm + platform
   */
  async getProductPlatformSummary(dateStr?: string): Promise<Array<{
    platform: string;
    productCategoryId: string;
    productCategoryName: string;
    totalGroups: number;
    profitableGroups: number;
    unprofitableGroups: number;
    profitableRate: number;
    kpiMet: boolean; // >= 4 profitable groups
    totalSpend: number;
    totalProfit: number;
  }>> {
    const date = dateStr || this.getTodayDateString();

    const pipeline = [
      { $match: { date } },
      {
        $group: {
          _id: { platform: '$platform', productCategoryId: '$productCategoryId' },
          productCategoryName: { $first: '$productCategoryName' },
          totalGroups: { $sum: 1 },
          profitableGroups: { $sum: { $cond: ['$isProfitable', 1, 0] } },
          totalSpend: { $sum: '$spendYesterday' },
          totalProfit: { $sum: '$profitYesterday' }
        }
      },
      {
        $project: {
          _id: 0,
          platform: '$_id.platform',
          productCategoryId: '$_id.productCategoryId',
          productCategoryName: 1,
          totalGroups: 1,
          profitableGroups: 1,
          unprofitableGroups: { $subtract: ['$totalGroups', '$profitableGroups'] },
          profitableRate: {
            $cond: [
              { $gt: ['$totalGroups', 0] },
              { $divide: ['$profitableGroups', '$totalGroups'] },
              0
            ]
          },
          kpiMet: { $gte: ['$profitableGroups', KPI_MIN_PROFITABLE_GROUPS_PER_PLATFORM_PRODUCT] },
          totalSpend: 1,
          totalProfit: 1
        }
      },
      { $sort: { platform: 1 as 1 | -1, productCategoryName: 1 as 1 | -1 } }
    ];

    return this.adjustmentModel.aggregate(pipeline);
  }

  // =============================================
  // PRIVATE HELPERS FOR DAILY SUGGESTIONS
  // =============================================

  private calculateSuggestedSpend(
    spendYesterday: number,
    avgSpendLast3Days: number,
    profitYesterday: number
  ): {
    suggestedSpend: number;
    suggestedSpendCapped: number;
    recommendation: 'increase' | 'maintain' | 'decrease' | 'pause';
    reason: string;
  } {
    const MIN_START_BUDGET = 60_000; // 60k VND cho nhóm mới (thống nhất với CFO Spec)
    const UPPER_CAP = 1.20; // Tăng tối đa 20%
    const LOWER_CAP = 0.70; // Giảm tối đa 30%

    // Baseline spend (xử lý edge cases)
    const baselineSpend = Math.max(spendYesterday, avgSpendLast3Days, MIN_START_BUDGET);

    // Tính ROI
    const roi = spendYesterday > 0 ? profitYesterday / spendYesterday : 0;

    let suggestedSpend: number;
    let recommendation: 'increase' | 'maintain' | 'decrease' | 'pause';
    let reason: string;

    if (spendYesterday === 0 && avgSpendLast3Days === 0) {
      // Nhóm mới hoặc chưa chạy
      suggestedSpend = MIN_START_BUDGET;
      recommendation = 'maintain';
      reason = 'Nhóm mới - khởi động với ngân sách tối thiểu';
    } else if (roi > 0.5) {
      // ROI > 50% - có thể tăng
      suggestedSpend = Math.round(baselineSpend * 1.20);
      recommendation = 'increase';
      reason = `ROI ${(roi * 100).toFixed(0)}% > 50% - Nên tăng ngân sách`;
    } else if (roi > 0) {
      // 0 < ROI <= 50% - giữ nguyên hoặc tăng nhẹ
      suggestedSpend = Math.round(baselineSpend * 1.10);
      recommendation = 'maintain';
      reason = `ROI ${(roi * 100).toFixed(0)}% - Giữ ổn định`;
    } else if (roi > -0.3) {
      // -30% < ROI <= 0 - giảm
      suggestedSpend = Math.round(baselineSpend * 0.80);
      recommendation = 'decrease';
      reason = `Lỗ nhẹ (${(roi * 100).toFixed(0)}%) - Cần tối ưu`;
    } else {
      // ROI <= -30% - cắt lỗ
      suggestedSpend = Math.round(baselineSpend * 0.50);
      recommendation = 'pause';
      reason = `Lỗ nặng (${(roi * 100).toFixed(0)}%) - Xem xét tắt`;
    }

    // Apply cap: không tăng quá 20%, không giảm quá 30%
    const upperCap = Math.round(baselineSpend * UPPER_CAP);
    const lowerCap = Math.round(baselineSpend * LOWER_CAP);
    const suggestedSpendCapped = Math.max(lowerCap, Math.min(upperCap, suggestedSpend));

    return {
      suggestedSpend,
      suggestedSpendCapped,
      recommendation,
      reason
    };
  }

  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getYesterdayDateString(today?: string): string {
    const date = today ? new Date(today) : new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  private getDateStringDaysAgo(fromDate: string, days: number): string {
    const date = new Date(fromDate);
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  // =============================================
  // PROFITABLE STATS BY DAY / MONTHLY
  // =============================================

  /**
   * Lấy thống kê nhóm có lãi theo ngày, gộp theo platform + product
   * Nguồn dữ liệu: AdGroupDailyReport (không dùng adjustment)
   * @param fromDate Ngày bắt đầu (YYYY-MM-DD)
   * @param toDate Ngày kết thúc (YYYY-MM-DD)
   * @param employeeId (Optional) Lọc theo nhân viên
   */
  async getProfitableStatsByDay(
    fromDate: string,
    toDate: string,
    employeeId?: string
  ): Promise<{
    dailyStats: Array<{
      date: string;
      platform: string;
      productCategoryId: string;
      productCategoryName: string;
      totalGroups: number;
      profitableGroups: number;
      profitableRate: number;
      kpiMet: boolean;
    }>;
    summary: {
      totalDays: number;
      avgProfitableRate: number;
      totalPlatformProducts: number;
      avgKpiMetRate: number;
    };
  }> {
    // Tính ngày tạo tối thiểu (7 ngày trước fromDate để loại nhóm mới)
    const gracePeriodDays = 7;
    const fromDateObj = new Date(fromDate);
    const maxCreatedAt = new Date(fromDateObj.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

    const matchQuery: any = {
      date: { $gte: fromDate, $lte: toDate }
    };

    const pipeline: any[] = [
      { $match: matchQuery },
      // Lookup ad group để lấy productCategoryId và createdAt
      {
        $lookup: {
          from: 'adgroups',
          localField: 'adGroupId',
          foreignField: 'adGroupId',
          as: 'adGroup'
        }
      },
      { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
      // Lọc theo nhân viên nếu có
      ...(employeeId ? [{
        $match: { 'adGroup.assignedEmployeeId': new Types.ObjectId(employeeId) }
      }] : []),
      // Loại bỏ nhóm mới (createdAt < gracePeriod)
      {
        $match: {
          'adGroup.createdAt': { $lte: maxCreatedAt }
        }
      },
      // Lookup product category để lấy tên
      {
        $lookup: {
          from: 'productcategories',
          localField: 'adGroup.productCategoryId',
          foreignField: '_id',
          as: 'productCategory'
        }
      },
      { $unwind: { path: '$productCategory', preserveNullAndEmptyArrays: true } },
      // Group theo ngày + platform + productCategoryId
      {
        $group: {
          _id: {
            date: '$date',
            platform: '$adGroup.platform',
            productCategoryId: '$adGroup.productCategoryId'
          },
          productCategoryName: { $first: '$productCategory.name' },
          totalGroups: { $sum: 1 },
          profitableGroups: { 
            $sum: { $cond: [{ $gt: ['$netProfit', 0] }, 1, 0] } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id.date',
          platform: '$_id.platform',
          productCategoryId: { $toString: '$_id.productCategoryId' },
          productCategoryName: { $ifNull: ['$productCategoryName', 'Không xác định'] },
          totalGroups: 1,
          profitableGroups: 1,
          profitableRate: {
            $cond: [
              { $gt: ['$totalGroups', 0] },
              { $divide: ['$profitableGroups', '$totalGroups'] },
              0
            ]
          },
          kpiMet: { $gte: ['$profitableGroups', KPI_MIN_PROFITABLE_GROUPS_PER_PLATFORM_PRODUCT] }
        }
      },
      { $sort: { date: -1 as 1 | -1, platform: 1 as 1 | -1, productCategoryName: 1 as 1 | -1 } }
    ];

    const dailyStats = await this.reportModel.aggregate(pipeline);

    // Calculate summary
    const uniqueDates = new Set(dailyStats.map(s => s.date));
    const totalProfitableRate = dailyStats.reduce((sum, s) => sum + s.profitableRate, 0);
    const totalKpiMet = dailyStats.filter(s => s.kpiMet).length;

    return {
      dailyStats,
      summary: {
        totalDays: uniqueDates.size,
        avgProfitableRate: dailyStats.length > 0 ? totalProfitableRate / dailyStats.length : 0,
        totalPlatformProducts: dailyStats.length,
        avgKpiMetRate: dailyStats.length > 0 ? totalKpiMet / dailyStats.length : 0
      }
    };
  }

  /**
   * Lấy thống kê tỷ lệ nhóm có lãi trung bình theo tháng
   * Nguồn dữ liệu: AdGroupDailyReport (không dùng adjustment)
   * @param yearMonth Tháng (YYYY-MM)
   * @param employeeId (Optional) Lọc theo nhân viên
   */
  async getProfitableStatsMonthly(
    yearMonth: string,
    employeeId?: string
  ): Promise<{
    yearMonth: string;
    platformProductStats: Array<{
      platform: string;
      productCategoryId: string;
      productCategoryName: string;
      totalDays: number;
      avgProfitableGroups: number;
      avgTotalGroups: number;
      avgProfitableRate: number;
      daysKpiMet: number;
      kpiMetRate: number;
    }>;
    overallSummary: {
      avgProfitableRate: number;
      avgKpiMetRate: number;
      totalPlatformProducts: number;
      bestPlatformProduct: {
        platform: string;
        productCategoryName: string;
        avgProfitableRate: number;
      } | null;
      worstPlatformProduct: {
        platform: string;
        productCategoryName: string;
        avgProfitableRate: number;
      } | null;
    };
  }> {
    // Parse yearMonth to get date range
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${yearMonth}-${lastDayOfMonth.toString().padStart(2, '0')}`;

    // Tính ngày tạo tối thiểu (7 ngày trước startDate để loại nhóm mới)
    const gracePeriodDays = 7;
    const startDateObj = new Date(startDate);
    const maxCreatedAt = new Date(startDateObj.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

    const matchQuery: any = {
      date: { $gte: startDate, $lte: endDate }
    };

    const pipeline: any[] = [
      { $match: matchQuery },
      // Lookup ad group để lấy productCategoryId và createdAt
      {
        $lookup: {
          from: 'adgroups',
          localField: 'adGroupId',
          foreignField: 'adGroupId',
          as: 'adGroup'
        }
      },
      { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
      // Lọc theo nhân viên nếu có
      ...(employeeId ? [{
        $match: { 'adGroup.assignedEmployeeId': new Types.ObjectId(employeeId) }
      }] : []),
      // Loại bỏ nhóm mới (createdAt < gracePeriod)
      {
        $match: {
          'adGroup.createdAt': { $lte: maxCreatedAt }
        }
      },
      // Lookup product category để lấy tên
      {
        $lookup: {
          from: 'productcategories',
          localField: 'adGroup.productCategoryId',
          foreignField: '_id',
          as: 'productCategory'
        }
      },
      { $unwind: { path: '$productCategory', preserveNullAndEmptyArrays: true } },
      // Group by date + platform + product first
      {
        $group: {
          _id: {
            date: '$date',
            platform: '$adGroup.platform',
            productCategoryId: '$adGroup.productCategoryId'
          },
          productCategoryName: { $first: '$productCategory.name' },
          totalGroups: { $sum: 1 },
          profitableGroups: { 
            $sum: { $cond: [{ $gt: ['$netProfit', 0] }, 1, 0] } 
          }
        }
      },
      // Add kpiMet field for each day
      {
        $addFields: {
          kpiMet: { $gte: ['$profitableGroups', KPI_MIN_PROFITABLE_GROUPS_PER_PLATFORM_PRODUCT] }
        }
      },
      // Group by platform + product to get monthly average
      {
        $group: {
          _id: {
            platform: '$_id.platform',
            productCategoryId: '$_id.productCategoryId'
          },
          productCategoryName: { $first: '$productCategoryName' },
          totalDays: { $sum: 1 },
          totalProfitableGroups: { $sum: '$profitableGroups' },
          totalGroupsSum: { $sum: '$totalGroups' },
          daysKpiMet: { $sum: { $cond: ['$kpiMet', 1, 0] } }
        }
      },
      {
        $project: {
          _id: 0,
          platform: '$_id.platform',
          productCategoryId: { $toString: '$_id.productCategoryId' },
          productCategoryName: { $ifNull: ['$productCategoryName', 'Không xác định'] },
          totalDays: 1,
          avgProfitableGroups: { $divide: ['$totalProfitableGroups', '$totalDays'] },
          avgTotalGroups: { $divide: ['$totalGroupsSum', '$totalDays'] },
          avgProfitableRate: {
            $cond: [
              { $gt: ['$totalGroupsSum', 0] },
              { $divide: ['$totalProfitableGroups', '$totalGroupsSum'] },
              0
            ]
          },
          daysKpiMet: 1,
          kpiMetRate: { $divide: ['$daysKpiMet', '$totalDays'] }
        }
      },
      { $sort: { platform: 1 as 1 | -1, productCategoryName: 1 as 1 | -1 } }
    ];

    const platformProductStats = await this.reportModel.aggregate(pipeline);

    // Calculate overall summary
    const totalAvgProfitableRate = platformProductStats.reduce((sum, s) => sum + s.avgProfitableRate, 0);
    const totalKpiMetRate = platformProductStats.reduce((sum, s) => sum + s.kpiMetRate, 0);

    // Find best and worst
    let bestPlatformProduct = null;
    let worstPlatformProduct = null;

    if (platformProductStats.length > 0) {
      const sorted = [...platformProductStats].sort((a, b) => b.avgProfitableRate - a.avgProfitableRate);
      bestPlatformProduct = {
        platform: sorted[0].platform,
        productCategoryName: sorted[0].productCategoryName,
        avgProfitableRate: sorted[0].avgProfitableRate
      };
      worstPlatformProduct = {
        platform: sorted[sorted.length - 1].platform,
        productCategoryName: sorted[sorted.length - 1].productCategoryName,
        avgProfitableRate: sorted[sorted.length - 1].avgProfitableRate
      };
    }

    return {
      yearMonth,
      platformProductStats,
      overallSummary: {
        avgProfitableRate: platformProductStats.length > 0 ? totalAvgProfitableRate / platformProductStats.length : 0,
        avgKpiMetRate: platformProductStats.length > 0 ? totalKpiMetRate / platformProductStats.length : 0,
        totalPlatformProducts: platformProductStats.length,
        bestPlatformProduct,
        worstPlatformProduct
      }
    };
  }

  /**
   * Lấy trend tỷ lệ nhóm có lãi theo ngày (cho chart)
   * Nguồn dữ liệu: AdGroupDailyReport (không dùng adjustment)
   */
  async getProfitableRateTrend(
    fromDate: string,
    toDate: string,
    employeeId?: string
  ): Promise<Array<{
    date: string;
    totalGroups: number;
    profitableGroups: number;
    profitableRate: number;
    avgProfitableRate7Day: number;
  }>> {
    // Tính ngày tạo tối thiểu (7 ngày trước fromDate để loại nhóm mới)
    const gracePeriodDays = 7;
    const fromDateObj = new Date(fromDate);
    const maxCreatedAt = new Date(fromDateObj.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

    const matchQuery: any = {
      date: { $gte: fromDate, $lte: toDate }
    };

    const pipeline: any[] = [
      { $match: matchQuery },
      // Lookup ad group để lấy createdAt
      {
        $lookup: {
          from: 'adgroups',
          localField: 'adGroupId',
          foreignField: 'adGroupId',
          as: 'adGroup'
        }
      },
      { $unwind: { path: '$adGroup', preserveNullAndEmptyArrays: false } },
      // Lọc theo nhân viên nếu có
      ...(employeeId ? [{
        $match: { 'adGroup.assignedEmployeeId': new Types.ObjectId(employeeId) }
      }] : []),
      // Loại bỏ nhóm mới (createdAt < gracePeriod)
      {
        $match: {
          'adGroup.createdAt': { $lte: maxCreatedAt }
        }
      },
      {
        $group: {
          _id: '$date',
          totalGroups: { $sum: 1 },
          profitableGroups: { 
            $sum: { $cond: [{ $gt: ['$netProfit', 0] }, 1, 0] } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalGroups: 1,
          profitableGroups: 1,
          profitableRate: {
            $cond: [
              { $gt: ['$totalGroups', 0] },
              { $divide: ['$profitableGroups', '$totalGroups'] },
              0
            ]
          }
        }
      },
      { $sort: { date: 1 as 1 | -1 } }
    ];

    const dailyData = await this.reportModel.aggregate(pipeline);

    // Calculate 7-day moving average
    return dailyData.map((day, index) => {
      const start = Math.max(0, index - 6);
      const window = dailyData.slice(start, index + 1);
      const avg7Day = window.reduce((sum, d) => sum + d.profitableRate, 0) / window.length;
      
      return {
        ...day,
        avgProfitableRate7Day: avg7Day
      };
    });
  }
}
