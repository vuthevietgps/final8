import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AiOperatorChatDto {
  @IsString()
  message!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  windowDays?: number;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  scenarioId?: string;

  @IsOptional()
  @IsString()
  intent?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}
