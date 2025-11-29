/**
 * File: advanced-analytics.service.ts
 * Mục đích: Advanced Mathematical Models for Non-Linear Ad Cost Optimization
 */
import { Injectable, Logger } from '@nestjs/common';
import { AdGroupProfitService } from '../../ad-group-profit/ad-group-profit.service';

interface CostProfitDataPoint {
  cost: number;
  revenue: number;
  profit: number;
  date: string;
  adGroupId: string;
}

interface OptimizationResult {
  optimalCost: number;
  predictedProfit: number;
  confidence: number;
  model: string;
  marginalROI: number;
}

@Injectable()
export class AdvancedAnalyticsService {
  private readonly logger = new Logger(AdvancedAnalyticsService.name);

  constructor(
    private adGroupProfitService: AdGroupProfitService
  ) {}

  /**
   * 🧮 PHASE 1: Non-Linear Regression Models
   */
  
  // Model 1: Exponential Saturation Model
  // Revenue = a(1 - e^(-b * Cost))
  async fitExponentialSaturationModel(data: CostProfitDataPoint[]): Promise<{a: number, b: number, r2: number}> {
    try {
      // Prepare data for regression
      const costArray = data.map(d => d.cost);
      const revenueArray = data.map(d => d.revenue);
      
      // Initial parameter estimates using method of moments
      const maxRevenue = Math.max(...revenueArray);
      const avgCost = costArray.reduce((sum, c) => sum + c, 0) / costArray.length;
      
      let bestA = maxRevenue * 1.2; // Asymptotic limit slightly above max observed
      let bestB = 1 / avgCost; // Rate parameter
      let bestR2 = 0;
      
      // Grid search for optimal parameters
      for (let a = maxRevenue * 0.8; a <= maxRevenue * 2; a += maxRevenue * 0.1) {
        for (let b = 0.0001; b <= 0.01; b += 0.001) {
          const r2 = this.calculateR2Exponential(costArray, revenueArray, a, b);
          if (r2 > bestR2) {
            bestA = a;
            bestB = b;
            bestR2 = r2;
          }
        }
      }
      
      this.logger.log(`Exponential Model: a=${bestA.toFixed(2)}, b=${bestB.toFixed(6)}, R²=${bestR2.toFixed(3)}`);
      return { a: bestA, b: bestB, r2: bestR2 };
      
    } catch (error) {
      this.logger.error('Exponential model fitting failed:', error);
      return { a: 0, b: 0, r2: 0 };
    }
  }

  // Model 2: Quadratic Model  
  // Profit = a * Cost - b * Cost²
  async fitQuadraticModel(data: CostProfitDataPoint[]): Promise<{a: number, b: number, c: number, r2: number}> {
    try {
      const n = data.length;
      const sumX = data.reduce((sum, d) => sum + d.cost, 0);
      const sumY = data.reduce((sum, d) => sum + d.profit, 0);
      const sumX2 = data.reduce((sum, d) => sum + d.cost * d.cost, 0);
      const sumX3 = data.reduce((sum, d) => sum + Math.pow(d.cost, 3), 0);
      const sumX4 = data.reduce((sum, d) => sum + Math.pow(d.cost, 4), 0);
      const sumXY = data.reduce((sum, d) => sum + d.cost * d.profit, 0);
      const sumX2Y = data.reduce((sum, d) => sum + d.cost * d.cost * d.profit, 0);

      // Solve system: [X'X]β = X'Y using matrix operations
      const matrix = [
        [n, sumX, sumX2],
        [sumX, sumX2, sumX3],  
        [sumX2, sumX3, sumX4]
      ];
      const vector = [sumY, sumXY, sumX2Y];
      
      const coefficients = this.solveLinearSystem(matrix, vector);
      const [c, a, b] = coefficients; // y = c + ax + bx²
      
      // Calculate R²
      const r2 = this.calculateR2Quadratic(data, a, b, c);
      
      // Find optimal cost: d/dx(ax - bx²) = 0 → x = a/(2b)
      const optimalCost = b !== 0 ? a / (2 * Math.abs(b)) : 0;
      
      this.logger.log(`Quadratic Model: Profit = ${c.toFixed(2)} + ${a.toFixed(4)}*Cost - ${Math.abs(b).toFixed(8)}*Cost², R²=${r2.toFixed(3)}`);
      this.logger.log(`Theoretical optimal cost: ${optimalCost.toFixed(0)} VND`);
      
      return { a, b: Math.abs(b), c, r2 };
      
    } catch (error) {
      this.logger.error('Quadratic model fitting failed:', error);
      return { a: 0, b: 0, c: 0, r2: 0 };
    }
  }

