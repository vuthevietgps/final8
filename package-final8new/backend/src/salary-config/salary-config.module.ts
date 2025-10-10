import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SalaryConfig, SalaryConfigSchema } from './schemas/salary-config.schema';
import { SalaryConfigService } from './salary-config.service';
import { SalaryConfigController } from './salary-config.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SalaryConfig.name, schema: SalaryConfigSchema }]),
  ],
  controllers: [SalaryConfigController],
  providers: [SalaryConfigService],
})
export class SalaryConfigModule {}
