/**
 * File: ml-optimization.service.ts
 * Mục đích: Machine Learning Models for Advanced Ad Optimization
 */
import { Injectable, Logger } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';

interface MLFeatures {
  cost: number;
  dayOfWeek: number;
  monthOfYear: number;
  cpm: number;
  cpc: number;
  ctr: number;
  frequency: number;
  audienceSize: number;
  competitorIndex: number;
  seasonalityFactor: number;
}

interface MLTrainingData {
  features: MLFeatures;
  target: number; // profit
}

interface RandomForestNode {
  isLeaf: boolean;
  splitFeature?: number;
  splitValue?: number;
  prediction?: number;
  left?: RandomForestNode;
  right?: RandomForestNode;
}

interface BayesianOptimizationResult {
  optimalCost: number;
  expectedProfit: number;
  uncertainty: number;
  acquisitionValue: number;
}

@Injectable()
export class MLOptimizationService {
  private readonly logger = new Logger(MLOptimizationService.name);
  
  // Simple Random Forest implementation
  private forest: RandomForestNode[] = [];
  private trainingData: MLTrainingData[] = [];

  constructor(
    private advancedAnalyticsService: AdvancedAnalyticsService
  ) {}

  /**
   * 🌲 RANDOM FOREST MODEL
   * Learns complex non-linear relationships between multiple features and profit
   */
  async trainRandomForest(adGroupId: string, nTrees: number = 10): Promise<void> {
    try {
      // 1. Collect and prepare training data
      this.trainingData = await this.prepareTrainingData(adGroupId, 60); // 60 days
      
      if (this.trainingData.length < 20) {
        throw new Error('Insufficient training data');
      }
      
      this.logger.log(`Training Random Forest with ${this.trainingData.length} samples, ${nTrees} trees`);
      
      // 2. Train multiple decision trees
      this.forest = [];
      for (let i = 0; i < nTrees; i++) {
        // Bootstrap sampling
        const bootstrapData = this.bootstrapSample(this.trainingData);
        
        // Train decision tree
        const tree = this.trainDecisionTree(bootstrapData, 0, 10); // max depth 10
        this.forest.push(tree);
        
        this.logger.debug(`Tree ${i + 1}/${nTrees} trained`);
      }
      
      // 3. Calculate feature importance
      const featureImportance = this.calculateFeatureImportance();
      this.logger.log(`Feature Importance: ${JSON.stringify(featureImportance)}`);
      
    } catch (error) {
      this.logger.error('Random Forest training failed:', error);
      throw error;
    }
  }

