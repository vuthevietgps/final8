/**
 * File: features/customer/customer.component.ts
 * Mục đích: Component quản lý Khách Hàng (danh sách, lọc, cập nhật,...).
 */
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomerService } from './customer.service';
import { 
  Customer, 
  CustomerStats, 
  UpdateCustomerDto,
  CustomerExpiryNotification,
  WeeklyCalendarDay
} from './models/customer.interface';

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
  
  // P2 FIX: Pagination
  totalCustomers = signal(0);
  currentPage = signal(1);
  pageSize = signal(50);
  
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
  
  // NEW: Tab và Notification state
  activeTab = signal<'list' | 'notifications'>('list');
  notifications = signal<CustomerExpiryNotification[]>([]);
  notificationSummary = signal({ total: 0, urgent: 0, warning: 0, normal: 0 });
  weeklyCalendar = signal<WeeklyCalendarDay[]>([]);
  notificationDays = signal(10);

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
    query.limit = this.pageSize();
    query.skip = (this.currentPage() - 1) * this.pageSize();

    this.customerService.findAll(query).subscribe({
      next: (response) => {
        this.customers.set(response.customers);
        this.totalCustomers.set(response.total);
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
        query.expired = true;
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

  // ============ NOTIFICATION SCHEDULE METHODS ============

  /**
   * Chuyển tab
   */
  switchTab(tab: 'list' | 'notifications'): void {
    this.activeTab.set(tab);
    if (tab === 'notifications') {
      this.loadNotifications();
      this.loadWeeklyCalendar();
    }
  }

  /**
   * Tải lịch thông báo khách sắp hết hạn
   */
  loadNotifications(): void {
    this.isLoading.set(true);
    this.customerService.getExpiryNotifications(this.notificationDays()).subscribe({
      next: (response) => {
        this.notifications.set(response.notifications);
        this.notificationSummary.set(response.summary);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.error.set('Không thể tải lịch thông báo.');
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Tải lịch tuần
   */
  loadWeeklyCalendar(): void {
    this.customerService.getWeeklyCalendar().subscribe({
      next: (response) => {
        this.weeklyCalendar.set(response.calendar);
      },
      error: (error) => {
        console.error('Error loading weekly calendar:', error);
      }
    });
  }

  /**
   * Thay đổi số ngày threshold
   */
  onNotificationDaysChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.notificationDays.set(parseInt(target.value, 10));
    this.loadNotifications();
  }

  /**
   * Export danh sách liên hệ
   */
  exportContacts(): void {
    this.customerService.exportContacts(this.notificationDays()).subscribe({
      next: (response) => {
        // Convert to CSV
        const headers = ['STT', 'Tên KH', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Còn lại', 'Hết hạn', 'Ưu tiên', 'Ghi chú'];
        const rows = response.contacts.map((c: any) => [
          c.stt, c.customerName, c.phoneNumber, c.address, c.productName,
          c.remainingDays + ' ngày', c.expiryDateFormatted, c.priority, c.notes
        ]);
        
        const csvContent = [headers.join(','), ...rows.map((r: any) => r.map((v: any) => `"${v}"`).join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `lich-cham-soc-khach-hang-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
      },
      error: (error) => {
        console.error('Error exporting contacts:', error);
        this.error.set('Không thể export danh sách.');
      }
    });
  }

  /**
   * Lấy class priority cho notification
   */
  getPriorityClass(priority: string): string {
    switch (priority) {
      case 'urgent': return 'priority-urgent';
      case 'warning': return 'priority-warning';
      default: return 'priority-normal';
    }
  }

  /**
   * Lấy text priority
   */
  getPriorityText(priority: string): string {
    switch (priority) {
      case 'urgent': return '🔴 Khẩn cấp';
      case 'warning': return '🟡 Cảnh báo';
      default: return '🟢 Bình thường';
    }
  }

  /**
   * Pagination: Chuyển trang
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadCustomers();
  }

  /**
   * Tính tổng số trang
   */
  totalPages(): number {
    return Math.ceil(this.totalCustomers() / this.pageSize());
  }
}