import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class ApproveWithdrawalDto {
  @IsMongoId()
  approvedBy: string;

  @IsString()
  @IsOptional()
  approvalNotes?: string;

  @IsString()
  @IsOptional()
  transactionReference?: string;
}
