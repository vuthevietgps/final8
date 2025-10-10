/**
 * File: dto/create-product.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới Sản phẩm.
 */
import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsNumber, 
  Min, 
  IsEnum,
  IsMongoId,
  Matches 
} from 'class-validator';
import { Types } from 'mongoose';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMongoId()
  @IsNotEmpty()
  categoryId: Types.ObjectId;

  @IsNumber()
  @Min(0)
  importPrice: number;

  @IsNumber()
  @Min(0)
  shippingCost: number;

  @IsNumber()
  @Min(0)
  packagingCost: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  estimatedDeliveryDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageDurationMonths?: number;

  @IsOptional()
  @IsEnum(['Hoạt động', 'Tạm dừng'])
  status?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Color must be a valid hex color (e.g., #FF0000)' })
  color?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  resourceLink?: string;
}
