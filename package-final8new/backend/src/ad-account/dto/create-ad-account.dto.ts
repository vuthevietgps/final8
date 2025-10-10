/**
 * File: ad-account/dto/create-ad-account.dto.ts
 * Mục đích: DTO cho việc tạo mới tài khoản quảng cáo.
 */
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateAdAccountDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  name: string; // Tên tài khoản quảng cáo

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  accountId: string; // ID tài khoản quảng cáo

  @IsEnum(['facebook', 'google', 'tiktok', 'zalo', 'shopee', 'lazada'])
  accountType: 'facebook' | 'google' | 'tiktok' | 'zalo' | 'shopee' | 'lazada'; // Loại tài khoản quảng cáo

  @IsOptional()
  @IsBoolean()
  isActive?: boolean; // Trạng thái hoạt động

  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string; // Ghi chú

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string; // Mô tả tài khoản
}
