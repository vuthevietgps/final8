/**
 * File: ad-group-profit-report/dto/ad-group-profit-query.dto.ts
 * Mục đích: DTO cho query báo cáo lợi nhuận nhóm quảng cáo.
 */
import { IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';

export enum ProfitReportPeriod {
  WEEK = 'week',
  TEN_DAYS = '10days', 
  THIRTY_DAYS = '30days',
  LAST_MONTH = 'lastMonth',
  THIS_MONTH = 'thisMonth',
  CUSTOM = 'custom'
}

export class AdGroupProfitQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(ProfitReportPeriod)
  period?: ProfitReportPeriod;

  @IsOptional()
  @IsString()
  adGroupId?: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}
