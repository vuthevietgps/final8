import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddLaborPaymentDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  createdBy?: string;

  @IsOptional()
  documents?: string[];
}
