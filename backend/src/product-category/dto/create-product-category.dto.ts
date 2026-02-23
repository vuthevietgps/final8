/**
 * File: dto/create-product-category.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới Nhóm Sản phẩm.
 */
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, IsHexColor } from 'class-validator';

export class CreateProductCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  productCount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
