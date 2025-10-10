/**
 * File: features/product-category/models/product-category.interface.ts
 * Mục đích: Định nghĩa interface cho Nhóm Sản phẩm ở frontend.
 */
export interface ProductCategory {
  _id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  isActive: boolean;
  order: number;
  code: string;
  productCount: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductCategoryDto {
  name: string;
  description: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  order?: number;
  code?: string;
  productCount?: number;
  notes?: string;
}

export interface UpdateProductCategoryDto extends Partial<CreateProductCategoryDto> {}

export interface ProductCategoryStats {
  total: number;
  active: number;
  inactive: number;
  totalProducts: number;
  averageProductsPerCategory: number;
}
