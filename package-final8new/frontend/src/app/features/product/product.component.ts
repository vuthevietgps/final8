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
  
  // Modal state
  isAddModalOpen = signal(false);
  isEditModalOpen = signal(false);
  selectedProduct = signal<Product | null>(null);
  
  // Form data
  formData = signal<CreateProductDto>({
    name: '',
    categoryId: '',
    importPrice: 0,
    shippingCost: 0,
    packagingCost: 0,
    minStock: 10,
    maxStock: 100,
    estimatedDeliveryDays: 1,
    usageDurationMonths: 12,
    status: 'Hoạt động',
    color: '#3B82F6',
    notes: '',
    resourceLink: ''
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
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.notes?.toLowerCase().includes(search)
      );
    }

    const status = this.selectedStatus();
    if (status !== 'all') {
      filtered = filtered.filter(product => product.status === status);
    }

    const category = this.selectedCategory();
    if (category !== 'all') {
      filtered = filtered.filter(product => product.categoryId._id === category);
    }

    return filtered;
  });

  constructor(
    private productService: ProductService,
    private categoryService: ProductCategoryService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadStats();
    this.loadCategories();
  }

  loadProducts(): void {
    this.isLoading.set(true);
    this.error.set(null);
    
    this.productService.getAll().subscribe({
      next: (products) => {
        this.products.set(products);
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
      },
      error: (err) => {
        console.error('Error loading categories:', err);
      }
    });
  }

  openAddModal(): void {
    this.formData.set({
      name: '',
      categoryId: '',
      importPrice: 0,
      shippingCost: 0,
      packagingCost: 0,
      minStock: 10,
      maxStock: 100,
      estimatedDeliveryDays: 1,
      usageDurationMonths: 12,
      status: 'Hoạt động',
      color: '#3B82F6',
      notes: '',
      resourceLink: ''
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
      categoryId: product.categoryId._id,
      importPrice: product.importPrice,
      shippingCost: product.shippingCost,
      packagingCost: product.packagingCost,
      minStock: product.minStock,
      maxStock: product.maxStock,
      estimatedDeliveryDays: product.estimatedDeliveryDays,
      usageDurationMonths: product.usageDurationMonths || 12,
      status: product.status,
      color: product.color || '#3B82F6',
      notes: product.notes || '',
      resourceLink: product.resourceLink || ''
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

    this.isLoading.set(true);
    this.productService.create(this.formData()).subscribe({
      next: (product) => {
        this.products.update(products => [...products, product]);
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

    this.isLoading.set(true);
    this.productService.update(product._id, this.formData()).subscribe({
      next: (updatedProduct) => {
        this.products.update(products => 
          products.map(p => p._id === product._id ? updatedProduct : p)
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

  seedData(): void {
    if (!confirm('Bạn có muốn tạo dữ liệu mẫu? Điều này sẽ thêm 20 sản phẩm mẫu.')) {
      return;
    }

    this.isLoading.set(true);
    this.productService.seedSampleData().subscribe({
      next: (products) => {
        this.products.set(products);
        this.loadStats();
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set('Không thể tạo dữ liệu mẫu');
        this.isLoading.set(false);
        console.error('Error seeding data:', err);
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  getStockStatus(product: Product): string {
    // Vì không có quantity, return status mặc định
    return 'in-stock';
  }

  updateFormField(field: keyof CreateProductDto, value: any): void {
    this.formData.update(current => ({
      ...current,
      [field]: value
    }));
  }

  onInputChange(field: keyof CreateProductDto, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    let value: any = target.value;
    
    // Convert to number for numeric fields
    if (['importPrice', 'shippingCost', 'packagingCost', 'minStock', 'maxStock', 'estimatedDeliveryDays'].includes(field)) {
      value = parseFloat(value) || 0;
    }
    
    this.updateFormField(field, value);
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
}
