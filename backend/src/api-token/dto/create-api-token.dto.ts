/** DTO tạo mới ApiToken */
import { IsEnum, IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class CreateApiTokenDto {
  @IsString() @Length(1,200) name: string;
  @IsString() token: string;
  @IsEnum(['facebook','zalo','google','tiktok','other']) provider: 'facebook' | 'zalo' | 'google' | 'tiktok' | 'other';
  @IsOptional() @IsEnum(['active','inactive']) status?: 'active' | 'inactive';
  @IsOptional() @IsMongoId() fanpageId?: string;
  // Liên kết theo tài khoản quảng cáo (tuỳ chọn)
  @IsOptional() @IsString() adAccountId?: string; // cho phép cả "123" hoặc "act_123"
  @IsOptional() @IsString() adAccountName?: string;
  @IsOptional() @IsString() notes?: string;
}
