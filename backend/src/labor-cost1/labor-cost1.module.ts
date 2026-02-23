import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LaborCost1, LaborCost1Schema } from './schemas/labor-cost1.schema';
import { LaborStatement, LaborStatementSchema } from './schemas/labor-statement.schema';
import { SalaryConfig, SalaryConfigSchema } from '../salary-config/schemas/salary-config.schema';
import { SessionLog, SessionLogSchema } from '../session-log/session-log.schema';
import { LaborCost1Service } from './labor-cost1.service';
import { LaborStatementService } from './labor-statement.service';
import { LaborCost1Controller } from './labor-cost1.controller';
import { FinanceModule } from '../finance/finance.module';
import { SalaryConfigModule } from '../salary-config/salary-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LaborCost1.name, schema: LaborCost1Schema },
      { name: LaborStatement.name, schema: LaborStatementSchema },
      { name: SalaryConfig.name, schema: SalaryConfigSchema },
      { name: SessionLog.name, schema: SessionLogSchema },
    ]),
    forwardRef(() => FinanceModule),
    SalaryConfigModule,
  ],
  controllers: [LaborCost1Controller],
  providers: [LaborCost1Service, LaborStatementService],
  exports: [LaborCost1Service, LaborStatementService],
})
export class LaborCost1Module {}
