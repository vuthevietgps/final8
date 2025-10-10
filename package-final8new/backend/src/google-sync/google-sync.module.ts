/**
 * File: google-sync/google-sync.module.ts
 * Mục đích: Khai báo module đồng bộ dữ liệu "Tổng hợp 1" lên Google Sheets theo từng đại lý.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GoogleSyncService } from './google-sync.service';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { Quote, QuoteSchema } from '../quote/schemas/quote.schema';
import { User, UserSchema } from '../user/user.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { GoogleSyncController } from './google-sync.controller';
// Summary1 removed - replaced by Summary4

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Quote.name, schema: QuoteSchema },
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      // Summary1 removed - replaced by Summary4
    ]),
  ],
  providers: [GoogleSyncService],
  controllers: [GoogleSyncController],
  exports: [GoogleSyncService],
})
export class GoogleSyncModule {}
