import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsMongoId, IsOptional, IsString, Min, MinLength, MaxLength } from 'class-validator';

export class CreateOrderShipmentDto {
  @IsString() @MinLength(8) @MaxLength(100) requestKey!: string;
  @IsString() @MinLength(1) @MaxLength(150) trackingNumber!: string;
  @IsIn(['company', 'supplier', 'agent']) senderKind!: 'company' | 'supplier' | 'agent';
  @IsOptional() @IsMongoId() senderId?: string;
  @IsOptional() @IsString() @MaxLength(500) senderAddress?: string;
  @IsOptional() @IsIn(['company', 'supplier', 'agent']) returnHolderKind?: 'company' | 'supplier' | 'agent';
  @IsOptional() @IsMongoId() returnHolderId?: string;
  @IsOptional() @IsString() @MaxLength(500) returnAddress?: string;
  @IsOptional() @IsMongoId() inventoryBatchId?: string;
  @IsInt() @Min(0) @Type(() => Number) shippingCost!: number;
  @IsInt() @Min(0) @Type(() => Number) returnCostQuote!: number;
  @IsInt() @Min(0) @Type(() => Number) dealerShippingCharge!: number;
  @IsInt() @Min(0) @Type(() => Number) dealerReturnChargeQuote!: number;
  @IsIn(['supplier', 'other']) feePayeeKind!: 'supplier' | 'other';
  @IsOptional() @IsString() @MaxLength(100) feePayeeName?: string;
}
export class CompleteOrderShipmentDto {
  @IsIn(['delivered', 'returning', 'returned', 'partial']) status!: string;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) deliveredQuantity?: number;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) returnCost?: number;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) dealerReturnCharge?: number;
  @IsOptional() @IsBoolean() feesConfirmed?: boolean;
}

export class AmendShipmentFeesDto {
  @IsString() @MinLength(8) @MaxLength(100) requestKey!: string;
  @IsInt() @Min(0) @Type(() => Number) shippingCost!: number;
  @IsInt() @Min(0) @Type(() => Number) returnCost!: number;
  @IsInt() @Min(0) @Type(() => Number) dealerShippingCharge!: number;
  @IsInt() @Min(0) @Type(() => Number) dealerReturnCharge!: number;
  @IsString() @MinLength(3) @MaxLength(500) evidence!: string;
}
