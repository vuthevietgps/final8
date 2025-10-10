import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateSalaryConfigDto {
  @IsMongoId()
  @IsNotEmpty()
  userId: string;

  @IsNumber()
  @Min(0)
  hourlyRate: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
