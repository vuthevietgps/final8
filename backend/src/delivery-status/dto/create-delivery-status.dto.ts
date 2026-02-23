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

  @IsBoolean()
  @IsOptional()
  isPaymentTrigger?: boolean;  // Trigger thanh toán NCC + hoa hồng

  @IsBoolean()
  @IsOptional()
  isReturnStatus?: boolean;    // Trạng thái hoàn hàng (tính phí hoàn)

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
