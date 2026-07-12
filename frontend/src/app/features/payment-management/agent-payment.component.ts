import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AgentPaymentService, AgentPaymentOpsSummary, AgentBreakdown } from './agent-payment.service';
import { UserService } from '../user/user.service';
import { Order, PaymentBatch } from './models/payment.model';

@Component({
  selector: 'app-agent-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-payment.component.html',
  styleUrls: ['./agent-payment.component.css']
})
export class AgentPaymentComponent implements OnInit {
  // Filters
  agentId = '';
  fromDate = '';
  toDate = '';
  fromDateDisplay = '';  // dd/mm/yyyy format for display
  toDateDisplay = '';    // dd/mm/yyyy format for display
  agingFilter = '';      // '', '0-7', '8-14', '15+'
  quickDateFilter = 'all';  // 'today', 'week', 'month', 'all'
  activeAgingFilter = ''; // Currently active aging filter label

  // Tabs
  activeTab: 'payable' | 'debt' = 'payable';

  // Sorting
  sortBy = 'aging-desc';  // Default sort by aging descending

  // Data
  pendingOrders: Order[] = [];
  batches: PaymentBatch[] = [];
  agents: any[] = [];

  // Ops Summary (CFO Spec v2.0)
  opsSummary: AgentPaymentOpsSummary | null = null;
  summaryLoading = false;
  showAllAgents = false;  // Toggle to show all agents vs top 10

  // Loading states
  loading = false;
  batchesLoading = false;

  // Math reference for template
  Math = Math;
  private readonly cdr = inject(ChangeDetectorRef);

  // Batch modal
  showBatchModal = false;
  batchForm = {
    batchId: '',
    paidDate: '',
    note: '',
    attachments: '',  // Link chứng từ (comma-separated)
    confirmOverThreshold: false  // CFO Spec v2.0: Checkbox xác nhận >5M
  };

  // View batch modal
  showViewBatchModal = false;
  selectedBatch: PaymentBatch | null = null;
  batchOrders: Order[] = [];

  constructor(
    private service: AgentPaymentService,
    private userService: UserService
  ) {}

  private syncView(): void {
    this.cdr.detectChanges();
  }

  ngOnInit() {
    this.loadAgents();
    this.loadOpsSummary();  // CFO Spec v2.0
    this.loadPendingOrders();
    this.loadBatches();

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    this.batchForm.paidDate = today;
  }

  // CFO Spec v2.0: Load ops summary with cards and breakdown
  async loadOpsSummary() {
    this.summaryLoading = true;
    try {
      this.syncView();
      const summary = await firstValueFrom(this.service.getOpsSummary({
        agentId: this.agentId || undefined,
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined
      }));

      this.opsSummary = summary || null;
    } catch (err) {
      console.error('Error loading ops summary:', err);
    } finally {
      this.summaryLoading = false;
      this.syncView();
    }
  }

  async loadAgents() {
    try {
      // CHỈ load EXTERNAL AGENT (internal agent không cần trả hoa hồng)
      this.syncView();
      const users = await firstValueFrom(this.userService.getAgents());
      this.agents = (users || []).filter(user => user.role === 'external_agent');
    } catch (err) {
      console.error('Error loading agents:', err);
    } finally {
      this.syncView();
    }
  }

  async loadPendingOrders() {
    this.loading = true;
    try {
      this.syncView();
      const res = await firstValueFrom(this.service.getPendingOrders({
        agentId: this.agentId || undefined,
        from: this.fromDate || undefined,
        to: this.toDate || undefined
      }));

      this.pendingOrders = (res?.orders || []).map(o => ({ ...o, selected: false }));
    } catch (err) {
      console.error('Error loading pending orders:', err);
      alert('Lỗi tải đơn hàng: ' + (err as any)?.error?.message || (err as any)?.message);
    } finally {
      this.loading = false;
      this.syncView();
    }
  }

