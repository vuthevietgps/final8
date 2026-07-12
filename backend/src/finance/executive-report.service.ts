import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { CashflowSafetyService } from './cashflow-safety.service';
import { AdGroup } from '../ad-group/schemas/ad-group.schema';
import { AdGroupDailyReport } from './schemas/ad-group-daily-report.schema';

/**
 * Executive Report Service
 *
 * Generates daily executive reports with:
 * 1. Cashflow health summary (CSI, DSO, DPO, Return Rate)
 * 2. Ads performance summary (ROI, profit, cost)
 * 3. Scale decisions summary (killed, scaled up, scaled down)
 * 4. Warnings and alerts
 * 5. Projections and recommendations
 *
 * Report Schedule:
 * - Daily at 04:00 AM (after auto-scale at 02:00 AM and frequency sync at 03:00 AM)
 * - Weekly summary on Monday at 06:00 AM
 * - Monthly summary on 1st of month at 08:00 AM
 *
 * Output Formats:
 * - Console log (always)
 * - Database storage (for history)
 * - Email (TODO - skipped per user request)
 * - Slack/Teams webhook (TODO - optional)
 */
@Injectable()
export class ExecutiveReportService {
  private readonly logger = new Logger(ExecutiveReportService.name);

  constructor(
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroup>,
    @InjectModel(AdGroupDailyReport.name)
    private readonly reportModel: Model<AdGroupDailyReport>,
    private readonly cashflowSafety: CashflowSafetyService,
  ) {}

