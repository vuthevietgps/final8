/**
 * File: other-cost/other-cost.module.ts
 * Mục đích: Module NestJS cho tính năng Chi Phí Khác.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OtherCost, OtherCostSchema } from './schemas/other-cost.schema';
import { OtherCostService } from './other-cost.service';
import { OtherCostController } from './other-cost.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OtherCost.name, schema: OtherCostSchema },
    ]),
  ],
  controllers: [OtherCostController],
  providers: [OtherCostService],
  exports: [OtherCostService],
})
export class OtherCostModule {}
