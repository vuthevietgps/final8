/**
 * File: ad-account/ad-account.module.ts
 * Mục đích: Module quản lý Tài Khoản Quảng Cáo.
 */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdAccountService } from './ad-account.service';
import { AdAccountController } from './ad-account.controller';
import { AdAccount, AdAccountSchema } from './schemas/ad-account.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AdAccount.name, schema: AdAccountSchema }]),
  ],
  controllers: [AdAccountController],
  providers: [AdAccountService],
  exports: [AdAccountService],
})
export class AdAccountModule {}
