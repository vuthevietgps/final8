import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BudgetBucketLinkedSourceDto {
  @IsMongoId()
  sourceId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allocated?: number;

  @IsOptional()
  @IsBoolean()
  restricted?: boolean;
}

export class CreateBudgetBucketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  @IsString({ each: true })
  productGroupIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyCap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weeklyCap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyCap?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BudgetBucketLinkedSourceDto)
  linkedSources?: BudgetBucketLinkedSourceDto[];

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
