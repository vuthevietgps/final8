/**
 * File: test-order2/test-order2.module.ts
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestOrder2, TestOrder2Schema } from './schemas/test-order2.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { TestOrder2Service } from './test-order2.service';
import { GoogleSyncModule } from '../google-sync/google-sync.module';
import { TestOrder2Controller } from './test-order2.controller';
import { Summary4Module } from '../summary4/summary4.module';
import { Summary5Module } from '../summary5/summary5.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Product.name, schema: ProductSchema },
    ]),
    GoogleSyncModule,
    Summary4Module, // Import Summary4Module để sử dụng Summary4SyncService
    Summary5Module,
  ],
  providers: [TestOrder2Service],
  controllers: [TestOrder2Controller],
  exports: [TestOrder2Service],
})
export class TestOrder2Module {}