  // Reload all data when filter changes
  async applyFilters() {
    await Promise.all([
      this.loadOpsSummary(),
      this.loadPendingOrders(),
      this.loadBatches()
    ]);
  }

  async loadBatches() {
    this.batchesLoading = true;
    try {
      this.syncView();
      const batches = await firstValueFrom(this.service.getPaymentBatches({
        agentId: this.agentId || undefined
      }));

      this.batches = batches || [];
    } catch (err) {
      console.error('Error loading batches:', err);
    } finally {
      this.batchesLoading = false;
      this.syncView();
    }
  }

  get selectedOrders(): Order[] {
    return this.pendingOrders.filter(o => o.selected);
  }

  get selectedCount(): number {
    return this.selectedOrders.length;
  }

  get selectedTotal(): number {
    return this.selectedOrders.reduce((sum, o) => {
      // CFO Spec v2.0: Tính commission theo công thức đúng
      return sum + this.calculateCommission(o);
    }, 0);
  }

  // CFO Spec v2.0: Tách payable (dương) và clawback (âm)
  get selectedPayableTotal(): number {
    return this.selectedOrders.reduce((sum, o) => {
      const commission = this.calculateCommission(o);
      return sum + (commission > 0 ? commission : 0);
    }, 0);
  }

  get selectedClawbackTotal(): number {
    return this.selectedOrders.reduce((sum, o) => {
      const commission = this.calculateCommission(o);
      return sum + (commission < 0 ? Math.abs(commission) : 0);
    }, 0);
  }

  get positiveCommissionCount(): number {
    return this.selectedOrders.filter(o => this.calculateCommission(o) > 0).length;
  }

  get negativeCommissionCount(): number {
    return this.selectedOrders.filter(o => this.calculateCommission(o) < 0).length;
  }

  selectAll(event: any) {
    const checked = event.target.checked;
    this.pendingOrders.forEach(o => o.selected = checked);
  }

  calculateCommission(order: Order): number {
    /**
     * Use the backend payment snapshot so pending rows, created batches,
     * history, finance reports, and batch detail modal stay consistent.
     */
    if (typeof order.agentPaidAmount === 'number' && Number.isFinite(order.agentPaidAmount)) {
      return order.agentPaidAmount;
    }

    const codAmount = Number(order.codAmount || 0);
    const agentQuote = Number(order.agentQuote || 0);
    const quantity = Number(order.quantity || 1);

    if (order.orderStatus === 'Hàng hoàn') {
      return 0 - (agentQuote * quantity);
    }

    return codAmount - (agentQuote * quantity);
  }

  openCreateBatchModal() {
    if (this.selectedCount === 0) {
      alert('Vui lòng chọn ít nhất 1 đơn hàng');
      return;
    }

    // Generate batch ID: PTTT-AGENT-YYYY-MM-001
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const seq = String(this.batches.length + 1).padStart(3, '0');
    this.batchForm.batchId = `PTTT-AGENT-${year}-${month}-${seq}`;

    this.showBatchModal = true;
  }

  closeBatchModal() {
    this.showBatchModal = false;
  }

