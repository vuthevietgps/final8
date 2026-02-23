/**
 * File: features/order-status/order-status.component.ts
 * Mục đích: Giao diện quản lý Trạng thái đơn hàng.
 */
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { OrderStatusService } from './order-status.service';
import { OrderStatus, CreateOrderStatus, UpdateOrderStatus } from './models/order-status.model';

/**
 * Component quản lý trạng thái đơn hàng
 * Cung cấp giao diện để thêm, sửa, xóa và xem danh sách trạng thái đơn hàng
 */
@Component({
  selector: 'app-order-status',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './order-status.component.html',
  styleUrls: ['./order-status.component.css']
})
export class OrderStatusComponent implements OnInit {
  // Reference đến modal để có thể đóng/mở từ code
  @ViewChild('orderStatusModal') modal!: ElementRef;

  // Danh sách tất cả trạng thái đơn hàng
  orderStatuses: OrderStatus[] = [];
  
  // Danh sách đã lọc để hiển thị
  filteredStatuses: OrderStatus[] = [];
  
  // Form để thêm/sửa trạng thái đơn hàng
  orderStatusForm!: FormGroup;
  
  // Trạng thái đang được chỉnh sửa (null khi thêm mới)
  editingStatus: OrderStatus | null = null;
  
  // Các state cho loading và error
  isLoading = false;
  error: string | null = null;
  
  // Bộ lọc hiện tại
  currentFilter: 'all' | 'active' | 'inactive' | 'processing' | 'final' = 'all';
  
  // Từ khóa tìm kiếm
  searchTerm = '';

  // Danh sách icon có sẵn
  availableIcons = [
    '📦', '⏳', '✅', '🚚', '📋', '❌', '🔄', '⚡', '🎯', '🏃', 
    '✔️', '❗', '🚩', '📝', '🔔', '💼', '🎉', '⭐', '🚀', '🛠️'
  ];

  constructor(
    private orderStatusService: OrderStatusService,
    private fb: FormBuilder
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadOrderStatuses();
  }

  /**
   * Khởi tạo reactive form với validation
   */
  private initializeForm(): void {
    this.orderStatusForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      color: ['#007bff', [Validators.required, Validators.pattern(/^#[0-9A-F]{6}$/i)]],
      description: [''],
      order: [0, [Validators.min(0)]],
      isActive: [true],
      isFinal: [false],
      icon: ['📦', [Validators.required]]
    });
  }

  /**
   * Tải danh sách trạng thái đơn hàng từ server
   */
  loadOrderStatuses(): void {
    this.isLoading = true;
    this.error = null;
    
    this.orderStatusService.getOrderStatuses().subscribe({
      next: (statuses) => {
        this.orderStatuses = statuses;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error.message;
        this.isLoading = false;
      }
    });
  }

  /**
   * Áp dụng bộ lọc và tìm kiếm
   */
  applyFilters(): void {
    let filtered = [...this.orderStatuses];

    // Lọc theo trạng thái
    switch (this.currentFilter) {
      case 'active':
        filtered = filtered.filter(status => status.isActive);
        break;
      case 'inactive':
        filtered = filtered.filter(status => !status.isActive);
        break;
      case 'processing':
        filtered = filtered.filter(status => !status.isFinal);
        break;
      case 'final':
        filtered = filtered.filter(status => status.isFinal);
        break;
    }

    // Tìm kiếm theo tên
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(status => 
        status.name.toLowerCase().includes(term) ||
        (status.description && status.description.toLowerCase().includes(term))
      );
    }

    this.filteredStatuses = filtered;
  }

  /**
   * Thay đổi bộ lọc
   */
  onFilterChange(filter: 'all' | 'active' | 'inactive' | 'processing' | 'final'): void {
    this.currentFilter = filter;
    this.applyFilters();
  }

