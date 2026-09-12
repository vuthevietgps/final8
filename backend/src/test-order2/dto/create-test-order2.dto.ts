import {
  IsOptional,
  IsString,
  IsNumber,
  IsInt,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsDateString,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'acquisitionAdGroupConsistent', async: false })
class AcquisitionAdGroupConsistentConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateTestOrder2Dto;
    const acquisitionSource = String(dto.customerAcquisitionSource || '').trim().toLowerCase();
    const adGroupId = typeof value === 'string' ? value.trim() : '';

    if (acquisitionSource === 'ads') return Boolean(adGroupId && adGroupId !== '0');
    if (acquisitionSource === 'non_ads') return !adGroupId || adGroupId === '0';
    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    const source = (args.object as CreateTestOrder2Dto).customerAcquisitionSource;
    return source === 'non_ads'
      ? 'adGroupId must be empty when customerAcquisitionSource is non_ads'
      : 'adGroupId is required when customerAcquisitionSource is ads';
  }
}

export class CreateTestOrder2Dto {
  @IsOptional() @IsInt() @Min(0)
  retailSaleAmount?: number;

  @IsOptional() @IsMongoId()
  inventoryBatchId?: string;
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
  @IsInt() @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  agentId?: string;

  @Validate(AcquisitionAdGroupConsistentConstraint)
  adGroupId?: string;

  @IsIn(['ads', 'non_ads'])
  customerAcquisitionSource: 'ads' | 'non_ads';

  @IsOptional()
  @IsIn(['google', 'facebook', 'tiktok'])
  adsProvider?: 'google' | 'facebook' | 'tiktok';

  @IsOptional()
  @IsString()
  adAccountProviderId?: string;

  @IsOptional()
  @IsString()
  adCampaignId?: string;

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
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  returnFee?: number;

  @IsOptional()
  @IsBoolean()
  dealerShippingIncludedInPrice?: boolean;

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
  @IsIn(['supplier', 'inventory', 'dealer_custody'])
  productSource?: string;

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