  async createBatch() {
    if (!this.batchForm.batchId || !this.batchForm.paidDate) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    const THRESHOLD = 5_000_000; // 5 triệu VNĐ

    // CFO Spec v2.0: Không cho payout nếu tổng âm
    if (this.selectedTotal < 0) {
      alert(
        `⚠️ KHÔNG THỂ THANH TOÁN\n\n` +
        `Tổng hoa hồng ÂM: ${this.selectedTotal.toLocaleString('vi-VN')}đ\n\n` +
        `Đây là khoản ĐẠI LÝ NỢ CÔNG TY (clawback).\n` +
        `Vui lòng tách riêng các đơn hoàn để theo dõi công nợ.`
      );
      return;
    }

    // CFO Spec v2.0: Validation bắt buộc cho >5M
    if (this.selectedTotal > THRESHOLD) {
      // Check confirm checkbox
      if (!this.batchForm.confirmOverThreshold) {
        alert(
          `⚠️ YÊU CẦU XÁC NHẬN\n\n` +
          `Tổng thanh toán: ${this.selectedTotal.toLocaleString('vi-VN')}đ\n` +
          `Vượt ngưỡng: ${THRESHOLD.toLocaleString('vi-VN')}đ\n\n` +
          `Vui lòng tích vào ô "Tôi xác nhận thanh toán vượt ngưỡng" và đính kèm chứng từ.`
        );
        return;
      }

      // Check attachments
      const attachments = this.batchForm.attachments
        ? this.batchForm.attachments.split(',').map(s => s.trim()).filter(s => s)
        : [];

      if (attachments.length === 0) {
        alert(
          `⚠️ THIẾU CHỨNG TỪ\n\n` +
          `Thanh toán vượt ${THRESHOLD.toLocaleString('vi-VN')}đ bắt buộc phải có chứng từ.\n\n` +
          `Vui lòng điền link chứng từ (phân cách bằng dấu phẩy).`
        );
        return;
      }
    }

    const orderIds = this.selectedOrders.map(o => o._id);

    // Parse attachments from comma-separated string
    const attachments = this.batchForm.attachments
      ? this.batchForm.attachments.split(',').map(s => s.trim()).filter(s => s)
      : [];

    try {
      // CFO Spec v2.0: Sử dụng atomic API với threshold validation
      const result = await firstValueFrom(this.service.createPaymentBatchAtomic({
        orderIds,
        batchId: this.batchForm.batchId,
        paidDate: this.batchForm.paidDate,
        note: this.batchForm.note || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        confirmOverThreshold: this.batchForm.confirmOverThreshold || undefined,
        confirmedBy: this.selectedTotal > THRESHOLD ? 'current-user-id' : undefined // TODO: Get from auth
      }));

      // Hiển thị kết quả chi tiết
      let message = `✅ Đã tạo phiếu ${this.batchForm.batchId}\n`;
      message += `• Số đơn: ${result?.orderCount || 0}\n`;
      if (result?.skippedCount && result.skippedCount > 0) {
        message += `• Bỏ qua: ${result.skippedCount} đơn (đã thanh toán trước đó)\n`;
      }
      if (result?.totalPayable !== undefined) {
        message += `• Phải trả: ${result.totalPayable.toLocaleString('vi-VN')}đ\n`;
      }
      if (result?.totalClawback !== undefined && result.totalClawback > 0) {
        message += `• Thu hồi: ${result.totalClawback.toLocaleString('vi-VN')}đ\n`;
      }
      if (result?.netAmount !== undefined) {
        message += `• Tổng net: ${result.netAmount.toLocaleString('vi-VN')}đ`;
      }
      if (result?.warning) {
        message += `\n\n${result.warning}`;
      }

      alert(message);

      this.closeBatchModal();
      this.batchForm.note = '';
      this.batchForm.attachments = '';
      this.batchForm.confirmOverThreshold = false;

      // Reload all data
      await this.applyFilters();
      this.syncView();
    } catch (err) {
      console.error('Error creating batch:', err);
      alert('Lỗi tạo lượt thanh toán: ' + (err as any)?.error?.message || (err as any)?.message);
    }
  }

  async viewBatch(batch: PaymentBatch) {
    this.selectedBatch = batch;
    this.showViewBatchModal = true;
    this.syncView();

    try {
      const orders = await firstValueFrom(this.service.getOrdersInBatch(batch.batchId));
      this.batchOrders = orders || [];
    } catch (err) {
      console.error('Error loading batch orders:', err);
      alert('Lỗi tải đơn hàng: ' + (err as any)?.error?.message || (err as any)?.message);
    } finally {
      this.syncView();
    }
  }

  closeViewBatchModal() {
    this.showViewBatchModal = false;
    this.selectedBatch = null;
    this.batchOrders = [];
    this.syncView();
  }

