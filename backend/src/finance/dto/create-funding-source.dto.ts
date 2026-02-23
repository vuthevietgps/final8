import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFundingSourceDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @IsIn(['loan', 'equity', 'internal'])
  type: 'loan' | 'equity' | 'internal';

  @IsOptional()
  @IsString()
  lenderOrInvestor?: string;

  @IsOptional()
  @IsNumber()
  principal?: number;

  @IsOptional()
  @IsNumber()
  availableBalance?: number;

  @IsOptional()
  @IsNumber()
  interestRate?: number;

  @IsOptional()
  @IsString()
  repaymentCycle?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString({ each: true })
  targetProductGroups?: string[];

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
