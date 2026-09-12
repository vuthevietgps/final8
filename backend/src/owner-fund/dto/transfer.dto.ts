import { IsString, IsNumber, IsOptional, IsDateString, Min, MaxLength } from 'class-validator';

export class TransferToOwnerFundDto {
  @IsOptional()
  @IsString()
  ledgerAccountId?: string;
  @IsString()
  @MaxLength(200)
  idempotencyKey: string;

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
  transactionReference?: string; // Mã giao dịch ngân hàng
}

export class TransferFromOwnerFundDto {
  @IsOptional()
  @IsString()
  ledgerAccountId?: string;
  @IsString()
  @MaxLength(200)
  idempotencyKey: string;

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
  transactionReference?: string;
}

export class OwnerWithdrawFromFundDto {
  @IsString()
  @MaxLength(200)
  idempotencyKey: string;

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
  reason?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  transactionReference?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  bankName?: string;
}
