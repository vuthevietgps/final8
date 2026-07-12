/**
 * File: features/product/product.component.ts
 * Mục đích: Giao diện quản lý Sản phẩm (danh sách, form, lọc,...).
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from './product.service';
import { ProductCategoryService } from '../product-category/product-category.service';
import { Product, CreateProductDto, UpdateProductDto, ProductStats } from './models/product.interface';
import { ProductCategory } from '../product-category/models/product-category.interface';
import { SupplierService, Supplier } from '../supplier/supplier.service';

@Component({
  selector: 'app-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.css']
})
export class ProductComponent implements OnInit {
  // Signals for reactive state management
  products = signal<Product[]>([]);
  categories = signal<ProductCategory[]>([]);
  stats = signal<ProductStats>({
    totalProducts: 0,
    totalValue: 0,
    averageImportPrice: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    categoryDistribution: {}
  });
  
  isLoading = signal(false);
  error = signal<string | null>(null);

  suppliers = signal<Supplier[]>([]);
  
  // Modal state
  isAddModalOpen = signal(false);
  isEditModalOpen = signal(false);
  selectedProduct = signal<Product | null>(null);
  
  // Form data
  formData = signal<CreateProductDto>({
    name: '',
    categoryId: '',
    status: 'Hoạt động',
    color: '#3B82F6',
    usageDurationMonths: 12,
    assumedReturnRatePercent: 20,
    importPrice: 0,
    shippingCost: 0,
    packagingCost: 0,
    minStock: 0,
    maxStock: 0,
    notes: '',
    resourceLink: '',
    supplierIds: [],
  });

  // Search and filter
  searchTerm = signal('');
  selectedStatus = signal('all');
  selectedCategory = signal('all');

  // Computed values
  filteredProducts = computed(() => {
    let filtered = this.products();
    
    const search = this.searchTerm().toLowerCase();
    if (search) {
      filtered = filtered.filter(product => 
        (product.name || '').toLowerCase().includes(search) ||
        (product.sku || '').toLowerCase().includes(search)
      );
    }

    const status = this.selectedStatus();
    if (status !== 'all') {
      filtered = filtered.filter(product => product.status === status);
    }

    const category = this.selectedCategory();
    if (category !== 'all') {
      filtered = filtered.filter(product => this.resolveCategoryId(product.categoryId) === category);
    }

    return filtered;
  });

  constructor(
    private productService: ProductService,
    private categoryService: ProductCategoryService,
    private supplierService: SupplierService,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadStats();
    this.loadCategories();
    this.loadSuppliers();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.error.set(null);
    
    this.productService.getAll().subscribe({
      next: (products) => {
        this.products.set(products.map(product => this.normalizeProduct(product)));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Không thể tải danh sách sản phẩm');
        this.isLoading.set(false);
        console.error('Error loading products:', err);
      }
    });
  }

  loadStats(): void {
    this.productService.getStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
      },
      error: (err) => {
        console.error('Error loading stats:', err);
      }
    });
  }

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.products.update(products => products.map(product => this.normalizeProduct(product)));
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  loadSuppliers(): void {
    this.supplierService.list({ active: true, minimal: true }).subscribe({
      next: (suppliers) => this.suppliers.set(suppliers),
      error: (err) => console.error('Error loading suppliers:', err)
    });
  }

  openAddModal(): void {
    this.formData.set({
      name: '',
      categoryId: '',
      status: 'Hoạt động',
      color: '#3B82F6',
      usageDurationMonths: 12,
      assumedReturnRatePercent: 20,
      importPrice: 0,
      shippingCost: 0,
      packagingCost: 0,
      minStock: 0,
      maxStock: 0,
      notes: '',
      resourceLink: '',
      supplierIds: [],
    });
    this.isAddModalOpen.set(true);
  }

  closeAddModal(): void {
    this.isAddModalOpen.set(false);
  }

  openEditModal(product: Product): void {
    this.selectedProduct.set(product);
    this.formData.set({
      name: product.name,
      categoryId: this.resolveCategoryId(product.categoryId),
      status: product.status,
      color: product.color || '#3B82F6',
      usageDurationMonths: product.usageDurationMonths || 12,
      assumedReturnRatePercent: product.assumedReturnRatePercent ?? 20,
      importPrice: product.importPrice ?? 0,
      shippingCost: product.shippingCost ?? 0,
      packagingCost: product.packagingCost ?? 0,
      minStock: product.minStock ?? 0,
      maxStock: product.maxStock ?? 0,
      notes: product.notes ?? '',
      resourceLink: product.resourceLink ?? '',
      supplierIds: (product.suppliers || []).map(s => s.supplierId || ''),
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedProduct.set(null);
  }

  createProduct(): void {
    if (!this.formData().name.trim()) {
      this.error.set('Tên sản phẩm không được để trống');
      return;
    }

    const usageDurationMonths = Number(this.formData().usageDurationMonths || 0);
    if (!Number.isFinite(usageDurationMonths) || usageDurationMonths < 1) {
      this.error.set('Thoi han su dung phai >= 1 thang');
      return;
    }

    const assumedReturnRatePercent = Number(this.formData().assumedReturnRatePercent ?? 20);
    if (!Number.isFinite(assumedReturnRatePercent) || assumedReturnRatePercent < 0 || assumedReturnRatePercent > 95) {
      this.error.set('Ty le hang hoan X phai trong khoang 0-95%');
      return;
    }

    const numericFields = this.validatedNumericFields();
    if (!numericFields) return;

    const payload = {
      ...this.formData(),
      usageDurationMonths,
      assumedReturnRatePercent,
      ...numericFields,
    } as CreateProductDto;

    this.isLoading.set(true);
    this.productService.create(payload).subscribe({
      next: (product) => {
        const normalizedProduct = this.normalizeProduct(product);
        this.products.update(products => [...products, normalizedProduct]);
        this.loadStats();
        this.closeAddModal();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Không thể tạo sản phẩm mới');
        this.isLoading.set(false);
        console.error('Error creating product:', err);
      }
    });
  }

  updateProduct(): void {
    const product = this.selectedProduct();
    if (!product) return;

    if (!this.formData().name.trim()) {
      this.error.set('Tên sản phẩm không được để trống');
      return;
    }

    const usageDurationMonths = Number(this.formData().usageDurationMonths || 0);
    if (!Number.isFinite(usageDurationMonths) || usageDurationMonths < 1) {
      this.error.set('Thoi han su dung phai >= 1 thang');
      return;
    }

    const assumedReturnRatePercent = Number(this.formData().assumedReturnRatePercent ?? 20);
    if (!Number.isFinite(assumedReturnRatePercent) || assumedReturnRatePercent < 0 || assumedReturnRatePercent > 95) {
      this.error.set('Ty le hang hoan X phai trong khoang 0-95%');
      return;
    }

    const numericFields = this.validatedNumericFields();
    if (!numericFields) return;

    this.isLoading.set(true);
    const payload = {
      ...this.formData(),
      usageDurationMonths,
      assumedReturnRatePercent,
      ...numericFields,
    } as UpdateProductDto;
    this.productService.update(product._id, payload).subscribe({
      next: (updatedProduct) => {
        const normalizedProduct = this.normalizeProduct(updatedProduct);
        this.products.update(products => 
          products.map(p => p._id === product._id ? normalizedProduct : p)
        );
        this.loadStats();
        this.closeEditModal();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Không thể cập nhật sản phẩm');
        this.isLoading.set(false);
        console.error('Error updating product:', err);
      }
    });
  }

  deleteProduct(product: Product): void {
    if (!confirm(`Bạn có chắc muốn xóa sản phẩm "${product.name}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.productService.delete(product._id).subscribe({
      next: () => {
        this.products.update(products => 
          products.filter(p => p._id !== product._id)
        );
        this.loadStats();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Không thể xóa sản phẩm');
        this.isLoading.set(false);
        console.error('Error deleting product:', err);
      }
    });
  }

  onSupplierToggle(supplierId: string, checked: boolean) {
    const current = new Set(this.formData().supplierIds || []);
    if (checked) current.add(supplierId); else current.delete(supplierId);
    this.formData.update(f => ({ ...f, supplierIds: Array.from(current) }));
  }

  updateFormField(field: keyof CreateProductDto, value: any): void {
    this.formData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  onInputChange(field: keyof CreateProductDto, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const nonNegativeNumberFields: Array<keyof CreateProductDto> = [
      'importPrice',
      'shippingCost',
      'packagingCost',
      'minStock',
      'maxStock',
    ];
    const value: any = field === 'usageDurationMonths'
      ? Math.max(0, Math.floor(Number(target.value) || 0))
      : field === 'assumedReturnRatePercent'
        ? Math.max(0, Math.min(95, Number(target.value) || 0))
      : nonNegativeNumberFields.includes(field)
        ? Math.max(0, Number(target.value) || 0)
      : target.value;
    this.updateFormField(field, value);
  }

  private validatedNumericFields(): Pick<CreateProductDto,
    'importPrice' | 'shippingCost' | 'packagingCost' | 'minStock' | 'maxStock'> | null {
    const importPrice = Number(this.formData().importPrice ?? 0);
    const shippingCost = Number(this.formData().shippingCost ?? 0);
    const packagingCost = Number(this.formData().packagingCost ?? 0);
    const minStock = Number(this.formData().minStock ?? 0);
    const maxStock = Number(this.formData().maxStock ?? 0);
    const values = [importPrice, shippingCost, packagingCost, minStock, maxStock];
    if (values.some(value => !Number.isFinite(value) || value < 0)) {
      this.error.set('Gia von va nguong ton kho phai la so khong am.');
      return null;
    }
    if (maxStock > 0 && maxStock < minStock) {
      this.error.set('Ton kho toi da phai lon hon hoac bang ton kho toi thieu.');
      return null;
    }
    return { importPrice, shippingCost, packagingCost, minStock, maxStock };
  }

  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  onStatusFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStatus.set(target.value || 'all');
  }

  onCategoryFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedCategory.set(target.value || 'all');
  }

  clearError(): void {
    this.error.set(null);
  }

  private resolveCategoryId(category: Product['categoryId'] | string | null | undefined): string {
    if (!category) return '';
    if (typeof category === 'string') return category;
    return category._id || '';
  }

  private normalizeProduct(product: Product): Product {
    const categoryId = this.resolveCategoryId((product as any).categoryId);
    if (!categoryId) {
      return product;
    }

    const matchedCategory = this.categories().find(category => category._id === categoryId);
    if (!matchedCategory) {
      return product;
    }

    return {
      ...product,
      categoryId: matchedCategory,
    };
  }
}


