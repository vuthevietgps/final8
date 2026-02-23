import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OwnerFundController } from './owner-fund.controller';
import { OwnerFundService } from './owner-fund.service';
import { Owner, OwnerSchema } from './schemas/owner.schema';
import { Withdrawal, WithdrawalSchema } from './schemas/withdrawal.schema';
import { FundTransaction, FundTransactionSchema } from './schemas/fund-transaction.schema';
import { OwnerFundAccount, OwnerFundAccountSchema } from './schemas/owner-fund-account.schema';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Owner.name, schema: OwnerSchema },
      { name: Withdrawal.name, schema: WithdrawalSchema },
      { name: FundTransaction.name, schema: FundTransactionSchema },
      { name: OwnerFundAccount.name, schema: OwnerFundAccountSchema },
    ]),
    forwardRef(() => FinanceModule),
  ],
  controllers: [OwnerFundController],
  providers: [OwnerFundService],
  exports: [OwnerFundService],
})
export class OwnerFundModule {}
