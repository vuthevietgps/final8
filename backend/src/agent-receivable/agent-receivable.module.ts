import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentReceivableController } from './agent-receivable.controller';
import { AgentPayablesController } from './agent-payables.controller';
import { AgentReceivableService } from './agent-receivable.service';
import { AgentStatement, AgentStatementSchema } from './schemas/agent-statement.schema';
import { TestOrder2, TestOrder2Schema } from '../test-order2/schemas/test-order2.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AgentStatement.name, schema: AgentStatementSchema },
      { name: TestOrder2.name, schema: TestOrder2Schema },
    ]),
  ],
  // CFO Spec v3.1: Thêm controller mới /api/agent-payables (đúng tên)
  // Route cũ /api/agent-receivables vẫn hoạt động (deprecated)
  controllers: [AgentReceivableController, AgentPayablesController],
  providers: [AgentReceivableService],
  exports: [AgentReceivableService],
})
export class AgentReceivableModule {}
