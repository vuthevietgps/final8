import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const TAX_OBLIGATION_SOURCES = [
  'tax_filing',
  'tax_authority_notice',
  'accountant_confirmation',
  'manual_reconciliation',
] as const;

export class TaxDueByDayDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must use YYYY-MM-DD' })
  date!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;
}

export class UpsertTaxObligationSnapshotDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalTaxDue!: number;

  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => TaxDueByDayDto)
  dueByDay7d!: TaxDueByDayDto[];

  @IsISO8601({ strict: true })
  @Matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
    { message: 'asOf must be an ISO-8601 timestamp with timezone' },
  )
  asOf!: string;

  @IsIn(TAX_OBLIGATION_SOURCES)
  source!: typeof TAX_OBLIGATION_SOURCES[number];

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  evidence!: string;
}
