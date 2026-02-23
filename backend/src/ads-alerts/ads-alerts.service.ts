/**
 * File: ads-alerts/ads-alerts.service.ts
 * Mục đích: Service chính xử lý logic Ads Alerts
 * - Kiểm tra ad groups cần attention
 * - Tạo alerts dựa trên ROI, CSI, budget
 * - Cron job chạy định kỳ
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdsAlertsEventsService, AdsAlert, AlertType, AlertCategory } from './ads-alerts-events.service';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { TestOrder2, TestOrder2Document } from '../test-order2/schemas/test-order2.schema';

// Alert thresholds
const THRESHOLDS = {
  ROI_CRITICAL: 50,        // ROI < 50% → CRITICAL
  ROI_WARNING: 80,         // ROI < 80% → WARNING
  ROI_SCALE: 150,          // ROI > 150% → Scale candidate
  CSI_KILL: 0.7,           // CSI >= 0.7 → Kill candidate
  CSI_WARNING: 0.5,        // CSI >= 0.5 → Warning
  SPEND_HIGH: 500000,      // Spend > 500k → High spend alert
  LOSS_THRESHOLD: -100000, // Loss > 100k → Critical loss
};

interface AdGroupMetrics {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  spend: number;
  revenue: number;
  profit: number;
  roi: number;
  csi: number;
  orders: number;
}

@Injectable()
export class AdsAlertsService {
  private readonly logger = new Logger(AdsAlertsService.name);
  private isChecking = false;

  constructor(
    private alertsEventsService: AdsAlertsEventsService,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(TestOrder2.name) private orderModel: Model<TestOrder2Document>,
  ) {}

  /**
   * Cron job: Kiểm tra alerts mỗi 30 phút trong giờ làm việc
   * Chạy từ 8:00 - 22:00, mỗi 30 phút
   */
  @Cron('*/30 8-22 * * *', {
    name: 'ads-alerts-check',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async checkAlertsScheduled(): Promise<void> {
    await this.checkAlerts();
  }

  /**
   * Manual trigger: Kiểm tra alerts ngay lập tức
   */
  async checkAlerts(): Promise<{ alertsCreated: number; adGroupsChecked: number }> {
    if (this.isChecking) {
      this.logger.warn('Alert check already in progress, skipping...');
      return { alertsCreated: 0, adGroupsChecked: 0 };
    }

    this.isChecking = true;
    let alertsCreated = 0;

    try {
      this.logger.log('🔔 Starting Ads Alerts check...');

      // Get active ad groups
      const adGroups = await this.adGroupModel.find({ isActive: true })
        .populate('productCategoryId', 'name')
        .lean()
        .exec();

      // Get last 7 days data from orders aggregated by adGroupId
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const orderMetrics = await this.orderModel.aggregate([
        {
          $match: {
            isActive: { $ne: false },
            adGroupId: { $exists: true, $ne: null },
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: '$adGroupId',
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: { $ifNull: ['$codCollectedBySupplier', 0] } },
            totalProfit: { $sum: { $ifNull: ['$netProfit', 0] } },
            totalAdsSpent: { $sum: { $ifNull: ['$advertisingCost', 0] } },
          }
        }
      ]).exec();

      // Create a map from order metrics
      const orderMetricsMap = new Map<string, any>();
      for (const om of orderMetrics) {
        orderMetricsMap.set(om._id, om);
      }

      // Aggregate metrics per ad group
      const metricsMap = new Map<string, AdGroupMetrics>();

      for (const adGroup of adGroups) {
        const adGroupId = (adGroup as any).adGroupId;
        if (!adGroupId) continue;

        const orderData = orderMetricsMap.get(adGroupId);
        
        const spend = orderData?.totalAdsSpent || 0;
        const revenue = orderData?.totalRevenue || 0;
        const profit = orderData?.totalProfit || 0;
        const orders = orderData?.totalOrders || 0;
        // ROI = (Profit / Spend) * 100 (not ROAS which is Revenue/Spend)
        const roi = spend > 0 ? (profit / spend) * 100 : 0;
        
        // Calculate CSI (Composite Severity Index)
        // CSI combines multiple factors: low ROI, high spend, negative trend
        let csi = 0;
        if (roi < 100 && spend > 0) csi += (100 - roi) / 100 * 0.5;
        if (spend > THRESHOLDS.SPEND_HIGH) csi += 0.2;
        if (profit < 0) csi += Math.min(Math.abs(profit) / 500000, 0.3);
        csi = Math.min(csi, 1);

        metricsMap.set(adGroupId, {
          adGroupId,
          adGroupName: adGroup.name || 'Không tên',
          platform: adGroup.platform || 'unknown',
          spend,
          revenue,
          profit,
          roi,
          csi,
          orders,
        });
      }

      // Generate alerts based on metrics
      for (const [adGroupId, metrics] of metricsMap) {
        // Skip if no spend
        if (metrics.spend === 0) continue;

        const alerts = this.generateAlertsForAdGroup(metrics);
        for (const alertParams of alerts) {
          this.alertsEventsService.createAlert(alertParams);
          alertsCreated++;
        }
      }

      this.logger.log(`🔔 Ads Alerts check completed: ${alertsCreated} alerts created for ${metricsMap.size} ad groups`);

      return {
        alertsCreated,
        adGroupsChecked: metricsMap.size,
      };

    } catch (error) {
      this.logger.error('Error checking ads alerts:', error);
      throw error;
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Generate alerts for a single ad group based on its metrics
   */
  private generateAlertsForAdGroup(metrics: AdGroupMetrics): Omit<AdsAlert, 'id' | 'createdAt' | 'isRead'>[] {
    const alerts: Omit<AdsAlert, 'id' | 'createdAt' | 'isRead'>[] = [];
    
    // 1. Kill Alert: CSI >= 0.7
    if (metrics.csi >= THRESHOLDS.CSI_KILL) {
      alerts.push({
        type: 'CRITICAL',
        category: 'KILL',
        title: `🚨 Cần TẮT: ${metrics.adGroupName}`,
        message: `CSI: ${(metrics.csi * 100).toFixed(1)}%, ROI: ${metrics.roi.toFixed(1)}%, Lỗ: ${this.formatCurrency(metrics.profit)}`,
        adGroupId: metrics.adGroupId,
        adGroupName: metrics.adGroupName,
        platform: metrics.platform,
        metrics: {
          roi: metrics.roi,
          csi: metrics.csi,
          spend: metrics.spend,
          revenue: metrics.revenue,
          profit: metrics.profit,
        },
        action: {
          type: 'KILL',
          url: `/ad-groups?id=${metrics.adGroupId}`,
          label: 'Xem chi tiết',
        },
        expiresAt: this.getExpiryTime(4), // 4 hours
      });
    }
    // 2. ROI Critical: ROI < 50%
    else if (metrics.roi < THRESHOLDS.ROI_CRITICAL && metrics.spend > 100000) {
      alerts.push({
        type: 'CRITICAL',
        category: 'ROI',
        title: `⚠️ ROI rất thấp: ${metrics.adGroupName}`,
        message: `ROI chỉ ${metrics.roi.toFixed(1)}% với chi phí ${this.formatCurrency(metrics.spend)}. Xem xét tắt hoặc tối ưu.`,
        adGroupId: metrics.adGroupId,
        adGroupName: metrics.adGroupName,
        platform: metrics.platform,
        metrics: {
          roi: metrics.roi,
          spend: metrics.spend,
          revenue: metrics.revenue,
          profit: metrics.profit,
        },
        action: {
          type: 'REVIEW',
          url: `/ad-groups?id=${metrics.adGroupId}`,
          label: 'Xem chi tiết',
        },
        expiresAt: this.getExpiryTime(6), // 6 hours
      });
    }
    // 3. ROI Warning: ROI < 80%
    else if (metrics.roi < THRESHOLDS.ROI_WARNING && metrics.spend > 50000) {
      alerts.push({
        type: 'WARNING',
        category: 'ROI',
        title: `📉 ROI thấp: ${metrics.adGroupName}`,
        message: `ROI ${metrics.roi.toFixed(1)}%. Cần theo dõi và tối ưu.`,
        adGroupId: metrics.adGroupId,
        adGroupName: metrics.adGroupName,
        platform: metrics.platform,
        metrics: {
          roi: metrics.roi,
          spend: metrics.spend,
          profit: metrics.profit,
        },
        action: {
          type: 'OPTIMIZE',
          url: `/ad-groups?id=${metrics.adGroupId}`,
          label: 'Tối ưu',
        },
        expiresAt: this.getExpiryTime(12), // 12 hours
      });
    }

    // 4. Scale Alert: ROI > 150%
    if (metrics.roi > THRESHOLDS.ROI_SCALE && metrics.orders >= 2) {
      alerts.push({
        type: 'SUCCESS',
        category: 'SCALE',
        title: `🚀 Scale: ${metrics.adGroupName}`,
        message: `ROI ${metrics.roi.toFixed(1)}%, ${metrics.orders} đơn. Có thể tăng ngân sách!`,
        adGroupId: metrics.adGroupId,
        adGroupName: metrics.adGroupName,
        platform: metrics.platform,
        metrics: {
          roi: metrics.roi,
          spend: metrics.spend,
          revenue: metrics.revenue,
          profit: metrics.profit,
        },
        action: {
          type: 'SCALE',
          url: `/ad-groups?id=${metrics.adGroupId}`,
          label: 'Tăng budget',
        },
        expiresAt: this.getExpiryTime(8), // 8 hours
      });
    }

    // 5. High Spend Alert
    if (metrics.spend > THRESHOLDS.SPEND_HIGH && metrics.roi < 100) {
      alerts.push({
        type: 'WARNING',
        category: 'BUDGET',
        title: `💸 Chi phí cao: ${metrics.adGroupName}`,
        message: `Đã chi ${this.formatCurrency(metrics.spend)} nhưng ROI chỉ ${metrics.roi.toFixed(1)}%`,
        adGroupId: metrics.adGroupId,
        adGroupName: metrics.adGroupName,
        platform: metrics.platform,
        metrics: {
          roi: metrics.roi,
          spend: metrics.spend,
          profit: metrics.profit,
        },
        action: {
          type: 'REVIEW',
          url: `/ad-groups?id=${metrics.adGroupId}`,
          label: 'Xem chi tiết',
        },
        expiresAt: this.getExpiryTime(6),
      });
    }

    return alerts;
  }

  /**
   * Get all current alerts
   */
  getAllAlerts(): AdsAlert[] {
    return this.alertsEventsService.getAllAlerts();
  }

  /**
   * Get alerts summary
   */
  getSummary(): {
    total: number;
    unread: number;
    critical: number;
    warning: number;
    info: number;
    success: number;
    byCategory: Record<string, number>;
  } {
    const alerts = this.alertsEventsService.getAllAlerts();
    
    const byCategory: Record<string, number> = {};
    for (const alert of alerts) {
      byCategory[alert.category] = (byCategory[alert.category] || 0) + 1;
    }

    return {
      total: alerts.length,
      unread: this.alertsEventsService.getUnreadCount(),
      critical: alerts.filter(a => a.type === 'CRITICAL').length,
      warning: alerts.filter(a => a.type === 'WARNING').length,
      info: alerts.filter(a => a.type === 'INFO').length,
      success: alerts.filter(a => a.type === 'SUCCESS').length,
      byCategory,
    };
  }

  /**
   * Mark alert as read
   */
  markAsRead(alertId: string): void {
    this.alertsEventsService.markAsRead(alertId);
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    this.alertsEventsService.markAllAsRead();
  }

  /**
   * Dismiss alert
   */
  dismissAlert(alertId: string): void {
    this.alertsEventsService.dismissAlert(alertId);
  }

  /**
   * Clear all alerts
   */
  clearAll(): void {
    this.alertsEventsService.clearAll();
  }

  // Helper methods
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  private getExpiryTime(hours: number): Date {
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + hours);
    return expiry;
  }
}
