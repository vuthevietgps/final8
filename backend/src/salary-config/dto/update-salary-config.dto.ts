import { IsMongoId, IsNumber, IsOptional, IsString, Min, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceTierDto, KpiBonusTierDto, PunctualityRulesDto } from './create-salary-config.dto';

export class UpdateSalaryConfigDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  payrollCycle?: 'weekly' | 'monthly';

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  paymentDays?: number[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceTierDto)
  attendanceTiers?: AttendanceTierDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KpiBonusTierDto)
  kpiBonusTiers?: KpiBonusTierDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PunctualityRulesDto)
  punctualityRules?: PunctualityRulesDto | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
