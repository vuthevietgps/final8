/**
 * File: features/quote/models/quote.model.ts
 * Mục đích: Khai báo kiểu dữ liệu (interface) cho Báo giá dùng ở frontend.
 */
export interface Quote {
  _id?: string;
  productId: string | Product;
  agentId: string | User;
  unitPrice: number; // Đổi từ price sang unitPrice
  status: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối' | 'Hết hiệu lực';
  validFrom: string; // Đổi từ expiryDate
  validUntil: string; // Thêm field mới
  notes?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateQuote {
  productId: string;
  agentId?: string; // Optional khi applyToAllAgents = true
  unitPrice: number; // Đổi từ price sang unitPrice
  status: string; // Thêm lại status field
  validFrom: string; // Đổi từ expiryDate
  validUntil: string; // Thêm field mới
  notes?: string;
  applyToAllAgents?: boolean; // Tính năng mới
}

export interface UpdateQuote extends Partial<CreateQuote> {}

export interface QuoteStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  approvalRate: number;
}

export interface Product {
  _id: string;
  name: string;
  sku: string;
  price: number;
}

export interface User {
  _id?: string;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}
