import {
  Equals,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpsertGoogleAdsBiddingLifecycleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  clickThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  clickWindowDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  maxCpcBidCeilingVnd?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maximizeConversionsMinConversions?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  conversionWindowDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  targetCpaMinConversions?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  targetCpaVnd?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 365)
  cooldownHours?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 365)
  minimumStageDwellHours?: number;

  @IsOptional()
  @IsBoolean()
  @Equals(true)
  draftOnly?: true;
}
