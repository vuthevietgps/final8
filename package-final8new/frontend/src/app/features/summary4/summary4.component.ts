import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Summary4Service } from './summary4.service';
import { Summary4, Summary4Filter, Summary4Stats, AgentSummary } from './models/summary4.interface';

@Component({
  selector: 'app-summary4',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './summary4.component.html',
  styleUrls: ['./summary4.component.css']
})
export class Summary4Component implements OnInit {
  // Signals for reactive state management
  summary4Data = signal<Summary4[]>([]);
  stats = signal<Summary4Stats | null>(null);
  agents = signal<AgentSummary[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  
  // Filter state
  filter = signal<Summary4Filter>({
    page: 1,
    limit: 50,
    sortBy: 'orderDate',
    sortOrder: 'desc',
    paymentStatus: 'all'
  });

  // Pagination state
  totalRecords = signal(0);
  currentPage = signal(1);
  totalPages = signal(0);

  // Edit state
  editingPayment = signal<string | null>(null);
  editPaymentValue = signal<number>(0);

  // UI state for filters
  showFilters = signal(false);
  
  // Form state for date filters
  startDateInput = signal('');
  endDateInput = signal('');

  // Computed for displaying data (no more client-side filtering)
  filteredData = computed(() => {
    return this.summary4Data(); // Server-side filtering only
  });

  constructor(
    private summary4Service: Summary4Service
  ) {
    // No search/filter logic
  }

  ngOnInit() {
    this.loadData();
    this.loadStats();
    this.loadAgents();
  }

  loadData() {
    console.log('🚀 loadData called with filter:', JSON.stringify(this.filter()));
    this.loading.set(true);
    this.error.set(null);
    
    this.summary4Service.findAll(this.filter()).subscribe({
      next: (response) => {
        console.log('✅ API Success:', {
          dataLength: response.data?.length || 0,
          total: response.total,
          page: response.page,
          totalPages: response.totalPages,
          redirected: response.redirectedToPage ? `${response.requestedPage} -> ${response.redirectedToPage}` : null
        });

        // Handle server-side page redirect
        if (response.redirectedToPage && response.page !== this.filter().page) {
          console.log(`📄 Server redirected from page ${response.requestedPage} to ${response.page}`);
          // Update filter to reflect the actual page returned by server
          this.filter.update(f => ({ ...f, page: response.page }));
        }
        
        this.summary4Data.set(response.data);
        this.totalRecords.set(response.total);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('❌ API Error:', err);
        this.error.set('Lỗi khi tải dữ liệu: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  loadStats() {
    this.summary4Service.getStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (err) => console.error('Lỗi khi tải thống kê:', err)
    });
  }

  loadAgents() {
    this.summary4Service.getAgents().subscribe({
      next: (agents) => this.agents.set(agents),
      error: (err) => console.error('Lỗi khi tải danh sách đại lý:', err)
    });
  }

  // Sorting and pagination only
  updateFilter<K extends keyof Summary4Filter>(key: K, value: Summary4Filter[K]) {
    this.filter.update(f => ({ ...f, [key]: value } as Summary4Filter));
    if (key !== 'page' && key !== 'limit') {
      this.filter.update(f => ({ ...f, page: 1 }));
    }
    this.loadData();
  }

  // Filter methods
  toggleFilters() {
    this.showFilters.update(show => !show);
  }

  applyDateFilter() {
    const startDate = this.startDateInput();
    const endDate = this.endDateInput();
    
    this.filter.update(f => ({
      ...f,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1
    }));
    this.loadData();
  }

  clearDateFilter() {
    this.startDateInput.set('');
    this.endDateInput.set('');
    this.filter.update(f => ({
      ...f,
      startDate: undefined,
      endDate: undefined,
      page: 1
    }));
    this.loadData();
  }

  filterByAgent(agentId: string) {
    if (agentId === 'all') {
      this.filter.update(f => ({ ...f, agentId: undefined, page: 1 }));
    } else {
      this.filter.update(f => ({ ...f, agentId, page: 1 }));
    }
    this.loadData();
  }

  filterByPaymentStatus(status: string) {
    const paymentStatus = status as 'all' | 'unpaid' | 'paid' | 'manual';
    this.filter.update(f => ({ ...f, paymentStatus, page: 1 }));
    this.loadData();
  }

  searchCustomer(customerName: string) {
    this.filter.update(f => ({ 
      ...f, 
      customerName: customerName.trim() || undefined, 
      page: 1 
    }));
    this.loadData();
  }

  searchProduct(productName: string) {
    this.filter.update(f => ({ 
      ...f, 
      productName: productName.trim() || undefined, 
      page: 1 
    }));
    this.loadData();
  }

  searchAgent(agentName: string) {
    this.filter.update(f => ({ 
      ...f, 
      agentName: agentName.trim() || undefined, 
      page: 1 
    }));
    this.loadData();
  }

  clearAllFilters() {
    this.startDateInput.set('');
    this.endDateInput.set('');
    this.filter.set({
      page: 1,
      limit: 50,
      sortBy: 'orderDate',
      sortOrder: 'desc',
      paymentStatus: 'all'
    });
    this.loadData();
  }

  // Summary1-like helpers
  refresh() {
    this.loadData();
    this.loadStats();
    this.loadAgents();
  }

  goToPage(page: number) {
    // Validate page number
    const validPage = Math.max(1, Math.min(this.totalPages(), Math.floor(page)));
    
    if (validPage !== page) {
      console.warn(`⚠️ Page ${page} is invalid, redirecting to page ${validPage}`);
    }
    
    if (validPage !== this.currentPage()) {
      this.filter.update(f => ({ ...f, page: validPage }));
      this.loadData();
    }
  }

  changePageSize(limit: number) {
    const validLimit = Math.max(1, Math.min(200, Math.floor(Number(limit))));
    
    if (validLimit !== Number(limit)) {
      console.warn(`⚠️ Limit ${limit} is invalid, using ${validLimit}`);
    }
    
    this.filter.update(f => ({ ...f, limit: validLimit, page: 1 }));
    this.loadData();
  }

  onPageChange(page: number) {
    this.goToPage(page);
  }

  onSortChange(sortBy: string) {
    this.filter.update(f => ({
      ...f,
      sortBy,
      sortOrder: f.sortBy === sortBy && f.sortOrder === 'asc' ? 'desc' : 'asc'
    }));
    this.loadData();
  }

  // Manual payment editing
  startEditPayment(id: string, currentValue: number) {
    this.editingPayment.set(id);
    this.editPaymentValue.set(currentValue);
  }

  savePayment(id: string) {
    this.summary4Service.updateManualPayment(id, { 
      manualPayment: this.editPaymentValue() 
    }).subscribe({
      next: (updated) => {
        const currentData = this.summary4Data();
        const index = currentData.findIndex(item => item._id === id);
        if (index !== -1) {
          currentData[index] = updated;
          this.summary4Data.set([...currentData]);
        }
        this.editingPayment.set(null);
        this.loadStats(); // Reload stats after update
      },
      error: (err) => {
        this.error.set('Lỗi khi cập nhật thanh toán: ' + err.message);
      }
    });
  }

  cancelEdit() {
    this.editingPayment.set(null);
  }

  // Always-on input blur-save (Summary1-like UX)
  onBlurManual(id: string, event: Event) {
    const target = event.target as HTMLInputElement;
    const value = Number(target?.value ?? 0);
    if (Number.isNaN(value)) return;

    const items = this.summary4Data();
    const idx = items.findIndex(i => i._id === id);
    if (idx === -1) return;

    const current = items[idx].manualPayment || 0;
    if (current === value) return; // no change

    this.summary4Service.updateManualPayment(id, { manualPayment: value }).subscribe({
      next: (updated) => {
        items[idx] = updated;
        this.summary4Data.set([...items]);
        this.loadStats();
      },
      error: (err) => {
        this.error.set('Lỗi khi cập nhật thanh toán: ' + err.message);
      }
    });
  }

  // Pagination display helpers for template
  displayFrom(): number {
    const total = this.totalRecords();
    if (!total) return 0;
    const limit = this.filter().limit || 50;
    return (this.currentPage() - 1) * limit + 1;
  }

  displayTo(): number {
    const total = this.totalRecords();
    if (!total) return 0;
    const limit = this.filter().limit || 50;
    const to = this.currentPage() * limit;
    return to > total ? total : to;
  }

  // Sync data
  syncData() {
    this.loading.set(true);
    this.summary4Service.syncFromTestOrder2().subscribe({
      next: (result) => {
        console.log('Đồng bộ hoàn thành:', result);
        this.loadData();
        this.loadStats();
      },
      error: (err) => {
        this.error.set('Lỗi khi đồng bộ: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  // Export unpaid records to Excel
  exportUnpaidToExcel() {
    this.loading.set(true);
    this.error.set(null);
    
    this.summary4Service.exportUnpaidToExcel().subscribe({
      next: (blob) => {
        // Tạo URL để download
        const url = window.URL.createObjectURL(blob);
        
        // Tạo link download
        const link = document.createElement('a');
        link.href = url;
        
        // Tạo tên file với timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `summary4-chua-thanh-toan-${timestamp}.xlsx`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.loading.set(false);
        console.log('Xuất Excel thành công');
      },
      error: (err) => {
        this.error.set('Lỗi khi xuất Excel: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  // Export manual payment template
  exportManualPaymentTemplate() {
    this.loading.set(true);
    this.error.set(null);
    
    this.summary4Service.exportManualPaymentTemplate().subscribe({
      next: (blob) => {
        // Tạo URL để download
        const url = window.URL.createObjectURL(blob);
        
        // Tạo link download
        const link = document.createElement('a');
        link.href = url;
        
        // Tạo tên file với timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `summary4-manual-payment-template-${timestamp}.xlsx`;
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        
        // Cleanup
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.loading.set(false);
        console.log('Xuất template thành công');
      },
      error: (err) => {
        this.error.set('Lỗi khi xuất template: ' + err.message);
        this.loading.set(false);
      }
    });
  }

  // Import manual payment from Excel
  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.name.match(/\.(xlsx|xls)$/)) {
        this.error.set('File phải có định dạng Excel (.xlsx hoặc .xls)');
        return;
      }

      this.importManualPaymentFromExcel(file);
    }
  }

  importManualPaymentFromExcel(file: File) {
    this.loading.set(true);
    this.error.set(null);

    this.summary4Service.importManualPaymentFromExcel(file).subscribe({
      next: (result) => {
        this.loading.set(false);
        
        let message = `Import hoàn thành!\n`;
        message += `- Xử lý: ${result.processed} dòng\n`;
        message += `- Cập nhật thành công: ${result.updated} bản ghi\n`;
        
        if (result.errors.length > 0) {
          message += `- Lỗi: ${result.errors.length} dòng\n\n`;
          message += 'Chi tiết lỗi:\n' + result.errors.slice(0, 5).join('\n');
          if (result.errors.length > 5) {
            message += `\n... và ${result.errors.length - 5} lỗi khác`;
          }
        }

        alert(message);

        // Refresh data if any records were updated
        if (result.updated > 0) {
          this.loadData();
          this.loadStats();
        }

        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      },
      error: (err) => {
        this.error.set('Lỗi khi import file: ' + err.message);
        this.loading.set(false);
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    });
  }

  // Helper method to trigger file input
  triggerFileInput() {
    const fileInput = document.getElementById('manual-payment-file') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + ' ₫';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('vi-VN');
  }

  getStatusColor(status: string): string {
    const statusColors: { [key: string]: string } = {
      'Đã trả kết quả': 'text-green-600',
      'Đang xử lý': 'text-yellow-600',
      'Chưa làm': 'text-gray-600',
      'Giao thành công': 'text-green-600',
      'Đang vận chuyển': 'text-blue-600',
      'Chưa có mã vận đơn': 'text-gray-600'
    };
    return statusColors[status] || 'text-gray-600';
  }

  trackByFn(index: number, item: Summary4): string {
    return item._id;
  }
}