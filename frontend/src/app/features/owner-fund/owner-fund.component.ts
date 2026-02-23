import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OwnerFundService } from './owner-fund.service';
import { 
  Owner, 
  Withdrawal, 
  WithdrawalStatus, 
  WithdrawalType,
  FundTransaction,
  FundTransactionType,
  FundTransactionCategory,
  FundSummary,
  FundAccountInfo,
} from './models/owner-fund.model';

@Component({
  selector: 'app-owner-fund',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './owner-fund.component.html',
  styleUrls: ['./owner-fund.component.css']
})
export class OwnerFundComponent implements OnInit {
  // Signals
  owners = signal<Owner[]>([]);
  withdrawals = signal<Withdrawal[]>([]);
  transactions = signal<FundTransaction[]>([]);
  fundSummary = signal<FundSummary | null>(null);
  fundAccountInfo = signal<FundAccountInfo | null>(null);
  selectedOwner = signal<Owner | null>(null);
  systemStats = signal<any>(null);
  
  // UI State
  activeTab: 'overview' | 'fund-account' | 'owners' | 'withdrawals' | 'transactions' | 'statistics' = 'overview';
  showOwnerForm = false;
  showWithdrawalForm = false;
  showTransactionForm = false;
  showTransferModal = false;
  showWithdrawModal = false;
  editingOwner: Owner | null = null;
  
  // Transfer Form
  transferForm = {
    amount: 0,
    description: '',
  };
  withdrawFromFundForm = {
    amount: 0,
    description: '',
    bankAccount: '',
    bankName: '',
  };
  
  // Filter
  statusFilter: WithdrawalStatus | 'all' = 'all';
  ownerFilter = '';
  transactionTypeFilter = '';
  transactionOwnerFilter = '';
  
  // Form Models
  ownerForm: Partial<Owner> = this.getEmptyOwnerForm();
  withdrawalForm: Partial<Withdrawal> = this.getEmptyWithdrawalForm();
  transactionForm: any = this.getEmptyTransactionForm();
  
  // Enums for template
  WithdrawalStatus = WithdrawalStatus;
  WithdrawalType = WithdrawalType;
  FundTransactionType = FundTransactionType;
  FundTransactionCategory = FundTransactionCategory;

  constructor(
    private ownerFundService: OwnerFundService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.loadFundSummary();
    this.loadFundAccount();
  }

  loadData(): void {
    this.loadOwners();
    this.loadWithdrawals();
    this.loadSystemStats();
  }

  loadOwners(): void {
    this.ownerFundService.getAllOwners().subscribe({
      next: (data) => this.owners.set(data),
      error: (err) => console.error('Error loading owners:', err)
    });
  }

  loadWithdrawals(): void {
    const filters: any = {};
    if (this.statusFilter !== 'all') {
      filters.status = this.statusFilter;
    }
    if (this.ownerFilter) {
      filters.ownerId = this.ownerFilter;
    }

    this.ownerFundService.getAllWithdrawals(filters).subscribe({
      next: (data) => this.withdrawals.set(data),
      error: (err) => console.error('Error loading withdrawals:', err)
    });
  }

  loadSystemStats(): void {
    this.ownerFundService.getSystemStatistics().subscribe({
      next: (data) => this.systemStats.set(data),
      error: (err) => console.error('Error loading statistics:', err)
    });
  }

  loadFundSummary(): void {
    this.ownerFundService.getFundSummary().subscribe({
      next: (data) => this.fundSummary.set(data),
      error: (err) => console.error('Error loading fund summary:', err)
    });
  }

  loadFundAccount(): void {
    this.ownerFundService.getFundAccount().subscribe({
      next: (data) => this.fundAccountInfo.set(data),
      error: (err) => console.error('Error loading fund account:', err)
    });
  }

  loadTransactions(): void {
    const filters: any = {};
    if (this.transactionTypeFilter) {
      filters.type = this.transactionTypeFilter;
    }
    if (this.transactionOwnerFilter) {
      filters.ownerId = this.transactionOwnerFilter;
    }

    this.ownerFundService.getAllFundTransactions(filters).subscribe({
      next: (data) => this.transactions.set(data),
      error: (err) => console.error('Error loading transactions:', err)
    });
  }

  // ==================== OWNER OPERATIONS ====================

