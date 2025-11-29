import { IsOptional, IsString, IsNumber, IsBoolean, IsDateString } from 'class-validator';

export class CreateTestOrder2Dto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  customerName: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  productionStatus?: string;

  @IsOptional()
  @IsString()
  orderStatus?: string;

  @IsOptional()
  @IsString()
  serviceDetails?: string;

  @IsOptional()
  @IsString()
  submitLink?: string;

  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsOptional()
  @IsNumber()
  codAmount?: number;

  @IsOptional()
  @IsNumber()
  manualPayment?: number;

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @IsOptional()
  @IsString()
  receiverAddress?: string;

  @IsOptional()
  @IsDateString()
  orderDate?: string;
}