  /**
   * Tìm kiếm
   */
  onSearch(event: any): void {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  /**
   * Mở modal để thêm trạng thái đơn hàng mới
   */
  openAddModal(): void {
    this.editingStatus = null;
    this.orderStatusForm.reset({
      name: '',
      color: '#007bff',
      description: '',
      order: 0,
      isActive: true,
      isFinal: false,
      icon: '📦'
    });
    this.showModal();
  }

  /**
   * Mở modal để chỉnh sửa trạng thái đơn hàng
   */
  openEditModal(status: OrderStatus): void {
    this.editingStatus = status;
    this.orderStatusForm.patchValue({
      name: status.name,
      color: status.color,
      description: status.description || '',
      order: status.order,
      isActive: status.isActive,
      isFinal: status.isFinal,
      icon: status.icon
    });
    this.showModal();
  }

  /**
   * Hiển thị modal
   */
  private showModal(): void {
    const modalElement = this.modal.nativeElement;
    modalElement.style.display = 'block';
    modalElement.classList.add('show');
    document.body.classList.add('modal-open');
  }

  /**
   * Ẩn modal
   */
  hideModal(): void {
    const modalElement = this.modal.nativeElement;
    modalElement.style.display = 'none';
    modalElement.classList.remove('show');
    document.body.classList.remove('modal-open');
  }

  /**
   * Xử lý submit form
   */
  onSubmit(): void {
    if (this.orderStatusForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    const formValue = this.orderStatusForm.value;
    
    if (this.editingStatus) {
      this.updateOrderStatus(formValue);
    } else {
      this.createOrderStatus(formValue);
    }
  }

  /**
   * Tạo mới trạng thái đơn hàng
   */
  private createOrderStatus(data: CreateOrderStatus): void {
    this.isLoading = true;
    this.error = null;

    this.orderStatusService.createOrderStatus(data).subscribe({
      next: () => {
        this.loadOrderStatuses();
        this.hideModal();
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error.message;
        this.isLoading = false;
      }
    });
  }

  /**
   * Cập nhật trạng thái đơn hàng
   */
  private updateOrderStatus(data: UpdateOrderStatus): void {
    if (!this.editingStatus) return;

    this.isLoading = true;
    this.error = null;

    this.orderStatusService.updateOrderStatus(this.editingStatus._id, data).subscribe({
      next: () => {
        this.loadOrderStatuses();
        this.hideModal();
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error.message;
        this.isLoading = false;
      }
    });
  }

  /**
   * Xóa trạng thái đơn hàng
   */
  deleteOrderStatus(status: OrderStatus): void {
    if (!confirm(`Bạn có chắc chắn muốn xóa trạng thái "${status.name}"?`)) {
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.orderStatusService.deleteOrderStatus(status._id).subscribe({
      next: () => {
        this.loadOrderStatuses();
        this.isLoading = false;
      },
      error: (error) => {
        this.error = error.message;
        this.isLoading = false;
      }
    });
  }

  /**
   * Toggle trạng thái hoạt động
   */
  toggleActiveStatus(status: OrderStatus): void {
    const updateData: UpdateOrderStatus = {
      isActive: !status.isActive
    };

    this.orderStatusService.updateOrderStatus(status._id, updateData).subscribe({
      next: () => {
        this.loadOrderStatuses();
      },
      error: (error) => {
        this.error = error.message;
      }
    });
  }

  /**
   * Toggle trạng thái cuối
   */
  toggleFinalStatus(status: OrderStatus): void {
    const updateData: UpdateOrderStatus = {
      isFinal: !status.isFinal
    };

    this.orderStatusService.updateOrderStatus(status._id, updateData).subscribe({
      next: () => {
        this.loadOrderStatuses();
      },
      error: (error) => {
        this.error = error.message;
      }
    });
  }

  /**
   * Chọn icon
   */
  selectIcon(icon: string): void {
    this.orderStatusForm.patchValue({ icon });
  }

  /**
   * Đánh dấu tất cả field trong form là đã touched để hiển thị validation
   */
  private markFormGroupTouched(): void {
    Object.keys(this.orderStatusForm.controls).forEach(key => {
      this.orderStatusForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Kiểm tra field có lỗi validation không
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.orderStatusForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  /**
   * Lấy thông báo lỗi cho field
   */
  getFieldError(fieldName: string): string {
    const field = this.orderStatusForm.get(fieldName);
    if (!field || !field.errors) return '';

    const errors = field.errors;
    if (errors['required']) return `${this.getFieldLabel(fieldName)} là bắt buộc`;
    if (errors['minlength']) return `${this.getFieldLabel(fieldName)} phải có ít nhất ${errors['minlength'].requiredLength} ký tự`;
    if (errors['pattern']) return `${this.getFieldLabel(fieldName)} không đúng định dạng`;
    if (errors['min']) return `${this.getFieldLabel(fieldName)} phải lớn hơn hoặc bằng ${errors['min'].min}`;

    return 'Giá trị không hợp lệ';
  }

  /**
   * Lấy label hiển thị cho field
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      name: 'Tên trạng thái',
      color: 'Màu sắc',
      description: 'Mô tả',
      order: 'Thứ tự',
      icon: 'Icon'
    };
    return labels[fieldName] || fieldName;
  }
}
