/**
 * Module: OrderSheetSyncModule
 * Chức năng: Module đồng bộ đơn hàng lên Google Sheets
 */
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrderSheetSyncService } from './order-sheet-sync.service';
import { OrderSheetSyncController } from './order-sheet-sync.controller';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { User, UserSchema } from '../user/user.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { GoogleSyncModule } from '../google-sync/google-sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    GoogleSyncModule,
  ],
  providers: [OrderSheetSyncService],
  controllers: [OrderSheetSyncController],
  exports: [OrderSheetSyncService],
})
export class OrderSheetSyncModule {}
