/**
 * File: dto/update-fanpage.dto.ts
 * Mục đích: DTO cho việc cập nhật thông tin fanpage
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateFanpageDto } from './create-fanpage.dto';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateFanpageDto extends PartialType(CreateFanpageDto) {
  @IsOptional() @IsDateString() lastRefreshAt?: string;
}
