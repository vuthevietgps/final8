/**
 * File: features/ad-account/ad-account.component.ts
 * Mục đích: Giao diện quản lý Tài Khoản Quảng Cáo - inline editing như Nhóm Quảng Cáo.
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdAccountService } from './ad-account.service';
import { 
  AdAccount, 
  CreateAdAccountRequest, 
  AdAccountSearchFilter,
  AccountTypeStats
} from './models/ad-account.model';

@Component({
  selector: 'app-ad-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-account.component.html',
  styleUrls: ['./ad-account.component.css']
})
export class AdAccountComponent implements OnInit {
  private adAccountService = inject(AdAccountService);

  // State signals
  adAccounts = signal<AdAccount[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  searchFilter = signal<AdAccountSearchFilter>({});
  stats = signal<AccountTypeStats[]>([]);

  // Editing state
  editingAccountId = signal<string | null>(null);
  isAdding = signal(false);

  // Account type options
  accountTypeOptions = [
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'google', label: 'Google', icon: '🔍' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' },
    { value: 'zalo', label: 'Zalo', icon: '💬' },
    { value: 'shopee', label: 'Shopee', icon: '🛒' },
    { value: 'lazada', label: 'Lazada', icon: '🛍️' }
  ];

  ngOnInit() {
    this.loadAdAccounts();
    this.loadStats();
  }

  async loadAdAccounts() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      const filter = this.searchFilter();
      const accounts = await firstValueFrom(this.adAccountService.searchAdAccounts(filter));
      this.adAccounts.set(accounts || []);
    } catch (error: any) {
      this.error.set('Có lỗi xảy ra khi tải dữ liệu');
      console.error('Error loading ad accounts:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadStats() {
    try {
      const stats = await firstValueFrom(this.adAccountService.getStatsByType());
      this.stats.set(stats || []);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Search and filter methods
  onSearchKeyword(keyword: string) {
    this.searchFilter.update(filter => ({ ...filter, keyword }));
    this.loadAdAccounts();
  }

  onFilterAccountType(accountType: string) {
    this.searchFilter.update(filter => ({ ...filter, accountType }));
    this.loadAdAccounts();
  }

  onFilterStatus(status: string) {
    this.searchFilter.update(filter => ({ ...filter, status }));
    this.loadAdAccounts();
  }

  // Add new account
  addNew() {
    // Create new account object with temporary ID
    const tempId = 'temp_' + Date.now();
    const newAccount: AdAccount = {
      _id: tempId,
      name: '',
      accountId: '',
      accountType: 'facebook',
      isActive: true,
      notes: '',
      description: '',
      loginCustomerId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add to beginning of list
    this.adAccounts.update(accounts => [newAccount, ...accounts]);
    this.editingAccountId.set(tempId);
    this.isAdding.set(true);
  }

  // Save new account (called when finishing editing a new account)
  async saveNewAccount(account: AdAccount) {
    if (!account.name.trim() || !account.accountId.trim()) {
      alert('Vui lòng nhập tên và ID tài khoản');
      return;
    }

    try {
      const createData: CreateAdAccountRequest = {
        name: account.name,
        accountId: account.accountId,
        accountType: account.accountType,
        isActive: account.isActive,
        notes: account.notes || '',
        description: account.description || '',
        loginCustomerId: account.loginCustomerId || ''
      };

      const savedAccount = await firstValueFrom(this.adAccountService.createAdAccount(createData));
      
      // Replace temp account with saved account
      this.adAccounts.update(accounts => 
        accounts.map(acc => 
          acc._id === account._id ? savedAccount! : acc
        )
      );

      this.editingAccountId.set(null);
      this.isAdding.set(false);
      this.loadStats();
    } catch (error: any) {
      alert(error?.error?.message || 'Có lỗi xảy ra khi tạo tài khoản');
    }
  }

  // Cancel adding new account
  cancelAdd(accountId: string) {
    this.adAccounts.update(accounts => 
      accounts.filter(acc => acc._id !== accountId)
    );
    this.editingAccountId.set(null);
    this.isAdding.set(false);
  }

  // Inline editing
  async updateField(account: AdAccount, field: keyof AdAccount, value: any) {
    // If this is a new account being added, just update locally
    if (account._id.startsWith('temp_')) {
      this.adAccounts.update(accounts => 
        accounts.map(acc => 
          acc._id === account._id ? { ...acc, [field]: value } : acc
        )
      );
      return;
    }

    const oldValue = account[field];
    if (oldValue === value) return;

    try {
      const updateData = { [field]: value };
      await firstValueFrom(this.adAccountService.updateAdAccount(account._id, updateData));
      
      // Update local state
      this.adAccounts.update(accounts => 
        accounts.map(acc => 
          acc._id === account._id ? { ...acc, [field]: value } : acc
        )
      );
    } catch (error: any) {
      alert(error?.error?.message || 'Có lỗi xảy ra khi cập nhật');
      // Revert UI change by triggering reload
      this.loadAdAccounts();
    }
  }

  // Delete account
  async deleteAccount(account: AdAccount) {
    if (!confirm(`Bạn có chắc muốn xóa tài khoản "${account.name}"?`)) {
      return;
    }

    try {
      await firstValueFrom(this.adAccountService.deleteAdAccount(account._id));
      this.loadAdAccounts();
      this.loadStats();
    } catch (error: any) {
      alert(error?.error?.message || 'Có lỗi xảy ra khi xóa tài khoản');
    }
  }

  // Utility methods
  trackById(index: number, item: AdAccount): string {
    return item._id;
  }

  refresh() {
    this.loadAdAccounts();
    this.loadStats();
  }

  getAccountTypeIcon(type: string): string {
    const option = this.accountTypeOptions.find(opt => opt.value === type);
    return option?.icon || '📊';
  }

  getAccountTypeLabel(type: string): string {
    const option = this.accountTypeOptions.find(opt => opt.value === type);
    return option?.label || type;
  }

  updateNewAccountField(field: keyof CreateAdAccountRequest, value: any) {
    // This method is no longer needed with inline editing
  }
}