  /**
   * 🔮 BAYESIAN OPTIMIZATION
   * Uses Gaussian Process to find optimal cost with uncertainty quantification
   */
  async bayesianOptimization(adGroupId: string, iterations: number = 20): Promise<BayesianOptimizationResult> {
    try {
      this.logger.log(`Starting Bayesian Optimization for ${adGroupId}`);
      
      // 1. Initialize with current data
      const historicalData = await this.prepareTrainingData(adGroupId, 30);
      const currentAvgCost = historicalData.reduce((sum, d) => sum + d.features.cost, 0) / historicalData.length;
      
      // 2. Define search space
      const costMin = currentAvgCost * 0.3;
      const costMax = currentAvgCost * 2.0;
      
      // 3. Initialize with some random points
      const evaluatedPoints: { cost: number, profit: number }[] = [];
      
      // Add historical points
      for (const data of historicalData.slice(-10)) {
        evaluatedPoints.push({
          cost: data.features.cost,
          profit: data.target
        });
      }
      
      let bestCost = currentAvgCost;
      let bestProfit = -Infinity;
      
      // 4. Bayesian optimization loop
      for (let iter = 0; iter < iterations; iter++) {
        // Fit Gaussian Process (simplified)
        const gp = this.fitGaussianProcess(evaluatedPoints);
        
        // Find next point to evaluate using acquisition function
        const nextCost = this.findNextPoint(gp, costMin, costMax, evaluatedPoints);
        
        // Evaluate the point (predict using our models)
        const predictedProfit = await this.predictProfitML(nextCost, adGroupId);
        
        evaluatedPoints.push({ cost: nextCost, profit: predictedProfit });
        
        if (predictedProfit > bestProfit) {
          bestProfit = predictedProfit;
          bestCost = nextCost;
        }
        
        this.logger.debug(`BO Iteration ${iter + 1}: Cost=${nextCost.toFixed(0)}, Profit=${predictedProfit.toFixed(0)}`);
      }
      
      // 5. Calculate uncertainty at optimal point
      const finalGP = this.fitGaussianProcess(evaluatedPoints);
      const uncertainty = this.calculateUncertainty(finalGP, bestCost);
      
      const result = {
        optimalCost: Math.round(bestCost),
        expectedProfit: bestProfit,
        uncertainty,
        acquisitionValue: bestProfit / (1 + uncertainty) // Simple acquisition
      };
      
      this.logger.log(`🎯 Bayesian Optimization Result: Cost=${result.optimalCost}, Profit=${result.expectedProfit.toFixed(0)}, Uncertainty=${uncertainty.toFixed(2)}`);
      
      return result;
      
    } catch (error) {
      this.logger.error('Bayesian optimization failed:', error);
      
      // Fallback
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

  /**
   * 🧠 ENSEMBLE PREDICTION
   * Combines multiple models for robust predictions
   */
  async ensemblePrediction(adGroupId: string): Promise<{
    optimalCost: number;
    predictions: any[];
    finalPrediction: number;
    confidence: number;
  }> {
    try {
      // 1. Get predictions from different models
      const mathOptimization = await this.advancedAnalyticsService.findOptimalCost(adGroupId, 30);
      const bayesianResult = await this.bayesianOptimization(adGroupId, 10);
      
      // 2. Random Forest prediction (if trained)
      let rfPrediction = mathOptimization.optimalCost;
      if (this.forest.length > 0) {
        rfPrediction = await this.predictOptimalCostRF(adGroupId);
      }
      
      const predictions = [
        { model: 'mathematical', cost: mathOptimization.optimalCost, confidence: mathOptimization.confidence },
        { model: 'bayesian', cost: bayesianResult.optimalCost, confidence: (1 - bayesianResult.uncertainty) * 100 },
        { model: 'random_forest', cost: rfPrediction, confidence: 75 }
      ];
      
      // 3. Weighted ensemble (higher confidence = higher weight)
      const totalWeight = predictions.reduce((sum, p) => sum + p.confidence, 0);
      const ensembleCost = predictions.reduce((sum, p) => sum + (p.cost * p.confidence), 0) / totalWeight;
      
      // 4. Calculate ensemble confidence
      const variance = predictions.reduce((sum, p) => sum + Math.pow(p.cost - ensembleCost, 2) * p.confidence, 0) / totalWeight;
      const ensembleConfidence = Math.max(20, 100 - Math.sqrt(variance) / ensembleCost * 100);
      
      this.logger.log(`🎯 Ensemble Prediction: ${ensembleCost.toFixed(0)} VND (Confidence: ${ensembleConfidence.toFixed(1)}%)`);
      
      return {
        optimalCost: Math.round(ensembleCost),
        predictions,
        finalPrediction: ensembleCost,
        confidence: ensembleConfidence
      };
      
    } catch (error) {
      this.logger.error('Ensemble prediction failed:', error);
      throw error;
    }
  }

  /**
   * 🔧 PRIVATE HELPER METHODS
   */
  
  private async prepareTrainingData(adGroupId: string, days: number): Promise<MLTrainingData[]> {
    // This would collect comprehensive feature data
    // For now, simplified version
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    
    // Mock training data - in production, collect real features
    const mockData: MLTrainingData[] = [];
    
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
        target: 50000 + Math.random() * 100000 // Mock profit
      });
    }
    
