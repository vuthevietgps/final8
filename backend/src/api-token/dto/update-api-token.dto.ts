/** DTO cập nhật ApiToken (partial) */
import { PartialType } from '@nestjs/mapped-types';
import { CreateApiTokenDto } from './create-api-token.dto';
export class UpdateApiTokenDto extends PartialType(CreateApiTokenDto) {}
