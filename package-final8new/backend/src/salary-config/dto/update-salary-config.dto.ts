import { IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSalaryConfigDto {
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
