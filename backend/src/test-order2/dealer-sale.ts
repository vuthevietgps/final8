/** The dealer buys the goods; its customer's return is not a return of our sale. */
export interface DealerSaleInput {
  productSource?: string;
  inventoryUnitCostSnapshot?: number;
  dealerShippingFeeSnapshot?: number;
  dealerReturnFeeSnapshot?: number;
  dealerShippingCharges?: number;
  dealerReturnCharges?: number;
  supplierFreightObligation?: number;
  agentId?: unknown;
  quantity?: number;
  productionStatus?: string;
  trackingNumber?: string;
  dealerSaleRecognizedAt?: Date | string;
  dealerReturnedAt?: Date | string;
  agentQuoteId?: string;
  agentQuoteSnapshotAt?: Date | string;
  agentAppliedPrice?: number;
  supplierQuoteId?: unknown;
  supplierQuoteSnapshotAt?: Date | string;
  supplierAppliedPrice?: number;
  shippingFee?: number;
  returnFee?: number;
  packagingCostSnapshot?: number;
  dealerShippingIncludedInPrice?: boolean;
}

export function dealerSaleAmounts(order: DealerSaleInput, isReturn: boolean) {
  const dispatched = Boolean(order.dealerSaleRecognizedAt)
    || (order.productionStatus === 'Đã trả kết quả' && Boolean(order.trackingNumber?.trim()));
  const quantity = Number(order.quantity ?? 1);
  const stockSource = ['inventory', 'dealer_custody'].includes(order.productSource || '');
  const hasQuotes = Boolean(order.agentQuoteId)
    && (stockSource ? Number.isFinite(order.inventoryUnitCostSnapshot) : Boolean(order.supplierQuoteId))
    && Number.isFinite(order.agentAppliedPrice) && Number(order.agentAppliedPrice) >= 0
    && (stockSource || (Number.isFinite(order.supplierAppliedPrice) && Number(order.supplierAppliedPrice) >= 0))
    && Number.isInteger(quantity) && quantity > 0;
  const state = !dispatched ? 'awaiting_dispatch' : !hasQuotes ? 'missing_quotes' : 'recognized';
  const shipping = dispatched ? Number(order.shippingFee || 0) : 0;
  const hasReturned = isReturn || Boolean(order.dealerReturnedAt);
  const returns = dispatched && (hasReturned || order.supplierFreightObligation != null) ? Number(order.returnFee || 0) : 0;
  const packaging = dispatched ? Number(order.packagingCostSnapshot || 0) * quantity : 0;
  // Dealer always owes outbound freight, plus return freight once incurred.
  // Ignore the legacy included-shipping flag for every dealer order.
  const returnCharges = order.dealerReturnCharges ?? (hasReturned ? Number(order.dealerReturnFeeSnapshot ?? returns) : 0);
  const recoverableFees = dispatched ? Number(order.dealerShippingCharges ?? order.dealerShippingFeeSnapshot ?? shipping) + returnCharges : 0;
  const custody = order.productSource === 'dealer_custody';
  const revenue = state === 'recognized' && !custody ? Number(order.agentAppliedPrice) * quantity : 0;
  // Holding a dealer's returned goods never restores company-owned inventory/cost.
  const goodsCost = state === 'recognized' && !custody
    ? Math.round(Number(stockSource ? order.inventoryUnitCostSnapshot : order.supplierAppliedPrice) * quantity) : 0;
  return {
    state, dispatched, revenue, goodsCost, shipping, returns, packaging,
    recoverableFees, returnFeeReceivable: returnCharges,
    contractAmount: state === 'recognized' ? revenue + recoverableFees : 0,
    supplierContractAmount: (!stockSource && order.productionStatus === 'Đã trả kết quả' && order.supplierQuoteId
      ? Number(order.supplierAppliedPrice || 0) * quantity : 0)
      + Number(order.supplierFreightObligation ?? (stockSource ? 0 : shipping + returns)),
    grossProfit: state === 'recognized'
      ? revenue - goodsCost - shipping - returns - packaging + recoverableFees : 0,
  };
}
