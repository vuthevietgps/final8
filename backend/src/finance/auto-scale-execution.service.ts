import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AutoScaleDecisionService, ScaleDecision } from './auto-scale-decision.service';
import { CapitalAllocationService } from './capital-allocation.service';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';
import { BudgetApplyService } from '../advertising-optimization/ai-optimization/budget-apply.service';

interface AutoScaleLog {
  date: Date;
  adGroupId: string;
  adGroupName?: string;
  action: string;
  oldBudget: number;
  newBudget: number;
  reason: string;
  confidence: number;
  metrics: any;
  success: boolean;
  error?: string;
}

@Injectable()
export class AutoScaleExecutionService {
  private readonly logger = new Logger(AutoScaleExecutionService.name);

  constructor(
    @InjectModel(AdGroup.name)
    private readonly adGroupModel: Model<AdGroupDocument>,
    private readonly autoScaleDecisionService: AutoScaleDecisionService,
    private readonly capitalAllocationService: CapitalAllocationService,
    private readonly budgetApplyService: BudgetApplyService,
  ) {}

  /**
   * 🤖 Cronjob chạy mỗi ngày 02:00 AM
   * Tự động scale/kill ad groups dựa trên performance
   */
  @Cron('0 2 * * *', { 
    name: 'auto-scale-ads',
    timeZone: 'Asia/Ho_Chi_Minh' 
  })
  async runDailyAutoScale() {
    this.logger.log('🚀 ========== STARTING DAILY AUTO SCALE/KILL PROCESS ==========');
    
    const startTime = Date.now();
    const logs: AutoScaleLog[] = [];

    try {
      // 1. Lấy reinvestment fund từ Capital Allocation
      const capitalAllocation = await this.capitalAllocationService.computeAllocation();
      const reinvestmentFund = capitalAllocation.reinvestmentAmount || 0;
      
      this.logger.log(`💰 Reinvestment fund available: ${reinvestmentFund.toLocaleString()} VND (45% từ lợi nhuận thuần)`);
      
      // 2. Lấy tất cả active ad groups
      const adGroups = await this.adGroupModel.find({ 
        isActive: { $ne: false }
      });
      
      this.logger.log(`📊 Processing ${adGroups.length} active ad groups`);
      
      if (adGroups.length === 0) {
        this.logger.warn('⚠️  No active ad groups found');
        return;
      }

      let scaleUpCount = 0;
      let scaleDownCount = 0;
      let killedCount = 0;
      let maintainedCount = 0;
      let errorCount = 0;
      
      // 3. Process từng ad group
      for (const adGroup of adGroups) {
        try {
          const adGroupId = adGroup.adGroupId;
          const currentBudget = (adGroup as any).budget || 0;

          this.logger.log(`\n📈 Processing: ${adGroupId} (Current: ${currentBudget.toLocaleString()})`);

          // Make decision
          const decision = await this.autoScaleDecisionService.makeDecision(
            adGroupId,
            currentBudget
          );
          
          this.logger.log(`   Decision: ${decision.action} | New Budget: ${decision.newBudget.toLocaleString()} | Confidence: ${decision.confidence}%`);
          this.logger.log(`   Reason: ${decision.reason}`);
          
          // Execute decision
          let success = false;
          let error: string | undefined;

          switch (decision.action) {
            case 'KILL':
              success = await this.killAdGroup(adGroup, decision);
              if (success) killedCount++;
              break;
            
            case 'SCALE_DOWN':
              success = await this.scaleDownAdGroup(adGroup, decision);
              if (success) scaleDownCount++;
              break;
            
            case 'SCALE_UP_MODERATE':
            case 'SCALE_UP_AGGRESSIVE':
              success = await this.scaleUpAdGroup(adGroup, decision);
              if (success) scaleUpCount++;
              break;
            
            case 'MAINTAIN':
              success = true;
              maintainedCount++;
              this.logger.log(`   ✅ Maintained`);
              break;
          }

          if (!success) {
            errorCount++;
            error = 'Failed to execute decision';
          }

          // Log decision
          logs.push({
            date: new Date(),
            adGroupId,
            adGroupName: (adGroup as any).name,
            action: decision.action,
            oldBudget: currentBudget,
            newBudget: decision.newBudget,
            reason: decision.reason,
            confidence: decision.confidence,
            metrics: decision.metrics,
            success,
            error
          });
          
        } catch (error) {
          errorCount++;
          this.logger.error(`❌ Failed to process ${adGroup.adGroupId}:`, error);
          
          logs.push({
            date: new Date(),
            adGroupId: adGroup.adGroupId,
            action: 'ERROR',
            oldBudget: 0,
            newBudget: 0,
            reason: 'Processing error',
            confidence: 0,
            metrics: null,
            success: false,
            error: (error as any)?.message || 'Unknown error'
          });
        }
      }
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      this.logger.log(`\n✅ ========== AUTO SCALE COMPLETED in ${duration}s ==========`);
      this.logger.log(`📊 Summary:`);
      this.logger.log(`   🟢 Scaled Up: ${scaleUpCount}`);
      this.logger.log(`   🟠 Scaled Down: ${scaleDownCount}`);
      this.logger.log(`   🔴 Killed: ${killedCount}`);
      this.logger.log(`   🟡 Maintained: ${maintainedCount}`);
      this.logger.log(`   ❌ Errors: ${errorCount}`);
      
      // Save logs to database (optional)
      await this.saveLogsToDatabase(logs);
      
      // Send daily report (optional)
      // await this.sendDailyReport({ 
      //   scaleUpCount, scaleDownCount, killedCount, maintainedCount, errorCount, 
      //   logs, duration 
      // });
      
    } catch (error) {
      this.logger.error('❌ Auto scale process failed:', error);
    }
  }

