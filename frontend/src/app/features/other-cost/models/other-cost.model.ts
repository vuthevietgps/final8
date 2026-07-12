/**
 * File: features/other-cost/models/other-cost.model.ts
 */
export interface OtherCost {
  _id?: string;
  date: string; // ISO string
  dueDate?: string;
  amount: number;
  notes?: string;
  documentLink?: string;
  isConfirmed?: boolean;
  confirmedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateOtherCost = Pick<OtherCost, 'date' | 'dueDate' | 'amount' | 'notes' | 'documentLink'>;
export type UpdateOtherCost = Partial<CreateOtherCost>;

export interface OtherCostSummary {
  totalAmount: number;
  count: number;
}
