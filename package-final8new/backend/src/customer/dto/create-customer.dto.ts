/**
 * File: customer/dto/create-customer.dto.ts
 * Mục đích: DTO cho việc tạo khách hàng mới.
 */
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsMongoId, IsDateString } from 'class-validator';
import { Types } from 'mongoose';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsMongoId()
  @IsNotEmpty()
  productId: Types.ObjectId;

  @IsDateString()
  latestPurchaseDate: string;

  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}