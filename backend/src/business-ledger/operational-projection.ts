import { isDealerSale } from '../test-order2/order-sale-mode';

/** Read-only commercial projection. Cash always comes from confirmed journal entries. */
export function operationalEntries(orders: any[], includeAllocatedOverhead = true): any[] {
  return orders.filter(o => o.financialModelVersion === 2 && o.isActive !== false).flatMap(order => {
    const dealer = isDealerSale(order);
    const orderId = String(order._id);
    const context = { orderId, productId: String(order.productId?._id || order.productId),
      agentId: dealer && order.agentId ? String(order.agentId) : undefined,
      supplierId: order.supplierId ? String(order.supplierId) : undefined,
      quantity: order.quantity, adGroupId: order.adGroupId, orderDate: order.orderDate };
    const base = { orderId, context, status: 'confirmed', occurredAt: order.orderDate,
      productName: order.productId?.name, operationalProjection: true };
    const debtEffects = [];
    if (order.supplierId && order.supplierContractAmount) debtEffects.push({
      partyKey: `supplier:${order.supplierId}`, amount: -order.supplierContractAmount,
    });
    for (const shipment of order.shipments || []) {
      if (shipment.status !== 'preparing' && shipment.feePayeeKind === 'other') debtEffects.push({
        partyKey: `other:${shipment.feePayeeName.trim().toLowerCase()}`, amount: -(shipment.shippingCost + shipment.returnCost),
      });
    }
    const ready = order.dealerProfitState === 'recognized' || order.retailProfitState === 'recognized';
    const entries: any[] = [{ ...base, _id: `operational:${orderId}:obligation`, kind: 'opening_payable',
      effects: { revenue: 0, cogs: 0, expense: 0, debts: debtEffects, cash: [] } }];
    if (ready) {
      entries.push({ ...base, _id: `operational:${orderId}:sale`, kind: 'sale', effects: {
        revenue: order.recognizedRevenue || 0, cogs: 0, expense: 0, cash: [], debts: [{
          partyKey: dealer ? `agent:${order.agentId}` : `customer:${orderId}`,
          amount: dealer ? order.dealerContractAmount || 0 : order.recognizedRevenue || 0,
        }],
      } });
      entries.push({ ...base, _id: `operational:${orderId}:cost`, kind: 'inventory_cost', effects: {
        revenue: 0, cogs: order.recognizedGoodsCost || 0,
        expense: (order.recognizedRevenue || 0) - (order.recognizedGoodsCost || 0) - (order.grossProfit || 0), debts: [], cash: [],
      } });
    }
    if (!ready && order.retailProfitState === 'awaiting_delivery') entries.push({
      ...base, _id: `operational:${orderId}:dispatch-cost`, kind: 'expense', effects: {
        revenue: 0, cogs: 0, expense: -Number(order.grossProfit || 0), debts: [], cash: [],
      },
    });
    if (includeAllocatedOverhead) entries.push({ ...base, _id: `operational:${orderId}:allocation`, kind: 'expense', effects: {
      revenue: 0, cogs: 0, expense: (order.laborCostAllocation || 0) + (order.otherCostAllocation || 0), debts: [], cash: [],
    } });
    return entries;
  });
}
