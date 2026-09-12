import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../user/user.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { ProductCategory, ProductCategorySchema } from '../product-category/schemas/product-category.schema';
import { TestOrder2Module } from '../test-order2/test-order2.module';
import { TrackingCrmController } from './tracking-crm.controller';
import { TrackingCrmService } from './tracking-crm.service';
import { TrackingIngestController, TrackingIngestGuard } from './tracking-ingest.controller';
import { TrackingIngestService } from './tracking-ingest.service';
import {
  TrackingSource, TrackingSourceSchema, TrackingVisit, TrackingVisitSchema,
  TrackingEvent, TrackingEventSchema, TrackingLead, TrackingLeadSchema,
  TrackingOrderLink, TrackingOrderLinkSchema,
} from './schemas/tracking-crm.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },
    { name: Product.name, schema: ProductSchema },
    { name: ProductCategory.name, schema: ProductCategorySchema },
    { name: TrackingSource.name, schema: TrackingSourceSchema },
    { name: TrackingVisit.name, schema: TrackingVisitSchema },
    { name: TrackingEvent.name, schema: TrackingEventSchema },
    { name: TrackingLead.name, schema: TrackingLeadSchema },
    { name: TrackingOrderLink.name, schema: TrackingOrderLinkSchema },
  ]), TestOrder2Module],
  controllers: [TrackingCrmController, TrackingIngestController],
  providers: [TrackingCrmService, TrackingIngestService, TrackingIngestGuard],
  exports: [MongooseModule],
})
export class TrackingCrmModule {}
