import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TestOrder2Service } from '../src/test-order2/test-order2.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const orders = app.get(TestOrder2Service);

  const supplierA = '65a0000000000000000000a1';
  const supplierB = '65a0000000000000000000b2';

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const samples = [
    {
      supplierId: supplierA,
      customerName: 'Demo khách 1',
      productSource: 'supplier',
      quantity: 3,
      supplierAppliedPrice: 180000,
      productionStatus: 'Đã trả kết quả',
      orderStatus: 'Giao thành công',
      codAmount: 540000,
      orderDate: new Date(now.getTime() - 5 * day).toISOString(),
    },
    {
      supplierId: supplierA,
      customerName: 'Demo khách 2',
      productSource: 'supplier',
      quantity: 2,
      supplierAppliedPrice: 185000,
      productionStatus: 'Đã trả kết quả',
      orderStatus: 'Giao thành công',
      codAmount: 370000,
      orderDate: new Date(now.getTime() - 3 * day).toISOString(),
    },
    {
      supplierId: supplierB,
      customerName: 'Demo khách 3',
      productSource: 'supplier',
      quantity: 3,
      supplierAppliedPrice: 180000,
      productionStatus: 'Đã trả kết quả',
      orderStatus: 'Giao thành công',
      codAmount: 540000,
      orderDate: new Date(now.getTime() - 2 * day).toISOString(),
    },
  ];

  for (const s of samples) {
    try {
      const res = await orders.create(s as any);
      console.log('Created order', res._id?.toString?.(), 'supplier', s.supplierId, 'amount', s.supplierAppliedPrice * s.quantity);
    } catch (e) {
      console.error('Create failed', s.customerName, e?.message || e);
    }
  }

  await app.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});