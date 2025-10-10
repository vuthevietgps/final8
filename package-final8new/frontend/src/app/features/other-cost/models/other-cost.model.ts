/**
 * File: features/other-cost/models/other-cost.model.ts
 */
export interface OtherCost {
  _id?: string;
  date: string; // ISO string
  amount: number;
  notes?: string;
  documentLink?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateOtherCost = Pick<OtherCost, 'date' | 'amount' | 'notes' | 'documentLink'>;
export type UpdateOtherCost = Partial<CreateOtherCost>;

export interface OtherCostSummary {
  totalAmount: number;
  count: number;
}
