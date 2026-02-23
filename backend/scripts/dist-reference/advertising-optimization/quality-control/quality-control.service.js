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
var QualityControlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityControlService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const delivery_status_service_1 = require("../../delivery-status/delivery-status.service");
const ad_group_profit_service_1 = require("../../ad-group-profit/ad-group-profit.service");
let QualityControlService = QualityControlService_1 = class QualityControlService {
    constructor(adGroupProfitService, deliveryStatusService) {
        this.adGroupProfitService = adGroupProfitService;
        this.deliveryStatusService = deliveryStatusService;
        this.logger = new common_1.Logger(QualityControlService_1.name);
        this.predictionAccuracyMap = new Map();
        this.qualityMetricsCache = new Map();
        this.lastQualityCheck = new Map();
    }
    async validatePastPredictions() {
        this.logger.log('🔍 Validating past predictions...');
        try {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
            for (const [adGroupId, predictions] of this.predictionAccuracyMap) {
                const unvalidated = predictions.filter(p => !p.isValidated && p.predictionDate <= threeDaysAgoStr);
                for (const prediction of unvalidated) {
                    await this.validateSinglePrediction(adGroupId, prediction);
                }
            }
            await this.updateQualityMetricsCache();
        }
        catch (error) {
            this.logger.error('Validation failed:', error);
        }
    }
    async performSafetyCheck(adGroupId) {
        try {
            const reasons = [];
            let shouldPause = false;
            let shouldReduceBudget = false;
            let riskLevel = 'LOW';
            const qualityMetrics = await this.getQualityMetrics(adGroupId);
            if (qualityMetrics.recentAccuracy < 50) {
                shouldPause = true;
                reasons.push('Độ chính xác dự đoán thấp (<50%)');
            }
            const deliveryMetrics = await this.getDeliveryMetrics(adGroupId);
            if (deliveryMetrics.successRate < 60) {
                shouldReduceBudget = true;
                reasons.push('Tỷ lệ giao hàng thành công thấp (<60%)');
            }
            if (deliveryMetrics.successRate < 40 || qualityMetrics.recentAccuracy < 30) {
                riskLevel = 'HIGH';
            }
            else if (deliveryMetrics.successRate < 70 || qualityMetrics.recentAccuracy < 60) {
                riskLevel = 'MEDIUM';
            }
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
        }
        catch (error) {
            this.logger.error('Safety check failed:', error);
            return {
                shouldPause: true,
                shouldReduceBudget: true,
                riskLevel: 'HIGH',
                reasons: ['Lỗi hệ thống - chuyển sang chế độ an toàn']
            };
        }
    }
    async createPredictionRecord(adGroupId, analysis) {
        const prediction = {
            adGroupId,
            predictionDate: new Date().toISOString().split('T')[0],
            predictedProfit: analysis.expectedProfit || 0,
            confidence: analysis.confidence || 50,
            isValidated: false
        };
        if (!this.predictionAccuracyMap.has(adGroupId)) {
            this.predictionAccuracyMap.set(adGroupId, []);
        }
        const predictions = this.predictionAccuracyMap.get(adGroupId);
        predictions.push(prediction);
        if (predictions.length > 30) {
            predictions.splice(0, predictions.length - 30);
        }
    }
    async getDeliveryMetrics(adGroupId) {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return {
                successRate: 75,
                avgDeliveryDays: 2.5
            };
        }
        catch (error) {
            this.logger.error('Failed to get delivery metrics:', error);
            return { successRate: 50, avgDeliveryDays: 5 };
        }
    }
    async getQualityMetrics(adGroupId) {
        const cached = this.qualityMetricsCache.get(adGroupId);
        const lastCheck = this.lastQualityCheck.get(adGroupId);
        if (cached && lastCheck && (Date.now() - lastCheck.getTime()) < 3600000) {
            return cached;
        }
        const predictions = this.predictionAccuracyMap.get(adGroupId) || [];
        const validated = predictions.filter(p => p.isValidated);
        const overallAccuracy = validated.length > 0
            ? validated.reduce((sum, p) => sum + (p.accuracyScore || 0), 0) / validated.length
            : 50;
        const recent = validated.slice(-7);
        const recentAccuracy = recent.length > 0
            ? recent.reduce((sum, p) => sum + (p.accuracyScore || 0), 0) / recent.length
            : overallAccuracy;
        const riskScore = this.calculateRiskScore(overallAccuracy, recentAccuracy, predictions.length);
        const metrics = {
            overallAccuracy,
            recentAccuracy,
            predictionCount: predictions.length,
            validatedCount: validated.length,
            riskScore
        };
        this.qualityMetricsCache.set(adGroupId, metrics);
        this.lastQualityCheck.set(adGroupId, new Date());
        return metrics;
    }
    async getAdGroupQualityReport(adGroupId) {
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
    async getSystemQualityOverview() {
        const allAdGroups = Array.from(this.predictionAccuracyMap.keys());
        const reports = await Promise.all(allAdGroups.map(id => this.getAdGroupQualityReport(id)));
        const overallMetrics = {
            totalAdGroups: allAdGroups.length,
            avgAccuracy: reports.reduce((sum, r) => sum + r.qualityMetrics.recentAccuracy, 0) / reports.length || 0,
            highRiskCount: reports.filter(r => r.safetyCheck.riskLevel === 'HIGH').length,
            pausedCount: reports.filter(r => r.safetyCheck.shouldPause).length,
            systemHealth: 'GOOD'
        };
        return {
            overallMetrics,
            adGroupReports: reports
        };
    }
    async validateSinglePrediction(adGroupId, prediction) {
        try {
            const fromDate = prediction.predictionDate;
            const toDate = new Date().toISOString().split('T')[0];
            const profitData = await this.adGroupProfitService.getAdGroupProfitReport({
                from: fromDate,
                to: toDate
            });
            const actualProfit = profitData
                .filter(p => p.adGroupId === adGroupId)
                .reduce((sum, p) => sum + p.totalProfit, 0);
            const accuracyScore = this.calculateAccuracyScore(prediction.predictedProfit, actualProfit);
            prediction.actualProfit = actualProfit;
            prediction.accuracyScore = accuracyScore;
            prediction.isValidated = true;
            prediction.validatedAt = new Date();
            this.logger.log(`✅ Validated ${adGroupId}: ${accuracyScore}% accuracy`);
        }
        catch (error) {
            this.logger.error(`Failed to validate prediction for ${adGroupId}:`, error);
        }
    }
    calculateAccuracyScore(predicted, actual) {
        if (predicted === 0 && actual === 0)
            return 100;
        if (predicted === 0 || actual === 0)
            return 0;
        const error = Math.abs(predicted - actual) / Math.abs(actual);
        return Math.max(0, (1 - error) * 100);
    }
    calculateRiskScore(overallAccuracy, recentAccuracy, sampleSize) {
        let risk = 0;
        if (recentAccuracy < 50)
            risk += 40;
        else if (recentAccuracy < 70)
            risk += 20;
        if (sampleSize < 10)
            risk += 30;
        else if (sampleSize < 20)
            risk += 15;
        const trend = recentAccuracy - overallAccuracy;
        if (trend < -10)
            risk += 20;
        return Math.min(100, risk);
    }
    async checkMarketVolatility(adGroupId) {
        try {
            const recentData = await this.adGroupProfitService.getAdGroupProfitReport({
                from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });
            const adGroupData = recentData.filter(d => d.adGroupId === adGroupId);
            if (adGroupData.length < 3)
                return 0.1;
            const costs = adGroupData.map(d => d.adsCost);
            const avg = costs.reduce((sum, c) => sum + c, 0) / costs.length;
            const variance = costs.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / costs.length;
            return Math.sqrt(variance) / (avg || 1);
        }
        catch (error) {
            return 0.2;
        }
    }
    async updateQualityMetricsCache() {
        for (const adGroupId of this.predictionAccuracyMap.keys()) {
            await this.getQualityMetrics(adGroupId);
        }
    }
};
exports.QualityControlService = QualityControlService;
__decorate([
    (0, schedule_1.Cron)('0 9 * * *', {
        name: 'validate-predictions',
        timeZone: 'Asia/Ho_Chi_Minh',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QualityControlService.prototype, "validatePastPredictions", null);
exports.QualityControlService = QualityControlService = QualityControlService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ad_group_profit_service_1.AdGroupProfitService,
        delivery_status_service_1.DeliveryStatusService])
], QualityControlService);
//# sourceMappingURL=quality-control.service.js.map