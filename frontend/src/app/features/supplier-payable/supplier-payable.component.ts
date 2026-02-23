import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupplierPayableService, SupplierPayable, SupplierStatement } from './supplier-payable.service';
import { SupplierService, Supplier } from '../supplier/supplier.service';

@Component({
  selector: 'app-supplier-payable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-payable.component.html',
  styleUrls: ['./supplier-payable.component.css']
})
export class SupplierPayableComponent implements OnInit {
  supplierId = '';
  search = '';
  status = '';
  from?: string;
  to?: string;
  rows: SupplierPayable[] = [];
  loading = false;

  statements: SupplierStatement[] = [];
  statementSupplierId = '';
  statementFrom = '';
  statementTo = '';
  statementStatus = '';
  statementNotes = '';
  statementLoading = false;
  statementPayAmount: Record<string, number> = {};
  statementPayDate: Record<string, string> = {};
  statementPayRef: Record<string, string> = {};
  statementPayDocs: Record<string, string> = {};

  suppliers: Supplier[] = [];
  
  // User info for role check
  currentUserRole = '';

  // Modal states
  paymentModal = false;
  confirmModal = false;
  selectedStatement: SupplierStatement | null = null;
  paymentForm = {
    amount: 0,
    paidAt: '',
    method: '',
    reference: '',
    notes: '',
    files: [] as File[],
    documentLinks: ''
  };

  constructor(private service: SupplierPayableService, private supplierService: SupplierService) {}

