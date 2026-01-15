import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReturnReportService } from './return-report.service';
import { ReturnReportController } from './return-report.controller';
import { Summary4, Summary4Schema } from '../summary4/schemas/summary4.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Summary4.name, schema: Summary4Schema }]),
  ],
  providers: [ReturnReportService],
  controllers: [ReturnReportController],
})
export class ReturnReportModule {}
