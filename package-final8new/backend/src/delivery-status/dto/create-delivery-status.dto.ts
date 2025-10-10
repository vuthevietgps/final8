/**
 * File: dto/create-delivery-status.dto.ts
 * Mục đích: Ràng buộc validate khi tạo mới trạng thái giao hàng.
 */
import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateDeliveryStatusDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsString()
  @IsNotEmpty()
  icon: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isFinal?: boolean;

  @IsNumber()
  @IsOptional()
  order?: number;

  @IsNumber()
  @IsOptional()
  estimatedDays?: number;

  @IsString()
  @IsOptional()
  trackingNote?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
