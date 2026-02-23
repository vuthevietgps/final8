import { IsOptional, IsString } from 'class-validator';

export class UpdateDeliveryStatusDto {
  @IsOptional()
  @IsString()
  productionStatus?: string;

  @IsOptional()
  @IsString()
  orderStatus?: string;

  @IsOptional()
  @IsString()
  deliveryStatus?: string;
}
