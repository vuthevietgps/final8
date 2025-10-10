/**
 * File: other-cost/dto/update-other-cost.dto.ts
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateOtherCostDto } from './create-other-cost.dto';

export class UpdateOtherCostDto extends PartialType(CreateOtherCostDto) {}
