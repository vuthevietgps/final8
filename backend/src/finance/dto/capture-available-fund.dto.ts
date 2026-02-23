import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CaptureAvailableFundDto {
  @IsOptional()
  @IsNumber()
  collectedRevenue?: number;

  @IsOptional()
  @IsNumber()
  loanAvailable?: number;

  @IsOptional()
  @IsNumber()
  actualSpent?: number;

  @IsOptional()
  @IsNumber()
  reservedPayroll?: number;

  @IsOptional()
  @IsNumber()
  reservedInterest?: number;

  @IsOptional()
  @IsNumber()
  reservedPayables?: number;

  @IsOptional()
  @IsNumber()
  reservedSuppliers?: number;

  @IsOptional()
  @IsNumber()
  reservedAgents?: number;

  @IsOptional()
  @IsNumber()
  reservedOther?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
