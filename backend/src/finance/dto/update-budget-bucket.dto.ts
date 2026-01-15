import { PartialType } from '@nestjs/mapped-types';
import { CreateBudgetBucketDto } from './create-budget-bucket.dto';

export class UpdateBudgetBucketDto extends PartialType(CreateBudgetBucketDto) {}
