/**
 * File: features/ad-account/ad-account.component.ts
 * Muc dich: Giao dien quan ly Tai Khoan Quang Cao voi boi canh BM / MCC / BC.
 */
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdAccountService } from './ad-account.service';
import {
  AdAccount,
  AdAccountSearchFilter,
  AdManagementMode,
  AdTokenSource,
  AdsOperatorRef,
  CreateAdAccountRequest,
  AccountTypeStats,
} from './models/ad-account.model';
import { UserService } from '../user/user.service';
import { User } from '../user/user.model';

@Component({
  selector: 'app-ad-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ad-account.component.html',
  styleUrls: ['./ad-account.component.css']
})
export class AdAccountComponent implements OnInit {
  private readonly adAccountService = inject(AdAccountService);
  private readonly userService = inject(UserService);

  adAccounts = signal<AdAccount[]>([]);
  adsOperators = signal<User[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);
  searchFilter = signal<AdAccountSearchFilter>({});
  stats = signal<AccountTypeStats[]>([]);

  editingAccountId = signal<string | null>(null);
  isAdding = signal(false);

  readonly accountTypeOptions = [
    { value: 'facebook', label: 'Facebook', icon: 'FB' },
    { value: 'google', label: 'Google', icon: 'GG' },
    { value: 'tiktok', label: 'TikTok', icon: 'TT' },
    { value: 'zalo', label: 'Zalo', icon: 'ZA' },
    { value: 'shopee', label: 'Shopee', icon: 'SP' },
    { value: 'lazada', label: 'Lazada', icon: 'LZ' },
  ] as const;

  readonly managementModeOptions: Array<{ value: AdManagementMode; label: string }> = [
    { value: 'direct', label: 'Direct' },
    { value: 'bm', label: 'BM' },
    { value: 'mcc', label: 'MCC' },
    { value: 'bc', label: 'BC' },
  ];

  readonly tokenSourceOptions: Array<{ value: AdTokenSource; label: string }> = [
    { value: 'system', label: 'System' },
    { value: 'account', label: 'Account' },
    { value: 'manual', label: 'Manual' },
  ];

  ngOnInit() {
    this.loadInitialData();
  }

