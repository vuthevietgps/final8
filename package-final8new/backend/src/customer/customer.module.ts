/**
 * File: customer/customer.module.ts
 * Mục đích: Module tổng hợp cho chức năng Khách Hàng.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomerController } from './customer.controller';
import { CustomerService } from './customer.service';
import { Customer, CustomerSchema } from './schemas/customer.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';
import { Product, ProductSchema } from '../product/schemas/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Customer.name, schema: CustomerSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
      { name: Product.name, schema: ProductSchema }
    ])
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService]
})
export class CustomerModule {}