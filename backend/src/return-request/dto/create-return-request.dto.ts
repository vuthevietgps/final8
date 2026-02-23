import { Type } from 'class-transformer';
import { IsArray, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class ReturnItemDto {
  @IsMongoId()
  productId!: string;

  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantityReturned!: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateReturnRequestDto {
  @IsMongoId()
  orderId!: string;

  @IsMongoId()
  @IsOptional()
  supplierId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  @IsNotEmpty({ each: true })
  items!: ReturnItemDto[];

  @IsString()
  @IsOptional()
  reason?: string;
}
