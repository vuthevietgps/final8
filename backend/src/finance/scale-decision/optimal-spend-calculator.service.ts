/**
 * Optimal Spend Calculator Service
 * 
 * Tính toán chi phí quảng cáo tối ưu dựa trên mối quan hệ PHI TUYẾN
 * giữa chi phí (spend) và lợi nhuận (profit).
 * 
 * ## Nguyên lý:
 * - Lợi nhuận KHÔNG tuyến tính với chi phí
 * - Tồn tại điểm "diminishing returns" - lợi nhuận biên giảm dần
 * - Quá điểm này, tăng spend sẽ giảm ROI
 * 
 * ## Mô hình toán học:
 * profit(spend) = a * ln(spend + b) + c
 * Trong đó:
 * - a: Hệ số tăng trưởng
 * - b: Điểm khởi đầu (để tránh ln(0))
 * - c: Hằng số điều chỉnh
 * 
 * ## ROI biên (Marginal ROI):
 * marginalROI = d(profit)/d(spend) = a / (spend + b)
 * 
 * Điểm tối ưu là khi marginalROI = 1 (mỗi đồng chi thêm sinh ra đúng 1 đồng lời)
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroupDailyReport, AdGroupDailyReportDocument } from '../schemas/ad-group-daily-report.schema';
import { OptimalSpendResult, SpendProfitDataPoint } from './interfaces';

// Constants
const MIN_DATA_POINTS = 7;  // Cần ít nhất 7 ngày data
const MAX_SAFE_INCREASE_RATE = 0.20;  // 20% max increase
const MIN_MARGINAL_ROI = 0.5;  // Ngừng scale khi marginal ROI < 50%
const TARGET_MARGINAL_ROI = 1.0;  // Điểm tối ưu lý tưởng

@Injectable()
export class OptimalSpendCalculatorService {
  private readonly logger = new Logger(OptimalSpendCalculatorService.name);

  constructor(
    @InjectModel(AdGroupDailyReport.name)
    private readonly dailyReportModel: Model<AdGroupDailyReportDocument>,
  ) {}

  /**
   * Tính chi phí tối ưu cho một ad group
   * Sử dụng dữ liệu lịch sử để fit logarithmic curve
   */
  async calculateOptimalSpend(
    adGroupId: string,
    currentSpend: number,
    days: number = 30
  ): Promise<OptimalSpendResult> {
    try {
      // 1. Lấy dữ liệu lịch sử
      const dataPoints = await this.getHistoricalData(adGroupId, days);

      if (dataPoints.length < MIN_DATA_POINTS) {
        return this.createDefaultResult(currentSpend, dataPoints.length);
      }

      // 2. Fit logarithmic model: profit = a * ln(spend + b) + c
      const model = this.fitLogarithmicModel(dataPoints);

      if (!model.isValid) {
        return this.createLinearFallback(currentSpend, dataPoints);
      }

      // 3. Tính điểm optimal (marginal ROI = 1)
      const optimalSpend = this.calculateOptimalPoint(model);

      // 4. Tính marginal ROI tại current spend
      const marginalROI = this.calculateMarginalROI(model, currentSpend);

      // 5. Tính expected profit tại optimal spend
      const expectedProfit = this.predictProfit(model, optimalSpend);
      const expectedROI = optimalSpend > 0 ? (expectedProfit / optimalSpend) * 100 : 0;

      // 6. Tính diminishing returns point
      const diminishingReturnsPoint = this.calculateDiminishingReturnsPoint(model);

      // 7. Xác định recommendation
      const recommendation = this.determineRecommendation(
        currentSpend,
        optimalSpend,
        marginalROI,
        model
      );

      // 8. Tính safe scaling (max 20% increase)
      const safeMaxSpend = currentSpend * (1 + MAX_SAFE_INCREASE_RATE);
      const suggestedSpend = Math.min(optimalSpend, safeMaxSpend);

      return {
        optimalSpend,
        currentSpend,
        expectedProfit,
        expectedROI,
        confidence: model.confidence,
        diminishingReturnsPoint,
        marginalROI,
        recommendation: recommendation.action,
        reason: recommendation.reason,
        safeMaxSpend,
        suggestedSpend
      };
    } catch (error) {
      this.logger.error(`Failed to calculate optimal spend for ${adGroupId}:`, error);
      return this.createDefaultResult(currentSpend, 0);
    }
  }

  /**
   * Lấy dữ liệu lịch sử spend-profit
   */
  private async getHistoricalData(
    adGroupId: string,
    days: number
  ): Promise<SpendProfitDataPoint[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reports = await this.dailyReportModel
      .find({
        adGroupId,
        date: { $gte: startDate }
      })
      .sort({ date: 1 })
      .lean();

    return reports.map(r => ({
      spend: r.adsCost || 0,
      profit: r.netProfit || 0,
      orders: 0,  // Not available in daily report
      date: new Date(r.date)
    }));
  }

  /**
   * Fit logarithmic model: profit = a * ln(spend + b) + c
   * Sử dụng phương pháp least squares
   */
  private fitLogarithmicModel(dataPoints: SpendProfitDataPoint[]): {
    a: number;
    b: number;
    c: number;
    isValid: boolean;
    confidence: number;
    r2: number;
  } {
    // Filter out zero/negative spends
    const validPoints = dataPoints.filter(p => p.spend > 0);

    if (validPoints.length < MIN_DATA_POINTS) {
      return { a: 0, b: 1, c: 0, isValid: false, confidence: 0, r2: 0 };
    }

    // Assume b = 100000 (100k VND) for simplicity
    // This shifts the curve to handle small spends better
    const b = 100_000;

    // Transform to linear: profit = a * X + c, where X = ln(spend + b)
    const n = validPoints.length;
    const X = validPoints.map(p => Math.log(p.spend + b));
    const Y = validPoints.map(p => p.profit);

    // Calculate means
    const meanX = X.reduce((a, b) => a + b, 0) / n;
    const meanY = Y.reduce((a, b) => a + b, 0) / n;

    // Calculate slope (a) and intercept (c)
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (X[i] - meanX) * (Y[i] - meanY);
      denominator += (X[i] - meanX) ** 2;
    }

    if (denominator === 0) {
      return { a: 0, b, c: meanY, isValid: false, confidence: 0, r2: 0 };
    }

    const a = numerator / denominator;
    const c = meanY - a * meanX;

    // Calculate R² (coefficient of determination)
    const predictions = X.map(x => a * x + c);
    const ssRes = Y.reduce((sum, y, i) => sum + (y - predictions[i]) ** 2, 0);
    const ssTot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - (ssRes / ssTot) : 0;

    // Model is valid if a > 0 (profit increases with spend) and R² > 0.5
    const isValid = a > 0 && r2 > 0.3;
    const confidence = Math.min(r2 * 100, 95);

    return { a, b, c, isValid, confidence, r2 };
  }

  /**
   * Tính điểm optimal: marginal ROI = 1
   * marginalROI = a / (spend + b) = 1
   * → spend = a - b
   */
  private calculateOptimalPoint(model: { a: number; b: number }): number {
    const optimalSpend = model.a - model.b;
    
    // Ensure positive and reasonable
    if (optimalSpend <= 0) {
      return model.b;  // Fallback to minimum spend
    }
    
    return Math.round(optimalSpend);
  }

  /**
   * Tính marginal ROI tại một điểm spend
   * marginalROI = a / (spend + b)
   */
  private calculateMarginalROI(
    model: { a: number; b: number },
    spend: number
  ): number {
    if (spend + model.b <= 0) return 0;
    return model.a / (spend + model.b);
  }

  /**
   * Dự đoán profit tại một mức spend
   * profit = a * ln(spend + b) + c
   */
  private predictProfit(
    model: { a: number; b: number; c: number },
    spend: number
  ): number {
    if (spend + model.b <= 0) return model.c;
    return model.a * Math.log(spend + model.b) + model.c;
  }

  /**
   * Tính điểm diminishing returns
   * Định nghĩa: Điểm mà marginal ROI giảm xuống < 50%
   */
  private calculateDiminishingReturnsPoint(model: { a: number; b: number }): number {
    // marginalROI = a / (spend + b) = 0.5
    // → spend = 2a - b
    const drPoint = 2 * model.a - model.b;
    return Math.max(0, Math.round(drPoint));
  }

  /**
   * Xác định recommendation dựa trên phân tích
   */
  private determineRecommendation(
    currentSpend: number,
    optimalSpend: number,
    marginalROI: number,
    model: { a: number; b: number; c: number; isValid: boolean }
  ): { action: 'SCALE_UP' | 'SCALE_DOWN' | 'MAINTAIN' | 'KILL'; reason: string } {
    
    // KILL: Marginal ROI quá thấp hoặc model không hợp lệ với ROI âm
    if (marginalROI < 0 || (model.isValid && this.predictProfit(model, currentSpend) < 0)) {
      return {
        action: 'KILL',
        reason: `Marginal ROI ${(marginalROI * 100).toFixed(0)}% quá thấp, ads không sinh lời`
      };
    }

    // SCALE_DOWN: Đang chi quá điểm optimal
    if (currentSpend > optimalSpend * 1.2) {
      return {
        action: 'SCALE_DOWN',
        reason: `Đang chi ${(currentSpend / 1_000_000).toFixed(1)}M > Optimal ${(optimalSpend / 1_000_000).toFixed(1)}M. Giảm budget để tăng ROI.`
      };
    }

    // SCALE_DOWN: Marginal ROI < 50%
    if (marginalROI < MIN_MARGINAL_ROI) {
      return {
        action: 'SCALE_DOWN',
        reason: `Marginal ROI ${(marginalROI * 100).toFixed(0)}% < 50%. Đã qua điểm diminishing returns.`
      };
    }

    // MAINTAIN: Gần điểm optimal (±20%)
    if (currentSpend >= optimalSpend * 0.8 && currentSpend <= optimalSpend * 1.2) {
      return {
        action: 'MAINTAIN',
        reason: `Đang ở gần điểm optimal ${(optimalSpend / 1_000_000).toFixed(1)}M. Marginal ROI: ${(marginalROI * 100).toFixed(0)}%`
      };
    }

    // SCALE_UP: Đang chi dưới optimal và marginal ROI cao
    if (currentSpend < optimalSpend && marginalROI >= TARGET_MARGINAL_ROI) {
      return {
        action: 'SCALE_UP',
        reason: `Có thể scale lên ${(optimalSpend / 1_000_000).toFixed(1)}M. Marginal ROI: ${(marginalROI * 100).toFixed(0)}%`
      };
    }

    return {
      action: 'MAINTAIN',
      reason: 'Không có tín hiệu rõ ràng, giữ nguyên budget'
    };
  }

  /**
   * Fallback khi không đủ data cho logarithmic model
   * Sử dụng linear regression đơn giản
   */
  private createLinearFallback(
    currentSpend: number,
    dataPoints: SpendProfitDataPoint[]
  ): OptimalSpendResult {
    const validPoints = dataPoints.filter(p => p.spend > 0 && p.profit !== 0);

    if (validPoints.length === 0) {
      return this.createDefaultResult(currentSpend, 0);
    }

    // Simple average ROI
    const avgROI = validPoints.reduce((sum, p) => sum + (p.profit / p.spend), 0) / validPoints.length;
    const avgProfit = validPoints.reduce((sum, p) => sum + p.profit, 0) / validPoints.length;

    const recommendation = avgROI > 0.5 ? 'SCALE_UP' : avgROI < 0 ? 'KILL' : 'MAINTAIN';
    const safeMaxSpend = currentSpend * (1 + MAX_SAFE_INCREASE_RATE);

    return {
      optimalSpend: currentSpend,  // Can't determine optimal without enough data
      currentSpend,
      expectedProfit: avgProfit,
      expectedROI: avgROI * 100,
      confidence: 30,  // Low confidence
      diminishingReturnsPoint: currentSpend * 2,  // Estimate
      marginalROI: avgROI,
      recommendation,
      reason: `Chưa đủ data (${validPoints.length}/${MIN_DATA_POINTS} ngày). ROI trung bình: ${(avgROI * 100).toFixed(0)}%`,
      safeMaxSpend,
      suggestedSpend: currentSpend
    };
  }

  /**
   * Default result khi không có data
   */
  private createDefaultResult(currentSpend: number, dataCount: number): OptimalSpendResult {
    return {
      optimalSpend: currentSpend,
      currentSpend,
      expectedProfit: 0,
      expectedROI: 0,
      confidence: 0,
      diminishingReturnsPoint: currentSpend,
      marginalROI: 0,
      recommendation: 'MAINTAIN',
      reason: `Không đủ dữ liệu (${dataCount}/${MIN_DATA_POINTS} ngày) để tính toán chi phí tối ưu`,
      safeMaxSpend: currentSpend * (1 + MAX_SAFE_INCREASE_RATE),
      suggestedSpend: currentSpend
    };
  }

  /**
   * Batch calculate optimal spends cho nhiều ad groups
   */
  async calculateBatchOptimalSpends(
    adGroupIds: string[],
    currentSpends: Map<string, number>
  ): Promise<Map<string, OptimalSpendResult>> {
    const results = new Map<string, OptimalSpendResult>();

    for (const adGroupId of adGroupIds) {
      const currentSpend = currentSpends.get(adGroupId) || 0;
      const result = await this.calculateOptimalSpend(adGroupId, currentSpend);
      results.set(adGroupId, result);
    }

    return results;
  }
}
