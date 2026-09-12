import { Type } from 'class-transformer';
import { IsArray, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ResolveReturnItemDto {
  @IsMongoId()
  itemId!: string;

  @IsIn(['restock', 'scrap'])
  decision!: 'restock' | 'scrap';

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  @Type(() => Number)
  quantity?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  recoveryUnitCost?: number;
}

export class ResolveReturnRequestDto {
  @IsOptional() @IsIn(['company', 'supplier', 'agent'])
  holderKind?: 'company' | 'supplier' | 'agent';
  @IsOptional() @IsMongoId() holderId?: string;
  @IsOptional() @IsString() holderAddress?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResolveReturnItemDto)
  items!: ResolveReturnItemDto[];

  @IsOptional()
  reason?: string;
}
