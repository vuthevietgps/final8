import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class BankStatementLineDto {
  @IsString() @IsNotEmpty() @MaxLength(120) externalId!: string;
  @IsDateString() occurredAt!: string;
  @IsInt() @Min(-1_000_000_000_000) @Max(1_000_000_000_000) amount!: number;
  @IsOptional() @IsString() @MaxLength(160) reference?: string;
  @IsString() @IsNotEmpty() @MaxLength(500) description!: string;
}

export class CreateBankStatementDto {
  @IsString() @IsNotEmpty() @MaxLength(120) requestKey!: string;
  @IsMongoId() accountId!: string;
  @Matches(/^[\p{L}\p{N}_.\/-]{1,120}$/u) statementKey!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) from!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) to!: string;
  @IsInt() @Min(0) @Max(1_000_000_000_000) openingBalance!: number;
  @IsInt() @Min(0) @Max(1_000_000_000_000) closingBalance!: number;
  @IsOptional() @IsIn(['VND']) currency?: 'VND';
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(2000)
  @ValidateNested({ each: true }) @Type(() => BankStatementLineDto)
  lines!: BankStatementLineDto[];
}

export class MatchBankStatementLineDto {
  @IsMongoId() entryId!: string;
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
}

export class UnmatchBankStatementLineDto {
  @IsString() @IsNotEmpty() @MaxLength(500) evidence!: string;
}

