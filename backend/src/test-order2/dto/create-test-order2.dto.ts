import { IsOptional, IsString, IsNumber, IsBoolean, IsDateString, Min } from 'class-validator';

export class CreateTestOrder2Dto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  productUsageDurationMonths?: number;

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
  supplierQuote?: number;

  @IsOptional()
  @IsString()
  agentQuoteId?: string;

  @IsOptional()
  @IsNumber()
  agentAppliedPrice?: number;

  @IsOptional()
  @IsNumber()
  agentQuote?: number;

  @IsOptional()
  @IsString()
  productType?: string;

  @IsOptional()
  @IsNumber()
  codAmount?: number;

  @IsOptional()
  @IsNumber()
  manualPayment?: number;

  @IsOptional()
  @IsNumber()
  shippingFee?: number;

  @IsOptional()
  @IsNumber()
  returnFee?: number;

  @IsOptional()
  @IsNumber()
  codCollectedBySupplier?: number;

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

  @IsOptional()
  @IsString()
  productSource?: string; // inventory|supplier

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsNumber()
  supplierPriceLevel?: number;

  @IsOptional()
  @IsNumber()
  supplierAppliedPrice?: number;

  @IsOptional()
  @IsNumber()
  grossProfit?: number;

  @IsOptional()
  @IsNumber()
  advertisingCost?: number;

  @IsOptional()
  @IsNumber()
  laborCostAllocation?: number;

  @IsOptional()
  @IsNumber()
  otherCostAllocation?: number;

  @IsOptional()
  @IsNumber()
  netProfit?: number;
}
