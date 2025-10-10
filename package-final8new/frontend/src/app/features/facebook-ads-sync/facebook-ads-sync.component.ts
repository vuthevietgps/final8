/**
 * File: facebook-ads-sync.component.ts
 * Mục đích: Component quản lý đồng bộ chi phí Facebook Ads
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FacebookAdsSyncService, FacebookSyncResult, SyncRequest } from './facebook-ads-sync.service';
import { AdAccountService } from '../ad-account/ad-account.service';
import { AdAccount } from '../ad-account/models/ad-account.model';
import { FacebookTokenService, FacebookToken } from '../facebook-token/facebook-token.service';

@Component({
  selector: 'app-facebook-ads-sync',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './facebook-ads-sync.component.html',
  styleUrls: ['./facebook-ads-sync.component.css']
})
export class FacebookAdsSyncComponent implements OnInit {
  // State
  loading = signal(false);
  syncResult = signal<FacebookSyncResult | null>(null);
  error = signal<string | null>(null);
  adAccounts = signal<AdAccount[]>([]);
  availableTokens = signal<FacebookToken[]>([]);

  // Form data
  selectedTokenId = '';
  selectedAccountId = '';
  syncType = 'yesterday'; // 'yesterday', 'lastWeek', 'range', 'all'
  dateFrom = '';
  dateTo = '';

  constructor(
    private facebookSyncService: FacebookAdsSyncService,
    private adAccountService: AdAccountService,
    private facebookTokenService: FacebookTokenService
  ) {}

  ngOnInit() {
    this.loadAdAccounts();
    this.loadFacebookTokens();
    this.setDefaultDates();
  }

  loadAdAccounts() {
    this.adAccountService.getAdAccounts().subscribe({
      next: (accounts) => {
        this.adAccounts.set(accounts.filter(acc => acc.accountType === 'facebook'));
      },
      error: (err) => {
        console.error('Error loading ad accounts:', err);
      }
    });
  }

  loadFacebookTokens() {
    this.facebookTokenService.getAll().subscribe({
      next: (tokens: FacebookToken[]) => {
        this.availableTokens.set(tokens);
        // Auto-select default token if available
        const defaultToken = tokens.find((t: FacebookToken) => t.isDefault);
        if (defaultToken && defaultToken._id) {
          this.selectedTokenId = defaultToken._id;
        }
      },
      error: (err: any) => {
        console.error('Error loading Facebook tokens:', err);
      }
    });
  }

  setDefaultDates() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    this.dateFrom = lastWeek.toISOString().split('T')[0];
    this.dateTo = yesterday.toISOString().split('T')[0];
  }

  async syncData() {
    if (!this.selectedTokenId) {
      this.error.set('Vui lòng chọn Facebook Access Token');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.syncResult.set(null);

    try {
      let result: FacebookSyncResult;

      // Sử dụng default token từ backend hoặc token được chọn
      const useDefault = this.selectedTokenId === 'default' || !this.selectedTokenId;

      switch (this.syncType) {
        case 'yesterday':
          if (useDefault) {
            result = await firstValueFrom(this.facebookSyncService.syncWithDefaultToken());
          } else {
            // Tạm thời sử dụng method cũ với token placeholder
            result = await firstValueFrom(this.facebookSyncService.syncYesterday('temp'));
          }
          break;
        
        case 'lastWeek':
          if (useDefault) {
            result = await firstValueFrom(this.facebookSyncService.syncWithDefaultToken());
          } else {
            result = await firstValueFrom(this.facebookSyncService.syncLastWeek('temp'));
          }
          break;
        
        case 'range':
          if (!this.dateFrom || !this.dateTo) {
            this.error.set('Vui lòng chọn khoảng thời gian');
            return;
          }
          // Với range, sử dụng default token với date range
          const rangeRequest = {
            since: this.dateFrom,
            until: this.dateTo
          };
          result = await firstValueFrom(this.facebookSyncService.syncWithDefaultToken(rangeRequest));
          break;
        
        case 'all':
          result = await firstValueFrom(this.facebookSyncService.syncWithDefaultToken());
          break;
        
        case 'account':
          if (!this.selectedAccountId) {
            this.error.set('Vui lòng chọn tài khoản quảng cáo');
            return;
          }
          // Tạm thời placeholder
          result = await firstValueFrom(this.facebookSyncService.syncAll({ 
            accessToken: 'temp',
            accountId: this.selectedAccountId 
          }));
          break;
        
        default:
          this.error.set('Loại đồng bộ không hợp lệ');
          return;
      }

      this.syncResult.set(result);

      if (result.failed > 0) {
        this.error.set(`Đã hoàn thành với ${result.failed} lỗi. Xem chi tiết bên dưới.`);
      }

    } catch (error: any) {
      console.error('Sync error:', error);
      this.error.set(error.error?.message || error.message || 'Đã xảy ra lỗi khi đồng bộ');
    } finally {
      this.loading.set(false);
    }
  }

  async testConnection() {
    if (!this.selectedTokenId) {
      this.error.set('Vui lòng chọn Facebook Access Token');
      return;
    }

    if (!this.selectedAccountId) {
      this.error.set('Vui lòng chọn tài khoản để test');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // Test token trước
      const tokenResult = await firstValueFrom(this.facebookTokenService.testToken(this.selectedTokenId));
      
      if (tokenResult.valid) {
        alert('Token hợp lệ và kết nối Facebook API thành công!');
      } else {
        this.error.set(`Token không hợp lệ: ${tokenResult.error}`);
      }

    } catch (error: any) {
      console.error('Test error:', error);
      this.error.set(error.error?.message || error.message || 'Test kết nối thất bại');
    } finally {
      this.loading.set(false);
    }
  }

  clearResults() {
    this.syncResult.set(null);
    this.error.set(null);
  }

  onSyncTypeChange() {
    this.clearResults();
  }

  getTotalSpend(): number {
    const result = this.syncResult();
    if (!result) return 0;
    return result.synced.reduce((sum, item) => sum + item.spend, 0);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }
}