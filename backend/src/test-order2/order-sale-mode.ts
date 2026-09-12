export type OrderSaleMode = 'retail' | 'dealer';

export function saleModeForAgentRole(agentId: unknown, role?: string): OrderSaleMode {
  if (!agentId || role === 'internal_agent') return 'retail';
  if (role === 'external_agent') return 'dealer';
  // Preserve the historical interpretation only when an old row has not yet
  // captured its role. Callers should mark these rows for review/backfill.
  return 'dealer';
}

export function isDealerSale(order: {
  agentId?: unknown;
  saleMode?: OrderSaleMode;
  agentRoleSnapshot?: string;
}): boolean {
  if (order.saleMode) return order.saleMode === 'dealer';
  return saleModeForAgentRole(order.agentId, order.agentRoleSnapshot) === 'dealer';
}
