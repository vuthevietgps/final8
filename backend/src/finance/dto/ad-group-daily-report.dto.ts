import { IsString, IsOptional, IsDateString } from 'class-validator';

export class GetAdGroupDailyReportDto {
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  platform?: string; // facebook, google, tiktok
}
