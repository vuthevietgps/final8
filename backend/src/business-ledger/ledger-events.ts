import {Logger} from '@nestjs/common';
import {EventEmitter2} from '@nestjs/event-emitter';
import {FinanceEvents} from '../finance/events/finance-events.constants';

/** Refresh financial projections only after the journal transaction has committed. */
export function notifyLedgerChanged(events?:EventEmitter2){
  try{events?.emit(FinanceEvents.ORDER_PAYMENT_UPDATED,{orderId:'business-ledger',paymentType:'both'});}
  catch{Logger.warn('Ledger committed; finance projection refresh requires retry.','BusinessLedger');}
}
