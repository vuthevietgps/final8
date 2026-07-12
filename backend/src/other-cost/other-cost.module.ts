import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OtherCost, OtherCostSchema } from './schemas/other-cost.schema';
import { OtherCostService } from './other-cost.service';
import { OtherCostController } from './other-cost.controller';
import { TestOrder2Module } from '../test-order2/test-order2.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OtherCost.name, schema: OtherCostSchema },
    ]),
    forwardRef(() => TestOrder2Module),
  ],
  controllers: [OtherCostController],
  providers: [OtherCostService],
  exports: [OtherCostService],
})
export class OtherCostModule {}