  ngOnInit(): void {
    // Get user role from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUserRole = user.role || '';
      } catch (e) {
        this.currentUserRole = '';
      }
    }
    
    this.loadSuppliers();
    this.load();
    this.refreshStatements();
  }

  get isDirector(): boolean {
    return this.currentUserRole === 'director';
  }

  loadSuppliers() {
    // Không lọc active để tránh thiếu NCC, dùng minimal để load nhẹ
    this.supplierService.list({ minimal: true }).subscribe({
      next: (res) => { this.suppliers = res || []; },
      error: () => { this.suppliers = []; }
    });
  }

  load() {
    this.loading = true;
    this.service.list({ supplierId: this.supplierId || undefined, status: this.status || undefined, from: this.from, to: this.to })
      .subscribe({
        next: (res) => {
          this.rows = res.data || [];
          this.loading = false;
        },
        error: () => {
          this.rows = [];
          this.loading = false;
        }
      });
  }

  get filteredRows(): SupplierPayable[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.rows;
    return this.rows.filter(r => {
      const name = (r.supplierName || r.supplierNameSnap || '').toLowerCase();
      const id = (r.supplierId || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }

  refreshStatements() {
    this.statementLoading = true;
    this.service.listStatements({ supplierId: this.statementSupplierId || undefined, from: this.statementFrom || undefined, to: this.statementTo || undefined, status: this.statementStatus || undefined })
      .subscribe({
        next: (res) => { this.statements = res || []; this.statementLoading = false; },
        error: () => { this.statements = []; this.statementLoading = false; }
      });
  }

  upsertStatement() {
    if (!this.statementSupplierId || !this.statementFrom || !this.statementTo) return;
    this.service.upsertStatement({ supplierId: this.statementSupplierId, from: this.statementFrom, to: this.statementTo, notes: this.statementNotes || undefined })
      .subscribe({ next: () => this.refreshStatements(), error: () => {} });
  }

  addStatementPayment(s: SupplierStatement) {
    const amount = this.statementPayAmount[s._id];
    const paidAt = this.statementPayDate[s._id];
    if (!amount || !paidAt) return;
    const docsRaw = this.statementPayDocs[s._id];
    const documents = docsRaw ? docsRaw.split(',').map(v => v.trim()).filter(Boolean) : undefined;
    this.service.addStatementPayment(s._id, {
      amount,
      paidAt,
      reference: this.statementPayRef[s._id] || undefined,
      documents,
    }).subscribe({
      next: (updated) => {
        this.statements = this.statements.map(st => st._id === updated._id ? updated : st);
        this.statementPayAmount[s._id] = 0;
        this.statementPayDate[s._id] = '';
        this.statementPayRef[s._id] = '';
        this.statementPayDocs[s._id] = '';
      },
      error: () => {}
    });
  }

  closeStatement(s: SupplierStatement) {
    if (s.status === 'closed') return;
    this.service.closeStatement(s._id).subscribe({ next: (updated) => {
      this.statements = this.statements.map(st => st._id === updated._id ? updated : st);
    }, error: () => {} });
  }

  // Modal methods
  openPaymentModal(statement: SupplierStatement) {
    this.selectedStatement = statement;
    this.paymentForm = {
      amount: 0,
      paidAt: new Date().toISOString().split('T')[0],
      method: 'Chuyển khoản',
      reference: '',
      notes: '',
      files: [],
      documentLinks: ''
    };
    this.paymentModal = true;
  }

  closePaymentModal() {
    this.paymentModal = false;
    this.selectedStatement = null;
  }

  onFileSelect(event: any) {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;
    
    // Giới hạn 5 files
    const remainingSlots = 5 - this.paymentForm.files.length;
    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    this.paymentForm.files.push(...filesToAdd);
  }

  removeFile(index: number) {
    this.paymentForm.files.splice(index, 1);
  }

  async submitPayment() {
    if (!this.selectedStatement || !this.paymentForm.amount || !this.paymentForm.paidAt) return;

    // Upload files nếu có (giả định có service upload, hoặc convert base64)
    let uploadedLinks: string[] = [];
    
    // Nếu có files, convert sang base64 hoặc upload (simplified: chỉ lưu tên file như demo)
    if (this.paymentForm.files.length > 0) {
      // TODO: Thực tế cần upload lên server/cloud storage
      // Tạm thời demo: lưu placeholder
      uploadedLinks = this.paymentForm.files.map(f => `uploaded://${f.name}`);
    }

    // Parse document links
    const manualLinks = this.paymentForm.documentLinks
      ? this.paymentForm.documentLinks.split(',').map(l => l.trim()).filter(Boolean)
      : [];

    const documents = [...uploadedLinks, ...manualLinks];

    this.service.addStatementPayment(this.selectedStatement._id, {
      amount: this.paymentForm.amount,
      paidAt: this.paymentForm.paidAt,
      method: this.paymentForm.method || undefined,
      reference: this.paymentForm.reference || undefined,
      notes: this.paymentForm.notes || undefined,
      documents: documents.length ? documents : undefined,
    }).subscribe({
      next: (updated) => {
        this.statements = this.statements.map(st => st._id === updated._id ? updated : st);
        this.closePaymentModal();
      },
      error: (err) => {
        alert('Lỗi thêm thanh toán: ' + (err.error?.message || err.message));
      }
    });
  }

  confirmCloseStatement(statement: SupplierStatement) {
    this.selectedStatement = statement;
    this.confirmModal = true;
  }

  closeConfirmModal() {
    this.confirmModal = false;
    this.selectedStatement = null;
  }

  executeCloseStatement() {
    if (!this.selectedStatement) return;
    this.service.closeStatement(this.selectedStatement._id).subscribe({
      next: (updated) => {
        this.statements = this.statements.map(st => st._id === updated._id ? updated : st);
        this.closeConfirmModal();
      },
      error: (err) => {
        alert('Lỗi chốt kỳ: ' + (err.error?.message || err.message));
      }
    });
  }

  /**
   * Reopen closed statement (Director only)
   */
  reopenStatement(statement: SupplierStatement) {
    if (!this.isDirector) {
      alert('Chỉ Giám đốc mới có quyền mở lại kỳ đã chốt');
      return;
    }
    
    if (!confirm(`Bạn có chắc muốn MỞ LẠI kỳ đã chốt này?\n\nKỳ: ${new Date(statement.periodFrom).toLocaleDateString()} → ${new Date(statement.periodTo).toLocaleDateString()}\n\nSau khi mở lại, kỳ này có thể được chỉnh sửa lại.`)) {
      return;
    }

    this.service.reopenStatement(statement._id).subscribe({
      next: (updated) => {
        this.statements = this.statements.map(st => st._id === updated._id ? updated : st);
        alert('Đã mở lại kỳ thành công');
      },
      error: (err) => {
        alert('Lỗi mở lại kỳ: ' + (err.error?.message || err.message));
      }
    });
  }

  exportStatementPDF(statement: SupplierStatement) {
    // Get token from localStorage (same key as AuthService)
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('Vui lòng đăng nhập lại');
      return;
    }
    
    // Call backend PDF export endpoint with token in URL
    const url = `${this.service['baseUrl']}/statements/${statement._id}/pdf?token=${token}`;
    window.open(url, '_blank');
  }

  getSupplierName(supplierId?: string): string {
    if (!supplierId) return 'N/A';
    const supplier = this.suppliers.find(s => s._id === supplierId);
    return supplier?.fullName || supplierId;
  }
}
