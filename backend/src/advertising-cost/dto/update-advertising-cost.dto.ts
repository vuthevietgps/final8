/**
 * File: advertising-cost/dto/update-advertising-cost.dto.ts
 * Mục đích: DTO cập nhật Chi Phí Quảng Cáo.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateAdvertisingCostDto } from './create-advertising-cost.dto';

export class UpdateAdvertisingCostDto extends PartialType(CreateAdvertisingCostDto) {}
