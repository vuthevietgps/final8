import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdvertisingCostFacebookSyncService } from '../advertising-cost/advertising-cost.facebook-sync.service';
import { AdvertisingCostGoogleSyncService } from '../advertising-cost/advertising-cost.google-sync.service';
import { AdvertisingCostTiktokSyncService } from '../advertising-cost/advertising-cost.tiktok-sync.service';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';
import { AdGroupDailyReportService } from './ad-group-daily-report.service';

/**
 * Data Collection Service
 *
 * Responsible for the 24-hour cronjob pipeline:
 *
 * 00:00 - Data Collection Phase
 *   - Sync ads data from Facebook/Google/TikTok
 *   - Sync order data from TestOrder2
 *   - Sync receivables from AgentStatement
 *   - Sync payables from SupplierPayable
 *   - Update daily reports
 *
 * 01:00 - Metric Calculation Phase
 *   - Calculate CSI (Cashflow Safety Index)
 *   - Calculate DSO (Days Sales Outstanding)
 *   - Calculate DPO (Days Payable Outstanding)
 *   - Calculate Return Rate
 *   - Update ad group testing phases
 *
 * 02:00 - Decision & Execution Phase (handled by AutoScaleExecutionService)
 *   - Make scale/kill decisions
 *   - Execute budget changes
 *   - Update ad group status
 *
 * 03:00 - Frequency Sync Phase (handled by FrequencySyncService)
 *   - Sync frequency metrics from Facebook
 *   - Update ad group frequency data
 *
 * 04:00 - Report Generation Phase (handled by ExecutiveReportService)
 *   - Generate daily executive report
 *   - Send notifications (if enabled)
 *
 * This service manages the first two phases: Data Collection and Metric Calculation.
 */
@Injectable()
export class DataCollectionService {
  private readonly logger = new Logger(DataCollectionService.name);

  constructor(
    private readonly facebookSyncService: AdvertisingCostFacebookSyncService,
    private readonly googleSyncService: AdvertisingCostGoogleSyncService,
    private readonly tiktokSyncService: AdvertisingCostTiktokSyncService,
    private readonly orderCalculationService: OrderCalculationService,
    private readonly adGroupDailyReportService: AdGroupDailyReportService,
  ) {}

