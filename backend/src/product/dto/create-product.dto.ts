/**
 * File: dto/create-product.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới Sản phẩm.
 */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsMongoId,
  Matches,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  categoryId: Types.ObjectId;

  @IsOptional()
  @IsEnum(['Hoạt động', 'Tạm dừng'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Color must be a valid hex color (e.g., #FF0000)' })
  color?: string;

  // Danh sách NCC (chỉ lưu ID) cho sản phẩm
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  supplierIds?: Types.ObjectId[];

  @IsOptional()
  @IsBoolean()
  isReturnable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(95)
  @Type(() => Number)
  assumedReturnRatePercent?: number;

  // Thêm các trường giá và chi phí
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  importPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  shippingCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  packagingCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  usageDurationMonths?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  resourceLink?: string;
}
