import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class CreateCapitalAllocationPolicyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  reinvestmentRatio: number; // 40-50%

  @IsNumber()
  @Min(0)
  @Max(100)
  safetyReserveRatio: number; // 20-25%

  @IsNumber()
  @Min(0)
  @Max(100)
  personalIncomeRatio: number; // 20-25%

  @IsNumber()
  @Min(0)
  @Max(100)
  longTermAssetRatio: number; // 10-15%

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCapitalAllocationPolicyDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  reinvestmentRatio?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  safetyReserveRatio?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  personalIncomeRatio?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  longTermAssetRatio?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
