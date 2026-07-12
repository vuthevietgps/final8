export const ERP_FIELD_ALIASES = [
  { standard_entity: 'service_group', erp_entity: 'ProductCategory', confidence: 'medium', note: 'V1 alias; cần xác nhận taxonomy.' },
  { standard_entity: 'product_variant', erp_entity: 'Product', confidence: 'medium', note: 'Order và profit tính theo Product.' },
  { standard_entity: 'lead', erp_entity: 'MarketingLead', confidence: 'medium', note: 'Một phần lead được suy diễn.' },
  { standard_entity: 'order', erp_entity: 'TestOrder2', confidence: 'high', note: 'Nguồn order/profit chính.' },
  { standard_entity: 'ad_group', erp_entity: 'AdGroup', confidence: 'medium', note: 'Multi-channel mapping ở cấp ad group.' },
] as const;

export function mapLoanStatus(loan: { status?: string; disbursementStatus?: string }): string {
  if (loan.status === 'draft') return 'proposed';
  if (loan.status === 'closed') return 'repaid';
  if (loan.status === 'active' && loan.disbursementStatus === 'pending') return 'approved_not_disbursed';
  if (loan.status === 'active' && ['partial', 'fully'].includes(String(loan.disbursementStatus))) return 'disbursed';
  return 'unknown';
}

