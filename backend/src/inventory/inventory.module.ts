import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryTransaction, InventoryTransactionSchema } from './schemas/inventory-transaction.schema';
import { InventorySummary, InventorySummarySchema } from './schemas/inventory-summary.schema';
import { InventoryBatch, InventoryBatchSchema } from './schemas/inventory-batch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: InventoryTransaction.name, schema: InventoryTransactionSchema },
      { name: InventorySummary.name, schema: InventorySummarySchema },
      { name: InventoryBatch.name, schema: InventoryBatchSchema },
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
