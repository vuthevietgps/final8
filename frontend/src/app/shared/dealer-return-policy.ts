export type DealerReturnPolicy = 'unconfigured' | 'no_goods_charge' | 'supplier_cost' | 'full_sale_price' | 'by_agreement';
export const DEALER_RETURN_POLICY_OPTIONS: ReadonlyArray<{ value: DealerReturnPolicy; label: string }> = [
  { value: 'unconfigured', label: 'Chưa xác nhận chính sách' },
  { value: 'no_goods_charge', label: 'Đại lý không chịu tiền hàng; phí hoàn xét riêng' },
  { value: 'supplier_cost', label: 'Đại lý chịu tiền hàng theo giá NCC' },
  { value: 'full_sale_price', label: 'Đại lý chịu tiền hàng theo giá bán cho đại lý' },
  { value: 'by_agreement', label: 'Đại lý chịu theo thỏa thuận riêng của sản phẩm' },
];
export function dealerReturnPolicyLabel(value?: string): string {
  return DEALER_RETURN_POLICY_OPTIONS.find(option => option.value === value)?.label || 'Chưa xác nhận chính sách';
}
