import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OpenAIConfig, OpenAIConfigSchema } from './schemas/openai-config.schema';
import { OpenAIConfigService } from './openai-config.service';
import { OpenAIConfigController } from './openai-config.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: OpenAIConfig.name, schema: OpenAIConfigSchema }])],
  providers: [OpenAIConfigService],
  controllers: [OpenAIConfigController],
  exports: [OpenAIConfigService]
})
export class OpenAIConfigModule {}
