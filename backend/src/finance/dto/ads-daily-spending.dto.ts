import { IsString, IsNumber, IsOptional, IsArray, IsEnum } from 'class-validator';

export class CreateAdsDailySpendingDto {
  @IsString()
  date: string; // YYYY-MM-DD

  @IsString()
  snapshotId: string;

  @IsNumber()
  totalAdsCost: number;

  @IsArray()
  @IsOptional()
  breakdown?: Array<{
    adGroupId: string;
    adGroupName: string;
    adsCost: number;
  }>;

  @IsEnum(['auto-sync', 'manual', 're-sync'])
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
