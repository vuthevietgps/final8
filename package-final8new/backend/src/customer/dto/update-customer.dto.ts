/**
 * File: customer/dto/update-customer.dto.ts
 * Mục đích: DTO cho việc cập nhật thông tin khách hàng.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @IsOptional()
  @IsBoolean()
  isDisabled?: boolean;
}