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
  expired?: boolean;  // P1 FIX: filter expired
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

// P2 FIX: Response with pagination
export interface CustomerListResponse {
  customers: Customer[];
  total: number;
  limit: number;
  skip: number;
}

// NEW: Notification interfaces for CSKH
export interface CustomerExpiryNotification {
  _id: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  productName: string;
  productSku: string;
  remainingDays: number;
  expiryDate: string;
  latestPurchaseDate: string;
  priority: 'urgent' | 'warning' | 'normal';
}

export interface ExpiryNotificationResponse {
  notifications: CustomerExpiryNotification[];
  summary: {
    total: number;
    urgent: number;
    warning: number;
    normal: number;
  };
  generatedAt: string;
}

export interface WeeklyCalendarDay {
  date: string;
  dayOfWeek: string;
  customersExpiring: CustomerExpiryNotification[];
  count: number;
}

export interface WeeklyCalendarResponse {
  calendar: WeeklyCalendarDay[];
  totalThisWeek: number;
  generatedAt: string;
}