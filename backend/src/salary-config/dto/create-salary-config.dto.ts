import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceTierDto {
  @IsNumber()
  @Min(0)
  minHours: number;

  @IsNumber()
  @Min(0)
  maxHours: number;

  @IsNumber()
  @Min(0)
  bonusAmount: number;
}

export class KpiBonusTierDto {
  @IsNumber()
  @Min(0)
  minPercent: number;

  @IsNumber()
  @Min(0)
  maxPercent: number;

  @IsNumber()
  @Min(0)
  bonusAmount: number;
}

export class PunctualityRulesDto {
  @IsString()
  @IsNotEmpty()
  checkInDeadline: string; // HH:mm format

  @IsNumber()
  @Min(0)
  onTimeBonus: number;

  @IsNumber()
  @Min(0)
  latePenalty: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gracePeriodMinutes?: number;
}

export class CreateSalaryConfigDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsOptional()
  @IsIn(['weekly', 'monthly'])
  payrollCycle?: 'weekly' | 'monthly';

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  paymentDays?: number[]; // Ngày thanh toán lương trong tháng, VD: [5] hoặc [5, 20]

  @IsNumber()
  @Min(0)
  hourlyRate: number;

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
  punctualityRules?: PunctualityRulesDto;

  @IsOptional()
  @IsString()
  notes?: string;
}
