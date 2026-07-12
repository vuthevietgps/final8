import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { OPS_ACTION_PRIORITIES, OPS_ACTION_TYPES } from '../interfaces/ops-action.interfaces';
import { OPS_PLAN_STATUSES, OPS_TASK_STATUSES } from '../schemas/ops-action-plan.schema';

export class CreateOpsActionPlanFromSuggestionsDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsIn(OPS_ACTION_TYPES, { each: true })
  actionTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(OPS_ACTION_PRIORITIES, { each: true })
  priorities?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ListOpsActionPlansQueryDto {
  @IsOptional()
  @IsIn(OPS_PLAN_STATUSES)
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListOpsTasksQueryDto {
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @IsOptional()
  @IsIn(OPS_TASK_STATUSES)
  status?: string;

  @IsOptional()
  @IsIn(OPS_ACTION_PRIORITIES)
  priority?: string;

  @IsOptional()
  @IsIn(OPS_ACTION_TYPES)
  actionType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class ApproveOpsTaskDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectOpsTaskDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
