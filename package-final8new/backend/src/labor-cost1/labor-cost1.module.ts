import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LaborCost1, LaborCost1Schema } from './schemas/labor-cost1.schema';
import { SalaryConfig, SalaryConfigSchema } from '../salary-config/schemas/salary-config.schema';
import { SessionLog, SessionLogSchema } from '../session-log/session-log.schema';
import { LaborCost1Service } from './labor-cost1.service';
import { LaborCost1Controller } from './labor-cost1.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LaborCost1.name, schema: LaborCost1Schema },
      { name: SalaryConfig.name, schema: SalaryConfigSchema },
      { name: SessionLog.name, schema: SessionLogSchema },
    ]),
  ],
  controllers: [LaborCost1Controller],
  providers: [LaborCost1Service],
})
export class LaborCost1Module {}
