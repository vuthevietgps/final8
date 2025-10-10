import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Summary4Controller } from './summary4.controller';
import { Summary4Service } from './summary4.service';
import { Summary4GoogleSyncService } from './summary4-google-sync.service';
import { Summary4, Summary4Schema } from './schemas/summary4.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { Quote, QuoteSchema } from '../quote/schemas/quote.schema';
import { User, UserSchema } from '../user/user.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { Summary5Module } from '../summary5/summary5.module';
import { GoogleSyncModule } from '../google-sync/google-sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Summary4.name, schema: Summary4Schema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Quote.name, schema: QuoteSchema },
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
    Summary5Module,
    GoogleSyncModule,
  ],
  controllers: [Summary4Controller],
  providers: [Summary4Service, Summary4GoogleSyncService],
  exports: [Summary4Service, Summary4GoogleSyncService],
})
export class Summary4Module {}