/**
 * File: ad-account/dto/update-ad-account.dto.ts
 * Mục đích: DTO cho việc cập nhật tài khoản quảng cáo.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateAdAccountDto } from './create-ad-account.dto';

export class UpdateAdAccountDto extends PartialType(CreateAdAccountDto) {}
