import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLoanContractDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @MaxLength(120)
  lenderName: string;

  @IsNumber()
  principal: number;

  @IsOptional()
  @IsNumber()
  interestRate?: number; // annual %

  @IsOptional()
  @IsString()
  repaymentCycle?: string; // e.g. monthly, weekly

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  restricted?: boolean;

  @IsOptional()
  @IsString()
  @IsIn(['active', 'draft', 'closed'])
  status?: 'active' | 'draft' | 'closed';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
