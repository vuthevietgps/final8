import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateSupplierFulfillmentDto {
  @IsOptional()
  @IsString()
  supplierFulfillmentStatus?: string; // pending|confirmed|shipped|delivered|cancelled

  @IsOptional()
  @IsString()
  supplierTrackingNumber?: string;

  @IsOptional()
  @IsDateString()
  supplierShipDate?: string;

  @IsOptional()
  @IsNumber()
  supplierShippingFee?: number;

  @IsOptional()
  @IsString()
  supplierNotes?: string;
}
