/**
 * File: features/product/models/product.interface.ts
 * Mục đích: Định nghĩa interface cho Sản phẩm ở frontend.
 */
export interface Product {
  _id: string;
  name: string;
  categoryId: ProductCategoryRef;
  status: 'Hoạt động' | 'Tạm dừng' | 'Ngừng bán';
  color: string;
  usageDurationMonths?: number;
  assumedReturnRatePercent?: number;
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  totalCost?: number;
  minStock?: number;
  maxStock?: number;
  notes?: string;
  resourceLink?: string;
  sku?: string;
  suppliers?: Array<{ supplierId?: string }>;
  createdAt?: string;
  updatedAt?: string;
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
  status?: 'Hoạt động' | 'Tạm dừng' | 'Ngừng bán';
  color?: string;
  usageDurationMonths?: number;
  assumedReturnRatePercent?: number;
  importPrice?: number;
  shippingCost?: number;
  packagingCost?: number;
  minStock?: number;
  maxStock?: number;
  notes?: string;
  resourceLink?: string;
  supplierIds?: string[];
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
