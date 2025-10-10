/**
 * File: features/customer/customer.component.ts
 * Mục đích: Component quản lý Khách Hàng (danh sách, lọc, cập nhật,...).
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from './customer.service';
import { Customer, CustomerStats, UpdateCustomerDto } from './models/customer.interface';

@Component({
  selector: 'app-customer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customer.component.html',
  styleUrls: ['./customer.component.css']
})
export class CustomerComponent implements OnInit {
  // Signals for reactive state management
  customers = signal<Customer[]>([]);
  stats = signal<CustomerStats>({
    totalCustomers: 0,
    activeCustomers: 0,
    expiringSoon: 0,
    expired: 0,
    disabledCustomers: 0
  });
  
  isLoading = signal(false);
  error = signal<string | null>(null);
  
  // Modal state
  isEditModalOpen = signal(false);
  selectedCustomer = signal<Customer | null>(null);
  
  // Form data
  formData = signal<UpdateCustomerDto>({
    customerName: '',
    phoneNumber: '',
    address: '',
    notes: ''
  });

  // Search and filter
  searchTerm = signal('');
  selectedFilter = signal('all');

  constructor(private customerService: CustomerService) {}

  ngOnInit(): void {
    this.loadCustomers();
    this.loadStats();
  }

  /**
   * Tải danh sách khách hàng
   */
  loadCustomers(): void {
    this.isLoading.set(true);
    this.error.set(null);

    const query = this.buildQuery();

    this.customerService.findAll(query).subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading customers:', error);
        this.error.set('Không thể tải danh sách khách hàng. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Tải thống kê
   */
  loadStats(): void {
    this.customerService.getStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
      },
      error: (error) => {
        console.error('Error loading stats:', error);
      }
    });
  }

  /**
   * Xây dựng query từ filter và search
   */
  buildQuery(): any {
    const query: any = {};

    if (this.searchTerm()) {
      query.search = this.searchTerm();
    }

    const filter = this.selectedFilter();
    switch (filter) {
      case 'active':
        query.isDisabled = false;
        break;
      case 'expiring':
        query.expiringSoon = true;
        break;
      case 'expired':
        query.isDisabled = false;
        // Will be handled by backend logic
        break;
      case 'disabled':
        query.isDisabled = true;
        break;
    }

    return query;
  }

  /**
   * Đồng bộ khách hàng từ TestOrder2
   */
  syncFromOrders(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.customerService.syncFromOrders().subscribe({
      next: (response) => {
        console.log('Sync completed:', response.message);
        this.loadCustomers();
        this.loadStats();
      },
      error: (error) => {
        console.error('Error syncing customers:', error);
        this.error.set('Không thể đồng bộ dữ liệu. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Cập nhật thời gian còn lại
   */
  updateRemainingDays(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.customerService.updateRemainingDays().subscribe({
      next: (response) => {
        console.log('Update completed:', response.message);
        this.loadCustomers();
        this.loadStats();
      },
      error: (error) => {
        console.error('Error updating remaining days:', error);
        this.error.set('Không thể cập nhật thời gian còn lại. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Vô hiệu hóa khách hàng
   */
  disableCustomer(customer: Customer): void {
    if (!confirm(`Bạn có chắc chắn muốn vô hiệu hóa khách hàng "${customer.customerName}"?`)) {
      return;
    }

    this.customerService.disable(customer._id).subscribe({
      next: () => {
        this.loadCustomers();
        this.loadStats();
      },
      error: (error) => {
        console.error('Error disabling customer:', error);
        this.error.set('Không thể vô hiệu hóa khách hàng. Vui lòng thử lại.');
      }
    });
  }

  /**
   * Kích hoạt lại khách hàng
   */
  enableCustomer(customer: Customer): void {
    this.customerService.enable(customer._id).subscribe({
      next: () => {
        this.loadCustomers();
        this.loadStats();
      },
      error: (error) => {
        console.error('Error enabling customer:', error);
        this.error.set('Không thể kích hoạt khách hàng. Vui lòng thử lại.');
      }
    });
  }

  /**
   * Xóa khách hàng
   */
  deleteCustomer(customer: Customer): void {
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng "${customer.customerName}"?\n\nHành động này không thể hoàn tác!`)) {
      return;
    }

    this.customerService.remove(customer._id).subscribe({
      next: () => {
        this.loadCustomers();
        this.loadStats();
      },
      error: (error) => {
        console.error('Error deleting customer:', error);
        this.error.set('Không thể xóa khách hàng. Vui lòng thử lại.');
      }
    });
  }

  /**
   * Mở modal chỉnh sửa
   */
  openEditModal(customer: Customer): void {
    this.selectedCustomer.set(customer);
    this.formData.set({
      customerName: customer.customerName,
      phoneNumber: customer.phoneNumber,
      address: customer.address,
      notes: customer.notes || ''
    });
    this.isEditModalOpen.set(true);
  }

  /**
   * Đóng modal chỉnh sửa
   */
  closeEditModal(): void {
    this.isEditModalOpen.set(false);
    this.selectedCustomer.set(null);
    this.formData.set({
      customerName: '',
      phoneNumber: '',
      address: '',
      notes: ''
    });
  }

  /**
   * Cập nhật khách hàng
   */
  updateCustomer(): void {
    const customer = this.selectedCustomer();
    if (!customer) return;

    if (!this.formData().customerName?.trim()) {
      this.error.set('Tên khách hàng không được để trống');
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    this.customerService.update(customer._id, this.formData()).subscribe({
      next: () => {
        this.closeEditModal();
        this.loadCustomers();
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error updating customer:', error);
        this.error.set('Không thể cập nhật khách hàng. Vui lòng thử lại.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Xử lý thay đổi search
   */
  onSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
    // Debounce search
    setTimeout(() => {
      if (this.searchTerm() === target.value) {
        this.loadCustomers();
      }
    }, 500);
  }

  /**
   * Xử lý thay đổi filter
   */
  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedFilter.set(target.value);
    this.loadCustomers();
  }

  /**
   * Xử lý thay đổi input form
   */
  onInputChange(field: keyof UpdateCustomerDto, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    this.formData.update(current => ({
      ...current,
      [field]: target.value
    }));
  }

  /**
   * Xóa thông báo lỗi
   */
  clearError(): void {
    this.error.set(null);
  }

  /**
   * Format date
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN');
  }

  /**
   * Lấy class cho số ngày còn lại
   */
  getRemainingDaysClass(days: number): string {
    if (days <= 0) return 'expired';
    if (days < 15) return 'expiring';
    return 'normal';
  }

  /**
   * Lấy class cho trạng thái
   */
  getStatusClass(customer: Customer): string {
    if (customer.isDisabled) return 'disabled';
    if (customer.remainingDays <= 0) return 'expired';
    if (customer.remainingDays < 15) return 'expiring';
    return 'active';
  }

  /**
   * Lấy text trạng thái
   */
  getStatusText(customer: Customer): string {
    if (customer.isDisabled) return 'Đã vô hiệu hóa';
    if (customer.remainingDays <= 0) return 'Đã hết hạn';
    if (customer.remainingDays < 15) return 'Sắp hết hạn';
    return 'Hoạt động';
  }
}