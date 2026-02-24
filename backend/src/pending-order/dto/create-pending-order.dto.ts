import { IsDateString, IsEnum, IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePendingOrderDto {
  // Accept either Mongo _id or fanpage pageId. Service will normalize to ObjectId.
  @IsOptional() @IsString() fanpageId?: string;
  @IsOptional() @IsString() senderPsid?: string;
  @IsOptional() @IsMongoId() productId?: string;
  @IsOptional() @IsMongoId() agentId?: string;
  @IsOptional() @IsMongoId() supplierId?: string;
  @IsOptional() @IsString() adGroupId?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsNumber() quantity?: number;
  @IsOptional() @IsEnum(['draft','awaiting','approved','rejected']) status?: 'draft' | 'awaiting' | 'approved' | 'rejected';
  @IsOptional() @IsString() notes?: string;
  // Cho phép client gửi ngày đặt hàng dạng ISO string (yyyy-MM-dd hoặc ISO)
  @IsOptional() @IsDateString() orderDate?: string;
}
