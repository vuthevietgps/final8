import { IsArray, IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum PurchaseStatus {
  DRAFT = 'draft',
  ORDERED = 'ordered',
  PARTIALLY_RECEIVED = 'partially_received',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
}

export class PurchaseItemDto {
  @IsMongoId()
  productId!: string;

  @IsString()
  @IsOptional()
  productNameSnap?: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsMongoId()
  supplierId!: string;

  @IsString()
  @IsOptional()
  supplierNameSnap?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];

  @IsDateString()
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  shippingFee?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  discount?: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  tax?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsEnum(PurchaseStatus)
  @IsOptional()
  status?: PurchaseStatus;
}
