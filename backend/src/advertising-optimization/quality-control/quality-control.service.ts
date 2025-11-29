/**
 * File: quality-control/quality-control.service.ts
 * Mục đích: Quality Control System cho AI Advertising Optimization
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeliveryStatusService } from '../../delivery-status/delivery-status.service';
import { AdGroupProfitService } from '../../ad-group-profit/ad-group-profit.service';
import { 
  PredictionAccuracy, 
  QualityMetrics, 
  SafetyCheck, 
  DeliveryMetrics 
} from '../shared/interfaces/quality-control.interface';

@Injectable()
export class QualityControlService {
  private readonly logger = new Logger(QualityControlService.name);
  
  // Quality control tracking
  private predictionAccuracyMap = new Map<string, PredictionAccuracy[]>();
  private qualityMetricsCache = new Map<string, QualityMetrics>();
  private lastQualityCheck = new Map<string, Date>();

  constructor(
    private adGroupProfitService: AdGroupProfitService,
    private deliveryStatusService: DeliveryStatusService
  ) {}

  /**
   * 🔍 VALIDATION: Validate past predictions cron job
   */
  @Cron('0 9 * * *', {
    name: 'validate-predictions',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async validatePastPredictions(): Promise<void> {
    this.logger.log('🔍 Validating past predictions...');

    try {
      // Lấy predictions từ 3 ngày trước chưa validate
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      for (const [adGroupId, predictions] of this.predictionAccuracyMap) {
        const unvalidated = predictions.filter(p => 
          !p.isValidated && p.predictionDate <= threeDaysAgoStr
        );

        for (const prediction of unvalidated) {
          await this.validateSinglePrediction(adGroupId, prediction);
        }
      }

      // Update quality metrics cache
      await this.updateQualityMetricsCache();

    } catch (error) {
      this.logger.error('Validation failed:', error);
    }
  }

  /**
   * 🛡️ SAFETY CHECK: Comprehensive safety assessment
   */
  async performSafetyCheck(adGroupId: string): Promise<SafetyCheck> {
    try {
      const reasons: string[] = [];
      let shouldPause = false;
      let shouldReduceBudget = false;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

      // 1. Check prediction accuracy
      const qualityMetrics = await this.getQualityMetrics(adGroupId);
      if (qualityMetrics.recentAccuracy < 50) {
        shouldPause = true;
        reasons.push('Độ chính xác dự đoán thấp (<50%)');
      }

      // 2. Check delivery success rate
      const deliveryMetrics = await this.getDeliveryMetrics(adGroupId);
      if (deliveryMetrics.successRate < 60) {
        shouldReduceBudget = true;
        reasons.push('Tỷ lệ giao hàng thành công thấp (<60%)');
      }

      // 3. Assess overall risk level
      if (deliveryMetrics.successRate < 40 || qualityMetrics.recentAccuracy < 30) {
        riskLevel = 'HIGH';
      } else if (deliveryMetrics.successRate < 70 || qualityMetrics.recentAccuracy < 60) {
        riskLevel = 'MEDIUM';
      }

      // 4. Market volatility check
      const recentVariability = await this.checkMarketVolatility(adGroupId);
      if (recentVariability > 0.3) {
        shouldReduceBudget = true;
        riskLevel = 'HIGH';
        reasons.push('Thị trường biến động cao');
      }

      return {
        shouldPause,
        shouldReduceBudget,
        riskLevel,
        reasons
      };

    } catch (error) {
      this.logger.error('Safety check failed:', error);
      // Default to safe mode on error
      return {
        shouldPause: true,
        shouldReduceBudget: true,
        riskLevel: 'HIGH',
        reasons: ['Lỗi hệ thống - chuyển sang chế độ an toàn']
      };
    }
  }

  /**
   * 📊 CREATE PREDICTION RECORD
   */
  async createPredictionRecord(adGroupId: string, analysis: any): Promise<void> {
    const prediction: PredictionAccuracy = {
      adGroupId,
      predictionDate: new Date().toISOString().split('T')[0],
      predictedProfit: analysis.expectedProfit || 0,
      confidence: analysis.confidence || 50,
      isValidated: false
    };

    // Lưu vào memory map (trong production sẽ lưu vào database)
    if (!this.predictionAccuracyMap.has(adGroupId)) {
      this.predictionAccuracyMap.set(adGroupId, []);
    }
    
    const predictions = this.predictionAccuracyMap.get(adGroupId)!;
    predictions.push(prediction);
    
    // Giữ chỉ 30 records gần nhất
    if (predictions.length > 30) {
      predictions.splice(0, predictions.length - 30);
    }
  }

  /**
   * 📈 GET DELIVERY METRICS
   */
  async getDeliveryMetrics(adGroupId: string): Promise<DeliveryMetrics> {
    try {
      // Simplified implementation - trong thực tế sẽ query test-order2
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Mock data - replace with actual query
      return {
        successRate: 75, // 75% success rate
        avgDeliveryDays: 2.5
      };

    } catch (error) {
      this.logger.error('Failed to get delivery metrics:', error);
      return { successRate: 50, avgDeliveryDays: 5 }; // Conservative defaults
    }
  }

  /**
   * 📊 GET QUALITY METRICS
   */
  async getQualityMetrics(adGroupId: string): Promise<QualityMetrics> {
    // Check cache first
    const cached = this.qualityMetricsCache.get(adGroupId);
    const lastCheck = this.lastQualityCheck.get(adGroupId);
    
    if (cached && lastCheck && (Date.now() - lastCheck.getTime()) < 3600000) { // 1 hour cache
      return cached;
    }

    // Calculate fresh metrics
    const predictions = this.predictionAccuracyMap.get(adGroupId) || [];
    const validated = predictions.filter(p => p.isValidated);
    
    const overallAccuracy = validated.length > 0
      ? validated.reduce((sum, p) => sum + (p.accuracyScore || 0), 0) / validated.length
      : 50;

    // Recent accuracy (last 7 predictions)
    const recent = validated.slice(-7);
    const recentAccuracy = recent.length > 0
      ? recent.reduce((sum, p) => sum + (p.accuracyScore || 0), 0) / recent.length
      : overallAccuracy;

    const riskScore = this.calculateRiskScore(overallAccuracy, recentAccuracy, predictions.length);

    const metrics: QualityMetrics = {
      overallAccuracy,
      recentAccuracy,
      predictionCount: predictions.length,
      validatedCount: validated.length,
      riskScore
    };

    // Update cache
    this.qualityMetricsCache.set(adGroupId, metrics);
    this.lastQualityCheck.set(adGroupId, new Date());

    return metrics;
  }

  /**
   * 📊 PUBLIC QUALITY CONTROL METHODS
   */
  async getAdGroupQualityReport(adGroupId: string): Promise<any> {
    const qualityMetrics = await this.getQualityMetrics(adGroupId);
    const deliveryMetrics = await this.getDeliveryMetrics(adGroupId);
    const safetyCheck = await this.performSafetyCheck(adGroupId);
    
    return {
      adGroupId,
      qualityMetrics,
      deliveryMetrics,
      safetyCheck,
      predictions: this.predictionAccuracyMap.get(adGroupId) || [],
      lastUpdated: new Date()
    };
  }

  async getSystemQualityOverview(): Promise<any> {
    const allAdGroups = Array.from(this.predictionAccuracyMap.keys());
    const reports = await Promise.all(
      allAdGroups.map(id => this.getAdGroupQualityReport(id))
    );
    
    const overallMetrics = {
      totalAdGroups: allAdGroups.length,
      avgAccuracy: reports.reduce((sum, r) => sum + r.qualityMetrics.recentAccuracy, 0) / reports.length || 0,
      highRiskCount: reports.filter(r => r.safetyCheck.riskLevel === 'HIGH').length,
      pausedCount: reports.filter(r => r.safetyCheck.shouldPause).length,
      systemHealth: 'GOOD' // Calculate based on overall metrics
    };
    
    return {
      overallMetrics,
      adGroupReports: reports
    };
  }

  // Private helper methods
  private async validateSinglePrediction(adGroupId: string, prediction: PredictionAccuracy): Promise<void> {
    try {
      // Lấy actual profit từ prediction date đến nay
      const fromDate = prediction.predictionDate;
      const toDate = new Date().toISOString().split('T')[0];

      const profitData = await this.adGroupProfitService.getAdGroupProfitReport({
        from: fromDate,
        to: toDate
      });

      const actualProfit = profitData
        .filter(p => p.adGroupId === adGroupId)
        .reduce((sum, p) => sum + p.totalProfit, 0);

      // Calculate accuracy score
      const accuracyScore = this.calculateAccuracyScore(prediction.predictedProfit, actualProfit);

      // Update prediction record
      prediction.actualProfit = actualProfit;
      prediction.accuracyScore = accuracyScore;
      prediction.isValidated = true;
      prediction.validatedAt = new Date();

      this.logger.log(`✅ Validated ${adGroupId}: ${accuracyScore}% accuracy`);

    } catch (error) {
      this.logger.error(`Failed to validate prediction for ${adGroupId}:`, error);
    }
  }

  private calculateAccuracyScore(predicted: number, actual: number): number {
    if (predicted === 0 && actual === 0) return 100;
    if (predicted === 0 || actual === 0) return 0;
    
    const error = Math.abs(predicted - actual) / Math.abs(actual);
    return Math.max(0, (1 - error) * 100);
  }

  private calculateRiskScore(overallAccuracy: number, recentAccuracy: number, sampleSize: number): number {
    let risk = 0;
    
    // Accuracy risk
    if (recentAccuracy < 50) risk += 40;
    else if (recentAccuracy < 70) risk += 20;
    
    // Sample size risk
    if (sampleSize < 10) risk += 30;
    else if (sampleSize < 20) risk += 15;
    
    // Trend risk (recent vs overall)
    const trend = recentAccuracy - overallAccuracy;
    if (trend < -10) risk += 20; // Deteriorating performance
    
    return Math.min(100, risk);
  }

  private async checkMarketVolatility(adGroupId: string): Promise<number> {
    // Simplified volatility check
    try {
      const recentData = await this.adGroupProfitService.getAdGroupProfitReport({
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      
      const adGroupData = recentData.filter(d => d.adGroupId === adGroupId);
      if (adGroupData.length < 3) return 0.1; // Low volatility if insufficient data
      
      const costs = adGroupData.map(d => d.adsCost);
      const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length;
      const variance = costs.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / costs.length;
      
      return Math.sqrt(variance) / (avg || 1); // Coefficient of variation
      
    } catch (error) {
      return 0.2; // Default moderate volatility
    }
  }

  private async updateQualityMetricsCache(): Promise<void> {
    // Update cache for all tracked ad groups
    for (const adGroupId of this.predictionAccuracyMap.keys()) {
      await this.getQualityMetrics(adGroupId); // This will update the cache
    }
  }
}