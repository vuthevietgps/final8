import { IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkRepaymentPaidDto {
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceId?: string;

  @IsOptional()
  @IsIn(['bank', 'owner_fund'])
  fundingSource?: 'bank' | 'owner_fund';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;
}