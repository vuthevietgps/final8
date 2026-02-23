import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCashflowEntryDto {
  @IsIn(['in', 'out'])
  direction: 'in' | 'out';

  @IsString()
  @IsIn(['cod', 'deposit', 'loan', 'equity', 'other'])
  sourceType: 'cod' | 'deposit' | 'loan' | 'equity' | 'other';

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  bucketId?: string;

  @IsOptional()
  @IsString()
  fundingSourceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  category?: string; // ads, salary, supplier, interest, etc.

  @IsOptional()
  @IsString()
  @MaxLength(200)
  referenceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
