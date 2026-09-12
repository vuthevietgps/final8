/** Product-specific commercial terms, independent of the supplier's return policy. */
export const DEALER_RETURN_POLICIES = [
  'unconfigured',
  'no_goods_charge',
  'supplier_cost',
  'full_sale_price',
  'by_agreement',
] as const;
export type DealerReturnPolicy = (typeof DEALER_RETURN_POLICIES)[number];

export function requireDealerReturnPolicy(value: unknown): Exclude<DealerReturnPolicy, 'unconfigured'> {
  if (!DEALER_RETURN_POLICIES.includes(value as DealerReturnPolicy) || value === 'unconfigured') {
    throw new Error('Cần cấu hình trách nhiệm đại lý khi hàng hoàn tại sản phẩm trước khi chốt đơn đại lý.');
  }
  return value as Exclude<DealerReturnPolicy, 'unconfigured'>;
}