  /**
   * Phase 1: Data Collection - Runs at 06:00 AM (Asia/Ho_Chi_Minh)
   * Chạy sau khi nền tảng quảng cáo (FB/Google/TikTok) đã chốt số liệu qua đêm.
   * Collects all data from external sources and internal systems.
   */
  @Cron('0 6 * * *', {
    name: 'data-collection',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async runDataCollection() {
    this.logger.log('🔄 ========== PHASE 1: DATA COLLECTION (06:00) ==========');

    const startTime = Date.now();
    const yesterdayStr = this.getYesterdayIso();

    try {
      // 1. Chờ toàn bộ nền tảng sync xong trước khi tính phí.
      await this.syncAdsData(yesterdayStr);

      // 2. Chỉ phân bổ chi phí sau khi bước sync nền tảng đã hoàn tất.
      const recalculationResult = await this.orderCalculationService.recalculateOrdersForDate(yesterdayStr);
      this.logger.log(
        `✅ Bulk updated ${recalculationResult.updated} orders for ${recalculationResult.date} after ads sync.`,
      );

      // 3. Chốt báo cáo ad group daily sau khi order đã có advertisingCost chính xác.
      const reportResult = await this.adGroupDailyReportService.syncFromOrderTest2(yesterdayStr);
      this.logger.log(
        `✅ Ad group daily report synced for ${reportResult.date}: ${reportResult.recordsProcessed} records processed.`,
      );

      // 4. Sync receivables
      await this.syncReceivables();

      // 5. Sync payables
      await this.syncPayables();

      // 6. Update any remaining daily reports
      await this.updateDailyReports();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✅ Phase 1 completed in ${duration}s`);
    } catch (error) {
      this.logger.error(`❌ Phase 1 failed: ${error.message}`, error.stack);
    }
  }

  private getYesterdayIso(): string {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
    return targetDate.toISOString().split('T')[0];
  }

  /**
   * Phase 2: Metric Calculation - Runs at 07:30 AM (Asia/Ho_Chi_Minh)
   * Chạy sau khi Ads Cost đã sync xong (06:30) và RecalculationQueue debounce hoàn tất.
   * Calculates all metrics (CSI, DSO, DPO) needed for decision making.
   */
  @Cron('30 7 * * *', {
    name: 'metric-calculation',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async runMetricCalculation() {
    this.logger.log('🔄 ========== PHASE 2: METRIC CALCULATION (07:30) ==========');

    const startTime = Date.now();

    try {
      // 1. Pre-calculate CSI for all funding sources
      await this.calculateCSI();

      // 2. Pre-calculate DSO
      await this.calculateDSO();

      // 3. Pre-calculate DPO
      await this.calculateDPO();

      // 4. Pre-calculate Return Rate
      await this.calculateReturnRate();

      // 5. Update ad group testing phases
      await this.updateTestingPhases();

      // 6. Cache metrics for quick access during decision phase
      await this.cacheMetrics();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✅ Phase 2 completed in ${duration}s`);
    } catch (error) {
      this.logger.error(`❌ Phase 2 failed: ${error.message}`, error.stack);
    }
  }

  // ============================================
  // PHASE 1: DATA COLLECTION METHODS
  // ============================================

  /**
   * Sync ads data from Facebook/Google/TikTok APIs.
   */
  private async syncAdsData(dateStr: string) {
    this.logger.log('📊 Syncing ads data from platforms...');

    const results = await Promise.allSettled([
      this.facebookSyncService.syncForDate(dateStr),
      this.googleSyncService.syncForDate(dateStr),
      this.tiktokSyncService.syncForDate(dateStr),
    ]);

    const platforms = ['Facebook', 'Google', 'TikTok'];
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        this.logger.log(
          `   ✅ ${platforms[idx]} sync: ${result.value.updated} ad groups updated for ${dateStr}`,
        );
      } else {
        this.logger.error(
          `   ❌ ${platforms[idx]} sync failed: ${result.reason?.message}`,
        );
      }
    });
  }

  /**
   * Sync order data from TestOrder2.
   */
  private async syncOrderData() {
    this.logger.log('📦 Syncing order data...');

    try {
      // TODO: Query TestOrder2 for yesterday's orders
      // Calculate success rate, return rate, etc.

      this.logger.log('   ⚠️ Order data sync - TODO');
      this.logger.log('   ✅ Order data sync completed (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Order data sync failed: ${error.message}`);
    }
  }

  /**
   * Sync receivables from AgentStatement.
   */
  private async syncReceivables() {
    this.logger.log('💰 Syncing receivables...');

    try {
      // TODO: Query AgentStatement for open balances

      this.logger.log('   ⚠️ Receivables sync - TODO');
      this.logger.log('   ✅ Receivables sync completed (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Receivables sync failed: ${error.message}`);
    }
  }

  /**
   * Sync payables from SupplierPayable.
   */
  private async syncPayables() {
    this.logger.log('💸 Syncing payables...');

    try {
      // TODO: Query SupplierPayable for pending payments

      this.logger.log('   ⚠️ Payables sync - TODO');
      this.logger.log('   ✅ Payables sync completed (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Payables sync failed: ${error.message}`);
    }
  }

  /**
   * Update daily reports.
   */
  private async updateDailyReports() {
    this.logger.log('📈 Updating daily reports...');

    try {
      // TODO: Generate AdGroupDailyReport entries for yesterday

      this.logger.log('   ⚠️ Daily reports update - TODO');
      this.logger.log('   ✅ Daily reports updated (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Daily reports update failed: ${error.message}`);
    }
  }

  // ============================================
  // PHASE 2: METRIC CALCULATION METHODS
  // ============================================

  /**
   * Pre-calculate CSI (Cashflow Safety Index).
   */
  private async calculateCSI() {
    this.logger.log('💰 Calculating CSI...');

    try {
      // TODO: Calculate CSI using CashflowSafetyService
      // Cache result for decision phase

      this.logger.log('   ⚠️ CSI calculation - TODO');
      this.logger.log('   ✅ CSI calculated (mock)');
    } catch (error) {
      this.logger.error(`   ❌ CSI calculation failed: ${error.message}`);
    }
  }

  /**
   * Pre-calculate DSO (Days Sales Outstanding).
   */
  private async calculateDSO() {
    this.logger.log('📊 Calculating DSO...');

    try {
      // TODO: Calculate DSO using CashflowSafetyService

      this.logger.log('   ⚠️ DSO calculation - TODO');
      this.logger.log('   ✅ DSO calculated (mock)');
    } catch (error) {
      this.logger.error(`   ❌ DSO calculation failed: ${error.message}`);
    }
  }

  /**
   * Pre-calculate DPO (Days Payable Outstanding).
   */
  private async calculateDPO() {
    this.logger.log('💸 Calculating DPO...');

    try {
      // TODO: Calculate DPO using CashflowSafetyService

      this.logger.log('   ⚠️ DPO calculation - TODO');
      this.logger.log('   ✅ DPO calculated (mock)');
    } catch (error) {
      this.logger.error(`   ❌ DPO calculation failed: ${error.message}`);
    }
  }

  /**
   * Pre-calculate Return Rate.
   */
  private async calculateReturnRate() {
    this.logger.log('📦 Calculating return rate...');

    try {
      // TODO: Calculate return rate using CashflowSafetyService

      this.logger.log('   ⚠️ Return rate calculation - TODO');
      this.logger.log('   ✅ Return rate calculated (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Return rate calculation failed: ${error.message}`);
    }
  }

  /**
   * Update ad group testing phases based on daysSinceLaunch.
   */
  private async updateTestingPhases() {
    this.logger.log('🧪 Updating testing phases...');

    try {
      // TODO: Update testing phases using HorizontalScaleService.updateDaysSinceLaunch()

      this.logger.log('   ⚠️ Testing phase update - TODO');
      this.logger.log('   ✅ Testing phases updated (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Testing phase update failed: ${error.message}`);
    }
  }

  /**
   * Cache all calculated metrics for quick access during decision phase.
   */
  private async cacheMetrics() {
    this.logger.log('💾 Caching metrics...');

    try {
      // TODO: Store metrics in Redis or in-memory cache
      // This allows decision phase to run faster

      this.logger.log('   ⚠️ Metric caching - TODO');
      this.logger.log('   ✅ Metrics cached (mock)');
    } catch (error) {
      this.logger.error(`   ❌ Metric caching failed: ${error.message}`);
    }
  }

  // ============================================
  // MANUAL TRIGGER METHODS
  // ============================================

  /**
   * Manual trigger for data collection phase.
   */
  async runManualDataCollection() {
    this.logger.log('📊 Manual data collection triggered');
    await this.runDataCollection();
  }

  /**
   * Manual trigger for metric calculation phase.
   */
  async runManualMetricCalculation() {
    this.logger.log('📊 Manual metric calculation triggered');
    await this.runMetricCalculation();
  }

  /**
   * Get pipeline status.
   */
  async getPipelineStatus() {
    // TODO: Return last run times, success/failure status, etc.
    return {
      dataCollection: {
        lastRun: new Date().toISOString(),
        status: 'SUCCESS',
        duration: '45s',
      },
      metricCalculation: {
        lastRun: new Date().toISOString(),
        status: 'SUCCESS',
        duration: '12s',
      },
      autoScale: {
        lastRun: new Date().toISOString(),
        status: 'SUCCESS',
        duration: '180s',
      },
      frequencySync: {
        lastRun: new Date().toISOString(),
        status: 'SUCCESS',
        duration: '30s',
      },
      reportGeneration: {
        lastRun: new Date().toISOString(),
        status: 'SUCCESS',
        duration: '8s',
      },
    };
  }
}
