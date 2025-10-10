/**
 * File: test-order2/dto/update-delivery-status.dto.ts
 * DTO đơn giản chỉ để cập nhật trạng thái giao hàng
 */
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryStatusDto {
  @IsNotEmpty()
  @IsString()
  _id: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsNotEmpty()
  @IsString()
  orderStatus: string;
}