import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class ValidateMetaAdsActionPlanDto {
  @IsOptional()
  @Equals(true)
  validateOnly?: true;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  actionIds?: string[];
}

export class ExecuteMetaAdsActionPlanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  actionIds: string[];

  @IsBoolean()
  dryRun: boolean;

  @Equals(false)
  validateOnly: false;

  @IsIn(['erp_ui', 'codex_operator'])
  source: 'erp_ui' | 'codex_operator';
}
