import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, IsMongoId, Min } from 'class-validator';
import { WithdrawalType } from '../schemas/withdrawal.schema';

export class CreateWithdrawalDto {
  @IsMongoId()
  ownerId: string;

  @IsNumber()
  @Min(1000)
  amount: number;

  @IsEnum(WithdrawalType)
  @IsOptional()
  type?: WithdrawalType;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  bankAccount?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountName?: string;

  @IsBoolean()
  @IsOptional()
  isUrgent?: boolean;
}
