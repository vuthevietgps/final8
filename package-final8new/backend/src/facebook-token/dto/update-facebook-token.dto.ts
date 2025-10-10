/**
 * File: facebook-token/dto/update-facebook-token.dto.ts
 * Mục đích: DTO để cập nhật Facebook Access Token
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateFacebookTokenDto } from './create-facebook-token.dto';

export class UpdateFacebookTokenDto extends PartialType(CreateFacebookTokenDto) {}