  openOwnerForm(owner?: Owner): void {
    if (owner) {
      this.editingOwner = owner;
      this.ownerForm = { ...owner };
    } else {
      this.editingOwner = null;
      this.ownerForm = this.getEmptyOwnerForm();
    }
    this.showOwnerForm = true;
  }

  saveOwner(): void {
    if (this.editingOwner) {
      this.ownerFundService.updateOwner(this.editingOwner._id!, this.ownerForm).subscribe({
        next: () => {
          this.loadOwners();
          this.closeOwnerForm();
        },
        error: (err) => alert('Lỗi cập nhật Owner: ' + err.error?.message)
      });
    } else {
      this.ownerFundService.createOwner(this.ownerForm).subscribe({
        next: () => {
          this.loadOwners();
          this.closeOwnerForm();
        },
        error: (err) => alert('Lỗi tạo Owner: ' + err.error?.message)
      });
    }
  }

  deleteOwner(id: string): void {
    if (confirm('Bạn có chắc muốn xóa Owner này?')) {
      this.ownerFundService.deleteOwner(id).subscribe({
        next: () => this.loadOwners(),
        error: (err) => alert('Lỗi xóa Owner: ' + err.error?.message)
      });
    }
  }

  closeOwnerForm(): void {
    this.showOwnerForm = false;
    this.editingOwner = null;
    this.ownerForm = this.getEmptyOwnerForm();
  }

  // ==================== WITHDRAWAL OPERATIONS ====================

  openWithdrawalForm(): void {
    this.withdrawalForm = this.getEmptyWithdrawalForm();
    this.showWithdrawalForm = true;
  }

  saveWithdrawal(): void {
    this.ownerFundService.createWithdrawal(this.withdrawalForm).subscribe({
      next: () => {
        this.loadWithdrawals();
        this.loadSystemStats();
        this.closeWithdrawalForm();
      },
      error: (err) => alert('Lỗi tạo phiếu rút tiền: ' + err.error?.message)
    });
  }

  approveWithdrawal(withdrawal: Withdrawal): void {
    const notes = prompt('Ghi chú duyệt (tùy chọn):');
    if (notes !== null) {
      const currentUserId = '000000000000000000000001'; // TODO: Get from auth service
      this.ownerFundService.approveWithdrawal(withdrawal._id!, currentUserId, notes).subscribe({
        next: () => {
          this.loadWithdrawals();
          this.loadSystemStats();
        },
        error: (err) => alert('Lỗi duyệt phiếu: ' + err.error?.message)
      });
    }
  }

  rejectWithdrawal(withdrawal: Withdrawal): void {
    const notes = prompt('Lý do từ chối:');
    if (notes) {
      const currentUserId = '000000000000000000000001'; // TODO: Get from auth service
      this.ownerFundService.rejectWithdrawal(withdrawal._id!, currentUserId, notes).subscribe({
        next: () => this.loadWithdrawals(),
        error: (err) => alert('Lỗi từ chối phiếu: ' + err.error?.message)
      });
    }
  }

  completeWithdrawal(withdrawal: Withdrawal): void {
    const transRef = prompt('Mã giao dịch ngân hàng (tùy chọn):');
    if (transRef !== null) {
      this.ownerFundService.completeWithdrawal(withdrawal._id!, transRef).subscribe({
        next: () => this.loadWithdrawals(),
        error: (err) => alert('Lỗi hoàn thành phiếu: ' + err.error?.message)
      });
    }
  }

  cancelWithdrawal(withdrawal: Withdrawal): void {
    if (confirm('Bạn có chắc muốn hủy phiếu rút tiền này?')) {
      this.ownerFundService.cancelWithdrawal(withdrawal._id!).subscribe({
        next: () => this.loadWithdrawals(),
        error: (err) => alert('Lỗi hủy phiếu: ' + err.error?.message)
      });
    }
  }

  closeWithdrawalForm(): void {
    this.showWithdrawalForm = false;
    this.withdrawalForm = this.getEmptyWithdrawalForm();
  }

  // ==================== FUND TRANSACTIONS ====================

  openTransactionForm(): void {
    this.transactionForm = this.getEmptyTransactionForm();
    this.showTransactionForm = true;
  }

  closeTransactionForm(): void {
    this.showTransactionForm = false;
    this.transactionForm = this.getEmptyTransactionForm();
  }

