import { IsEnum, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePendingOrderDto {
  @IsOptional() @IsMongoId() fanpageId?: string;
  @IsOptional() @IsString() senderPsid?: string;
  @IsOptional() @IsMongoId() productId?: string;
  @IsOptional() @IsMongoId() agentId?: string;
  @IsOptional() @IsString() adGroupId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsEnum(['draft','awaiting','approved','rejected']) status?: 'draft' | 'awaiting' | 'approved' | 'rejected';
  @IsOptional() @IsString() notes?: string;
}