  /**
   * Daily executive report - runs at 09:30 AM (Asia/Ho_Chi_Minh).
   * Chạy sau FrequencySync (09:00) - tổng hợp đầy đủ dữ liệu ngày hôm qua cho CEO/CFO.
   */
  @Cron('30 9 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async runDailyReport() {
    this.logger.log('📊 Generating daily executive report...');

    try {
      const report = await this.generateDailyReport();
      await this.logReport(report, 'DAILY');

      this.logger.log('✅ Daily executive report completed');
    } catch (error) {
      this.logger.error(`❌ Daily report failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Weekly executive report - runs on Monday at 06:00 AM.
   */
  @Cron('0 6 * * 1')
  async runWeeklyReport() {
    this.logger.log('📊 Generating weekly executive report...');

    try {
      const report = await this.generateWeeklyReport();
      await this.logReport(report, 'WEEKLY');

      this.logger.log('✅ Weekly executive report completed');
    } catch (error) {
      this.logger.error(`❌ Weekly report failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Monthly executive report - runs on 1st of month at 08:00 AM.
   */
  @Cron('0 8 1 * *')
  async runMonthlyReport() {
    this.logger.log('📊 Generating monthly executive report...');

    try {
      const report = await this.generateMonthlyReport();
      await this.logReport(report, 'MONTHLY');

      this.logger.log('✅ Monthly executive report completed');
    } catch (error) {
      this.logger.error(`❌ Monthly report failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Generate daily executive report.
   */
  async generateDailyReport() {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    // 1. Cashflow Health
    const cashflowHealth = await this.cashflowSafety.getCashflowHealthDashboard();

    // 2. Ads Performance (yesterday)
    const adsPerformance = await this.getAdsPerformance(yesterday, today);

    // 3. Scale Decisions Summary
    const scaleDecisions = await this.getScaleDecisionsSummary();

    // 4. Active Alerts
    const alerts = this.extractAlerts(cashflowHealth);

    // 5. Projections
    const projectionData = {
      daysUntilCashout: cashflowHealth.daysUntilCashout,
      nextWeekBudget: this.calculateNextWeekBudget(adsPerformance),
      expectedRevenue: this.calculateExpectedRevenue(adsPerformance),
    };

    return {
      type: 'DAILY',
      date: today.toISOString().split('T')[0],
      cashflowHealth: {
        csi: cashflowHealth.CSI,
        csiStatus: cashflowHealth.cashflowRiskLevel,
        dso: cashflowHealth.DSO,
        dpo: cashflowHealth.DPO,
        returnRate: cashflowHealth.returnRate,
        totalCash: cashflowHealth.availableCash,
      },
      adsPerformance,
      scaleDecisions,
      alerts: {
        critical: alerts.filter(a => a.level === 'CRITICAL').length,
        danger: alerts.filter(a => a.level === 'DANGER').length,
        warning: alerts.filter(a => a.level === 'WARNING').length,
        details: alerts,
      },
      projections: projectionData,
      recommendations: this.generateRecommendations(cashflowHealth, adsPerformance),
    };
  }

  /**
   * Generate weekly executive report.
   */
  async generateWeeklyReport() {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const adsPerformance = await this.getAdsPerformance(weekAgo, today);
    const cashflowHealth = await this.cashflowSafety.getCashflowHealthDashboard();

    return {
      type: 'WEEKLY',
      period: {
        from: weekAgo.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      },
      summary: {
        totalAdsCost: adsPerformance.totalAdsCost,
        totalRevenue: adsPerformance.totalRevenue,
        totalProfit: adsPerformance.totalProfit,
        avgROI: adsPerformance.avgROI,
        activeAdGroups: adsPerformance.activeAdGroups,
      },
      cashflowHealth: {
        csi: cashflowHealth.CSI,
        dso: cashflowHealth.DSO,
        returnRate: cashflowHealth.returnRate,
      },
      topPerformers: await this.getTopPerformers(7),
      worstPerformers: await this.getWorstPerformers(7),
      recommendations: this.generateWeeklyRecommendations(adsPerformance, cashflowHealth),
    };
  }

  /**
   * Generate monthly executive report.
   */
  async generateMonthlyReport() {
    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const adsPerformance = await this.getAdsPerformance(monthAgo, today);
    const cashflowHealth = await this.cashflowSafety.getCashflowHealthDashboard();

    return {
      type: 'MONTHLY',
      period: {
        from: monthAgo.toISOString().split('T')[0],
        to: today.toISOString().split('T')[0],
      },
      summary: {
        totalAdsCost: adsPerformance.totalAdsCost,
        totalRevenue: adsPerformance.totalRevenue,
        totalProfit: adsPerformance.totalProfit,
        avgROI: adsPerformance.avgROI,
        totalOrders: adsPerformance.totalOrders,
        successRate: adsPerformance.successRate,
      },
      cashflowTrend: {
        csi: cashflowHealth.CSI,
        dso: cashflowHealth.DSO,
        returnRate: cashflowHealth.returnRate,
      },
      topPerformers: await this.getTopPerformers(30),
      growth: this.calculateGrowthMetrics(adsPerformance),
      recommendations: this.generateMonthlyRecommendations(adsPerformance, cashflowHealth),
    };
  }

  /**
   * Get ads performance for a date range.
   */
  private async getAdsPerformance(from: Date, to: Date) {
    const reports = await this.reportModel.aggregate([
      {
        $match: {
          date: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: null,
          totalAdsCost: { $sum: '$adsCost' },
          totalProfit: { $sum: '$netProfit' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalConversions: { $sum: '$conversions' },
          adGroupCount: { $addToSet: '$adGroupId' },
        },
      },
    ]);

    if (reports.length === 0) {
      return {
        totalAdsCost: 0,
        totalRevenue: 0,
        totalProfit: 0,
        avgROI: 0,
        totalOrders: 0,
        successRate: 0,
        activeAdGroups: 0,
      };
    }

    const data = reports[0];
    const totalRevenue = data.totalAdsCost + data.totalProfit;
    const avgROI = data.totalAdsCost > 0 ? (data.totalProfit / data.totalAdsCost) * 100 : 0;

    return {
      totalAdsCost: data.totalAdsCost,
      totalRevenue,
      totalProfit: data.totalProfit,
      avgROI: parseFloat(avgROI.toFixed(2)),
      totalImpressions: data.totalImpressions,
      totalClicks: data.totalClicks,
      totalConversions: data.totalConversions,
      totalOrders: data.totalConversions, // Approximate
      successRate: 85, // TODO: Calculate from TestOrder2
      activeAdGroups: data.adGroupCount.length,
    };
  }

  /**
   * Get scale decisions summary.
   */
  private async getScaleDecisionsSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const adGroups = await this.adGroupModel.find({
      updatedAt: { $gte: today },
    });

    // TODO: Track scale decisions in a separate collection
    // For now, estimate based on budget changes

    return {
      total: adGroups.length,
      killed: 0, // TODO: Count budget = 0
      scaledUp: 0, // TODO: Count budget increased
      scaledDown: 0, // TODO: Count budget decreased
      maintained: adGroups.length, // TODO: Count budget unchanged
    };
  }

  /**
   * Extract alerts from cashflow health.
   */
  private extractAlerts(cashflowHealth: any): any[] {
    const alerts = [];

    if (cashflowHealth.cashflowRiskLevel !== 'SAFE') {
      alerts.push({
        level: cashflowHealth.cashflowRiskLevel,
        type: 'CSI',
        message: `CSI ${cashflowHealth.CSI.toFixed(2)} - ${cashflowHealth.cashflowRiskLevel}`,
      });
    }

    if (cashflowHealth.DSO > 10) {
      alerts.push({
        level: cashflowHealth.DSO > 15 ? 'CRITICAL' : 'DANGER',
        type: 'DSO',
        message: `DSO ${cashflowHealth.DSO.toFixed(1)} days - Collection too slow`,
      });
    }

    if (cashflowHealth.returnRate > 25) {
      alerts.push({
        level: cashflowHealth.returnRate > 35 ? 'CRITICAL' : 'DANGER',
        type: 'RETURN_RATE',
        message: `Return rate ${cashflowHealth.returnRate.toFixed(1)}%`,
      });
    }

    return alerts;
  }

  /**
   * Get top performing ad groups.
   */
  private async getTopPerformers(days: number) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const topPerformers = await this.reportModel.aggregate([
      {
        $match: {
          date: { $gte: from },
        },
      },
      {
        $group: {
          _id: '$adGroupId',
          totalProfit: { $sum: '$netProfit' },
          totalAdsCost: { $sum: '$adsCost' },
          avgROI: { $avg: '$roi' },
        },
      },
      {
        $sort: { totalProfit: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    return topPerformers;
  }

  /**
   * Get worst performing ad groups.
   */
  private async getWorstPerformers(days: number) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const worstPerformers = await this.reportModel.aggregate([
      {
        $match: {
          date: { $gte: from },
        },
      },
      {
        $group: {
          _id: '$adGroupId',
          totalProfit: { $sum: '$netProfit' },
          totalAdsCost: { $sum: '$adsCost' },
          avgROI: { $avg: '$roi' },
        },
      },
      {
        $sort: { avgROI: 1 },
      },
      {
        $limit: 5,
      },
    ]);

    return worstPerformers;
  }

  /**
   * Calculate next week budget projection.
   */
  private calculateNextWeekBudget(adsPerformance: any): number {
    // Simple projection: current daily avg * 7 days
    return adsPerformance.totalAdsCost * 7;
  }

  /**
   * Calculate expected revenue.
   */
  private calculateExpectedRevenue(adsPerformance: any): number {
    return adsPerformance.totalRevenue * 7;
  }

  /**
   * Calculate growth metrics.
   */
  private calculateGrowthMetrics(adsPerformance: any) {
    // TODO: Compare with previous period
    return {
      revenueGrowth: 0,
      profitGrowth: 0,
      roiGrowth: 0,
    };
  }

  /**
   * Generate daily recommendations.
   */
  private generateRecommendations(cashflowHealth: any, adsPerformance: any): string[] {
    const recommendations: string[] = [];

    if (cashflowHealth.csi.status === 'CRITICAL') {
      recommendations.push('🚨 URGENT: CSI critical - Reduce ads budget by 50-70%');
    }

    if (cashflowHealth.dso.dso > 10) {
      recommendations.push('⚠️ DSO high - Focus on collecting receivables');
    }

    if (cashflowHealth.returnRate.returnRate > 25) {
      recommendations.push('⚠️ High return rate - Review product quality and logistics');
    }

    if (adsPerformance.avgROI < 100) {
      recommendations.push('📉 Low ROI - Consider pausing underperforming ad groups');
    }

    if (adsPerformance.avgROI > 200) {
      recommendations.push('📈 High ROI - Consider scaling up top performers');
    }

    return recommendations;
  }

  /**
   * Generate weekly recommendations.
   */
  private generateWeeklyRecommendations(adsPerformance: any, cashflowHealth: any): string[] {
    const recommendations: string[] = [];

    if (adsPerformance.avgROI > 150) {
      recommendations.push('✅ Strong performance - Continue current strategy');
    }

    if (cashflowHealth.csi.csi > 1.5) {
      recommendations.push('💰 Healthy cashflow - Safe to explore new ad groups');
    }

    return recommendations;
  }

  /**
   * Generate monthly recommendations.
   */
  private generateMonthlyRecommendations(adsPerformance: any, cashflowHealth: any): string[] {
    const recommendations: string[] = [];

    recommendations.push('📊 Review and optimize top 20% performers');
    recommendations.push('🔍 Analyze bottom 20% for kill/optimization');

    return recommendations;
  }

  /**
   * Log report to console and optionally to database.
   */
  private async logReport(report: any, type: string) {
    const separator = '='.repeat(80);

    this.logger.log(`\n${separator}`);
    this.logger.log(`📊 ${type} EXECUTIVE REPORT - ${report.date || report.period?.to}`);
    this.logger.log(separator);

    if (type === 'DAILY') {
      this.logger.log(`\n💰 CASHFLOW HEALTH:`);
      this.logger.log(`   CSI: ${report.cashflowHealth.csi.toFixed(2)} (${report.cashflowHealth.csiStatus})`);
      this.logger.log(`   DSO: ${report.cashflowHealth.dso.toFixed(1)} days`);
      this.logger.log(`   DPO: ${report.cashflowHealth.dpo.toFixed(1)} days`);
      this.logger.log(`   Return Rate: ${report.cashflowHealth.returnRate.toFixed(1)}%`);
      this.logger.log(`   Total Cash: ${(report.cashflowHealth.totalCash / 1000000).toFixed(1)}M VND`);

      this.logger.log(`\n📈 ADS PERFORMANCE:`);
      this.logger.log(`   Ads Cost: ${(report.adsPerformance.totalAdsCost / 1000000).toFixed(1)}M VND`);
      this.logger.log(`   Revenue: ${(report.adsPerformance.totalRevenue / 1000000).toFixed(1)}M VND`);
      this.logger.log(`   Profit: ${(report.adsPerformance.totalProfit / 1000000).toFixed(1)}M VND`);
      this.logger.log(`   ROI: ${report.adsPerformance.avgROI.toFixed(1)}%`);
      this.logger.log(`   Active Ad Groups: ${report.adsPerformance.activeAdGroups}`);

      this.logger.log(`\n⚠️ ALERTS:`);
      this.logger.log(`   Critical: ${report.alerts.critical}`);
      this.logger.log(`   Danger: ${report.alerts.danger}`);
      this.logger.log(`   Warning: ${report.alerts.warning}`);

      if (report.recommendations && report.recommendations.length > 0) {
        this.logger.log(`\n💡 RECOMMENDATIONS:`);
        report.recommendations.forEach((rec: string) => {
          this.logger.log(`   ${rec}`);
        });
      }
    }

    this.logger.log(`\n${separator}\n`);

    // TODO: Save to database for history
  }

  /**
   * Manual trigger for generating report.
   */
  async generateManualReport(type: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'DAILY') {
    this.logger.log(`📊 Manual report requested: ${type}`);

    let report: any;

    switch (type) {
      case 'DAILY':
        report = await this.generateDailyReport();
        break;
      case 'WEEKLY':
        report = await this.generateWeeklyReport();
        break;
      case 'MONTHLY':
        report = await this.generateMonthlyReport();
        break;
    }

    await this.logReport(report, type);

    return report;
  }
}
