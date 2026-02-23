import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupplierQuoteController } from './supplier-quote.controller';
import { SupplierQuoteService } from './supplier-quote.service';
import { SupplierQuote, SupplierQuoteSchema } from './schemas/supplier-quote.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: SupplierQuote.name, schema: SupplierQuoteSchema }])],
  controllers: [SupplierQuoteController],
  providers: [SupplierQuoteService],
  exports: [SupplierQuoteService],
})
export class SupplierQuoteModule {}
