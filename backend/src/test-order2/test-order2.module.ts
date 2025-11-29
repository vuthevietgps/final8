import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestOrder2, TestOrder2Schema } from './schemas/test-order2.schema';
import { TestOrder2Service } from './test-order2.service';
import { TestOrder2ExportService } from './test-order2-export.service';
import { TestOrder2ExportJsonService } from './test-order2-export-json.service';
import { TestOrder2ImportService } from './test-order2-import.service';
import { TestOrder2Controller } from './test-order2.controller';
import { Summary4Module } from '../summary4/summary4.module';
import { GoogleSyncModule } from '../google-sync/google-sync.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TestOrder2.name, schema: TestOrder2Schema }]),
    forwardRef(() => Summary4Module),
    GoogleSyncModule,
  ],
  providers: [TestOrder2Service, TestOrder2ExportService, TestOrder2ExportJsonService, TestOrder2ImportService],
  controllers: [TestOrder2Controller],
  exports: [
    TestOrder2Service,
    TestOrder2ExportService,
    TestOrder2ExportJsonService,
    TestOrder2ImportService,
    MongooseModule.forFeature([{ name: TestOrder2.name, schema: TestOrder2Schema }])
  ],
})
export class TestOrder2Module {}