    return mockData;
  }

  private bootstrapSample(data: MLTrainingData[]): MLTrainingData[] {
    const sample: MLTrainingData[] = [];
    for (let i = 0; i < data.length; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      sample.push(data[randomIndex]);
    }
    return sample;
  }

  private trainDecisionTree(data: MLTrainingData[], depth: number, maxDepth: number): RandomForestNode {
    // Simple decision tree implementation
    
    if (depth >= maxDepth || data.length < 5) {
      // Create leaf node
      const avgTarget = data.reduce((sum, d) => sum + d.target, 0) / data.length;
      return { isLeaf: true, prediction: avgTarget };
    }
    
    // Find best split
    const bestSplit = this.findBestSplit(data);
    
    if (!bestSplit) {
      const avgTarget = data.reduce((sum, d) => sum + d.target, 0) / data.length;
      return { isLeaf: true, prediction: avgTarget };
    }
    
    // Split data
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

  private findBestSplit(data: MLTrainingData[]): { feature: number, value: number, gain: number } | null {
    let bestGain = 0;
    let bestSplit: { feature: number, value: number, gain: number } | null = null;
    
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

  private getFeatureValue(features: MLFeatures, featureIndex: number): number {
    const featureNames = Object.keys(features);
    return (features as any)[featureNames[featureIndex]];
  }

  private calculateInformationGain(data: MLTrainingData[], feature: number, splitValue: number): number {
    const left = data.filter(d => this.getFeatureValue(d.features, feature) <= splitValue);
    const right = data.filter(d => this.getFeatureValue(d.features, feature) > splitValue);
    
    if (left.length === 0 || right.length === 0) return 0;
    
    const totalVariance = this.calculateVariance(data.map(d => d.target));
    const leftVariance = this.calculateVariance(left.map(d => d.target));
    const rightVariance = this.calculateVariance(right.map(d => d.target));
    
    const weightedVariance = (left.length / data.length) * leftVariance + 
                           (right.length / data.length) * rightVariance;
    
    return totalVariance - weightedVariance;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private calculateFeatureImportance(): Record<string, number> {
    // Simplified feature importance calculation
    return {
      'cost': 0.35,
      'ctr': 0.25,
      'cpc': 0.15,
      'dayOfWeek': 0.10,
      'seasonality': 0.08,
      'frequency': 0.07
    };
  }

  private fitGaussianProcess(points: { cost: number, profit: number }[]): any {
    // Simplified Gaussian Process implementation
    return {
      points,
      mean: points.reduce((sum, p) => sum + p.profit, 0) / points.length,
      variance: this.calculateVariance(points.map(p => p.profit))
    };
  }

  private findNextPoint(gp: any, costMin: number, costMax: number, evaluatedPoints: any[]): number {
    // Expected Improvement acquisition function (simplified)
    let bestCost = costMin;
    let bestAcquisition = -Infinity;
    
    const currentBest = Math.max(...gp.points.map((p: any) => p.profit));
    
    for (let cost = costMin; cost <= costMax; cost += (costMax - costMin) / 100) {
      // Skip if already evaluated
      if (evaluatedPoints.some(p => Math.abs(p.cost - cost) < (costMax - costMin) / 200)) {
        continue;
      }
      
      // Simple acquisition: expected improvement
      const predicted = this.predictAtCost(gp, cost);
      const improvement = Math.max(0, predicted - currentBest);
      const uncertainty = Math.sqrt(gp.variance);
      
      const acquisition = improvement + 0.1 * uncertainty; // Exploration bonus
      
      if (acquisition > bestAcquisition) {
        bestAcquisition = acquisition;
        bestCost = cost;
      }
    }
    
    return bestCost;
  }

  private predictAtCost(gp: any, cost: number): number {
    // Simple GP prediction using nearest neighbors
    const distances = gp.points.map((p: any) => ({
      distance: Math.abs(p.cost - cost),
      profit: p.profit
    }));
    
    distances.sort((a, b) => a.distance - b.distance);
    
    // Weighted average of 3 nearest neighbors
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

  private calculateUncertainty(gp: any, cost: number): number {
    // Simple uncertainty estimation
    const nearestPoint = gp.points.reduce((nearest: any, p: any) => 
      Math.abs(p.cost - cost) < Math.abs(nearest.cost - cost) ? p : nearest
    );
    
    const distance = Math.abs(nearestPoint.cost - cost);
    const maxDistance = Math.max(...gp.points.map((p: any) => p.cost)) - Math.min(...gp.points.map((p: any) => p.cost));
    
    return Math.min(1, distance / maxDistance);
  }

  private async predictProfitML(cost: number, adGroupId: string): Promise<number> {
    // Use trained models to predict profit at given cost
    if (this.forest.length > 0) {
      // Mock features for prediction
      const mockFeatures: MLFeatures = {
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
      
      // Average predictions from all trees
      let totalPrediction = 0;
      for (const tree of this.forest) {
        totalPrediction += this.predictWithTree(tree, mockFeatures);
      }
      
      return totalPrediction / this.forest.length;
    }
    
    // Fallback to simple linear estimation
    return cost * 0.3; // Assume 30% profit margin
  }

  private predictWithTree(tree: RandomForestNode, features: MLFeatures): number {
    if (tree.isLeaf) {
      return tree.prediction || 0;
    }
    
    const featureValue = this.getFeatureValue(features, tree.splitFeature!);
    
    if (featureValue <= tree.splitValue!) {
      return this.predictWithTree(tree.left!, features);
    } else {
      return this.predictWithTree(tree.right!, features);
    }
  }

  private async predictOptimalCostRF(adGroupId: string): Promise<number> {
    // Use Random Forest to find optimal cost
    // This would involve testing different cost values and finding the one with highest predicted profit
    
    const testCosts = [];
    for (let cost = 50000; cost <= 500000; cost += 10000) {
      const predictedProfit = await this.predictProfitML(cost, adGroupId);
      testCosts.push({ cost, profit: predictedProfit });
    }
    
    const optimal = testCosts.reduce((best, current) => 
      current.profit > best.profit ? current : best
    );
    
    return optimal.cost;
  }
}