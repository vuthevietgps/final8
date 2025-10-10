/**
 * File: advertising-cost-suggestion.service.ts
 * Mục đích: Service xử lý logic nghiệp vụ cho đề xuất chi phí quảng cáo
 * Chức năng: CRUD operations, tính toán chênh lệch, đồng bộ với advertising-cost2
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AdvertisingCostSuggestion, AdvertisingCostSuggestionDocument } from './schemas/advertising-cost-suggestion.schema';
import { CreateAdvertisingCostSuggestionDto } from './dto/create-advertising-cost-suggestion.dto';
import { UpdateAdvertisingCostSuggestionDto } from './dto/update-advertising-cost-suggestion.dto';

@Injectable()
export class AdvertisingCostSuggestionService {
  constructor(
    @InjectModel(AdvertisingCostSuggestion.name) 
    private suggestionModel: Model<AdvertisingCostSuggestionDocument>
  ) {}

  async create(createDto: CreateAdvertisingCostSuggestionDto): Promise<AdvertisingCostSuggestionDocument> {
    const createdSuggestion = new this.suggestionModel({
      ...createDto,
      dailyCost: createDto.dailyCost || 0
    });
    
    return createdSuggestion.save();
  }

  async findAll(): Promise<AdvertisingCostSuggestionDocument[]> {
    return this.suggestionModel
      .find({ isActive: { $ne: false } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<AdvertisingCostSuggestionDocument> {
    const suggestion = await this.suggestionModel.findById(id).exec();
    if (!suggestion) {
      throw new NotFoundException(`Không tìm thấy đề xuất chi phí với ID ${id}`);
    }
    return suggestion;
  }

  async update(id: string, updateDto: UpdateAdvertisingCostSuggestionDto): Promise<AdvertisingCostSuggestionDocument> {
    const updatedSuggestion = await this.suggestionModel
      .findByIdAndUpdate(id, updateDto, { new: true })
      .exec();
    
    if (!updatedSuggestion) {
      throw new NotFoundException(`Không tìm thấy đề xuất chi phí với ID ${id}`);
    }
    
    return updatedSuggestion;
  }

  async remove(id: string): Promise<void> {
    const result = await this.suggestionModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Không tìm thấy đề xuất chi phí với ID ${id}`);
    }
  }

  // Cập nhật chi phí hàng ngày từ advertising-cost2
  async updateDailyCost(adGroupId: string, dailyCost: number): Promise<AdvertisingCostSuggestionDocument | null> {
    const suggestion = await this.suggestionModel
      .findOne({ adGroupId })
      .exec();
    
    if (suggestion) {
      suggestion.dailyCost = dailyCost;
      // Pre-save hook sẽ tự động tính toán lại chênh lệch
      return suggestion.save();
    }
    
    return null;
  }

  // Tìm theo adGroupId
  async findByAdGroupId(adGroupId: string): Promise<AdvertisingCostSuggestionDocument | null> {
    return this.suggestionModel
      .findOne({ adGroupId })
      .exec();
  }

  // Lấy thống kê tổng quan
  async getStatistics() {
    const totalSuggestions = await this.suggestionModel.countDocuments({ isActive: { $ne: false } });
    const activeSuggestions = await this.suggestionModel.countDocuments({ isActive: true });
    
    const pipeline = [
      { $match: { isActive: { $ne: false } } },
      {
        $group: {
          _id: null,
          totalSuggestedCost: { $sum: '$suggestedCost' },
          totalDailyCost: { $sum: '$dailyCost' },
          averageSuggestedCost: { $avg: '$suggestedCost' },
          averageDailyCost: { $avg: '$dailyCost' },
          totalDifference: { $sum: '$dailyDifference' }
        }
      }
    ];

    const stats = await this.suggestionModel.aggregate(pipeline);
    
    return {
      totalSuggestions,
      activeSuggestions,
      ...(stats[0] || {
        totalSuggestedCost: 0,
        totalDailyCost: 0,
        averageSuggestedCost: 0,
        averageDailyCost: 0,
        totalDifference: 0
      })
    };
  }

  // Đồng bộ tất cả chi phí từ advertising-cost2
  async syncAllDailyCosts(dailyCostsMap: Map<string, number>) {
    const suggestions = await this.suggestionModel.find({ isActive: { $ne: false } });
    
    for (const suggestion of suggestions) {
      const dailyCost = dailyCostsMap.get(suggestion.adGroupId) || 0;
      if (suggestion.dailyCost !== dailyCost) {
        suggestion.dailyCost = dailyCost;
        await suggestion.save();
      }
    }
  }
}