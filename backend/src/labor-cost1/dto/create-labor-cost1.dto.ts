import { IsDateString, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateLaborCost1Dto {
  @IsNotEmpty()
  @IsDateString()
  date: string; // yyyy-MM-dd hoặc ISO, FE sẽ chuẩn hóa từ dd/MM/yyyy

  @IsMongoId()
  userId: string;

  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  startTime: string; // HH:mm

  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  endTime: string; // HH:mm

  @IsOptional()
  @IsString()
  notes?: string;
}
