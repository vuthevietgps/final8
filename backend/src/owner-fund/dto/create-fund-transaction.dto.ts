import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';
import { FundTransactionType, FundTransactionCategory } from '../schemas/fund-transaction.schema';

export class CreateFundTransactionDto {
  @IsString()
  ownerId: string;

  @IsEnum(FundTransactionType)
  type: FundTransactionType;

  @IsEnum(FundTransactionCategory)
  category: FundTransactionCategory;

  @IsNumber()
  @Min(1000)
  amount: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  referenceType?: string;
}
