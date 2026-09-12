/** Dealer purchases create receivables; delivery never proves payment. */
export function dealerReceivableStages(): any[] {
  return [
    { $set: {
      _qty: { $ifNull: ['$quantity', 1] },
      _price: { $ifNull: ['$agentAppliedPrice', '$agentQuote'] },
      _issued: { $or: [
        { $ne: [{ $ifNull: ['$dealerSaleRecognizedAt', null] }, null] },
        { $and: [{ $eq: ['$productionStatus', 'Đã trả kết quả'] },
          { $ne: [{ $trim: { input: { $ifNull: ['$trackingNumber', ''] } } }, ''] }] },
      ] },
      _returned: { $or: [{ $eq: ['$orderStatus', 'Hàng hoàn'] },
        { $ne: [{ $ifNull: ['$dealerReturnedAt', null] }, null] }] },
    } },
    { $set: {
      _hasQuote: { $and: [{ $ne: [{ $ifNull: ['$agentQuoteId', null] }, null] }, { $gte: ['$_price', 0] }] },
      _shipping: { $ifNull: ['$dealerShippingCharges', { $ifNull: ['$dealerShippingFeeSnapshot', { $ifNull: ['$shippingFee', 0] }] }] },
      _return: { $ifNull: ['$dealerReturnCharges', { $cond: ['$_returned', { $ifNull: ['$dealerReturnFeeSnapshot', { $ifNull: ['$returnFee', 0] }] }, 0] }] },
    } },
    { $set: {
      quoteAmount: { $cond: [{ $and: ['$_issued', '$_hasQuote', { $ne: ['$productSource', 'dealer_custody'] }] },
        { $multiply: ['$_price', '$_qty'] }, 0] },
      needsReview: { $not: ['$_hasQuote'] },
    } },
    { $lookup: { from: 'businessledgerentries', let: { orderKey: { $toString: '$_id' } }, pipeline: [
      { $match: { status: 'confirmed', $expr: { $eq: ['$orderId', '$$orderKey'] } } },
    ], as: '_entries' } },
    { $set: { _paymentIds: { $map: {
      input: { $filter: { input: '$_entries', as: 'e', cond: { $eq: ['$$e.kind', 'payment'] } } },
      as: 'e', in: { $toString: '$$e._id' },
    } } } },
    { $set: { collected: { $multiply: [-1, { $sum: { $map: {
      input: { $filter: { input: '$_entries', as: 'e', cond: { $or: [
        { $eq: ['$$e.kind', 'payment'] },
        { $and: [{ $eq: ['$$e.kind', 'reversal'] }, { $in: ['$$e.reversalOf', '$_paymentIds'] }] },
      ] } } }, as: 'e', in: { $sum: { $map: {
        input: { $filter: { input: '$$e.effects.debts', as: 'd', cond: {
          $eq: ['$$d.partyKey', { $concat: ['agent:', { $toString: '$agentId' }] }],
        } } }, as: 'd', in: '$$d.amount',
      } } },
    } } }] } } },
    { $set: { receivableBase: { $cond: [{ $and: ['$_issued', '$_hasQuote'] },
      { $add: ['$quoteAmount', '$_shipping', '$_return'] }, 0] } } },
    // Negative balances are customer credits; do not discard overpayments.
    { $set: { receivable: { $subtract: ['$receivableBase', '$collected'] } } },
  ];
}
