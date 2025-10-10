/**
 * File: dto/update-advertising-cost-suggestion.dto.ts
 * Mục đích: Định nghĩa DTO cho cập nhật đề xuất chi phí quảng cáo
 * Kế thừa: CreateAdvertisingCostSuggestionDto với PartialType
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateAdvertisingCostSuggestionDto } from './create-advertising-cost-suggestion.dto';

export class UpdateAdvertisingCostSuggestionDto extends PartialType(CreateAdvertisingCostSuggestionDto) {}