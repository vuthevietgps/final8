/**
 * File: other-cost/dto/create-other-cost.dto.ts
 * Mục đích: DTO tạo Chi Phí Khác.
 */
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOtherCostDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  documentLink?: string;
}
