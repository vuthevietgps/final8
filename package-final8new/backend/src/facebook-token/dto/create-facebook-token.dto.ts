/**
 * File: facebook-token/dto/create-facebook-token.dto.ts
 * Mục đích: DTO để tạo mới Facebook Access Token
 */
import { IsString, IsOptional, IsArray, IsBoolean, IsEnum, IsDateString } from 'class-validator';

export class CreateFacebookTokenDto {
  @IsString()
  name: string;

  @IsString()
  accessToken: string;

  @IsOptional()
  @IsEnum(['user', 'page', 'app'])
  tokenType?: string;

  @IsOptional()
  @IsString()
  appId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}