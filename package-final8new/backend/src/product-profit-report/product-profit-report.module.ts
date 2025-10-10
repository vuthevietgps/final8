/**
 * File: product-profit-report/product-profit-report.module.ts
 * Mục đích: Module báo cáo lợi nhuận sản phẩm theo ngày từ dữ liệu Summary5
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductProfitReportController } from './product-profit-report.controller';
import { ProductProfitReportService } from './product-profit-report.service';
import { Summary5, Summary5Schema } from '../summary5/schemas/summary5.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Summary5.name, schema: Summary5Schema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ProductProfitReportController],
  providers: [ProductProfitReportService],
  exports: [ProductProfitReportService],
})
export class ProductProfitReportModule {}
