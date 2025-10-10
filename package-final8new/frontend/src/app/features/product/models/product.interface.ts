/**
 * File: features/product/models/product.interface.ts
 * Mục đích: Định nghĩa interface cho Sản phẩm ở frontend.
 */
export interface Product {
  _id: string;
  name: string;
  categoryId: ProductCategoryRef;
  importPrice: number;
  shippingCost: number;
  packagingCost: number;
  minStock: number;
  maxStock: number;
  estimatedDeliveryDays: number;
  usageDurationMonths: number;
  status: 'Hoạt động' | 'Tạm dừng';
  color: string;
  notes?: string;
  resourceLink?: string;
  sku: string;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategoryRef {
  _id: string;
  name: string;
  code: string;
  icon: string;
  color: string;
}

export interface CreateProductDto {
  name: string;
  categoryId: string;
  importPrice: number;
  shippingCost: number;
  packagingCost: number;
  minStock: number;
  maxStock: number;
  estimatedDeliveryDays?: number;
  usageDurationMonths?: number;
  status?: 'Hoạt động' | 'Tạm dừng';
  color?: string;
  notes?: string;
  resourceLink?: string;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

export interface ProductStats {
  totalProducts: number;
  totalValue: number;
  averageImportPrice: number;
  lowStockCount: number;
  outOfStockCount: number;
  categoryDistribution: { [key: string]: number };
}

export interface ProductQuery {
  categoryId?: string;
  status?: string;
  search?: string;
}
