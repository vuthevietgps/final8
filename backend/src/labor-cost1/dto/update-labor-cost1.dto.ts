import { IsDateString, IsMongoId, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateLaborCost1Dto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  endTime?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
