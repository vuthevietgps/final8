import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionLog, SessionLogSchema } from './session-log.schema';
import { SessionLogService } from './session-log.service';
import { SessionLogController } from './session-log.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: SessionLog.name, schema: SessionLogSchema }])],
  providers: [SessionLogService],
  controllers: [SessionLogController],
  exports: [SessionLogService],
})
export class SessionLogModule {}
