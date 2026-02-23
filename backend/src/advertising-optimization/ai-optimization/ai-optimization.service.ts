/**
 * File: ai-optimization/ai-optimization.service.ts
 * Mục đích: AI Optimization System với Quality Control integration
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { OpenAIConfigService } from '../../openai-config/openai-config.service';

// TODO: Rebuild from OrderTest2
// import { AdGroupProfitService } from '../../ad-group-profit/ad-group-profit.service';
import { QualityControlService } from '../quality-control/quality-control.service';
// TODO: AdvertisingCostSuggestion module removed - rebuild from OrderTest2
// import { AdvertisingCostSuggestion, AdvertisingCostSuggestionDocument } from '../../advertising-cost-suggestion/schemas/advertising-cost-suggestion.schema';
import { AIAnalysisResult } from '../shared/interfaces/quality-control.interface';
import { AdvancedAnalyticsService } from '../advanced-analytics/advanced-analytics.service';
import { MLOptimizationService } from '../advanced-analytics/ml-optimization.service';
import { BudgetApplyService } from './budget-apply.service';

@Injectable()
export class AIOptimizationService {
  private readonly logger = new Logger(AIOptimizationService.name);

  constructor(
    // TODO: AdvertisingCostSuggestion module removed - rebuild from OrderTest2
    // @InjectModel(AdvertisingCostSuggestion.name) 
    // private suggestionModel: Model<AdvertisingCostSuggestionDocument>,
    private budgetApplyService: BudgetApplyService,
    private openAIConfigService: OpenAIConfigService,
    // TODO: Rebuild from OrderTest2
    // private adGroupProfitService: AdGroupProfitService,
    private qualityControlService: QualityControlService,
    private advancedAnalyticsService: AdvancedAnalyticsService,
    private mlOptimizationService: MLOptimizationService
  ) {}

  /**
   * � ENHANCED MATHEMATICAL OPTIMIZATION
   * Uses advanced non-linear regression, ML, and Bayesian optimization
   * TODO: Rebuild from OrderTest2 after AdvertisingCostSuggestion removal
   */
  /* COMMENTED OUT - AdvertisingCostSuggestion module removed
  async runAdvancedOptimization(adGroupId?: string): Promise<void> {
    try {
      this.logger.log('🚀 Starting Advanced Mathematical Optimization');
      
      const suggestions = adGroupId 
        ? await this.suggestionModel.findOne({ adGroupId }).exec()
          ? [await this.suggestionModel.findOne({ adGroupId }).exec()]
          : []
        : await this.suggestionModel.find({ isActive: { $ne: false } }).exec();
      
      let optimizedCount = 0;
      
      for (const suggestion of suggestions.filter(s => s !== null)) {
        if (!suggestion.adGroupId || suggestion.adGroupId === '0') {
          this.logger.warn(`Skipping suggestion without valid adGroupId: ${suggestion._id}`);
          continue;
        }
        try {
          this.logger.log(`🎯 Analyzing ${suggestion.adGroupId} with advanced algorithms`);
          
          // 1. Mathematical Models (Non-linear regression)
          const mathResult = await this.advancedAnalyticsService.findOptimalCost(suggestion.adGroupId, 30);
          
          // 2. Train and use ML models
          await this.mlOptimizationService.trainRandomForest(suggestion.adGroupId, 15);
          const bayesianResult = await this.mlOptimizationService.bayesianOptimization(suggestion.adGroupId, 15);
          
          // 3. Ensemble prediction
          const ensembleResult = await this.mlOptimizationService.ensemblePrediction(suggestion.adGroupId);
          
          // 4. Quality control validation
          const safetyCheck = await this.qualityControlService.performSafetyCheck(suggestion.adGroupId);
          
          this.logger.log(`📊 Results for ${suggestion.adGroupId}:
            - Mathematical: ${mathResult.optimalCost} VND (${mathResult.model}, conf: ${mathResult.confidence}%)
            - Bayesian: ${bayesianResult.optimalCost} VND (uncertainty: ${bayesianResult.uncertainty.toFixed(2)})
            - Ensemble: ${ensembleResult.optimalCost} VND (conf: ${ensembleResult.confidence.toFixed(1)}%)
            - Safety: ${safetyCheck.riskLevel} risk, pause: ${safetyCheck.shouldPause}`);
          
          // 5. Final decision based on ensemble + safety
          if (!safetyCheck.shouldPause && ensembleResult.confidence > 60) {
            const optimizationResult: AIAnalysisResult = {
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
              
              // Create prediction record for validation
              await this.qualityControlService.createPredictionRecord(
                suggestion.adGroupId,
                { 
                  expectedProfit: bayesianResult.expectedProfit,
                  confidence: ensembleResult.confidence,
                  reasoning: optimizationResult.reasoning
                }
              );
              
              this.logger.log(`✅ Successfully optimized ${suggestion.adGroupId}: ${suggestion.suggestedCost} → ${ensembleResult.optimalCost} VND`);
            }
          } else {
            this.logger.log(`⏸️ Skipped ${suggestion.adGroupId}: ${safetyCheck.shouldPause ? 'Safety pause' : 'Low confidence'}`);
          }
          
        } catch (error) {
          this.logger.error(`Failed to optimize ${suggestion.adGroupId}:`, error);
        }
      }
      
      this.logger.log(`🎯 Advanced optimization completed: ${optimizedCount}/${suggestions.length} ad groups optimized`);
      
    } catch (error) {
      this.logger.error('Advanced optimization failed:', error);
    }
  }
  */

  /**
   * �🤖 AI-ENHANCED AUTO OPTIMIZATION
   * Cron job chạy hàng ngày để phân tích và tự động điều chỉnh ngân sách
   * TODO: Rebuild from OrderTest2 after AdvertisingCostSuggestion removal
   */
  /* COMMENTED OUT - AdvertisingCostSuggestion module removed
  @Cron('0 10 * * *', {
    name: 'ai-cost-optimization',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async runAIOptimization(): Promise<void> {
    this.logger.log('🚀 Starting AI-enhanced cost optimization with quality control...');

    try {
      // Validate past predictions trước khi optimize
      await this.qualityControlService.validatePastPredictions();
      
      // Lấy tất cả suggestions active
      const suggestions = await this.suggestionModel.find({ isActive: { $ne: false } });
      
      let processedCount = 0;
      let executedCount = 0;
      let pendingCount = 0;
      let pausedCount = 0;

      for (const suggestion of suggestions) {
        if (!suggestion.adGroupId || suggestion.adGroupId === '0') {
          this.logger.warn(`Skipping suggestion without valid adGroupId: ${suggestion._id}`);
          continue;
        }
        try {
          // QUALITY CONTROL: Safety check trước khi analyze
          const safetyCheck = await this.qualityControlService.performSafetyCheck(suggestion.adGroupId);
          
          if (safetyCheck.shouldPause) {
            this.logger.warn(`🚨 Pausing optimization for ${suggestion.adGroupId}: ${safetyCheck.reasons.join(', ')}`);
            pausedCount++;
            continue;
          }

          const analysis = await this.analyzeAdGroupWithAI(suggestion);
          
          if (analysis.recommendedAction !== 'MAINTAIN') {
            processedCount++;
            
            // QUALITY CONTROL: Create prediction record
            await this.qualityControlService.createPredictionRecord(suggestion.adGroupId, analysis);
            
            // Apply safety adjustments
            if (safetyCheck.shouldReduceBudget) {
              analysis.suggestedBudget *= 0.7; // Reduce by 30% if risky
              analysis.confidence *= 0.8; // Lower confidence
            }
            
            // Kiểm tra auto mode setting và confidence threshold
            const autoModeEnabled = await this.getAutoModeSetting(suggestion.adGroupId);
            const minConfidence = 60; // Minimum confidence for auto execution
            
            if (autoModeEnabled && analysis.confidence >= minConfidence) {
              // Thực hiện tự động với quality control
              const executed = await this.executeOptimizationWithQuality(suggestion, analysis);
              if (executed) executedCount++;
            } else {
              // Tạo pending recommendation
              await this.createPendingRecommendation(suggestion, analysis);
              pendingCount++;
            }
          }

        } catch (error) {
          this.logger.error(`Failed to process suggestion ${suggestion._id}:`, error);
        }
      }

      this.logger.log(`✅ AI optimization completed: ${processedCount} processed, ${executedCount} executed, ${pendingCount} pending, ${pausedCount} paused`);

    } catch (error) {
      this.logger.error('AI optimization failed:', error);
    }
  }

  /**
   * 🧠 Phân tích ad group với AI
   * TODO: Rebuild from OrderTest2 after AdvertisingCostSuggestion removal
   */
  /* COMMENTED OUT - AdvertisingCostSuggestion module removed
  async analyzeAdGroupWithAI(suggestion: AdvertisingCostSuggestionDocument): Promise<AIAnalysisResult> {
    try {
      // Lấy performance data 7 ngày
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 7);

      // TODO: Rebuild from OrderTest2 - Query OrderTest2 directly for profit data
      const profitData: any[] = [];
      // const profitData = await this.adGroupProfitService.getAdGroupProfitReport({
      //   from: startDate.toISOString().split('T')[0],
      //   to: endDate.toISOString().split('T')[0]
      // });

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

      // Tính toán metrics
      const totalSpend = adGroupPerformance.reduce((sum, p) => sum + p.adsCost, 0);
      const totalProfit = adGroupPerformance.reduce((sum, p) => sum + p.totalProfit, 0);
      const totalRevenue = adGroupPerformance.reduce((sum, p) => sum + p.totalRevenue, 0);
      const avgDailySpend = totalSpend / adGroupPerformance.length;
      const roi = totalSpend > 0 ? (totalProfit / totalSpend) * 100 : 0;
      const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

      // Prepare prompt cho OpenAI
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

      // Gọi OpenAI API (mock) + tính optimal cost phi tuyến
      const openAIConfig = await this.openAIConfigService.pickConfig({});
      if (!openAIConfig) {
        throw new Error('No active OpenAI configuration found');
      }

      // 1) Mock AI heuristic
      const mockResponse = this.generateMockAIResponse(roi, profitMargin, avgDailySpend, suggestion.suggestedCost || 0);

      // 2) Non-linear optimal cost
      const optimal = await this.advancedAnalyticsService.findOptimalCost(suggestion.adGroupId, 30);

      // 3) Kết hợp: ưu tiên suggestedBudget từ optimal cost, giữ action từ AI mock
      const combined: AIAnalysisResult = {
        ...mockResponse,
        suggestedBudget: optimal.optimalCost || mockResponse.suggestedBudget,
        confidence: Math.max(mockResponse.confidence || 0, optimal.confidence || 0),
        expectedProfit: optimal.predictedProfit ?? mockResponse.expectedProfit,
        reasoning: `Optimal cost (${optimal.model}, R²→conf ${optimal.confidence.toFixed(0)}%, marginal ROI ${optimal.marginalROI.toFixed(2)}). ${mockResponse.reasoning}`,
        marketConditions: `marginalROI=${optimal.marginalROI.toFixed(2)}`
      };

      return combined;

    } catch (error) {
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

  /**
   * ⚡ EXECUTE OPTIMIZATION WITH QUALITY CONTROL
   * TODO: Rebuild from OrderTest2 after AdvertisingCostSuggestion removal
   */
  /* COMMENTED OUT - AdvertisingCostSuggestion module removed
  async executeOptimizationWithQuality(
    suggestion: AdvertisingCostSuggestionDocument, 
    analysis: AIAnalysisResult
  ): Promise<boolean> {
    try {
      const ctx = await this.budgetApplyService.resolveContext(suggestion.adGroupId);
      const currentBudget = this.budgetApplyService.pickCurrentBudget(suggestion, ctx?.adGroup);
      const maxDailyChange = currentBudget > 0 ? currentBudget * 0.2 : 0;
      
      let newBudget = analysis.suggestedBudget;
      const budgetChange = Math.abs(newBudget - currentBudget);
      
      if (maxDailyChange > 0 && budgetChange > maxDailyChange) {
        newBudget = newBudget > currentBudget
          ? currentBudget + maxDailyChange
          : currentBudget - maxDailyChange;
        this.logger.log(`🛡️ Applied safety limit (20%/day): ${analysis.suggestedBudget} → ${newBudget}`);
      }

      // Check cooldown period (24 hours)
      const lastOptimization = suggestion.lastOptimizedAt;
      if (lastOptimization) {
        const hoursSince = (Date.now() - lastOptimization.getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) {
          this.logger.log(`⏰ Cooldown period active for ${suggestion.adGroupId}`);
          return false;
        }
      }

      // Execute the optimization
      const success = await this.executeOptimization(suggestion, {
        ...analysis,
        suggestedBudget: newBudget
      });

      if (success) {
        // Update optimization timestamp
        await this.suggestionModel.findByIdAndUpdate(suggestion._id, {
          lastOptimizedAt: new Date(),
          lastOptimizationReason: `AI: ${analysis.reasoning} (Quality: ${analysis.confidence}%)`
        });

        if (ctx?.adGroup) {
          await this.budgetApplyService.applyBudgetToProvider(ctx.adGroup, ctx.adAccount || null, newBudget);
        }
      }

      return success;

    } catch (error) {
      this.logger.error('Quality-controlled execution failed:', error);
      return false;
    }
  }

  // Private helper methods
  private determineAction(currentCost: number, optimalCost: number): string {
    const change = ((optimalCost - currentCost) / currentCost) * 100;
    
    if (Math.abs(change) < 5) return 'maintain';
    if (change > 20) return 'increase_high';
    if (change > 5) return 'increase_low';
    if (change < -20) return 'decrease_high';
    return 'decrease_low';
  }

  private async getAutoModeSetting(adGroupId: string): Promise<boolean> {
    // Implementation to check if auto mode is enabled for this ad group
    // For now, default to true
    return true;
  }

  /* COMMENTED OUT - AdvertisingCostSuggestion module removed
  private async createPendingRecommendation(
    suggestion: AdvertisingCostSuggestionDocument, 
    analysis: AIAnalysisResult
  ): Promise<void> {
    // Implementation to create pending recommendation for manual approval
    this.logger.log(`📝 Created pending recommendation for ${suggestion.adGroupId}: ${analysis.recommendedAction}`);
  }
  */

  /* COMMENTED OUT - AdvertisingCostSuggestion module removed
  private async executeOptimization(
    suggestion: AdvertisingCostSuggestionDocument, 
    analysis: AIAnalysisResult
  ): Promise<boolean> {
    try {
      // Update suggestion với new budget
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

    } catch (error) {
      this.logger.error('Optimization execution failed:', error);
      return false;
    }
  }
  */



  private generateMockAIResponse(roi: number, profitMargin: number, avgDailySpend: number, currentBudget: number): AIAnalysisResult {
    // Mock AI response based on performance metrics
    let recommendedAction = 'MAINTAIN';
    let suggestedBudget = currentBudget;
    let confidence = 70;
    let reasoning = 'Performance is stable';
    let expectedProfit = 0;

    if (roi > 200 && profitMargin > 20) {
      recommendedAction = 'INCREASE';
      suggestedBudget = currentBudget * 1.15; // Increase 15%
      confidence = 85;
      reasoning = 'High ROI and profit margin - scaling up recommended';
      expectedProfit = (suggestedBudget - currentBudget) * (roi / 100);
    } else if (roi < 50 || profitMargin < 5) {
      recommendedAction = 'DECREASE';
      suggestedBudget = currentBudget * 0.8; // Decrease 20%
      confidence = 80;
      reasoning = 'Low ROI or profit margin - reducing spend to minimize losses';
      expectedProfit = -(currentBudget - suggestedBudget) * 0.1;
    } else if (roi < 20) {
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

}