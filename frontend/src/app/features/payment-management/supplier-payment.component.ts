import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierPaymentService } from './supplier-payment.service';
import { SupplierService } from '../supplier/supplier.service';
import { Order, PaymentBatch, SupplierPaymentOpsSummary, SUPPLIER_PAYMENT_ALERT_THRESHOLD } from './models/payment.model';

@Component({
  selector: 'app-supplier-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-payment.component.html',
  styleUrls: ['./supplier-payment.component.css']
})
export class SupplierPaymentComponent implements OnInit {
  // Filters
  supplierId = '';
  fromDate = '';
  toDate = '';
  orderStatus = 'Giao thành công';

  // Data
  pendingOrders: Order[] = [];
  batches: PaymentBatch[] = [];
  suppliers: any[] = [];

  // Ops Summary data
  opsSummary: SupplierPaymentOpsSummary | null = null;
  opsSummaryLoading = false;
  showAllSuppliers = false;
  
  // Threshold constant
  readonly THRESHOLD = SUPPLIER_PAYMENT_ALERT_THRESHOLD;

  // Loading states
  loading = false;
  batchesLoading = false;

  // Batch modal
  showBatchModal = false;
  batchForm = {
    batchId: '',
    paidDate: '',
    note: '',
    attachments: '',  // Link chứng từ (comma-separated)
    confirmOverThreshold: false // Checkbox xác nhận vượt ngưỡng
  };

  // View batch modal
  showViewBatchModal = false;
  selectedBatch: PaymentBatch | null = null;
  batchOrders: Order[] = [];

  constructor(
    private service: SupplierPaymentService,
    private supplierService: SupplierService
  ) {}

  ngOnInit() {
    this.loadSuppliers();
    this.loadPendingOrders();
    this.loadBatches();
    this.loadOpsSummary();
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    this.batchForm.paidDate = today;
  }

  async loadOpsSummary() {
    this.opsSummaryLoading = true;
    try {
      const summary = await this.service.getOpsSummary({
        supplierId: this.supplierId || undefined,
        fromDate: this.fromDate || undefined,
        toDate: this.toDate || undefined
      }).toPromise();
      
      this.opsSummary = summary || null;
    } catch (err) {
      console.error('Error loading ops summary:', err);
    } finally {
      this.opsSummaryLoading = false;
    }
  }

  async loadSuppliers() {
    try {
      const suppliers = await this.supplierService.list({ active: true }).toPromise();
      this.suppliers = suppliers || [];
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  }

  async loadPendingOrders() {
    this.loading = true;
    try {
      const res = await this.service.getPendingOrders({
        supplierId: this.supplierId || undefined,
        from: this.fromDate || undefined,
        to: this.toDate || undefined,
        orderStatus: this.orderStatus || undefined
      }).toPromise();
      
      this.pendingOrders = (res?.orders || []).map(o => ({ ...o, selected: false }));
      
      // Reload ops summary khi filter thay đổi
      this.loadOpsSummary();
    } catch (err) {
      console.error('Error loading pending orders:', err);
      alert('Lỗi tải đơn hàng: ' + (err as any)?.error?.message || (err as any)?.message);
    } finally {
      this.loading = false;
    }
  }

  async loadBatches() {
    this.batchesLoading = true;
    try {
      const batches = await this.service.getPaymentBatches({
        supplierId: this.supplierId || undefined
      }).toPromise();
      
      this.batches = batches || [];
    } catch (err) {
      console.error('Error loading batches:', err);
    } finally {
      this.batchesLoading = false;
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
      return sum + this.calculateSupplierAmount(o);
    }, 0);
  }

  // Kiểm tra tổng tiền đang chọn có vượt ngưỡng không
  get isSelectedOverThreshold(): boolean {
    return this.selectedTotal > this.THRESHOLD;
  }

  // Format aging bucket label
  getAgingLabel(bucket: string): string {
    switch (bucket) {
      case '0_7': return '0-7 ngày';
      case '8_14': return '8-14 ngày';
      case '15_plus': return '>14 ngày';
      default: return bucket;
    }
  }

  selectAll(event: any) {
    const checked = event.target.checked;
    this.pendingOrders.forEach(o => o.selected = checked);
  }

  openCreateBatchModal() {
    if (this.selectedCount === 0) {
      alert('Vui lòng chọn ít nhất 1 đơn hàng');
      return;
    }

    // Generate batch ID: PTTT-NCC-YYYY-MM-001
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const seq = String(this.batches.length + 1).padStart(3, '0');
    this.batchForm.batchId = `PTTT-NCC-${year}-${month}-${seq}`;

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

    // Kiểm tra xác nhận vượt ngưỡng
    if (this.isSelectedOverThreshold && !this.batchForm.confirmOverThreshold) {
      alert('⚠️ Tổng tiền vượt 5.000.000đ. Vui lòng xác nhận để tiếp tục.');
      return;
    }

    const orderIds = this.selectedOrders.map(o => o._id);
    
    // Parse attachments from comma-separated string
    const attachments = this.batchForm.attachments
      ? this.batchForm.attachments.split(',').map(s => s.trim()).filter(s => s)
      : [];

    try {
      await this.service.createPaymentBatch({
        orderIds,
        batchId: this.batchForm.batchId,
        paidDate: this.batchForm.paidDate,
        note: this.batchForm.note || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        confirmOverThreshold: this.batchForm.confirmOverThreshold || undefined
      }).toPromise();

      alert(`✅ Đã tạo lượt thanh toán ${this.batchForm.batchId} với ${orderIds.length} đơn`);
      
      this.closeBatchModal();
      this.batchForm.note = '';
      this.batchForm.attachments = '';
      this.batchForm.confirmOverThreshold = false;
      
      // Reload data
      await this.loadPendingOrders();
      await this.loadBatches();
    } catch (err) {
      console.error('Error creating batch:', err);
      alert('Lỗi tạo lượt thanh toán: ' + (err as any)?.error?.message || (err as any)?.message);
    }
  }

  async viewBatch(batch: PaymentBatch) {
    this.selectedBatch = batch;
    this.showViewBatchModal = true;

    try {
      const orders = await this.service.getOrdersInBatch(batch.batchId).toPromise();
      this.batchOrders = orders || [];
    } catch (err) {
      console.error('Error loading batch orders:', err);
      alert('Lỗi tải đơn hàng: ' + (err as any)?.error?.message || (err as any)?.message);
    }
  }

  closeViewBatchModal() {
    this.showViewBatchModal = false;
    this.selectedBatch = null;
    this.batchOrders = [];
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

  calculateSupplierAmount(order: Order): number {
    // Số tiền phải trả NCC = Báo giá NCC × Số lượng
    const supplierQuote = order.supplierQuote || 0;
    const quantity = order.quantity || 1;
    return supplierQuote * quantity;
  }

  getSupplierName(supplierId: string): string {
    const supplier = this.suppliers.find(s => s._id === supplierId);
    return supplier?.fullName || supplier?.email || supplierId;
  }
}