  exportBatch(batch: PaymentBatch) {
    // Export batch to CSV
    const rows = [
      ['Mã phiếu', 'Ngày thanh toán', 'Số đơn', 'Tổng tiền', 'Ghi chú', 'Link chứng từ'],
      [
        batch.batchId,
        new Date(batch.paidDate).toLocaleDateString('vi-VN'),
        String(batch.orderCount || 0),
        String(batch.totalAmount || 0),
        batch.note || '',
        (batch.attachments || []).join('; ')
      ]
    ];

    // Add BOM for UTF-8
    const BOM = '\uFEFF';
    const csvContent = BOM + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${batch.batchId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  getAgentName(agentId: string): string {
    const agent = this.agents.find(a => a._id === agentId);
    return agent?.fullName || agent?.email || agentId;
  }

  // Calculate aging days from eligible date or updated date
  getAgingDays(order: Order): number {
    const eligibleDate = order.agentEligibleAt || order.updatedAt || order.orderDate;
    if (!eligibleDate) return 0;
    const today = new Date();
    const date = new Date(eligibleDate);
    return Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  // CFO Spec v2.0: Click agent trong breakdown → filter pending list
  async drilldownToAgent(agentId: string) {
    this.agentId = agentId;
    this.showAllAgents = false;  // Reset to top 10 view
    await this.applyFilters();

    // Scroll to pending orders section
    const pendingSection = document.getElementById('pending-orders-section');
    if (pendingSection) {
      pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // CFO Spec v2.0: Check if selected total is over threshold
  get isOverThreshold(): boolean {
    return this.selectedTotal > 5_000_000;
  }

  // CFO Spec v2.0: Check if selected total is negative (clawback)
  get isNegativeTotal(): boolean {
    return this.selectedTotal < 0;
  }

  // Payable only orders (commission > 0)
  get payableOnlyOrders(): Order[] {
    let orders = this.pendingOrders.filter(o => this.calculateCommission(o) > 0);

    // Apply aging filter
    if (this.agingFilter) {
      orders = orders.filter(o => {
        const days = this.getAgingDays(o);
        switch (this.agingFilter) {
          case '0-7': return days <= 7;
          case '8-14': return days > 7 && days <= 14;
          case '15+': return days > 14;
          default: return true;
        }
      });
    }

    return orders;
  }

  // Debt orders (commission < 0) - for separate tab
  get debtOrders(): Order[] {
    return this.pendingOrders.filter(o => this.calculateCommission(o) < 0);
  }

  // Total debt amount
  get totalDebtAmount(): number {
    return this.debtOrders.reduce((sum, o) => sum + Math.abs(this.calculateCommission(o)), 0);
  }

  // Period label for "Đã Trả" card
  get periodLabel(): string {
    if (this.quickDateFilter === 'today') return '(Hôm nay)';
    if (this.quickDateFilter === 'week') return '(7 ngày)';
    if (this.quickDateFilter === 'month') return '(Tháng này)';
    if (this.fromDate || this.toDate) return '(Theo lọc)';
    return '(Tất cả)';
  }

  // Filter by card click
  filterByCard(cardType: string) {
    switch (cardType) {
      case 'payable':
        this.activeTab = 'payable';
        this.agingFilter = '';
        this.activeAgingFilter = '';
        break;
      case 'paid':
        // Scroll to payment history section without unsupported CSS selectors
        const historySection = Array.from(document.querySelectorAll('.card')).find(card =>
          card.textContent?.includes('Lịch Sử Phiếu Thanh Toán') || card.textContent?.includes('Lịch Sử')
        ) as HTMLElement | undefined;
        if (historySection) {
          historySection.scrollIntoView({ behavior: 'smooth' });
        }
        break;
      case 'debt':
        this.activeTab = 'debt';
        break;
      case 'aging-0-7':
        this.activeTab = 'payable';
        this.agingFilter = '0-7';
        this.activeAgingFilter = '0-7 ngày';
        break;
      case 'aging-8-14':
        this.activeTab = 'payable';
        this.agingFilter = '8-14';
        this.activeAgingFilter = '8-14 ngày';
        break;
      case 'aging-15':
        this.activeTab = 'payable';
        this.agingFilter = '15+';
        this.activeAgingFilter = '>14 ngày';
        break;
    }

    // Scroll to orders section
    const pendingSection = document.getElementById('pending-orders-section');
    if (pendingSection) {
      pendingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Set active tab
  setActiveTab(tab: 'payable' | 'debt') {
    this.activeTab = tab;
  }

  // Set quick date filter
  setQuickDateFilter(filter: string) {
    this.quickDateFilter = filter;
    const today = new Date();

    switch (filter) {
      case 'today':
        this.fromDate = this.toDate = today.toISOString().split('T')[0];
        this.fromDateDisplay = this.toDateDisplay = this.formatDateVN(today);
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        this.fromDate = weekAgo.toISOString().split('T')[0];
        this.toDate = today.toISOString().split('T')[0];
        this.fromDateDisplay = this.formatDateVN(weekAgo);
        this.toDateDisplay = this.formatDateVN(today);
        break;
      case 'month':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        this.fromDate = monthStart.toISOString().split('T')[0];
        this.toDate = today.toISOString().split('T')[0];
        this.fromDateDisplay = this.formatDateVN(monthStart);
        this.toDateDisplay = this.formatDateVN(today);
        break;
      case 'all':
        this.fromDate = this.toDate = '';
        this.fromDateDisplay = this.toDateDisplay = '';
        break;
    }

    this.applyFilters();
  }

  // Format date to VN format dd/mm/yyyy
  formatDateVN(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  // Parse date input from dd/mm/yyyy to ISO format
  parseDateInput(field: 'from' | 'to', value: string) {
    if (!value) {
      if (field === 'from') this.fromDate = '';
      else this.toDate = '';
      return;
    }

    // Try to parse dd/mm/yyyy
    const parts = value.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);

      if (!isNaN(date.getTime())) {
        const isoDate = date.toISOString().split('T')[0];
        if (field === 'from') this.fromDate = isoDate;
        else this.toDate = isoDate;
        return;
      }
    }

    // Invalid format - reset
    if (field === 'from') {
      this.fromDate = '';
      this.fromDateDisplay = '';
    } else {
      this.toDate = '';
      this.toDateDisplay = '';
    }
  }

  // Reset all filters
  resetFilters() {
    this.agentId = '';
    this.fromDate = '';
    this.toDate = '';
    this.fromDateDisplay = '';
    this.toDateDisplay = '';
    this.agingFilter = '';
    this.activeAgingFilter = '';
    this.quickDateFilter = 'all';
    this.applyFilters();
  }

  // Sort orders
  sortOrders() {
    // Sort is applied via getter, this just triggers change detection
  }

  // Toggle order selection
  toggleOrderSelection(order: Order) {
    order.selected = !order.selected;
  }

  // Select all payable orders
  selectAllPayable(event: any) {
    const checked = event.target.checked;
    this.payableOnlyOrders.forEach(o => o.selected = checked);
  }

  // Deselect all
  deselectAll() {
    this.pendingOrders.forEach(o => o.selected = false);
  }

  // Export debt report
  exportDebtReport() {
    const headers = ['Mã đơn', 'Khách hàng', 'Đại lý', 'SL', 'Chi phí NCC', 'Phí ship', 'Phí hoàn', 'Số nợ', 'Ngày hoàn'];
    const rows = this.debtOrders.map(o => [
      o._id,
      o.customerName || '-',
      this.getAgentName(o.agentId || ''),
      String(o.quantity || 1),
      String(o.supplierQuote || 0),
      String(o.shippingFee || 0),
      String(o.returnFee || 0),
      String(this.calculateCommission(o)),
      o.agentEligibleAt ? new Date(o.agentEligibleAt).toLocaleDateString('vi-VN') : '-'
    ]);

    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-no-dai-ly-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
