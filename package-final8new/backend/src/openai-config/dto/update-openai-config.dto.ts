/**
 * File: openai-config/dto/update-openai-config.dto.ts
 * Mục đích: DTO validation cho cập nhật cấu hình OpenAI
 * Chức năng: Extends CreateDto với tất cả fields optional
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateOpenAIConfigDto } from './create-openai-config.dto';
export class UpdateOpenAIConfigDto extends PartialType(CreateOpenAIConfigDto) {}