  onTransactionTypeChange(): void {
    // Reset category when type changes
    if (this.transactionForm.type === FundTransactionType.IN) {
      this.transactionForm.category = FundTransactionCategory.PROFIT_SHARE;
    } else {
      this.transactionForm.category = FundTransactionCategory.WITHDRAWAL_PROFIT;
    }
  }

  saveTransaction(): void {
    const payload = {
      ...this.transactionForm,
      date: this.transactionForm.date || new Date().toISOString().split('T')[0],
    };

    this.ownerFundService.createFundTransaction(payload).subscribe({
      next: () => {
        this.loadTransactions();
        this.loadFundSummary();
        this.loadOwners();
        this.closeTransactionForm();
      },
      error: (err) => alert('Lỗi tạo giao dịch: ' + err.error?.message)
    });
  }

  getEmptyTransactionForm(): any {
    return {
      ownerId: '',
      type: FundTransactionType.IN,
      category: FundTransactionCategory.PROFIT_SHARE,
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      description: '',
      notes: '',
    };
  }

  getCategoryText(category: FundTransactionCategory): string {
    const texts: Record<FundTransactionCategory, string> = {
      [FundTransactionCategory.PROFIT_SHARE]: 'Phân bổ lợi nhuận',
      [FundTransactionCategory.CAPITAL_CONTRIBUTION]: 'Góp vốn',
      [FundTransactionCategory.REFUND]: 'Hoàn tiền',
      [FundTransactionCategory.BANK_TRANSFER_IN]: 'Chuyển từ Bank Balance',
      [FundTransactionCategory.OTHER_IN]: 'Khác (vào)',
      [FundTransactionCategory.WITHDRAWAL_PROFIT]: 'Rút lợi nhuận',
      [FundTransactionCategory.WITHDRAWAL_EMERGENCY]: 'Rút khẩn cấp',
      [FundTransactionCategory.WITHDRAWAL_ADVANCE]: 'Tạm ứng',
      [FundTransactionCategory.BANK_TRANSFER_OUT]: 'Trả về Bank Balance',
      [FundTransactionCategory.PERSONAL_WITHDRAWAL]: 'Rút về cá nhân',
      [FundTransactionCategory.TAX]: 'Thuế',
      [FundTransactionCategory.OTHER_OUT]: 'Khác (ra)',
    };
    return texts[category] || category;
  }

  // ==================== FUND ACCOUNT TRANSFER ====================

  openTransferModal(): void {
    this.transferForm = { amount: 0, description: '' };
    this.showTransferModal = true;
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.transferForm = { amount: 0, description: '' };
  }

  transferToFund(): void {
    if (this.transferForm.amount <= 0) {
      alert('Số tiền phải lớn hơn 0');
      return;
    }

    const maxAmount = this.fundAccountInfo()?.ownerWithdrawable || 0;
    if (this.transferForm.amount > maxAmount) {
      alert(`Số tiền vượt quá giới hạn cho phép (${this.formatCurrency(maxAmount)})`);
      return;
    }

    this.ownerFundService.transferToOwnerFund(this.transferForm).subscribe({
      next: (result) => {
        alert(result.message || 'Chuyển tiền thành công!');
        this.closeTransferModal();
        this.loadFundAccount();
        this.loadFundSummary();
        this.loadTransactions();
      },
      error: (err) => alert('Lỗi: ' + (err.error?.message || 'Không thể chuyển tiền'))
    });
  }

  openWithdrawModal(): void {
    this.withdrawFromFundForm = { amount: 0, description: '', bankAccount: '', bankName: '' };
    this.showWithdrawModal = true;
  }

  closeWithdrawModal(): void {
    this.showWithdrawModal = false;
    this.withdrawFromFundForm = { amount: 0, description: '', bankAccount: '', bankName: '' };
  }

  withdrawFromFund(): void {
    if (this.withdrawFromFundForm.amount <= 0) {
      alert('Số tiền phải lớn hơn 0');
      return;
    }

    const balance = this.fundAccountInfo()?.account?.balance || 0;
    if (this.withdrawFromFundForm.amount > balance) {
      alert(`Số dư Quỹ không đủ (${this.formatCurrency(balance)})`);
      return;
    }

    this.ownerFundService.ownerWithdrawFromFund(this.withdrawFromFundForm).subscribe({
      next: (result) => {
        alert(result.message || 'Rút tiền thành công!');
        this.closeWithdrawModal();
        this.loadFundAccount();
        this.loadFundSummary();
        this.loadTransactions();
      },
      error: (err) => alert('Lỗi: ' + (err.error?.message || 'Không thể rút tiền'))
    });
  }

