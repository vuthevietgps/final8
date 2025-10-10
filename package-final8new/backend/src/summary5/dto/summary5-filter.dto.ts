export interface Summary5FilterDto {
  agentId?: string;
  productId?: string;
  productionStatus?: string;
  orderStatus?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
