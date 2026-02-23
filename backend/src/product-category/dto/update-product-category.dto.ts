/**
 * File: dto/update-product-category.dto.ts
 * Mục đích: Ràng buộc validate khi cập nhật Nhóm Sản phẩm.
 */
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductCategoryDto } from './create-product-category.dto';

export class UpdateProductCategoryDto extends PartialType(CreateProductCategoryDto) {}