  returnToCompany(): void {
    const amount = prompt('Nhập số tiền muốn trả về Quỹ Công Ty:');
    if (!amount) return;

    const amountNum = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Số tiền không hợp lệ');
      return;
    }

    const balance = this.fundAccountInfo()?.account?.balance || 0;
    if (amountNum > balance) {
      alert(`Số dư Quỹ không đủ (${this.formatCurrency(balance)})`);
      return;
    }

    const description = prompt('Mô tả (tùy chọn):') || '';

    this.ownerFundService.transferFromOwnerFund({ amount: amountNum, description }).subscribe({
      next: (result) => {
        alert(result.message || 'Chuyển tiền về Quỹ Công Ty thành công!');
        this.loadFundAccount();
        this.loadFundSummary();
        this.loadTransactions();
      },
      error: (err) => alert('Lỗi: ' + (err.error?.message || 'Không thể chuyển tiền'))
    });
  }

  navigateToFinancialControl(): void {
    this.router.navigate(['/finance/financial-control']);
  }

  // ==================== HELPERS ====================

  getEmptyOwnerForm(): Partial<Owner> {
    return {
      name: '',
      email: '',
      phone: '',
      profitSharePercentage: 20,
      bankAccount: '',
      bankName: '',
      bankAccountName: '',
      isActive: true,
      notes: '',
    };
  }

  getEmptyWithdrawalForm(): Partial<Withdrawal> {
    return {
      ownerId: '',
      amount: 0,
      type: WithdrawalType.PROFIT_SHARE,
      reason: '',
      notes: '',
      isUrgent: false,
    };
  }

  getStatusBadgeClass(status: WithdrawalStatus): string {
    const classes: Record<WithdrawalStatus, string> = {
      [WithdrawalStatus.PENDING]: 'badge-warning',
      [WithdrawalStatus.APPROVED]: 'badge-info',
      [WithdrawalStatus.COMPLETED]: 'badge-success',
      [WithdrawalStatus.REJECTED]: 'badge-danger',
      [WithdrawalStatus.CANCELLED]: 'badge-secondary',
    };
    return classes[status];
  }

  getStatusText(status: WithdrawalStatus): string {
    const texts: Record<WithdrawalStatus, string> = {
      [WithdrawalStatus.PENDING]: 'Chờ duyệt',
      [WithdrawalStatus.APPROVED]: 'Đã duyệt',
      [WithdrawalStatus.COMPLETED]: 'Hoàn thành',
      [WithdrawalStatus.REJECTED]: 'Từ chối',
      [WithdrawalStatus.CANCELLED]: 'Đã hủy',
    };
    return texts[status];
  }

  getTypeText(type: WithdrawalType): string {
    const texts: Record<WithdrawalType, string> = {
      [WithdrawalType.PROFIT_SHARE]: 'Rút lợi nhuận',
      [WithdrawalType.EMERGENCY]: 'Khẩn cấp',
      [WithdrawalType.ADVANCE]: 'Tạm ứng',
    };
    return texts[type];
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('vi-VN') + 'đ';
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('vi-VN');
  }

  getOwnerName(ownerId: string | Owner): string {
    if (typeof ownerId === 'object' && ownerId.name) {
      return ownerId.name;
    }
    const owner = this.owners().find(o => o._id === ownerId);
    return owner?.name || 'N/A';
  }

  get filteredWithdrawals(): Withdrawal[] {
    let filtered = this.withdrawals();
    
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(w => w.status === this.statusFilter);
    }
    
    if (this.ownerFilter) {
      filtered = filtered.filter(w => 
        typeof w.ownerId === 'string' ? w.ownerId === this.ownerFilter : w.ownerId._id === this.ownerFilter
      );
    }
    
    return filtered;
  }

  get pendingWithdrawals(): Withdrawal[] {
    return this.withdrawals().filter(w => w.status === WithdrawalStatus.PENDING);
  }

  get urgentWithdrawals(): Withdrawal[] {
    return this.withdrawals().filter(w => w.isUrgent && w.status === WithdrawalStatus.PENDING);
  }
}
