/**
 * File: ad-account/ad-account.module.ts
 * Mục đích: Module quản lý Tài Khoản Quảng Cáo.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdAccountService } from './ad-account.service';
import { AdAccountController } from './ad-account.controller';
import { AdAccount, AdAccountSchema } from './schemas/ad-account.schema';
import { AdAccountTimezoneCheckService } from './ad-account.timezone-check.service';
import { ApiTokenModule } from '../api-token/api-token.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AdAccount.name, schema: AdAccountSchema }]),
    ApiTokenModule,
  ],
  controllers: [AdAccountController],
  providers: [AdAccountService, AdAccountTimezoneCheckService],
  exports: [AdAccountService],
})
export class AdAccountModule {}
