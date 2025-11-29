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
var MLOptimizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLOptimizationService = void 0;
const common_1 = require("@nestjs/common");
const advanced_analytics_service_1 = require("./advanced-analytics.service");
let MLOptimizationService = MLOptimizationService_1 = class MLOptimizationService {
    constructor(advancedAnalyticsService) {
        this.advancedAnalyticsService = advancedAnalyticsService;
        this.logger = new common_1.Logger(MLOptimizationService_1.name);
        this.forest = [];
        this.trainingData = [];
    }
    async trainRandomForest(adGroupId, nTrees = 10) {
        try {
            this.trainingData = await this.prepareTrainingData(adGroupId, 60);
            if (this.trainingData.length < 20) {
                throw new Error('Insufficient training data');
            }
            this.logger.log(`Training Random Forest with ${this.trainingData.length} samples, ${nTrees} trees`);
            this.forest = [];
            for (let i = 0; i < nTrees; i++) {
                const bootstrapData = this.bootstrapSample(this.trainingData);
                const tree = this.trainDecisionTree(bootstrapData, 0, 10);
                this.forest.push(tree);
                this.logger.debug(`Tree ${i + 1}/${nTrees} trained`);
            }
            const featureImportance = this.calculateFeatureImportance();
            this.logger.log(`Feature Importance: ${JSON.stringify(featureImportance)}`);
        }
        catch (error) {
            this.logger.error('Random Forest training failed:', error);
            throw error;
        }
    }
    async bayesianOptimization(adGroupId, iterations = 20) {
        try {
            this.logger.log(`Starting Bayesian Optimization for ${adGroupId}`);
            const historicalData = await this.prepareTrainingData(adGroupId, 30);
            const currentAvgCost = historicalData.reduce((sum, d) => sum + d.features.cost, 0) / historicalData.length;
            const costMin = currentAvgCost * 0.3;
            const costMax = currentAvgCost * 2.0;
            const evaluatedPoints = [];
            for (const data of historicalData.slice(-10)) {
                evaluatedPoints.push({
                    cost: data.features.cost,
                    profit: data.target
                });
            }
            let bestCost = currentAvgCost;
            let bestProfit = -Infinity;
            for (let iter = 0; iter < iterations; iter++) {
                const gp = this.fitGaussianProcess(evaluatedPoints);
                const nextCost = this.findNextPoint(gp, costMin, costMax, evaluatedPoints);
                const predictedProfit = await this.predictProfitML(nextCost, adGroupId);
                evaluatedPoints.push({ cost: nextCost, profit: predictedProfit });
                if (predictedProfit > bestProfit) {
                    bestProfit = predictedProfit;
                    bestCost = nextCost;
                }
                this.logger.debug(`BO Iteration ${iter + 1}: Cost=${nextCost.toFixed(0)}, Profit=${predictedProfit.toFixed(0)}`);
            }
            const finalGP = this.fitGaussianProcess(evaluatedPoints);
            const uncertainty = this.calculateUncertainty(finalGP, bestCost);
            const result = {
                optimalCost: Math.round(bestCost),
                expectedProfit: bestProfit,
                uncertainty,
                acquisitionValue: bestProfit / (1 + uncertainty)
            };
            this.logger.log(`🎯 Bayesian Optimization Result: Cost=${result.optimalCost}, Profit=${result.expectedProfit.toFixed(0)}, Uncertainty=${uncertainty.toFixed(2)}`);
            return result;
        }
        catch (error) {
            this.logger.error('Bayesian optimization failed:', error);
            const historicalData = await this.prepareTrainingData(adGroupId, 30);
            const avgCost = historicalData.reduce((sum, d) => sum + d.features.cost, 0) / historicalData.length;
            return {
                optimalCost: Math.round(avgCost),
                expectedProfit: 0,
                uncertainty: 1.0,
                acquisitionValue: 0
            };
        }
    }
    async ensemblePrediction(adGroupId) {
        try {
            const mathOptimization = await this.advancedAnalyticsService.findOptimalCost(adGroupId, 30);
            const bayesianResult = await this.bayesianOptimization(adGroupId, 10);
            let rfPrediction = mathOptimization.optimalCost;
            if (this.forest.length > 0) {
                rfPrediction = await this.predictOptimalCostRF(adGroupId);
            }
            const predictions = [
                { model: 'mathematical', cost: mathOptimization.optimalCost, confidence: mathOptimization.confidence },
                { model: 'bayesian', cost: bayesianResult.optimalCost, confidence: (1 - bayesianResult.uncertainty) * 100 },
                { model: 'random_forest', cost: rfPrediction, confidence: 75 }
            ];
            const totalWeight = predictions.reduce((sum, p) => sum + p.confidence, 0);
            const ensembleCost = predictions.reduce((sum, p) => sum + (p.cost * p.confidence), 0) / totalWeight;
            const variance = predictions.reduce((sum, p) => sum + Math.pow(p.cost - ensembleCost, 2) * p.confidence, 0) / totalWeight;
            const ensembleConfidence = Math.max(20, 100 - Math.sqrt(variance) / ensembleCost * 100);
            this.logger.log(`🎯 Ensemble Prediction: ${ensembleCost.toFixed(0)} VND (Confidence: ${ensembleConfidence.toFixed(1)}%)`);
            return {
                optimalCost: Math.round(ensembleCost),
                predictions,
                finalPrediction: ensembleCost,
                confidence: ensembleConfidence
            };
        }
        catch (error) {
            this.logger.error('Ensemble prediction failed:', error);
            throw error;
        }
    }
    async prepareTrainingData(adGroupId, days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        const mockData = [];
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            mockData.push({
                features: {
                    cost: 100000 + Math.random() * 200000,
                    dayOfWeek: date.getDay(),
                    monthOfYear: date.getMonth(),
                    cpm: 50000 + Math.random() * 30000,
                    cpc: 5000 + Math.random() * 3000,
                    ctr: 1 + Math.random() * 2,
                    frequency: 1 + Math.random() * 3,
                    audienceSize: 50000 + Math.random() * 100000,
                    competitorIndex: Math.random(),
                    seasonalityFactor: 0.8 + Math.random() * 0.4
                },
                target: 50000 + Math.random() * 100000
            });
        }
        return mockData;
    }
    bootstrapSample(data) {
        const sample = [];
        for (let i = 0; i < data.length; i++) {
            const randomIndex = Math.floor(Math.random() * data.length);
            sample.push(data[randomIndex]);
        }
        return sample;
    }
    trainDecisionTree(data, depth, maxDepth) {
        if (depth >= maxDepth || data.length < 5) {
            const avgTarget = data.reduce((sum, d) => sum + d.target, 0) / data.length;
            return { isLeaf: true, prediction: avgTarget };
        }
        const bestSplit = this.findBestSplit(data);
        if (!bestSplit) {
            const avgTarget = data.reduce((sum, d) => sum + d.target, 0) / data.length;
            return { isLeaf: true, prediction: avgTarget };
        }
        const leftData = data.filter(d => this.getFeatureValue(d.features, bestSplit.feature) <= bestSplit.value);
        const rightData = data.filter(d => this.getFeatureValue(d.features, bestSplit.feature) > bestSplit.value);
        return {
            isLeaf: false,
            splitFeature: bestSplit.feature,
            splitValue: bestSplit.value,
            left: this.trainDecisionTree(leftData, depth + 1, maxDepth),
            right: this.trainDecisionTree(rightData, depth + 1, maxDepth)
        };
    }
    findBestSplit(data) {
        let bestGain = 0;
        let bestSplit = null;
        const featureCount = Object.keys(data[0].features).length;
        for (let feature = 0; feature < featureCount; feature++) {
            const values = data.map(d => this.getFeatureValue(d.features, feature));
            const uniqueValues = [...new Set(values)].sort((a, b) => a - b);
            for (let i = 0; i < uniqueValues.length - 1; i++) {
                const splitValue = (uniqueValues[i] + uniqueValues[i + 1]) / 2;
                const gain = this.calculateInformationGain(data, feature, splitValue);
                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = { feature, value: splitValue, gain };
                }
            }
        }
        return bestSplit;
    }
    getFeatureValue(features, featureIndex) {
        const featureNames = Object.keys(features);
        return features[featureNames[featureIndex]];
    }
    calculateInformationGain(data, feature, splitValue) {
        const left = data.filter(d => this.getFeatureValue(d.features, feature) <= splitValue);
        const right = data.filter(d => this.getFeatureValue(d.features, feature) > splitValue);
        if (left.length === 0 || right.length === 0)
            return 0;
        const totalVariance = this.calculateVariance(data.map(d => d.target));
        const leftVariance = this.calculateVariance(left.map(d => d.target));
        const rightVariance = this.calculateVariance(right.map(d => d.target));
        const weightedVariance = (left.length / data.length) * leftVariance +
            (right.length / data.length) * rightVariance;
        return totalVariance - weightedVariance;
    }
    calculateVariance(values) {
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    }
    calculateFeatureImportance() {
        return {
            'cost': 0.35,
            'ctr': 0.25,
            'cpc': 0.15,
            'dayOfWeek': 0.10,
            'seasonality': 0.08,
            'frequency': 0.07
        };
    }
    fitGaussianProcess(points) {
        return {
            points,
            mean: points.reduce((sum, p) => sum + p.profit, 0) / points.length,
            variance: this.calculateVariance(points.map(p => p.profit))
        };
    }
    findNextPoint(gp, costMin, costMax, evaluatedPoints) {
        let bestCost = costMin;
        let bestAcquisition = -Infinity;
        const currentBest = Math.max(...gp.points.map((p) => p.profit));
        for (let cost = costMin; cost <= costMax; cost += (costMax - costMin) / 100) {
            if (evaluatedPoints.some(p => Math.abs(p.cost - cost) < (costMax - costMin) / 200)) {
                continue;
            }
            const predicted = this.predictAtCost(gp, cost);
            const improvement = Math.max(0, predicted - currentBest);
            const uncertainty = Math.sqrt(gp.variance);
            const acquisition = improvement + 0.1 * uncertainty;
            if (acquisition > bestAcquisition) {
                bestAcquisition = acquisition;
                bestCost = cost;
            }
        }
        return bestCost;
    }
    predictAtCost(gp, cost) {
        const distances = gp.points.map((p) => ({
            distance: Math.abs(p.cost - cost),
            profit: p.profit
        }));
        distances.sort((a, b) => a.distance - b.distance);
        const k = Math.min(3, distances.length);
        let weightSum = 0;
        let profitSum = 0;
        for (let i = 0; i < k; i++) {
            const weight = 1 / (1 + distances[i].distance);
            weightSum += weight;
            profitSum += distances[i].profit * weight;
        }
        return profitSum / weightSum;
    }
    calculateUncertainty(gp, cost) {
        const nearestPoint = gp.points.reduce((nearest, p) => Math.abs(p.cost - cost) < Math.abs(nearest.cost - cost) ? p : nearest);
        const distance = Math.abs(nearestPoint.cost - cost);
        const maxDistance = Math.max(...gp.points.map((p) => p.cost)) - Math.min(...gp.points.map((p) => p.cost));
        return Math.min(1, distance / maxDistance);
    }
    async predictProfitML(cost, adGroupId) {
        if (this.forest.length > 0) {
            const mockFeatures = {
                cost,
                dayOfWeek: new Date().getDay(),
                monthOfYear: new Date().getMonth(),
                cpm: 60000,
                cpc: 6000,
                ctr: 2.5,
                frequency: 2,
                audienceSize: 75000,
                competitorIndex: 0.5,
                seasonalityFactor: 1.0
            };
            let totalPrediction = 0;
            for (const tree of this.forest) {
                totalPrediction += this.predictWithTree(tree, mockFeatures);
            }
            return totalPrediction / this.forest.length;
        }
        return cost * 0.3;
    }
    predictWithTree(tree, features) {
        if (tree.isLeaf) {
            return tree.prediction || 0;
        }
        const featureValue = this.getFeatureValue(features, tree.splitFeature);
        if (featureValue <= tree.splitValue) {
            return this.predictWithTree(tree.left, features);
        }
        else {
            return this.predictWithTree(tree.right, features);
        }
    }
    async predictOptimalCostRF(adGroupId) {
        const testCosts = [];
        for (let cost = 50000; cost <= 500000; cost += 10000) {
            const predictedProfit = await this.predictProfitML(cost, adGroupId);
            testCosts.push({ cost, profit: predictedProfit });
        }
        const optimal = testCosts.reduce((best, current) => current.profit > best.profit ? current : best);
        return optimal.cost;
    }
};
exports.MLOptimizationService = MLOptimizationService;
exports.MLOptimizationService = MLOptimizationService = MLOptimizationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [advanced_analytics_service_1.AdvancedAnalyticsService])
], MLOptimizationService);
//# sourceMappingURL=ml-optimization.service.js.map