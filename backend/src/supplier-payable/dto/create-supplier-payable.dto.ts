import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class SupplierPayableItemDto {
  @IsOptional()
  @IsMongoId()
  productId?: string;

  @IsOptional()
  @IsString()
  productNameSnap?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;
}

export class CreateSupplierPayableDto {
  @IsMongoId()
  supplierId!: string;

  @IsOptional()
  @IsString()
  supplierNameSnap?: string;

  @IsOptional()
  @IsMongoId()
  purchaseOrderId?: string;

  @IsOptional()
  @IsMongoId()
  orderId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupplierPayableItemDto)
  items!: SupplierPayableItemDto[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  totalAmount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(['draft', 'unpaid', 'partial', 'paid'])
  status?: string;
}
