/**
 * File: ad-group-profit-report/dto/ad-group-profit-filter.dto.ts
 * Mục đích: DTO cho filter báo cáo lợi nhuận quảng cáo theo ngày (giống sản phẩm)
 */
import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class AdGroupProfitFilterDto {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  year?: number;

  @IsOptional()
  @IsString()
  @IsIn(['week', '10days', '30days', 'lastMonth', 'thisMonth', 'custom'])
  period?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;
}
