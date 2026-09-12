import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class BeginMetaAdsProviderValidationDto {
  @IsInt()
  @Min(0)
  expectedActionRevision: number;
}

export class CompleteMetaAdsProviderValidationDto {
  @IsInt()
  @Min(0)
  expectedActionRevision: number;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  @IsString()
  @Length(1, 240)
  providerRequestId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  errorCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  errorMessage?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  beforeStateHash?: string;

  @IsOptional()
  @IsString()
  @Matches(/^v25\.0$/)
  graphApiVersion?: 'v25.0';

  @IsOptional()
  @IsString()
  @Length(1, 160)
  @Matches(/^[A-Za-z0-9._:-]+$/)
  credentialReferenceId?: string;
}

export class ApproveMetaAdsActionPlanDto {
  @IsInt()
  @Min(0)
  expectedActionRevision: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectMetaAdsActionPlanDto {
  @IsInt()
  @Min(0)
  expectedActionRevision: number;

  @IsString()
  @Length(1, 500)
  reason: string;
}
