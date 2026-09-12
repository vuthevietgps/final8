import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsInt,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSupplierQuoteDto {
  @IsNotEmpty()
  @IsMongoId()
  productId!: string;

  @IsNotEmpty()
  @IsMongoId()
  supplierId!: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  currency?: string;

  @IsOptional()
  @IsDateString()
  effectiveAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  isReturnableOverride?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Min(0)
  returnFee?: number;
}
