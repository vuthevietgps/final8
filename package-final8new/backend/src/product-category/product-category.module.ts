/**
 * File: product-category.module.ts
 * Mục đích: Module quản lý Nhóm Sản phẩm (controller/service/schema).
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductCategoryService } from './product-category.service';
import { ProductCategoryController } from './product-category.controller';
import { ProductCategory, ProductCategorySchema } from './schemas/product-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductCategory.name, schema: ProductCategorySchema }
    ])
  ],
  controllers: [ProductCategoryController],
  providers: [ProductCategoryService],
  exports: [ProductCategoryService]
})
export class ProductCategoryModule {}
