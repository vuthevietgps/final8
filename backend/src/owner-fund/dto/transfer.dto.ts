import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';

export class TransferToOwnerFundDto {
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
