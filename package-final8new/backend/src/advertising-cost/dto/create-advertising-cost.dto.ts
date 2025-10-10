/**
 * File: advertising-cost/dto/create-advertising-cost.dto.ts
 * Mục đích: DTO tạo mới Chi Phí Quảng Cáo với validate.
 */
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAdvertisingCostDto {
  @IsOptional()
  @IsDateString()
  date?: string; // Định dạng ISO, frontend sẽ nhập mm/dd/yyyy rồi convert

  @IsOptional()
  @IsNumber()
  frequency?: number; // Không bắt buộc

  @IsString()
  adGroupId: string; // Bắt buộc

  @IsOptional()
  @IsNumber()
  spentAmount?: number;

  @IsOptional()
  @IsNumber()
  cpm?: number;

  @IsOptional()
  @IsNumber()
  cpc?: number;
}
