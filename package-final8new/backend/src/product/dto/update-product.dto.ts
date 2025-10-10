/**
 * File: dto/update-product.dto.ts
 * Mục đích: Ràng buộc validate khi cập nhật Sản phẩm.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
