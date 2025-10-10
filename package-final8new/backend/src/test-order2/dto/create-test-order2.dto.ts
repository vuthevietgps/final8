/**
 * File: test-order2/dto/create-test-order2.dto.ts
 */
import { IsBoolean, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min, Matches } from 'class-validator';

export class CreateTestOrder2Dto {
  @IsMongoId()
  productId: string; // dropdown sản phẩm

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-F]{6}$/i, { message: 'Product color must be a valid hex color' })
  productColor?: string; // Màu sắc của sản phẩm

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsNumber()
  @Min(1)
  quantity: number = 1;

  @IsMongoId()
  agentId: string; // user

  @IsString()
  @IsNotEmpty()
  adGroupId: string; // ID nhóm quảng cáo hoặc '0'

  @IsBoolean()
  isActive: boolean = true;

  @IsOptional()
  @IsString()
  serviceDetails?: string;

  @IsString()
  @IsNotEmpty()
  productionStatus: string = 'Chưa làm';

  @IsString()
  @IsNotEmpty()
  orderStatus: string = 'Chưa có mã vận đơn';

  @IsOptional()
  @IsString()
  submitLink?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  manualPayment?: number = 0;

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  receiverAddress?: string;
}