  // Model 3: Log-Log Model
  // ln(Revenue) = a + b * ln(Cost)  
  async fitLogLogModel(data: CostProfitDataPoint[]): Promise<{a: number, b: number, r2: number}> {
    try {
      // Filter out zero/negative values for log transformation
      const validData = data.filter(d => d.cost > 0 && d.revenue > 0);
      
      if (validData.length < 5) {
        throw new Error('Insufficient valid data points for log-log model');
      }

      const n = validData.length;
      const lnCosts = validData.map(d => Math.log(d.cost));
      const lnRevenues = validData.map(d => Math.log(d.revenue));
      
      const sumLnX = lnCosts.reduce((sum, x) => sum + x, 0);
      const sumLnY = lnRevenues.reduce((sum, y) => sum + y, 0);
      const sumLnX2 = lnCosts.reduce((sum, x) => sum + x * x, 0);
      const sumLnXY = lnCosts.reduce((sum, x, i) => sum + x * lnRevenues[i], 0);
      
      // Linear regression on log-transformed data
      const b = (n * sumLnXY - sumLnX * sumLnY) / (n * sumLnX2 - sumLnX * sumLnX);
      const a = (sumLnY - b * sumLnX) / n;
      
      const r2 = this.calculateR2LogLog(lnCosts, lnRevenues, a, b);
      
      this.logger.log(`Log-Log Model: ln(Revenue) = ${a.toFixed(3)} + ${b.toFixed(3)} * ln(Cost), R²=${r2.toFixed(3)}`);
      
      // Elasticity interpretation
      if (b < 1) {
        this.logger.log(`💡 Elasticity=${b.toFixed(3)}: Diminishing returns detected (1% cost increase → ${(b*100).toFixed(1)}% revenue increase)`);
      }
      
      return { a, b, r2 };
      
    } catch (error) {
      this.logger.error('Log-log model fitting failed:', error);
      return { a: 0, b: 0, r2: 0 };
    }
  }

