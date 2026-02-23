/**
 * File: dto/update-quote.dto.ts
 * Mục đích: Định nghĩa kiểu dữ liệu và ràng buộc validate cho yêu cầu cập nhật Báo giá.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateQuoteDto } from './create-quote.dto';

export class UpdateQuoteDto extends PartialType(CreateQuoteDto) {}
