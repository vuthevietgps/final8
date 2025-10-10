/**
 * File: product-profit-report/dto/product-profit-filter.dto.ts
 * Mục đích: DTO cho filter báo cáo lợi nhuận sản phẩm theo ngày
 */
import { IsOptional, IsString, IsNumber, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';

export class ProductProfitFilterDto {
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
  productId?: string;
}
