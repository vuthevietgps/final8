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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AIOptimizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIOptimizationService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("mongoose");
const mongoose_2 = require("@nestjs/mongoose");
const openai_config_service_1 = require("../../openai-config/openai-config.service");
const ad_group_profit_service_1 = require("../../ad-group-profit/ad-group-profit.service");
const quality_control_service_1 = require("../quality-control/quality-control.service");
const advertising_cost_suggestion_schema_1 = require("../../advertising-cost-suggestion/schemas/advertising-cost-suggestion.schema");
const advanced_analytics_service_1 = require("../advanced-analytics/advanced-analytics.service");
const ml_optimization_service_1 = require("../advanced-analytics/ml-optimization.service");
let AIOptimizationService = AIOptimizationService_1 = class AIOptimizationService {
    constructor(suggestionModel, openAIConfigService, adGroupProfitService, qualityControlService, advancedAnalyticsService, mlOptimizationService) {
        this.suggestionModel = suggestionModel;
        this.openAIConfigService = openAIConfigService;
        this.adGroupProfitService = adGroupProfitService;
        this.qualityControlService = qualityControlService;
        this.advancedAnalyticsService = advancedAnalyticsService;
        this.mlOptimizationService = mlOptimizationService;
        this.logger = new common_1.Logger(AIOptimizationService_1.name);
    }
    async runAdvancedOptimization(adGroupId) {
        try {
            this.logger.log('🚀 Starting Advanced Mathematical Optimization');
            const suggestions = adGroupId
                ? await this.suggestionModel.findOne({ adGroupId }).exec()
                    ? [await this.suggestionModel.findOne({ adGroupId }).exec()]
                    : []
                : await this.suggestionModel.find({ isActive: { $ne: false } }).exec();
            let optimizedCount = 0;
            for (const suggestion of suggestions.filter(s => s !== null)) {
                try {
                    this.logger.log(`🎯 Analyzing ${suggestion.adGroupId} with advanced algorithms`);
                    const mathResult = await this.advancedAnalyticsService.findOptimalCost(suggestion.adGroupId, 30);
                    await this.mlOptimizationService.trainRandomForest(suggestion.adGroupId, 15);
                    const bayesianResult = await this.mlOptimizationService.bayesianOptimization(suggestion.adGroupId, 15);
                    const ensembleResult = await this.mlOptimizationService.ensemblePrediction(suggestion.adGroupId);
                    const safetyCheck = await this.qualityControlService.performSafetyCheck(suggestion.adGroupId);
                    this.logger.log(`📊 Results for ${suggestion.adGroupId}:
            - Mathematical: ${mathResult.optimalCost} VND (${mathResult.model}, conf: ${mathResult.confidence}%)
            - Bayesian: ${bayesianResult.optimalCost} VND (uncertainty: ${bayesianResult.uncertainty.toFixed(2)})
            - Ensemble: ${ensembleResult.optimalCost} VND (conf: ${ensembleResult.confidence.toFixed(1)}%)
            - Safety: ${safetyCheck.riskLevel} risk, pause: ${safetyCheck.shouldPause}`);
                    if (!safetyCheck.shouldPause && ensembleResult.confidence > 60) {
                        const optimizationResult = {
                            recommendedAction: this.determineAction(suggestion.suggestedCost, ensembleResult.optimalCost),
                            suggestedBudget: ensembleResult.optimalCost,
                            reasoning: `Advanced ensemble optimization: Mathematical(${mathResult.model}), Bayesian, ML. Confidence: ${ensembleResult.confidence.toFixed(1)}%`,
                            confidence: ensembleResult.confidence,
                            expectedProfit: bayesianResult.expectedProfit,
                            marketConditions: `Risk level: ${safetyCheck.riskLevel}`,
                            riskFactors: safetyCheck.reasons
                        };
                        const success = await this.executeOptimizationWithQuality(suggestion, optimizationResult);
                        if (success) {
                            optimizedCount++;
                            await this.qualityControlService.createPredictionRecord(suggestion.adGroupId, {
                                expectedProfit: bayesianResult.expectedProfit,
                                confidence: ensembleResult.confidence,
                                reasoning: optimizationResult.reasoning
                            });
                            this.logger.log(`✅ Successfully optimized ${suggestion.adGroupId}: ${suggestion.suggestedCost} → ${ensembleResult.optimalCost} VND`);
                        }
                    }
                    else {
                        this.logger.log(`⏸️ Skipped ${suggestion.adGroupId}: ${safetyCheck.shouldPause ? 'Safety pause' : 'Low confidence'}`);
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to optimize ${suggestion.adGroupId}:`, error);
                }
            }
            this.logger.log(`🎯 Advanced optimization completed: ${optimizedCount}/${suggestions.length} ad groups optimized`);
        }
        catch (error) {
            this.logger.error('Advanced optimization failed:', error);
        }
    }
    async runAIOptimization() {
        this.logger.log('🚀 Starting AI-enhanced cost optimization with quality control...');
        try {
            await this.qualityControlService.validatePastPredictions();
            const suggestions = await this.suggestionModel.find({ isActive: { $ne: false } });
            let processedCount = 0;
            let executedCount = 0;
            let pendingCount = 0;
            let pausedCount = 0;
            for (const suggestion of suggestions) {
                try {
                    const safetyCheck = await this.qualityControlService.performSafetyCheck(suggestion.adGroupId);
                    if (safetyCheck.shouldPause) {
                        this.logger.warn(`🚨 Pausing optimization for ${suggestion.adGroupId}: ${safetyCheck.reasons.join(', ')}`);
                        pausedCount++;
                        continue;
                    }
                    const analysis = await this.analyzeAdGroupWithAI(suggestion);
                    if (analysis.recommendedAction !== 'MAINTAIN') {
                        processedCount++;
                        await this.qualityControlService.createPredictionRecord(suggestion.adGroupId, analysis);
                        if (safetyCheck.shouldReduceBudget) {
                            analysis.suggestedBudget *= 0.7;
                            analysis.confidence *= 0.8;
                        }
                        const autoModeEnabled = await this.getAutoModeSetting(suggestion.adGroupId);
                        const minConfidence = 60;
                        if (autoModeEnabled && analysis.confidence >= minConfidence) {
                            const executed = await this.executeOptimizationWithQuality(suggestion, analysis);
                            if (executed)
                                executedCount++;
                        }
                        else {
                            await this.createPendingRecommendation(suggestion, analysis);
                            pendingCount++;
                        }
                    }
                }
                catch (error) {
                    this.logger.error(`Failed to process suggestion ${suggestion._id}:`, error);
                }
            }
            this.logger.log(`✅ AI optimization completed: ${processedCount} processed, ${executedCount} executed, ${pendingCount} pending, ${pausedCount} paused`);
        }
        catch (error) {
            this.logger.error('AI optimization failed:', error);
        }
    }
    async analyzeAdGroupWithAI(suggestion) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);
            const profitData = await this.adGroupProfitService.getAdGroupProfitReport({
                from: startDate.toISOString().split('T')[0],
                to: endDate.toISOString().split('T')[0]
            });
            const adGroupPerformance = profitData.filter(p => p.adGroupId === suggestion.adGroupId);
            if (adGroupPerformance.length === 0) {
                return {
                    recommendedAction: 'MAINTAIN',
                    suggestedBudget: suggestion.suggestedCost || 0,
                    confidence: 30,
                    reasoning: 'Insufficient performance data',
                    expectedProfit: 0
                };
            }
            const totalSpend = adGroupPerformance.reduce((sum, p) => sum + p.adsCost, 0);
            const totalProfit = adGroupPerformance.reduce((sum, p) => sum + p.totalProfit, 0);
            const totalRevenue = adGroupPerformance.reduce((sum, p) => sum + p.totalRevenue, 0);
            const avgDailySpend = totalSpend / adGroupPerformance.length;
            const roi = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;
            const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
            const prompt = `
Analyze advertising performance for ad group ${suggestion.adGroupId}:

Performance metrics (7 days):
- Total spend: ${totalSpend.toLocaleString()} VND
- Total profit: ${totalProfit.toLocaleString()} VND  
- Total revenue: ${totalRevenue.toLocaleString()} VND
- ROI: ${roi.toFixed(1)}%
- Profit margin: ${profitMargin.toFixed(1)}%
- Average daily spend: ${avgDailySpend.toLocaleString()} VND
- Current suggested cost: ${(suggestion.suggestedCost || 0).toLocaleString()} VND

Based on these metrics, recommend:
1. Action: INCREASE, DECREASE, PAUSE, or MAINTAIN
2. New budget (if changing)
3. Confidence level (0-100%)
4. Reasoning for recommendation
5. Expected profit impact

Respond in JSON format:
{
  "recommendedAction": "INCREASE|DECREASE|PAUSE|MAINTAIN",
  "suggestedBudget": number,
  "confidence": number,
  "reasoning": "detailed explanation",
  "expectedProfit": number,
  "marketConditions": "market analysis",
  "riskFactors": ["factor1", "factor2"]
}
`;
            const openAIConfig = await this.openAIConfigService.pickConfig({});
            if (!openAIConfig) {
                throw new Error('No active OpenAI configuration found');
            }
            const mockResponse = this.generateMockAIResponse(roi, profitMargin, avgDailySpend, suggestion.suggestedCost || 0);
            return mockResponse;
        }
        catch (error) {
            this.logger.error('AI analysis failed:', error);
            return {
                recommendedAction: 'MAINTAIN',
                suggestedBudget: suggestion.suggestedCost || 0,
                confidence: 20,
                reasoning: 'AI analysis failed - maintaining current budget',
                expectedProfit: 0
            };
        }
    }
    async executeOptimizationWithQuality(suggestion, analysis) {
        try {
            const currentBudget = suggestion.suggestedCost || 0;
            const maxDailyChange = Math.max(currentBudget * 0.2, 50000);
            let newBudget = analysis.suggestedBudget;
            const budgetChange = Math.abs(newBudget - currentBudget);
            if (budgetChange > maxDailyChange) {
                if (newBudget > currentBudget) {
                    newBudget = currentBudget + maxDailyChange;
                }
                else {
                    newBudget = currentBudget - maxDailyChange;
                }
                this.logger.log(`🛡️ Applied safety limit: ${analysis.suggestedBudget} → ${newBudget}`);
            }
            const lastOptimization = suggestion.lastOptimizedAt;
            if (lastOptimization) {
                const hoursSince = (Date.now() - lastOptimization.getTime()) / (1000 * 60 * 60);
                if (hoursSince < 24) {
                    this.logger.log(`⏰ Cooldown period active for ${suggestion.adGroupId}`);
                    return false;
                }
            }
            const success = await this.executeOptimization(suggestion, Object.assign(Object.assign({}, analysis), { suggestedBudget: newBudget }));
            if (success) {
                await this.suggestionModel.findByIdAndUpdate(suggestion._id, {
                    lastOptimizedAt: new Date(),
                    lastOptimizationReason: `AI: ${analysis.reasoning} (Quality: ${analysis.confidence}%)`
                });
            }
            return success;
        }
        catch (error) {
            this.logger.error('Quality-controlled execution failed:', error);
            return false;
        }
    }
    determineAction(currentCost, optimalCost) {
        const change = ((optimalCost - currentCost) / currentCost) * 100;
        if (Math.abs(change) < 5)
            return 'maintain';
        if (change > 20)
            return 'increase_high';
        if (change > 5)
            return 'increase_low';
        if (change < -20)
            return 'decrease_high';
        return 'decrease_low';
    }
    async getAutoModeSetting(adGroupId) {
        return true;
    }
    async createPendingRecommendation(suggestion, analysis) {
        this.logger.log(`📝 Created pending recommendation for ${suggestion.adGroupId}: ${analysis.recommendedAction}`);
    }
    async executeOptimization(suggestion, analysis) {
        try {
            await this.suggestionModel.findByIdAndUpdate(suggestion._id, {
                suggestedCost: analysis.suggestedBudget,
                lastUpdated: new Date(),
                optimizationHistory: {
                    date: new Date(),
                    action: analysis.recommendedAction,
                    oldBudget: suggestion.suggestedCost || 0,
                    newBudget: analysis.suggestedBudget,
                    confidence: analysis.confidence,
                    reasoning: analysis.reasoning
                }
            });
            this.logger.log(`✅ Executed optimization for ${suggestion.adGroupId}: ${analysis.recommendedAction} (${analysis.suggestedBudget})`);
            return true;
        }
        catch (error) {
            this.logger.error('Optimization execution failed:', error);
            return false;
        }
    }
    generateMockAIResponse(roi, profitMargin, avgDailySpend, currentBudget) {
        let recommendedAction = 'MAINTAIN';
        let suggestedBudget = currentBudget;
        let confidence = 70;
        let reasoning = 'Performance is stable';
        let expectedProfit = 0;
        if (roi > 200 && profitMargin > 20) {
            recommendedAction = 'INCREASE';
            suggestedBudget = currentBudget * 1.15;
            confidence = 85;
            reasoning = 'High ROI and profit margin - scaling up recommended';
            expectedProfit = (suggestedBudget - currentBudget) * (roi / 100);
        }
        else if (roi < 50 || profitMargin < 5) {
            recommendedAction = 'DECREASE';
            suggestedBudget = currentBudget * 0.8;
            confidence = 80;
            reasoning = 'Low ROI or profit margin - reducing spend to minimize losses';
            expectedProfit = -(currentBudget - suggestedBudget) * 0.1;
        }
        else if (roi < 20) {
            recommendedAction = 'PAUSE';
            suggestedBudget = 0;
            confidence = 90;
            reasoning = 'Very poor performance - pausing to prevent further losses';
            expectedProfit = 0;
        }
        return {
            recommendedAction,
            suggestedBudget,
            confidence,
            reasoning,
            expectedProfit,
            marketConditions: 'Stable market conditions',
            riskFactors: roi < 100 ? ['Low ROI risk'] : []
        };
    }
};
exports.AIOptimizationService = AIOptimizationService;
__decorate([
    (0, schedule_1.Cron)('0 10 * * *', {
        name: 'ai-cost-optimization',
        timeZone: 'Asia/Ho_Chi_Minh',
    }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AIOptimizationService.prototype, "runAIOptimization", null);
exports.AIOptimizationService = AIOptimizationService = AIOptimizationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_2.InjectModel)(advertising_cost_suggestion_schema_1.AdvertisingCostSuggestion.name)),
    __metadata("design:paramtypes", [mongoose_1.Model,
        openai_config_service_1.OpenAIConfigService,
        ad_group_profit_service_1.AdGroupProfitService,
        quality_control_service_1.QualityControlService,
        advanced_analytics_service_1.AdvancedAnalyticsService,
        ml_optimization_service_1.MLOptimizationService])
], AIOptimizationService);
//# sourceMappingURL=ai-optimization.service.js.map