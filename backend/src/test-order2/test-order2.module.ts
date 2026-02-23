import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestOrder2, TestOrder2Schema } from './schemas/test-order2.schema';
import { TestOrder2Service } from './test-order2.service';
import { OrderCalculationService } from './services/order-calculation.service';
import { OrderPaymentService } from './services/order-payment.service';
import { OrderReportService } from './services/order-report.service';
import { TestOrder2ExportService } from './test-order2-export.service';
import { TestOrder2ExportJsonService } from './test-order2-export-json.service';
import { TestOrder2ImportService } from './test-order2-import.service';
import { TestOrder2Controller } from './test-order2.controller';
import { GoogleSyncModule } from '../google-sync/google-sync.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SupplierPayableModule } from '../supplier-payable/supplier-payable.module';
import { Product, ProductSchema } from '../product/schemas/product.schema';
import { Quote, QuoteSchema } from '../quote/schemas/quote.schema';
import { SupplierQuote, SupplierQuoteSchema } from '../supplier-quote/schemas/supplier-quote.schema';
import { OrderSheetSyncModule } from '../order-sheet-sync/order-sheet-sync.module';
import { DeliveryStatusModule } from '../delivery-status/delivery-status.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Product.name, schema: ProductSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: SupplierQuote.name, schema: SupplierQuoteSchema },
    ]),
    GoogleSyncModule,
    InventoryModule,
    SupplierPayableModule,
    OrderSheetSyncModule,
    DeliveryStatusModule,
  ],
  providers: [
    OrderCalculationService,
    OrderPaymentService,
    OrderReportService,
    TestOrder2Service,
    TestOrder2ExportService,
    TestOrder2ExportJsonService,
    TestOrder2ImportService,
  ],
  controllers: [TestOrder2Controller],
  exports: [
    TestOrder2Service,
    OrderCalculationService,
    OrderPaymentService,
    OrderReportService,
    TestOrder2ExportService,
    TestOrder2ExportJsonService,
    TestOrder2ImportService,
    MongooseModule.forFeature([{ name: TestOrder2.name, schema: TestOrder2Schema }])
  ],
})
export class TestOrder2Module {}
