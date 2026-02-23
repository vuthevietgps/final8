import { IsDateString, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateStatementDto {
  @IsMongoId()
  supplierId!: string;

  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}