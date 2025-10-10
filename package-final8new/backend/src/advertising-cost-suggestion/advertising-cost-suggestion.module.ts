/**
 * File: advertising-cost-suggestion.module.ts
 * Mục đích: Module định nghĩa cho tính năng đề xuất chi phí quảng cáo
 * Imports: MongooseModule cho schema, providers cho service
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdvertisingCostSuggestionService } from './advertising-cost-suggestion.service';
import { AdvertisingCostSuggestionController } from './advertising-cost-suggestion.controller';
import { AdvertisingCostSuggestion, AdvertisingCostSuggestionSchema } from './schemas/advertising-cost-suggestion.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdvertisingCostSuggestion.name, schema: AdvertisingCostSuggestionSchema }
    ])
  ],
  controllers: [AdvertisingCostSuggestionController],
  providers: [AdvertisingCostSuggestionService],
  exports: [AdvertisingCostSuggestionService] // Export service để sử dụng ở module khác
})
export class AdvertisingCostSuggestionModule {}