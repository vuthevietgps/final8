import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLoanRepaymentDto {
  @IsString()
  loanId: string;

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
  @IsString()
  @MaxLength(200)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}
