import { IsArray, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateAiOperatorSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class UpdateAiOperatorSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'archived';
}

export class SubmitAiOperatorMessageFeedbackDto {
  @IsIn(['up', 'down', 'neutral'])
  rating!: 'up' | 'down' | 'neutral';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  correction?: string;

  @IsOptional()
  @IsString()
  expectedIntent?: string;

  @IsOptional()
  @IsString()
  expectedScenarioId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ReviewAiOperatorSessionDto {
  @IsOptional()
  @IsIn(['resolved', 'needs_followup', 'wrong_intent', 'missing_data', 'bad_answer', 'useful'])
  outcome?: 'resolved' | 'needs_followup' | 'wrong_intent' | 'missing_data' | 'bad_answer' | 'useful';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsIn(['none', 'low', 'medium', 'high'])
  improvementPriority?: 'none' | 'low' | 'medium' | 'high';

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
