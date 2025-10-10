/**
 * File: features/quote/quote.component.ts
 * Mục đích: Giao diện tạo/danh sách Báo giá; quản lý form, lọc, và hiển thị dữ liệu.
 */
import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { QuoteService } from './quote.service';
import { Quote, CreateQuote, Product, QuoteStats, User } from './models/quote.model';

@Component({
  selector: 'app-quote',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './quote.component.html',
  styleUrls: ['./quote.component.css']
})
export class QuoteComponent implements OnInit {
  @ViewChild('quoteModal') quoteModal!: ElementRef;

  quotes = signal<Quote[]>([]);
  products = signal<Product[]>([]);
  agents = signal<User[]>([]);
  stats = signal<QuoteStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    expired: 0,
    approvalRate: 0
  });

  quoteForm: FormGroup;
  isLoading = signal(false);
  isEditMode = signal(false);
  currentQuoteId = signal<string | null>(null);
  searchTerm = signal('');
  statusFilter = signal('all');

  statusOptions = [
    { value: 'Chờ duyệt', label: 'Chờ duyệt', color: '#f39c12' },
    { value: 'Đã duyệt', label: 'Đã duyệt', color: '#27ae60' },
    { value: 'Từ chối', label: 'Từ chối', color: '#e74c3c' },
    { value: 'Hết hiệu lực', label: 'Hết hiệu lực', color: '#95a5a6' }
  ];

  constructor(
    private quoteService: QuoteService,
    private fb: FormBuilder
  ) {
    this.quoteForm = this.fb.group({
      productId: ['', Validators.required],
      agentId: [''], // Sẽ được validate động
      applyToAllAgents: [false],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      status: ['Chờ duyệt', Validators.required],
      validFrom: ['', Validators.required],
      validUntil: ['', Validators.required],
      notes: ['', Validators.maxLength(500)]
    });

    // Lắng nghe thay đổi applyToAllAgents để cập nhật validation
    this.quoteForm.get('applyToAllAgents')?.valueChanges.subscribe(applyToAll => {
      const agentIdControl = this.quoteForm.get('agentId');
      if (applyToAll) {
        // Khi chọn apply to all, bỏ validation và clear value
        agentIdControl?.clearValidators();
        agentIdControl?.setValue('');
      } else {
        // Khi không chọn apply to all, yêu cầu chọn agent
        agentIdControl?.setValidators([Validators.required]);
      }
      agentIdControl?.updateValueAndValidity();
    });
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.loadQuotes(),
        this.loadProducts(),
        this.loadAgents(),
        this.loadStats()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadQuotes() {
    try {
      const quotes = await this.quoteService.getQuotes().toPromise();
      this.quotes.set(quotes || []);
    } catch (error) {
      console.error('Error loading quotes:', error);
    }
  }

  async loadProducts() {
    try {
      const products = await this.quoteService.getProducts().toPromise();
      this.products.set(products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async loadAgents() {
    try {
      const agents = await this.quoteService.getAgents().toPromise();
      this.agents.set(agents || []);
    } catch (error) {
      console.error('Error loading agents:', error);
    }
  }

  async loadStats() {
    try {
      const stats = await this.quoteService.getQuoteStats().toPromise();
      this.stats.set(stats || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        expired: 0,
        approvalRate: 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  openCreateModal() {
    this.isEditMode.set(false);
    this.currentQuoteId.set(null);
    this.quoteForm.reset({
      productId: '',
      agentId: '',
      applyToAllAgents: false,
      unitPrice: 0,
      status: 'Chờ duyệt',
      validFrom: '',
      validUntil: '',
      notes: ''
    });
    this.showModal();
  }

  openEditModal(quote: Quote) {
    this.isEditMode.set(true);
    this.currentQuoteId.set(quote._id || null);
    
    const validFrom = quote.validFrom ? new Date(quote.validFrom).toISOString().split('T')[0] : '';
    const validUntil = quote.validUntil ? new Date(quote.validUntil).toISOString().split('T')[0] : '';
    
    this.quoteForm.patchValue({
      productId: typeof quote.productId === 'string' ? quote.productId : quote.productId._id,
      agentId: typeof quote.agentId === 'string' ? quote.agentId : quote.agentId._id,
      applyToAllAgents: false, // Edit mode không áp dụng bulk
      unitPrice: quote.unitPrice,
      status: quote.status,
      validFrom: validFrom,
      validUntil: validUntil,
      notes: quote.notes || ''
    });
    this.showModal();
  }

  async onSubmit() {
    if (this.quoteForm.valid) {
      this.isLoading.set(true);
      
      try {
        const formData: any = { ...this.quoteForm.value };
        
        // Xử lý logic applyToAllAgents - nếu true thì xóa agentId
        if (formData.applyToAllAgents) {
          delete formData.agentId; // Xóa agentId khi áp dụng cho tất cả
        }
        
        // Ép kiểu unitPrice sang number phòng trường hợp input là chuỗi
        if (formData.unitPrice !== undefined) {
          const numeric = Number(String(formData.unitPrice).replace(/[^0-9.-]/g, ''));
          formData.unitPrice = isNaN(numeric) ? 0 : numeric;
        }
        
        // Đảm bảo productId là chuỗi
        if (formData.productId && typeof formData.productId !== 'string') {
          formData.productId = String(formData.productId);
        }
        
        // Chỉ xử lý agentId khi không phải applyToAllAgents
        if (!formData.applyToAllAgents && formData.agentId && typeof formData.agentId !== 'string') {
          formData.agentId = String(formData.agentId);
        }
        
        // Bước 1: Lưu và nhận kết quả
        try {
          let saved: Quote | Quote[] | undefined;
          if (this.isEditMode() && this.currentQuoteId()) {
            const updateResult = await this.quoteService.updateQuote(this.currentQuoteId()!, formData).toPromise();
            // Cập nhật ngay trong danh sách hiện tại
            if (updateResult) {
              this.quotes.update(list => list.map(q => (q._id === updateResult._id ? updateResult : q)));
            }
          } else {
            saved = await this.quoteService.createQuote(formData as CreateQuote).toPromise();
            // Thêm mới vào đầu danh sách để thấy ngay
            if (saved) {
              if (Array.isArray(saved)) {
                // Bulk creation - thêm tất cả vào danh sách
                const quotesToAdd = saved.map(quote => {
                  if (!quote.createdAt) {
                    quote.createdAt = new Date().toISOString();
                  }
                  return quote;
                });
                this.quotes.update(list => [...quotesToAdd, ...list]);
              } else {
                // Single creation - thêm một quote
                const singleQuote = saved as Quote;
                if (!singleQuote.createdAt) {
                  singleQuote.createdAt = new Date().toISOString();
                }
                this.quotes.update(list => [singleQuote, ...list]);
              }
            }
          }
        } catch (error) {
          console.error('Error saving quote:', error);
          const msg = (error as any)?.message || 'Có lỗi xảy ra khi lưu báo giá';
          alert(msg);
          return; // Dừng nếu lưu thất bại
        }

        // Bước 2: Đã lưu thành công -> đóng modal và làm tươi thống kê (nhẹ)
        this.hideModal();
        try {
          await this.loadStats();
        } catch (reloadError) {
          console.error('Error reloading after save:', reloadError);
          // Không chặn trải nghiệm; dữ liệu trong danh sách đã được cập nhật lạc quan
        }
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async deleteQuote(id: string) {
    if (confirm('Bạn có chắc chắn muốn xóa báo giá này?')) {
      try {
        await this.quoteService.deleteQuote(id).toPromise();
        await this.loadData();
      } catch (error) {
        console.error('Error deleting quote:', error);
        alert('Có lỗi xảy ra khi xóa báo giá');
      }
    }
  }

  filteredQuotes() {
    let filtered = this.quotes();
    
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(quote => {
  const productName = typeof quote.productId === 'string' ? '' : (quote.productId?.name || '').toLowerCase();
  const agentName = typeof quote.agentId === 'string' ? '' : (quote.agentId?.fullName || '').toLowerCase();
        return productName.includes(term) || agentName.includes(term);
      });
    }
    
    if (this.statusFilter() !== 'all') {
      filtered = filtered.filter(quote => quote.status === this.statusFilter());
    }
    
    return filtered;
  }

  getProductName(productId: string | Product): string {
    if (!productId) {
      return 'Unknown Product';
    }
    if (typeof productId === 'string') {
      const product = this.products().find(p => p._id === productId);
      return product ? product.name : 'Unknown Product';
    }
    return productId.name || 'Unknown Product';
  }

  getAgentName(agentId: string | User): string {
    if (!agentId) {
      return 'Unknown Agent';
    }
    if (typeof agentId === 'string') {
      const agent = this.agents().find(a => a._id === agentId);
      return agent ? agent.fullName : 'Unknown Agent';
    }
    return agentId.fullName || 'Unknown Agent';
  }

  getStatusColor(status: string): string {
    const statusOption = this.statusOptions.find(opt => opt.value === status);
    return statusOption ? statusOption.color : '#95a5a6';
  }

  formatPrice(unitPrice: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(unitPrice);
  }

  formatDate(date: string | undefined | null): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN');
  }

  trackByQuoteId(index: number, quote: Quote): string {
    return quote._id || index.toString();
  }

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  onStatusChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.statusFilter.set(target.value);
  }

  onApplyToAllChanged(event: Event) {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    
    // Reset agentId khi toggle applyToAllAgents
    if (isChecked) {
      this.quoteForm.get('agentId')?.setValue('');
    }
  }

  private showModal() {
    if (this.quoteModal?.nativeElement) {
      const modal = new (window as any).bootstrap.Modal(this.quoteModal.nativeElement);
      modal.show();
    }
  }

  private hideModal() {
    if (this.quoteModal?.nativeElement) {
      const modal = (window as any).bootstrap.Modal.getInstance(this.quoteModal.nativeElement);
      if (modal) {
        modal.hide();
      }
    }
  }
}
