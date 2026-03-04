/**
 * File: finance/horizontal-scale.service.ts
 * Mục đích: Xử lý mở rộng theo chiều ngang (tạo ad groups mới)
 * Khi nào dùng: Khi frequency cao, budget cap, hoặc vertical scaling >20%
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdGroup, AdGroupDocument } from '../ad-group/schemas/ad-group.schema';

interface HorizontalScaleDecision {
  action: 'CREATE_NEW_AD_GROUP' | 'CANNOT_SCALE' | 'NONE';
  reason?: string;
  newAdGroupConfig?: NewAdGroupConfig;
  estimatedROI?: number;
  confidence?: number;
}

interface NewAdGroupConfig {
  productCategoryId: string;
  selectedProducts: string[];
  initialBudget: number;
  testingPhase: 'TESTING';
  basedOnAdGroup: string;
  targetingStrategy: 'LOOKALIKE_1' | 'LOOKALIKE_2_3' | 'INTEREST_TARGETING' | 'BROAD_TARGETING';
  note: string;
  fanpageId: string;
  agentId: string;
  adAccountId: string;
  platform: 'facebook' | 'google' | 'tiktok';
}

interface FrequencyCheck {
  canScale: boolean;
  recommendation?: 'HORIZONTAL_SCALE' | 'VERTICAL_SCALE';
  reason: string;
}

interface AggregatedMetrics {
  roi: number;
  currentBudget: number;
  avgProfit: number;
  avgRevenue: number;
  successRate: number;
  frequency?: number;
  reach?: number;
  audienceSize?: number;
}

const TARGETING_STRATEGIES = [
  {
    name: 'LOOKALIKE_1' as const,
    description: 'Lookalike 1% từ customers hiện tại',
    audienceSize: 500_000,
    expectedPerformance: 0.9  // 90% so với ad group gốc
  },
  {
    name: 'LOOKALIKE_2_3' as const,
    description: 'Lookalike 2-3% mở rộng',
    audienceSize: 1_500_000,
    expectedPerformance: 0.7  // 70%
  },
  {
    name: 'INTEREST_TARGETING' as const,
    description: 'Interest-based targeting (related products)',
    audienceSize: 2_000_000,
    expectedPerformance: 0.6  // 60%
  },
  {
    name: 'BROAD_TARGETING' as const,
    description: 'Broad targeting để Facebook tự optimize',
    audienceSize: 5_000_000,
    expectedPerformance: 0.5  // 50%
  }
];

@Injectable()
export class HorizontalScaleService {
  private readonly logger = new Logger(HorizontalScaleService.name);

  constructor(
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
  ) {}

  /**
   * Kiểm tra xem có nên horizontal scaling không
   */
  async shouldHorizontalScale(
    adGroupId: string,
    metrics: AggregatedMetrics,
    frequencyCheck: FrequencyCheck,
    reinvestmentFund: number
  ): Promise<boolean> {
    const adGroup = await this.adGroupModel.findOne({ adGroupId });
    
    if (!adGroup) {
      return false;
    }

    // Trigger 1: Frequency quá cao
    if (frequencyCheck.recommendation === 'HORIZONTAL_SCALE') {
      this.logger.log(`📊 Ad group ${adGroupId}: Frequency cao → Consider horizontal scale`);
      return true;
    }

    // Trigger 2: Đã đạt max budget
    if (metrics.currentBudget >= 10_000_000) {
      this.logger.log(`💰 Ad group ${adGroupId}: Đã đạt max budget 10M → Consider horizontal scale`);
      return true;
    }

    // Trigger 3: ROI tốt + Reinvestment fund nhiều
    if (metrics.roi >= 200 && reinvestmentFund > 5_000_000) {
      this.logger.log(`🚀 Ad group ${adGroupId}: ROI ${metrics.roi}% + Fund ${(reinvestmentFund / 1_000_000).toFixed(1)}M → Consider horizontal scale`);
      return true;
    }

    // Trigger 4: Ad group ở STABLE phase
    if (adGroup.testingPhase === 'STABLE' && adGroup.daysSinceLaunch > 90) {
      this.logger.log(`⭐ Ad group ${adGroupId}: STABLE phase → Prefer horizontal scale`);
      return true;
    }

    return false;
  }

  /**
   * Quyết định horizontal scaling
   */
  async considerHorizontalScaling(
    adGroupId: string,
    metrics: AggregatedMetrics,
    frequencyCheck: FrequencyCheck,
    reinvestmentFund: number
  ): Promise<HorizontalScaleDecision> {
    
    const shouldScale = await this.shouldHorizontalScale(
      adGroupId,
      metrics,
      frequencyCheck,
      reinvestmentFund
    );

    if (!shouldScale) {
      return { action: 'NONE' };
    }

    // Lấy thông tin ad group hiện tại
    const adGroup = await this.adGroupModel.findOne({ adGroupId });
    
    if (!adGroup) {
      return {
        action: 'CANNOT_SCALE',
        reason: `Ad group ${adGroupId} not found`
      };
    }

    // Tìm các ad groups khác cùng product category
    const siblingAdGroups = await this.adGroupModel.find({
      productCategoryId: adGroup.productCategoryId,
      isActive: true,
      adGroupId: { $ne: adGroupId }
    });

    // Kiểm tra giới hạn số lượng ad groups per category
    const maxAdGroupsPerCategory = 5;  // Giới hạn 5 ad groups/category
    
    if (siblingAdGroups.length >= maxAdGroupsPerCategory) {
      return {
        action: 'CANNOT_SCALE',
        reason: `Đã đạt max ${maxAdGroupsPerCategory} ad groups cho category ${adGroup.productCategoryId}`
      };
    }

    // Tính budget cho ad group mới
    const newAdGroupBudget = Math.min(
      metrics.currentBudget * 0.5,  // 50% budget của ad group hiện tại
      1_000_000  // Max 1M cho ad group mới (testing phase)
    );

    // Kiểm tra reinvestment fund đủ không
    if (reinvestmentFund < newAdGroupBudget * 7) {  // Cần đủ budget cho 7 ngày testing
      return {
        action: 'CANNOT_SCALE',
        reason: `Reinvestment fund không đủ. Cần ${(newAdGroupBudget * 7 / 1_000_000).toFixed(1)}M, có ${(reinvestmentFund / 1_000_000).toFixed(1)}M`
      };
    }

    // Chọn targeting strategy cho ad group mới
    // Ưu tiên LOOKALIKE_1 nếu chưa có, rồi đến các loại khác
    const usedStrategies = siblingAdGroups.map(ag => ag.targetingStrategy).filter(Boolean);
    const availableStrategies = TARGETING_STRATEGIES.filter(
      s => !usedStrategies.includes(s.name)
    );

    if (availableStrategies.length === 0) {
      return {
        action: 'CANNOT_SCALE',
        reason: 'Đã sử dụng hết các targeting strategies available'
      };
    }

    const selectedStrategy = availableStrategies[0];
    const parentSelectedProducts = (adGroup.selectedProducts || []).map((p) => p.toString());
    if (!parentSelectedProducts.length) {
      return {
        action: 'CANNOT_SCALE',
        reason: `Ad group ${adGroupId} chưa gắn sản phẩm nên không thể tạo nhóm scale mới`,
      };
    }
    if (parentSelectedProducts.length > 1) {
      this.logger.warn(
        `Ad group ${adGroupId} đang có ${parentSelectedProducts.length} sản phẩm, sẽ lấy sản phẩm đầu tiên để tuân thủ rule 1 ad group = 1 product`,
      );
    }

    return {
      action: 'CREATE_NEW_AD_GROUP',
      reason: `Horizontal scaling: ${frequencyCheck.reason || 'ROI cao + Fund đủ'}`,
      newAdGroupConfig: {
        productCategoryId: adGroup.productCategoryId.toString(),
        selectedProducts: [parentSelectedProducts[0]],
        initialBudget: newAdGroupBudget,
        testingPhase: 'TESTING',
        basedOnAdGroup: adGroupId,
        targetingStrategy: selectedStrategy.name,
        note: `Horizontal scale from ${adGroupId}. Reason: ${frequencyCheck.reason || 'Good performance'}. Strategy: ${selectedStrategy.description}`,
        fanpageId: adGroup.fanpageId.toString(),
        agentId: adGroup.agentId.toString(),
        adAccountId: adGroup.adAccountId.toString(),
        platform: adGroup.platform
      },
      estimatedROI: metrics.roi * selectedStrategy.expectedPerformance,
      confidence: 70 + (selectedStrategy.expectedPerformance * 20)  // 70-90%
    };
  }

  /**
   * Tạo ad group mới (horizontal scaling)
   * Note: Chỉ tạo trong database, chưa tạo trên Facebook
   * Cần call Facebook API riêng để tạo campaign/adset thực tế
   */
  async createHorizontalAdGroup(
    config: NewAdGroupConfig
  ): Promise<AdGroupDocument | null> {
    try {
      const normalizedSelectedProducts = Array.from(
        new Set((config.selectedProducts || []).map((x) => String(x || '').trim()).filter(Boolean)),
      );
      if (normalizedSelectedProducts.length !== 1) {
        this.logger.error('Horizontal scaling yêu cầu đúng 1 sản phẩm cho ad group mới');
        return null;
      }

      const timestamp = Date.now();
      const parentAdGroup = await this.adGroupModel.findOne({ 
        adGroupId: config.basedOnAdGroup 
      });

      if (!parentAdGroup) {
        this.logger.error(`❌ Parent ad group ${config.basedOnAdGroup} not found`);
        return null;
      }

      // Count số ad groups khác cùng category
      const siblingCount = await this.adGroupModel.countDocuments({
        productCategoryId: config.productCategoryId,
        adGroupId: { $ne: config.basedOnAdGroup }
      });

      // Tạo ad group trong database
      const newAdGroup = await this.adGroupModel.create({
        name: `${parentAdGroup.name}_H${siblingCount + 1}_${config.targetingStrategy}`,
        adGroupId: `TEMP_${timestamp}`,  // Temporary ID, sẽ update sau khi tạo trên Facebook
        fanpageId: config.fanpageId,
        productCategoryId: config.productCategoryId,
        selectedProducts: normalizedSelectedProducts,
        agentId: config.agentId,
        adAccountId: config.adAccountId,
        platform: config.platform,
        dailyBudget: config.initialBudget,
        isActive: false,  // Chưa active, đợi tạo trên Facebook
        
        // Testing phase metadata
        testingPhase: 'TESTING',
        testingStartDate: new Date(),
        daysSinceLaunch: 0,
        
        // Horizontal scaling metadata
        basedOnAdGroup: config.basedOnAdGroup,
        autoCreated: true,
        autoCreatedReason: config.note,
        targetingStrategy: config.targetingStrategy,
        
        // Copy settings từ parent
        enableWebhook: parentAdGroup.enableWebhook,
        autoControlEnabled: false,  // Tắt auto control trong testing phase
        
        notes: config.note,
        description: `Horizontal scale from ${parentAdGroup.name}. ${config.note}`
      });

      this.logger.log(`✅ Created horizontal ad group: ${newAdGroup._id} (temp ID: TEMP_${timestamp})`);
      this.logger.log(`📋 Based on: ${config.basedOnAdGroup}`);
      this.logger.log(`🎯 Strategy: ${config.targetingStrategy}`);
      this.logger.log(`💰 Initial budget: ${(config.initialBudget / 1_000_000).toFixed(1)}M VND`);
      this.logger.log(`👥 Sibling ad groups in same category: ${siblingCount}`);
      this.logger.warn(`⚠️ Need to create campaign on Facebook and update adGroupId!`);

      return newAdGroup;

    } catch (error) {
      this.logger.error(`❌ Error creating horizontal ad group: ${error.message}`);
      return null;
    }
  }

  /**
   * Cập nhật daysSinceLaunch cho tất cả ad groups
   * Chạy daily để track testing phase progression
   */
  async updateDaysSinceLaunch(): Promise<void> {
    const adGroups = await this.adGroupModel.find({ 
      isActive: true,
      testingStartDate: { $exists: true }
    });

    for (const adGroup of adGroups) {
      const daysSince = Math.floor(
        (Date.now() - adGroup.testingStartDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Auto-promote testing phases
      let newPhase = adGroup.testingPhase;
      
      if (daysSince >= 90 && adGroup.testingPhase !== 'STABLE') {
        newPhase = 'STABLE';
      } else if (daysSince >= 30 && adGroup.testingPhase === 'GROWTH') {
        newPhase = 'MATURE';
      } else if (daysSince >= 8 && adGroup.testingPhase === 'TESTING') {
        newPhase = 'GROWTH';
      }

      await this.adGroupModel.updateOne(
        { _id: adGroup._id },
        { 
          $set: { 
            daysSinceLaunch: daysSince,
            ...(newPhase !== adGroup.testingPhase ? { testingPhase: newPhase } : {})
          } 
        }
      );

      if (newPhase !== adGroup.testingPhase) {
        this.logger.log(`🔄 Ad group ${adGroup.adGroupId}: ${adGroup.testingPhase} → ${newPhase} (${daysSince} days)`);
      }
    }

    this.logger.log(`✅ Updated daysSinceLaunch for ${adGroups.length} ad groups`);
  }

  /**
   * Lấy thông tin về các targeting strategies available
   */
  getAvailableTargetingStrategies() {
    return TARGETING_STRATEGIES;
  }
}
