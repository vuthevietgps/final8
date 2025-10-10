/**
 * File: fanpage.module.ts
 * Mục đích: Module quản lý Fanpage với dependency injection OpenAIConfigService
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Fanpage, FanpageSchema } from './schemas/fanpage.schema';
import { FanpageService } from './fanpage.service';
import { FanpageController } from './fanpage.controller';
import { OpenAIConfigModule } from '../openai-config/openai-config.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Fanpage.name, schema: FanpageSchema }]),
    OpenAIConfigModule
  ],
  providers: [FanpageService],
  controllers: [FanpageController],
  exports: [FanpageService]
})
export class FanpageModule {}
