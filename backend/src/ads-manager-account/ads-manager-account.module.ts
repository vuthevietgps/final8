import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdAccount, AdAccountSchema } from '../ad-account/schemas/ad-account.schema';
import { ApiTokenModule } from '../api-token/api-token.module';
import {
  ADS_MANAGER_READONLY_VERIFIER,
  AdsManagerAccountReadonlyVerificationService,
} from './ads-manager-account-readonly-verification.service';
import { AdsManagerAccountController } from './ads-manager-account.controller';
import { AdsManagerAccountService } from './ads-manager-account.service';
import {
  AdsManagerAccount,
  AdsManagerAccountSchema,
} from './schemas/ads-manager-account.schema';

@Module({
  imports: [
    ApiTokenModule,
    MongooseModule.forFeature([
      { name: AdsManagerAccount.name, schema: AdsManagerAccountSchema },
      { name: AdAccount.name, schema: AdAccountSchema },
    ]),
  ],
  controllers: [AdsManagerAccountController],
  providers: [
    AdsManagerAccountReadonlyVerificationService,
    {
      provide: ADS_MANAGER_READONLY_VERIFIER,
      useExisting: AdsManagerAccountReadonlyVerificationService,
    },
    AdsManagerAccountService,
  ],
  exports: [AdsManagerAccountService],
})
export class AdsManagerAccountModule {}
