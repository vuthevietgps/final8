import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLoanRepaymentDto {
  @IsOptional()
  @IsString()
  loanId?: string;

  @IsNumber()
  amountPrincipal: number;

  @IsOptional()
  @IsNumber()
  amountInterest?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsIn(['bank', 'owner_fund'])
  fundingSource?: 'bank' | 'owner_fund';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
