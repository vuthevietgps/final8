/**
 * File: dto/update-production-status.dto.ts
 * Mục đích: Ràng buộc validate khi cập nhật trạng thái sản xuất.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductionStatusDto } from './create-production-status.dto';

/**
 * DTO cho việc cập nhật trạng thái sản xuất
 * Kế thừa từ CreateProductionStatusDto với tất cả fields là optional
 */
export class UpdateProductionStatusDto extends PartialType(CreateProductionStatusDto) {}
