/**
 * File: features/product/models/product.interface.ts
 * Mục đích: Định nghĩa interface cho Sản phẩm ở frontend.
 */
export interface Product {
  _id: string;
  name: string;
  categoryId: ProductCategoryRef;
  status: 'Hoạt động' | 'Tạm dừng';
  color: string;
  usageDurationMonths?: number;
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
  status?: 'Hoạt động' | 'Tạm dừng';
  color?: string;
  usageDurationMonths?: number;
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
