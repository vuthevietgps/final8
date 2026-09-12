import { IsOptional, Matches } from 'class-validator';

export class WindsorAdsReadSyncDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
}

export class WindsorAdsSnapshotQueryDto {
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateFrom?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) dateTo?: string;
  @IsOptional() @Matches(/^\d{1,30}$/) accountId?: string;
}
