import { IsOptional, IsString } from 'class-validator';

export class ReturnReportFilterDto {
  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsString()
  productId?: string;
}
