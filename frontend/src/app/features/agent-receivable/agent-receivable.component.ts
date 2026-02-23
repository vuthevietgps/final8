import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentReceivableService, AgentReceivableRow, AgentStatement } from './agent-receivable.service';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

@Component({
  selector: 'app-agent-receivable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agent-receivable.component.html',
  styleUrls: ['./agent-receivable.component.css']
})
export class AgentReceivableComponent implements OnInit {
  agents: User[] = [];

  summaryRows: AgentReceivableRow[] = [];
  summaryLoading = false;
  summaryFrom = '';
  summaryTo = '';
  summaryAgentId = 'all';

  statements: AgentStatement[] = [];
  statementAgentId = '';
  statementFrom = '';
  statementTo = '';
  statementStatus = '';
  statementNotes = '';
  statementLoading = false;

  // User info for role check
  currentUserRole = '';

  // Modal states
  paymentModal = false;
  confirmModal = false;
  selectedStatement: AgentStatement | null = null;
  paymentForm = {
    amount: 0,
    paidAt: '',
    method: '',
    reference: '',
    notes: '',
    files: [] as File[],
    documentLinks: ''
  };

  constructor(private service: AgentReceivableService, private userService: UserService) {}

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
    
    this.loadAgents();
    this.loadSummary();
    this.loadStatements();
  }

  get isDirector(): boolean {
    return this.currentUserRole === 'director';
  }

  loadAgents() {
    this.userService.getAgents().subscribe({
      next: (res) => { this.agents = res || []; },
      error: () => { this.agents = []; }
    });
  }

  loadSummary() {
    this.summaryLoading = true;
    const params = {
      agentId: this.summaryAgentId !== 'all' ? this.summaryAgentId : undefined,
      from: this.summaryFrom || undefined,
      to: this.summaryTo || undefined,
    };
    this.service.getReceivableSummary(params).subscribe({
      next: (res) => {
        this.summaryRows = res.data || [];
        this.summaryLoading = false;
      },
      error: () => {
        this.summaryRows = [];
        this.summaryLoading = false;
      }
    });
  }

  loadStatements() {
    this.statementLoading = true;
    const params: any = {};
    if (this.statementAgentId) params.agentId = this.statementAgentId;
    if (this.statementFrom) params.from = this.statementFrom;
    if (this.statementTo) params.to = this.statementTo;
    if (this.statementStatus) params.status = this.statementStatus;
    
    this.service.listStatements(params).subscribe({
      next: (res) => { this.statements = res || []; this.statementLoading = false; },
      error: () => { this.statements = []; this.statementLoading = false; }
    });
  }

  canUpsert(): boolean {
    return !!(this.statementAgentId && this.statementFrom && this.statementTo);
  }

  upsertStatement() {
    if (!this.canUpsert()) return;
    this.service.upsertStatement({ agentId: this.statementAgentId, from: this.statementFrom, to: this.statementTo, notes: this.statementNotes || undefined })
      .subscribe({ next: () => this.loadStatements(), error: () => {} });
  }

  // Modal methods
  openPaymentModal(statement: AgentStatement) {
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

  confirmCloseStatement(statement: AgentStatement) {
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
  reopenStatement(statement: AgentStatement) {
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

  exportStatementPDF(statement: AgentStatement) {
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

  getAgentName(agentId?: string): string {
    if (!agentId) return 'N/A';
    const agent = this.agents.find(a => a._id === agentId);
    return agent?.fullName || agent?.email || agentId;
  }

  // Old payment method (kept for backward compatibility if needed)
  payAmount: { [key: string]: number } = {};
  payDate: { [key: string]: string } = {};
  payRef: { [key: string]: string } = {};
  payDocs: { [key: string]: string } = {};

  addPayment(s: AgentStatement) {
    const amount = this.payAmount[s._id];
    const paidAt = this.payDate[s._id];
    if (!amount || !paidAt) return;
    const docsRaw = this.payDocs[s._id];
    const documents = docsRaw ? docsRaw.split(',').map(v => v.trim()).filter(Boolean) : undefined;
    this.service.addStatementPayment(s._id, {
      amount,
      paidAt,
      reference: this.payRef[s._id] || undefined,
      documents,
    }).subscribe({
      next: (updated) => {
        this.statements = this.statements.map(st => st._id === updated._id ? updated : st);
        this.payAmount[s._id] = 0;
        this.payDate[s._id] = '';
        this.payRef[s._id] = '';
        this.payDocs[s._id] = '';
      },
      error: () => {}
    });
  }

  get summaryTotals() {
    return this.summaryRows.reduce((acc, cur) => {
      acc.totalQuoteAmount += cur.totalQuoteAmount || 0;
      acc.collectedAmount += cur.collectedAmount || 0;
      acc.receivableAmount += cur.receivableAmount || 0;
      acc.totalOrders += cur.totalOrders || 0;
      return acc;
    }, { totalQuoteAmount: 0, collectedAmount: 0, receivableAmount: 0, totalOrders: 0 });
  }
}
