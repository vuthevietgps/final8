import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpsActionController } from './ops-action.controller';
import { OpsActionService } from './ops-action.service';
import { SupplierPayableModule } from '../supplier-payable/supplier-payable.module';
import { AgentReceivableModule } from '../agent-receivable/agent-receivable.module';
import { AdsAlertsModule } from '../ads-alerts/ads-alerts.module';
import { OpsActionPlan, OpsActionPlanSchema } from './schemas/ops-action-plan.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: OpsActionPlan.name, schema: OpsActionPlanSchema }]), SupplierPayableModule, AgentReceivableModule, AdsAlertsModule],
  controllers: [OpsActionController],
  providers: [OpsActionService],
  exports: [OpsActionService],
})
export class OpsActionModule {}