  /**
   * 🔴 Kill ad group (pause completely)
   */
  private async killAdGroup(
    adGroup: AdGroupDocument, 
    decision: ScaleDecision
  ): Promise<boolean> {
    try {
      const adGroupId = adGroup.adGroupId;
      
      // 1. Update database
      await this.adGroupModel.updateOne(
        { _id: adGroup._id },
        {
          $set: {
            isActive: false,
            budget: 0,
            pausedAt: new Date(),
            autoPausedReason: decision.reason,
            autoKilled: true,
            lastAutoScaleAt: new Date(),
            autoScaleAction: 'KILL'
          }
        }
      );
      
      // 2. Pause on platform (Facebook/Google/TikTok) by setting budget to 0
      try {
        const context = await this.budgetApplyService.resolveContext(adGroupId);
        await this.budgetApplyService.applyBudgetToProvider(
          context.adGroup,
          context.adAccount,
          0  // Budget = 0 means pause
        );
      } catch (error) {
        this.logger.warn(`   ⚠️  Failed to pause on platform: ${(error as any)?.message}`);
        // Continue anyway - database is updated
      }
      
      this.logger.log(`   🔴 KILLED: ${adGroupId} - Reason: ${decision.reason}`);
      
      return true;
    } catch (error) {
      this.logger.error(`   ❌ Failed to kill ${adGroup.adGroupId}:`, error);
      return false;
    }
  }

  /**
   * 🟢 Scale up ad group
   */
  private async scaleUpAdGroup(
    adGroup: AdGroupDocument,
    decision: ScaleDecision
  ): Promise<boolean> {
    try {
      const adGroupId = adGroup.adGroupId;
      const oldBudget = (adGroup as any).budget || 0;
      const newBudget = decision.newBudget;
      const increasePercent = ((newBudget - oldBudget) / oldBudget * 100).toFixed(0);

      // 1. Update database
      await this.adGroupModel.updateOne(
        { _id: adGroup._id },
        {
          $set: {
            budget: newBudget,
            lastScaledAt: new Date(),
            lastAutoScaleAt: new Date(),
            autoScaleAction: decision.action,
            autoScaleReason: decision.reason
          }
        }
      );
      
      // 2. Apply to platform
      try {
        const context = await this.budgetApplyService.resolveContext(adGroupId);
        await this.budgetApplyService.applyBudgetToProvider(
          context.adGroup,
          context.adAccount,
          newBudget
        );
      } catch (error) {
        this.logger.warn(`   ⚠️  Failed to update budget on platform: ${(error as any)?.message}`);
        // Continue anyway - database is updated
      }
      
      this.logger.log(`   🟢 SCALED UP: ${oldBudget.toLocaleString()} → ${newBudget.toLocaleString()} (+${increasePercent}%)`);
      
      return true;
    } catch (error) {
      this.logger.error(`   ❌ Failed to scale up ${adGroup.adGroupId}:`, error);
      return false;
    }
  }

  /**
   * 🟠 Scale down ad group
   */
  private async scaleDownAdGroup(
    adGroup: AdGroupDocument,
    decision: ScaleDecision
  ): Promise<boolean> {
    try {
      const adGroupId = adGroup.adGroupId;
      const oldBudget = (adGroup as any).budget || 0;
      const newBudget = decision.newBudget;
      const decreasePercent = ((oldBudget - newBudget) / oldBudget * 100).toFixed(0);

      // 1. Update database
      await this.adGroupModel.updateOne(
        { _id: adGroup._id },
        {
          $set: {
            budget: newBudget,
            lastScaledAt: new Date(),
            lastAutoScaleAt: new Date(),
            autoScaleAction: 'SCALE_DOWN',
            autoScaleReason: decision.reason
          }
        }
      );
      
      // 2. Apply to platform
      try {
        const context = await this.budgetApplyService.resolveContext(adGroupId);
        await this.budgetApplyService.applyBudgetToProvider(
          context.adGroup,
          context.adAccount,
          newBudget
        );
      } catch (error) {
        this.logger.warn(`   ⚠️  Failed to update budget on platform: ${(error as any)?.message}`);
      }
      
      this.logger.log(`   🟠 SCALED DOWN: ${oldBudget.toLocaleString()} → ${newBudget.toLocaleString()} (-${decreasePercent}%)`);
      
      return true;
    } catch (error) {
      this.logger.error(`   ❌ Failed to scale down ${adGroup.adGroupId}:`, error);
      return false;
    }
  }

  /**
   * 💾 Save logs to database (optional)
   */
  private async saveLogsToDatabase(logs: AutoScaleLog[]) {
    // TODO: Implement saving to auto_scale_logs collection
    // This would help track history and analyze effectiveness
  }

  /**
   * 🧪 Manual trigger for testing
   */
  async runManualAutoScale(adGroupId?: string) {
    this.logger.log('🧪 Manual auto scale trigger');
    
    if (adGroupId) {
      // Run for specific ad group
      const adGroup = await this.adGroupModel.findOne({ adGroupId });
      
      if (!adGroup) {
        throw new Error(`Ad group ${adGroupId} not found`);
      }

      const currentBudget = (adGroup as any).budget || 0;
      const decision = await this.autoScaleDecisionService.makeDecision(
        adGroupId,
        currentBudget
      );

      this.logger.log(`Decision for ${adGroupId}: ${decision.action}`);
      this.logger.log(`Reason: ${decision.reason}`);
      
      // Execute (for testing, just log don't actually execute)
      return {
        adGroupId,
        currentBudget,
        decision
      };
    } else {
      // Run for all (trigger the cron manually)
      await this.runDailyAutoScale();
    }
  }
}
