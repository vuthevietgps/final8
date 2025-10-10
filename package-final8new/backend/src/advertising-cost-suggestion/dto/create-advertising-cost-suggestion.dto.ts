/**
 * File: dto/create-advertising-cost-suggestion.dto.ts
 * Mục đích: Định nghĩa DTO cho tạo mới đề xuất chi phí quảng cáo
 * Bao gồm: Validation và kiểu dữ liệu đầu vào
 */
import { IsNotEmpty, IsNumber, IsString, IsOptional, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdvertisingCostSuggestionDto {
  @IsNotEmpty({ message: 'ID nhóm quảng cáo không được để trống' })
  @IsString({ message: 'ID nhóm quảng cáo phải là chuỗi' })
  adGroupId: string;

  @IsNotEmpty({ message: 'Tên nhóm quảng cáo không được để trống' })
  @IsString({ message: 'Tên nhóm quảng cáo phải là chuỗi' })
  adGroupName: string;

  @IsNotEmpty({ message: 'Chi phí đề xuất không được để trống' })
  @IsNumber({}, { message: 'Chi phí đề xuất phải là số' })
  @Type(() => Number)
  @Min(0, { message: 'Chi phí đề xuất không được âm' })
  suggestedCost: number;

  @IsOptional()
  @IsNumber({}, { message: 'Chi phí hàng ngày phải là số' })
  @Type(() => Number)
  @Min(0, { message: 'Chi phí hàng ngày không được âm' })
  dailyCost?: number;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái phải là boolean' })
  isActive?: boolean;

  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  notes?: string;
}