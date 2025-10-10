/**
 * File: ad-group/dto/update-ad-group.dto.ts
 * Mục đích: DTO cho cập nhật Nhóm Quảng Cáo.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateAdGroupDto } from './create-ad-group.dto';

export class UpdateAdGroupDto extends PartialType(CreateAdGroupDto) {}
