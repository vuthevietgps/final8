import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBudgetBucketDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString({ each: true })
  productGroupIds?: string[];

  @IsOptional()
  @IsNumber()
  dailyCap?: number;

  @IsOptional()
  @IsNumber()
  weeklyCap?: number;

  @IsOptional()
  @IsNumber()
  monthlyCap?: number;

  @IsOptional()
  linkedSources?: Array<{
    sourceId: string;
    allocated?: number;
    restricted?: boolean;
  }>;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
