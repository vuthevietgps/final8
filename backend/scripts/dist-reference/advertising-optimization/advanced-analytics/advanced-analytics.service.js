"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AdvancedAnalyticsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvancedAnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const ad_group_profit_service_1 = require("../../ad-group-profit/ad-group-profit.service");
let AdvancedAnalyticsService = AdvancedAnalyticsService_1 = class AdvancedAnalyticsService {
    constructor(adGroupProfitService) {
        this.adGroupProfitService = adGroupProfitService;
        this.logger = new common_1.Logger(AdvancedAnalyticsService_1.name);
    }
    async fitExponentialSaturationModel(data) {
        try {
            const costArray = data.map(d => d.cost);
            const revenueArray = data.map(d => d.revenue);
            const maxRevenue = Math.max(...revenueArray);
            const avgCost = costArray.reduce((sum, c) => sum + c, 0) / costArray.length;
            let bestA = maxRevenue * 1.2;
            let bestB = 1 / avgCost;
            let bestR2 = 0;
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
        }
        catch (error) {
            this.logger.error('Exponential model fitting failed:', error);
            return { a: 0, b: 0, r2: 0 };
        }
    }
    async fitQuadraticModel(data) {
        try {
            const n = data.length;
            const sumX = data.reduce((sum, d) => sum + d.cost, 0);
            const sumY = data.reduce((sum, d) => sum + d.profit, 0);
            const sumX2 = data.reduce((sum, d) => sum + d.cost * d.cost, 0);
            const sumX3 = data.reduce((sum, d) => sum + Math.pow(d.cost, 3), 0);
            const sumX4 = data.reduce((sum, d) => sum + Math.pow(d.cost, 4), 0);
            const sumXY = data.reduce((sum, d) => sum + d.cost * d.profit, 0);
            const sumX2Y = data.reduce((sum, d) => sum + d.cost * d.cost * d.profit, 0);
            const matrix = [
                [n, sumX, sumX2],
                [sumX, sumX2, sumX3],
                [sumX2, sumX3, sumX4]
            ];
            const vector = [sumY, sumXY, sumX2Y];
            const coefficients = this.solveLinearSystem(matrix, vector);
            const [c, a, b] = coefficients;
            const r2 = this.calculateR2Quadratic(data, a, b, c);
            const optimalCost = b !== 0 ? a / (2 * Math.abs(b)) : 0;
            this.logger.log(`Quadratic Model: Profit = ${c.toFixed(2)} + ${a.toFixed(4)}*Cost - ${Math.abs(b).toFixed(8)}*Cost², R²=${r2.toFixed(3)}`);
            this.logger.log(`Theoretical optimal cost: ${optimalCost.toFixed(0)} VND`);
            return { a, b: Math.abs(b), c, r2 };
        }
        catch (error) {
            this.logger.error('Quadratic model fitting failed:', error);
            return { a: 0, b: 0, c: 0, r2: 0 };
        }
    }
    async fitLogLogModel(data) {
        try {
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
            const b = (n * sumLnXY - sumLnX * sumLnY) / (n * sumLnX2 - sumLnX * sumLnX);
            const a = (sumLnY - b * sumLnX) / n;
            const r2 = this.calculateR2LogLog(lnCosts, lnRevenues, a, b);
            this.logger.log(`Log-Log Model: ln(Revenue) = ${a.toFixed(3)} + ${b.toFixed(3)} * ln(Cost), R²=${r2.toFixed(3)}`);
            if (b < 1) {
                this.logger.log(`💡 Elasticity=${b.toFixed(3)}: Diminishing returns detected (1% cost increase → ${(b * 100).toFixed(1)}% revenue increase)`);
            }
            return { a, b, r2 };
        }
        catch (error) {
            this.logger.error('Log-log model fitting failed:', error);
            return { a: 0, b: 0, r2: 0 };
        }
    }
    async findOptimalCost(adGroupId, daysBack = 30) {
        try {
            const historicalData = await this.collectHistoricalData(adGroupId, daysBack);
            if (historicalData.length < 10) {
                throw new Error(`Insufficient data: ${historicalData.length} points, need at least 10`);
            }
            const exponentialModel = await this.fitExponentialSaturationModel(historicalData);
            const quadraticModel = await this.fitQuadraticModel(historicalData);
            const logLogModel = await this.fitLogLogModel(historicalData);
            const models = [
                { type: 'exponential', r2: exponentialModel.r2, params: exponentialModel },
                { type: 'quadratic', r2: quadraticModel.r2, params: quadraticModel },
                { type: 'loglog', r2: logLogModel.r2, params: logLogModel }
            ].sort((a, b) => b.r2 - a.r2);
            const bestModel = models[0];
            let optimalCost = 0;
            let predictedProfit = 0;
            let marginalROI = 0;
            switch (bestModel.type) {
                case 'quadratic':
                    const { a, b, c } = bestModel.params;
                    optimalCost = a / (2 * b);
                    predictedProfit = c + a * optimalCost - b * optimalCost * optimalCost;
                    marginalROI = a - 2 * b * optimalCost;
                    break;
                case 'exponential':
                    optimalCost = await this.numericalOptimizationExponential(bestModel.params, historicalData);
                    predictedProfit = this.predictProfitExponential(optimalCost, bestModel.params, historicalData);
                    marginalROI = this.calculateMarginalROI(optimalCost, bestModel.params);
                    break;
                case 'loglog':
                    optimalCost = await this.numericalOptimizationLogLog(bestModel.params, historicalData);
                    predictedProfit = this.predictProfitLogLog(optimalCost, bestModel.params, historicalData);
                    marginalROI = this.calculateMarginalROILogLog(optimalCost, bestModel.params);
                    break;
            }
            const currentAvgCost = historicalData.reduce((sum, d) => sum + d.cost, 0) / historicalData.length;
            const maxAllowedChange = currentAvgCost * 0.5;
            optimalCost = Math.max(currentAvgCost * 0.5, Math.min(optimalCost, currentAvgCost * 1.5));
            const confidence = Math.min(bestModel.r2 * 100, 95);
            this.logger.log(`🎯 Optimal cost for ${adGroupId}: ${optimalCost.toFixed(0)} VND (${bestModel.type} model, R²=${bestModel.r2.toFixed(3)})`);
            return {
                optimalCost: Math.round(optimalCost),
                predictedProfit,
                confidence,
                model: bestModel.type,
                marginalROI
            };
        }
        catch (error) {
            this.logger.error(`Optimization failed for ${adGroupId}:`, error);
            const historicalData = await this.collectHistoricalData(adGroupId, daysBack);
            const avgCost = historicalData.reduce((sum, d) => sum + d.cost, 0) / historicalData.length;
            return {
                optimalCost: Math.round(avgCost),
                predictedProfit: 0,
                confidence: 30,
                model: 'fallback_average',
                marginalROI: 0
            };
        }
    }
    async collectHistoricalData(adGroupId, days) {
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
    calculateR2Exponential(costs, revenues, a, b) {
        const predicted = costs.map(cost => a * (1 - Math.exp(-b * cost)));
        return this.calculateR2(revenues, predicted);
    }
    calculateR2Quadratic(data, a, b, c) {
        const predicted = data.map(d => c + a * d.cost - b * d.cost * d.cost);
        const actual = data.map(d => d.profit);
        return this.calculateR2(actual, predicted);
    }
    calculateR2LogLog(lnCosts, lnRevenues, a, b) {
        const predicted = lnCosts.map(lnCost => a + b * lnCost);
        return this.calculateR2(lnRevenues, predicted);
    }
    calculateR2(actual, predicted) {
        const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
        const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
        const ssResidual = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
        return Math.max(0, 1 - (ssResidual / ssTotal));
    }
    solveLinearSystem(matrix, vector) {
        const det = this.determinant3x3(matrix);
        if (Math.abs(det) < 1e-10) {
            throw new Error('Matrix is singular');
        }
        const result = [];
        for (let i = 0; i < 3; i++) {
            const modifiedMatrix = matrix.map((row, j) => row.map((val, k) => k === i ? vector[j] : val));
            result.push(this.determinant3x3(modifiedMatrix) / det);
        }
        return result;
    }
    determinant3x3(matrix) {
        const [[a, b, c], [d, e, f], [g, h, i]] = matrix;
        return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    }
    async numericalOptimizationExponential(params, data) {
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
            }
            else {
                left = x1;
            }
            if (Math.abs(right - left) < 1)
                break;
        }
        return (left + right) / 2;
    }
    predictProfitExponential(cost, params, data) {
        const { a, b } = params;
        const predictedRevenue = a * (1 - Math.exp(-b * cost));
        return predictedRevenue - cost;
    }
    calculateMarginalROI(cost, params) {
        const { a, b } = params;
        const marginalRevenue = a * b * Math.exp(-b * cost);
        return marginalRevenue - 1;
    }
    async numericalOptimizationLogLog(params, data) {
        const avgCost = data.reduce((sum, d) => sum + d.cost, 0) / data.length;
        return avgCost;
    }
    predictProfitLogLog(cost, params, data) {
        const { a, b } = params;
        const predictedRevenue = Math.exp(a + b * Math.log(cost));
        return predictedRevenue - cost;
    }
    calculateMarginalROILogLog(cost, params) {
        const { a, b } = params;
        const marginalRevenue = b * Math.exp(a + b * Math.log(cost)) / cost;
        return marginalRevenue - 1;
    }
};
exports.AdvancedAnalyticsService = AdvancedAnalyticsService;
exports.AdvancedAnalyticsService = AdvancedAnalyticsService = AdvancedAnalyticsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ad_group_profit_service_1.AdGroupProfitService])
], AdvancedAnalyticsService);
//# sourceMappingURL=advanced-analytics.service.js.map