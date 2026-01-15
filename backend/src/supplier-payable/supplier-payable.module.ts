import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupplierPayableController } from './supplier-payable.controller';
import { SupplierPayableService } from './supplier-payable.service';
import { SupplierPayable, SupplierPayableSchema } from './schemas/supplier-payable.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SupplierPayable.name, schema: SupplierPayableSchema }]),
  ],
  controllers: [SupplierPayableController],
  providers: [SupplierPayableService],
  exports: [SupplierPayableService],
})
export class SupplierPayableModule {}
