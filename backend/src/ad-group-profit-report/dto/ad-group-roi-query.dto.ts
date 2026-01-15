import { Transform } from 'class-transformer';
import { IsNumber, IsOptional } from 'class-validator';
import { AdGroupProfitFilterDto } from './ad-group-profit-filter.dto';

/**
 * Query DTO for ROI insights and budget suggestions per ad group.
 */
export class AdGroupRoiQueryDto extends AdGroupProfitFilterDto {
  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  targetRoi?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  minOrders?: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber()
  minAdCost?: number;
}
