/**
 * File: features/customer/models/customer.interface.ts
 * Mục đích: Định nghĩa interface cho Khách Hàng ở frontend.
 */
export interface Customer {
  _id: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  productId: ProductRef;
  latestPurchaseDate: string;
  usageDurationMonths: number;
  remainingDays: number;
  isDisabled: boolean;
  notes?: string;
  latestOrderId?: string;
  lastCalculated: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRef {
  _id: string;
  name: string;
  sku: string;
  color: string;
  usageDurationMonths: number;
}

export interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  expiringSoon: number;
  expired: number;
  disabledCustomers: number;
}

export interface CustomerQuery {
  search?: string;
  expiringSoon?: boolean;
  isDisabled?: boolean;
  limit?: number;
  skip?: number;
}

export interface UpdateCustomerDto {
  customerName?: string;
  phoneNumber?: string;
  address?: string;
  notes?: string;
  isDisabled?: boolean;
}