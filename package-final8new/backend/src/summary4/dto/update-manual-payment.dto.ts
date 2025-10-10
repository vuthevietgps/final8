import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateManualPaymentDto {
  @IsNumber()
  @IsOptional()
  manualPayment?: number;
}