  async loadInitialData() {
    this.isLoading.set(true);
    this.error.set(null);
    try {
      await Promise.all([
        this.loadAdAccounts(),
        this.loadStats(),
        this.loadAdsOperators(),
      ]);
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Co loi xay ra khi tai du lieu');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadAdAccounts() {
    const accounts = await firstValueFrom(this.adAccountService.searchAdAccounts(this.searchFilter()));
    this.adAccounts.set(accounts || []);
  }

  async loadStats() {
    const stats = await firstValueFrom(this.adAccountService.getStatsByType());
    this.stats.set(stats || []);
  }

  async loadAdsOperators() {
    const users = await firstValueFrom(this.userService.getAdsOperators());
    this.adsOperators.set(users || []);
  }

  onSearchKeyword(keyword: string) {
    this.searchFilter.update((filter) => ({ ...filter, keyword }));
    this.loadAdAccounts();
  }

  onFilterAccountType(accountType: string) {
    this.searchFilter.update((filter) => ({ ...filter, accountType }));
    this.loadAdAccounts();
  }

  onFilterManagementMode(managementMode: string) {
    this.searchFilter.update((filter) => ({ ...filter, managementMode }));
    this.loadAdAccounts();
  }

  onFilterAdsManager(adsManagerUserId: string) {
    this.searchFilter.update((filter) => ({ ...filter, adsManagerUserId }));
    this.loadAdAccounts();
  }

  onFilterStatus(status: string) {
    this.searchFilter.update((filter) => ({ ...filter, status }));
    this.loadAdAccounts();
  }

  addNew() {
    const tempId = `temp_${Date.now()}`;
    const accountType: AdAccount['accountType'] = 'tiktok';
    const newAccount: AdAccount = {
      _id: tempId,
      name: '',
      accountId: '',
      accountType,
      managementMode: this.defaultManagementMode(accountType),
      isActive: true,
      notes: '',
      description: '',
      loginCustomerId: '',
      businessCenterId: '',
      businessCenterName: '',
      tokenSource: 'system',
      adsManagerUserId: '',
      lastOperatorActivityAt: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.adAccounts.update((accounts) => [newAccount, ...accounts]);
    this.editingAccountId.set(tempId);
    this.isAdding.set(true);
  }

  async saveNewAccount(account: AdAccount) {
    if (!account.name.trim() || !account.accountId.trim()) {
      alert('Vui long nhap ten va ID tai khoan');
      return;
    }

    try {
      const payload = this.toPayload(account);
      await firstValueFrom(this.adAccountService.createAdAccount(payload));
      await this.loadAdAccounts();
      await this.loadStats();
      this.editingAccountId.set(null);
      this.isAdding.set(false);
    } catch (error: any) {
      alert(error?.error?.message || 'Co loi xay ra khi tao tai khoan');
    }
  }

  cancelAdd(accountId: string) {
    this.adAccounts.update((accounts) => accounts.filter((item) => item._id !== accountId));
    this.editingAccountId.set(null);
    this.isAdding.set(false);
  }

  async updateField(account: AdAccount, field: keyof AdAccount, value: any) {
    if (account._id.startsWith('temp_')) {
      this.adAccounts.update((accounts) =>
        accounts.map((item) => {
          if (item._id !== account._id) return item;
          const next = { ...item, [field]: value };
          if (field === 'accountType') {
            next.managementMode = this.defaultManagementMode(value);
          }
          return next;
        })
      );
      return;
    }

    const currentValue = this.getComparableValue(account[field]);
    const nextValue = this.getComparableValue(value);
    if (currentValue === nextValue) return;

    try {
      const patch: Record<string, any> = {
        [field]: this.normalizeFieldValue(field, value),
      };
      if (field === 'accountType') {
        patch['managementMode'] = this.defaultManagementMode(value);
      }

      const updated = await firstValueFrom(this.adAccountService.updateAdAccount(account._id, patch));
      this.adAccounts.update((accounts) =>
        accounts.map((item) => item._id === account._id ? updated! : item)
      );
    } catch (error: any) {
      alert(error?.error?.message || 'Co loi xay ra khi cap nhat');
      this.loadAdAccounts();
    }
  }

  async deleteAccount(account: AdAccount) {
    if (!confirm(`Ban co chac muon xoa tai khoan "${account.name}"?`)) return;

    try {
      await firstValueFrom(this.adAccountService.deleteAdAccount(account._id));
      await this.loadAdAccounts();
      await this.loadStats();
    } catch (error: any) {
      alert(error?.error?.message || 'Co loi xay ra khi xoa tai khoan');
    }
  }

  trackById(index: number, item: AdAccount): string {
    return item._id;
  }

  refresh() {
    this.loadInitialData();
  }

  defaultManagementMode(accountType: string): AdManagementMode {
    if (accountType === 'facebook') return 'bm';
    if (accountType === 'google') return 'mcc';
    if (accountType === 'tiktok') return 'bc';
    return 'direct';
  }

  getAccountTypeLabel(type: string): string {
    return this.accountTypeOptions.find((item) => item.value === type)?.label || type;
  }

  getAccountTypeIcon(type: string): string {
    return this.accountTypeOptions.find((item) => item.value === type)?.icon || 'AD';
  }

  getManagementModeLabel(mode?: string): string {
    return this.managementModeOptions.find((item) => item.value === mode)?.label || mode || '-';
  }

  getTokenSourceLabel(source?: string): string {
    return this.tokenSourceOptions.find((item) => item.value === source)?.label || source || '-';
  }

  getAdsManagerId(value?: string | AdsOperatorRef): string {
    if (!value) return '';
    return typeof value === 'string' ? value : value._id;
  }

  getAdsManagerLabel(value?: string | AdsOperatorRef): string {
    const id = this.getAdsManagerId(value);
    if (!id) return 'Chua gan';

    if (typeof value === 'object' && (value.fullName || value.email)) {
      return value.fullName || value.email || id;
    }

    const user = this.adsOperators().find((item) => item._id === id);
    return user?.fullName || user?.email || id;
  }

  formatLastOperatorActivity(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  showBusinessCenterFields(account: AdAccount): boolean {
    return account.accountType === 'tiktok';
  }

  showLoginCustomerId(account: AdAccount): boolean {
    return account.accountType === 'google';
  }

  private normalizeFieldValue(field: keyof AdAccount, value: any) {
    if (field === 'adsManagerUserId') {
      return value || undefined;
    }
    if (typeof value === 'string') {
      return value.trim() || undefined;
    }
    return value;
  }

  private getComparableValue(value: any): string {
    if (value == null) return '';
    if (typeof value === 'object') return value._id || '';
    return String(value);
  }

  private toPayload(account: AdAccount): CreateAdAccountRequest {
    return {
      name: account.name.trim(),
      accountId: account.accountId.trim(),
      accountType: account.accountType,
      managementMode: account.managementMode || this.defaultManagementMode(account.accountType),
      isActive: account.isActive,
      notes: account.notes?.trim() || undefined,
      description: account.description?.trim() || undefined,
      loginCustomerId: account.loginCustomerId?.trim() || undefined,
      businessCenterId: account.businessCenterId?.trim() || undefined,
      businessCenterName: account.businessCenterName?.trim() || undefined,
      tokenSource: account.tokenSource || 'system',
      adsManagerUserId: this.getAdsManagerId(account.adsManagerUserId) || undefined,
    };
  }
}
