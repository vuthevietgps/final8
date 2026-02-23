import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class PurchasePriceHistoryDto {
  @IsMongoId()
  productId!: string;

  @IsOptional()
  @IsMongoId()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