  /**
   * 🎯 OPTIMIZATION ENGINE: Find Optimal Cost
   */
  async findOptimalCost(adGroupId: string, daysBack: number = 30): Promise<OptimizationResult> {
    try {
      // 1. Collect historical data
      const historicalData = await this.collectHistoricalData(adGroupId, daysBack);
      
      if (historicalData.length < 10) {
        throw new Error(`Insufficient data: ${historicalData.length} points, need at least 10`);
      }
      
      // 2. Fit multiple models
      const exponentialModel = await this.fitExponentialSaturationModel(historicalData);
      const quadraticModel = await this.fitQuadraticModel(historicalData);
      const logLogModel = await this.fitLogLogModel(historicalData);
      
      // 3. Select best model based on R² and business logic
      const models = [
        { type: 'exponential', r2: exponentialModel.r2, params: exponentialModel },
        { type: 'quadratic', r2: quadraticModel.r2, params: quadraticModel },
        { type: 'loglog', r2: logLogModel.r2, params: logLogModel }
      ].sort((a, b) => b.r2 - a.r2);
      
      const bestModel = models[0];
      
      // 4. Calculate optimal cost based on best model
      let optimalCost = 0;
      let predictedProfit = 0;
      let marginalROI = 0;
      
      switch (bestModel.type) {
        case 'quadratic':
          const { a, b, c } = bestModel.params as any;
          optimalCost = a / (2 * b); // Analytical solution
          predictedProfit = c + a * optimalCost - b * optimalCost * optimalCost;
          marginalROI = a - 2 * b * optimalCost;
          break;
          
        case 'exponential':
          // Numerical optimization for exponential model
          optimalCost = await this.numericalOptimizationExponential(bestModel.params as any, historicalData);
          predictedProfit = this.predictProfitExponential(optimalCost, bestModel.params as any, historicalData);
          marginalROI = this.calculateMarginalROI(optimalCost, bestModel.params as any);
          break;
          
        case 'loglog':
          // For log-log, find cost where marginal revenue = marginal cost
          optimalCost = await this.numericalOptimizationLogLog(bestModel.params as any, historicalData);
          predictedProfit = this.predictProfitLogLog(optimalCost, bestModel.params as any, historicalData);
          marginalROI = this.calculateMarginalROILogLog(optimalCost, bestModel.params as any);
          break;
      }
      
      // 5. Apply business constraints
      const currentAvgCost = historicalData.reduce((sum, d) => sum + d.cost, 0) / historicalData.length;
      const maxAllowedChange = currentAvgCost * 0.5; // Max 50% change
      
      optimalCost = Math.max(
        currentAvgCost * 0.5, // Min 50% of current
        Math.min(optimalCost, currentAvgCost * 1.5) // Max 150% of current
      );
      
      const confidence = Math.min(bestModel.r2 * 100, 95); // Cap at 95%
      
      this.logger.log(`🎯 Optimal cost for ${adGroupId}: ${optimalCost.toFixed(0)} VND (${bestModel.type} model, R²=${bestModel.r2.toFixed(3)})`);
      
      return {
        optimalCost: Math.round(optimalCost),
        predictedProfit,
        confidence,
        model: bestModel.type,
        marginalROI
      };
      
    } catch (error) {
      this.logger.error(`Optimization failed for ${adGroupId}:`, error);
      
      // Fallback to simple average
      const historicalData = await this.collectHistoricalData(adGroupId, daysBack);
      const avgCost = historicalData.reduce((sum, d) => sum + d.cost, 0) / historicalData.length;
      
      return {
        optimalCost: Math.round(avgCost),
        predictedProfit: 0,
        confidence: 30, // Low confidence for fallback
        model: 'fallback_average',
        marginalROI: 0
      };
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private async collectHistoricalData(adGroupId: string, days: number): Promise<CostProfitDataPoint[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    const profitData = await this.adGroupProfitService.getAdGroupProfitReport({
      from: startDate.toISOString().split('T')[0],
      to: endDate.toISOString().split('T')[0]
    });
    
    return profitData
      .filter(d => d.adGroupId === adGroupId && d.adsCost > 0)
      .map(d => ({
        cost: d.adsCost,
        revenue: d.totalRevenue,
        profit: d.totalProfit,
        date: d.date,
        adGroupId: d.adGroupId
      }));
  }

  private calculateR2Exponential(costs: number[], revenues: number[], a: number, b: number): number {
    const predicted = costs.map(cost => a * (1 - Math.exp(-b * cost)));
    return this.calculateR2(revenues, predicted);
  }

  private calculateR2Quadratic(data: CostProfitDataPoint[], a: number, b: number, c: number): number {
    const predicted = data.map(d => c + a * d.cost - b * d.cost * d.cost);
    const actual = data.map(d => d.profit);
    return this.calculateR2(actual, predicted);
  }

  private calculateR2LogLog(lnCosts: number[], lnRevenues: number[], a: number, b: number): number {
    const predicted = lnCosts.map(lnCost => a + b * lnCost);
    return this.calculateR2(lnRevenues, predicted);
  }

  private calculateR2(actual: number[], predicted: number[]): number {
    const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
    
    const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
    const ssResidual = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
    
    return Math.max(0, 1 - (ssResidual / ssTotal));
  }

  private solveLinearSystem(matrix: number[][], vector: number[]): number[] {
    // Simple 3x3 matrix solver using Cramer's rule
    const det = this.determinant3x3(matrix);
    
    if (Math.abs(det) < 1e-10) {
      throw new Error('Matrix is singular');
    }
    
    const result: number[] = [];
    
    for (let i = 0; i < 3; i++) {
      const modifiedMatrix = matrix.map((row, j) => 
        row.map((val, k) => k === i ? vector[j] : val)
      );
      result.push(this.determinant3x3(modifiedMatrix) / det);
    }
    
    return result;
  }

  private determinant3x3(matrix: number[][]): number {
    const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
    return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  }

  private async numericalOptimizationExponential(params: any, data: CostProfitDataPoint[]): Promise<number> {
    // Simplified golden section search
    const avgCost = data.reduce((sum, d) => sum + d.cost, 0) / data.length;
    let left = avgCost * 0.1;
    let right = avgCost * 3;
    
    const phi = (1 + Math.sqrt(5)) / 2;
    
    for (let i = 0; i < 50; i++) {
      const x1 = right - (right - left) / phi;
      const x2 = left + (right - left) / phi;
      
      const profit1 = this.predictProfitExponential(x1, params, data);
      const profit2 = this.predictProfitExponential(x2, params, data);
      
      if (profit1 > profit2) {
        right = x2;
      } else {
        left = x1;
      }
      
      if (Math.abs(right - left) < 1) break;
    }
    
    return (left + right) / 2;
  }

  private predictProfitExponential(cost: number, params: any, data: CostProfitDataPoint[]): number {
    const { a, b } = params;
    const predictedRevenue = a * (1 - Math.exp(-b * cost));
    return predictedRevenue - cost;
  }

  private calculateMarginalROI(cost: number, params: any): number {
    const { a, b } = params;
    // Marginal revenue - marginal cost (which is 1)
    const marginalRevenue = a * b * Math.exp(-b * cost);
    return marginalRevenue - 1;
  }

  private async numericalOptimizationLogLog(params: any, data: CostProfitDataPoint[]): Promise<number> {
    // Similar golden section search for log-log model
    const avgCost = data.reduce((sum, d) => sum + d.cost, 0) / data.length;
    return avgCost; // Simplified - in practice, need full optimization
  }

  private predictProfitLogLog(cost: number, params: any, data: CostProfitDataPoint[]): number {
    const { a, b } = params;
    const predictedRevenue = Math.exp(a + b * Math.log(cost));
    return predictedRevenue - cost;
  }

  private calculateMarginalROILogLog(cost: number, params: any): number {
    const { a, b } = params;
    // Marginal revenue for log-log model
    const marginalRevenue = b * Math.exp(a + b * Math.log(cost)) / cost;
    return marginalRevenue - 1;
  }
}