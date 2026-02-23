/**
 * File: other-cost/dto/create-other-cost.dto.ts
 * Mục đích: DTO tạo Chi Phí Khác (Operating Expenses).
 * 
 * CFO v3.1: dueDate là REQUIRED để tính Committed Cash chính xác
 */
import { IsDateString, IsNumber, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { IsBoolean } from 'class-validator';
import { OPS_CATEGORIES, OpsCategory } from '../schemas/other-cost.schema';

export class CreateOtherCostDto {
  @IsDateString()
  date: string; // Ngày phát sinh

  /**
   * dueDate: Ngày đến hạn thanh toán (REQUIRED)
   * - CFO v3.1: Bắt buộc để tính Committed Cash
   */
  @IsDateString()
  dueDate: string;

  @IsNumber()
  @Min(0)
  amount: number;

  /**
   * category: Phân loại chi phí
   * - Default 'other' nếu không chọn
   */
  @IsOptional()
  @IsIn(OPS_CATEGORIES as unknown as string[])
  category?: OpsCategory;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  documentLink?: string;

  @IsOptional()
  @IsBoolean()
  isConfirmed?: boolean;
}
