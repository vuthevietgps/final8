/**
 * Component: AdsSettingsComponent
 * Quản lý cấu hình API credentials cho Facebook, Google Ads, TikTok
 * Cho phép test connection và trigger sync thủ công
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AdsSettings {
  facebook: { configured: boolean; tokenCount: number };
  google: { configured: boolean; clientId?: string; hasRefreshToken: boolean; developerToken?: string; loginCustomerId?: string };
  tiktok: { configured: boolean; hasAccessToken: boolean };
}

@Component({
  selector: 'app-ads-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ads-settings-container">
      <div class="header">
        <h2>⚙️ Cấu Hình API Quảng Cáo</h2>
        <p class="subtitle">Quản lý kết nối tự động với các nền tảng quảng cáo</p>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button [class.active]="activeTab() === 'overview'" (click)="activeTab.set('overview')">📊 Tổng quan</button>
        <button [class.active]="activeTab() === 'facebook'" (click)="activeTab.set('facebook')">📘 Facebook</button>
        <button [class.active]="activeTab() === 'google'" (click)="activeTab.set('google')">🔵 Google Ads</button>
        <button [class.active]="activeTab() === 'tiktok'" (click)="activeTab.set('tiktok')">🎵 TikTok</button>
      </div>

      <!-- Error/Success Messages -->
      <div *ngIf="message()" class="message" [class.error]="messageType() === 'error'" [class.success]="messageType() === 'success'">
        {{ message() }}
      </div>

      <!-- Overview Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'overview'">
        <div class="status-cards">
          <div class="status-card" [class.configured]="settings()?.facebook?.configured">
            <div class="platform-icon">📘</div>
            <div class="platform-name">Facebook Ads</div>
            <div class="platform-status">
              <span *ngIf="settings()?.facebook?.configured" class="badge success">✅ Đã cấu hình</span>
              <span *ngIf="!settings()?.facebook?.configured" class="badge warning">⚠️ Chưa cấu hình</span>
            </div>
            <div class="platform-detail">{{ settings()?.facebook?.tokenCount || 0 }} tokens</div>
            <button class="btn small" (click)="activeTab.set('facebook')">Cấu hình</button>
          </div>

          <div class="status-card" [class.configured]="settings()?.google?.configured">
            <div class="platform-icon">🔵</div>
            <div class="platform-name">Google Ads</div>
            <div class="platform-status">
              <span *ngIf="settings()?.google?.configured" class="badge success">✅ Đã cấu hình</span>
              <span *ngIf="!settings()?.google?.configured" class="badge warning">⚠️ Chưa cấu hình</span>
            </div>
            <div class="platform-detail" *ngIf="settings()?.google?.configured">
              Client ID: {{ settings()?.google?.clientId }}
            </div>
            <button class="btn small" (click)="activeTab.set('google')">Cấu hình</button>
          </div>

          <div class="status-card" [class.configured]="settings()?.tiktok?.configured">
            <div class="platform-icon">🎵</div>
            <div class="platform-name">TikTok Ads</div>
            <div class="platform-status">
              <span *ngIf="settings()?.tiktok?.configured" class="badge success">✅ Đã cấu hình</span>
              <span *ngIf="!settings()?.tiktok?.configured" class="badge warning">⚠️ Chưa cấu hình</span>
            </div>
            <div class="platform-detail" *ngIf="settings()?.tiktok?.configured">
              Access Token: ✓
            </div>
            <button class="btn small" (click)="activeTab.set('tiktok')">Cấu hình</button>
          </div>
        </div>

        <div class="info-box">
          <h4>📅 Lịch đồng bộ tự động</h4>
          <ul>
            <li><strong>Facebook:</strong> 6:00 AM hàng ngày</li>
            <li><strong>Google Ads:</strong> 6:15 AM hàng ngày</li>
            <li><strong>TikTok:</strong> 6:30 AM hàng ngày</li>
          </ul>
          <p class="note">Sau khi cấu hình, hệ thống sẽ tự động đồng bộ chi phí quảng cáo mỗi ngày.</p>
        </div>
      </div>

      <!-- Facebook Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'facebook'">
        <div class="form-section">
          <h3>📘 Cấu hình Facebook Ads</h3>
          <p class="help-text">
            Facebook Ads sử dụng Access Token. Bạn có thể lấy token từ 
            <a href="https://developers.facebook.com/tools/explorer/" target="_blank">Graph API Explorer</a>
            hoặc từ Business Manager.
          </p>
          
          <div class="existing-tokens" *ngIf="settings()?.facebook?.tokenCount">
            <p>✅ Đã có {{ settings()?.facebook?.tokenCount }} token được cấu hình.</p>
            <button class="btn secondary" routerLink="/api-tokens">Quản lý Tokens</button>
          </div>

          <div class="form-group">
            <label>Test sync Facebook (ngày hôm qua)</label>
            <button class="btn" (click)="testSync('facebook')" [disabled]="syncing()">
              {{ syncing() ? '⏳ Đang sync...' : '🔄 Test Sync Facebook' }}
            </button>
            <div class="sync-result" *ngIf="syncResult()">{{ syncResult() }}</div>
          </div>
        </div>
      </div>

      <!-- Google Ads Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'google'">
        <div class="form-section">
          <h3>🔵 Cấu hình Google Ads</h3>
          <p class="help-text">
            Google Ads yêu cầu OAuth 2.0 credentials. Xem 
            <a href="/docs/ADS-API-SETUP-GUIDE.md" target="_blank">hướng dẫn chi tiết</a>.
          </p>

          <div class="form-group">
            <label>Developer Token *</label>
            <input type="text" [(ngModel)]="googleForm.developerToken" placeholder="Lấy từ Google Ads API Center" />
          </div>

          <div class="form-group">
            <label>Client ID *</label>
            <input type="text" [(ngModel)]="googleForm.clientId" placeholder="xxx.apps.googleusercontent.com" />
          </div>

          <div class="form-group">
            <label>Client Secret *</label>
            <input type="password" [(ngModel)]="googleForm.clientSecret" placeholder="GOCSPX-..." />
          </div>

          <div class="form-group">
            <label>Refresh Token *</label>
            <input type="password" [(ngModel)]="googleForm.refreshToken" placeholder="1//..." />
            <small>Lấy từ <a href="https://developers.google.com/oauthplayground/" target="_blank">OAuth Playground</a></small>
          </div>

          <div class="form-group">
            <label>Login Customer ID (MCC)</label>
            <input type="text" [(ngModel)]="googleForm.loginCustomerId" placeholder="1234567890 (không có dấu gạch)" />
          </div>

          <div class="form-group">
            <label>Test Customer ID *</label>
            <input type="text" [(ngModel)]="googleForm.testCustomerId" placeholder="ID tài khoản để test" />
          </div>

          <div class="form-actions">
            <button class="btn secondary" (click)="testGoogle()" [disabled]="testingGoogle()">
              {{ testingGoogle() ? '⏳ Đang test...' : '🧪 Test Kết Nối' }}
            </button>
            <button class="btn primary" (click)="saveGoogle()" [disabled]="savingGoogle()">
              {{ savingGoogle() ? '⏳ Đang lưu...' : '💾 Lưu Cấu Hình' }}
            </button>
          </div>

          <div class="test-result" *ngIf="googleTestResult()">
            <pre>{{ googleTestResult() | json }}</pre>
          </div>

          <div class="form-group" *ngIf="settings()?.google?.configured">
            <label>Test sync Google Ads (ngày hôm qua)</label>
            <button class="btn" (click)="testSync('google')" [disabled]="syncing()">
              {{ syncing() ? '⏳ Đang sync...' : '🔄 Test Sync Google' }}
            </button>
            <div class="sync-result" *ngIf="syncResult()">{{ syncResult() }}</div>
          </div>
        </div>
      </div>

      <!-- TikTok Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'tiktok'">
        <div class="form-section">
          <h3>🎵 Cấu hình TikTok Ads</h3>
          <p class="help-text">
            TikTok Ads sử dụng Access Token từ 
            <a href="https://ads.tiktok.com/marketing_api/auth" target="_blank">TikTok Marketing API</a>.
          </p>

          <div class="form-group">
            <label>Access Token *</label>
            <input type="password" [(ngModel)]="tiktokForm.accessToken" placeholder="Token từ TikTok Marketing API" />
          </div>

          <div class="form-group">
            <label>App ID (tuỳ chọn)</label>
            <input type="text" [(ngModel)]="tiktokForm.appId" placeholder="App ID để refresh token" />
          </div>

          <div class="form-group">
            <label>App Secret (tuỳ chọn)</label>
            <input type="password" [(ngModel)]="tiktokForm.appSecret" placeholder="App Secret" />
          </div>

          <div class="form-group">
            <label>Advertiser ID (để test) *</label>
            <input type="text" [(ngModel)]="tiktokForm.testAdvertiserId" placeholder="7123456789012345678" />
          </div>

          <div class="form-actions">
            <button class="btn secondary" (click)="testTikTok()" [disabled]="testingTikTok()">
              {{ testingTikTok() ? '⏳ Đang test...' : '🧪 Test Kết Nối' }}
            </button>
            <button class="btn primary" (click)="saveTikTok()" [disabled]="savingTikTok()">
              {{ savingTikTok() ? '⏳ Đang lưu...' : '💾 Lưu Cấu Hình' }}
            </button>
          </div>

          <div class="test-result" *ngIf="tiktokTestResult()">
            <pre>{{ tiktokTestResult() | json }}</pre>
          </div>

          <div class="form-group" *ngIf="settings()?.tiktok?.configured">
            <label>Test sync TikTok (ngày hôm qua)</label>
            <button class="btn" (click)="testSync('tiktok')" [disabled]="syncing()">
              {{ syncing() ? '⏳ Đang sync...' : '🔄 Test Sync TikTok' }}
            </button>
            <div class="sync-result" *ngIf="syncResult()">{{ syncResult() }}</div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ads-settings-container {
      padding: 20px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .header { margin-bottom: 20px; }
    .header h2 { margin: 0 0 5px 0; }
    .subtitle { color: #666; margin: 0; }

    .tabs {
      display: flex;
      gap: 5px;
      margin-bottom: 20px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 10px;
    }
    .tabs button {
      padding: 10px 20px;
      border: none;
      background: #f5f5f5;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    .tabs button:hover { background: #e8e8e8; }
    .tabs button.active { background: #4285f4; color: white; }

    .message {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .message.error { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
    .message.success { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }

    .tab-content { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .status-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .status-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      transition: all 0.3s;
    }
    .status-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .status-card.configured { border-color: #4caf50; }
    .platform-icon { font-size: 48px; margin-bottom: 10px; }
    .platform-name { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
    .platform-status { margin-bottom: 10px; }
    .platform-detail { color: #666; font-size: 13px; margin-bottom: 15px; min-height: 20px; }

    .badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge.success { background: #e8f5e9; color: #2e7d32; }
    .badge.warning { background: #fff3e0; color: #e65100; }

    .info-box {
      background: #e3f2fd;
      border: 1px solid #90caf9;
      border-radius: 8px;
      padding: 20px;
    }
    .info-box h4 { margin: 0 0 10px 0; }
    .info-box ul { margin: 0 0 10px 20px; padding: 0; }
    .info-box li { margin: 5px 0; }
    .info-box .note { color: #1565c0; font-size: 13px; margin: 0; }

    .form-section {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 25px;
    }
    .form-section h3 { margin: 0 0 10px 0; }
    .help-text { color: #666; margin-bottom: 20px; }
    .help-text a { color: #1976d2; }

    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
      color: #333;
    }
    .form-group input, .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      box-sizing: border-box;
    }
    .form-group input:focus { border-color: #4285f4; outline: none; }
    .form-group small { color: #888; font-size: 12px; display: block; margin-top: 4px; }
    .form-group small a { color: #1976d2; }

    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 25px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .btn.primary { background: #4285f4; color: white; }
    .btn.primary:hover { background: #3367d6; }
    .btn.secondary { background: #f5f5f5; color: #333; border: 1px solid #ddd; }
    .btn.secondary:hover { background: #e8e8e8; }
    .btn.small { padding: 8px 16px; font-size: 13px; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .test-result, .sync-result {
      margin-top: 15px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      overflow-x: auto;
    }
    .test-result pre { margin: 0; white-space: pre-wrap; }

    .existing-tokens {
      background: #e8f5e9;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .existing-tokens p { margin: 0 0 10px 0; }
  `]
})
export class AdsSettingsComponent implements OnInit {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  activeTab = signal<'overview' | 'facebook' | 'google' | 'tiktok'>('overview');
  settings = signal<AdsSettings | null>(null);
  message = signal('');
  messageType = signal<'error' | 'success'>('success');

  // Google form
  googleForm = {
    developerToken: '',
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    loginCustomerId: '',
    testCustomerId: ''
  };
  testingGoogle = signal(false);
  savingGoogle = signal(false);
  googleTestResult = signal<any>(null);

  // TikTok form
  tiktokForm = {
    accessToken: '',
    appId: '',
    appSecret: '',
    testAdvertiserId: ''
  };
  testingTikTok = signal(false);
  savingTikTok = signal(false);
  tiktokTestResult = signal<any>(null);

  // Sync
  syncing = signal(false);
  syncResult = signal('');

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.http.get<AdsSettings>(`${this.baseUrl}/api-tokens/settings`).subscribe({
      next: (data) => this.settings.set(data),
      error: (err) => this.showMessage('Lỗi tải cấu hình: ' + (err?.error?.message || err.message), 'error')
    });
  }

  showMessage(msg: string, type: 'error' | 'success') {
    this.message.set(msg);
    this.messageType.set(type);
    setTimeout(() => this.message.set(''), 5000);
  }

  // Google Ads
  testGoogle() {
    if (!this.googleForm.clientId || !this.googleForm.refreshToken || !this.googleForm.developerToken) {
      this.showMessage('Vui lòng nhập đầy đủ thông tin Google Ads', 'error');
      return;
    }
    this.testingGoogle.set(true);
    this.googleTestResult.set(null);

    this.http.post(`${this.baseUrl}/api-tokens/test/google`, {
      clientId: this.googleForm.clientId,
      clientSecret: this.googleForm.clientSecret,
      refreshToken: this.googleForm.refreshToken,
      developerToken: this.googleForm.developerToken,
      customerId: this.googleForm.testCustomerId || this.googleForm.loginCustomerId
    }).subscribe({
      next: (res: any) => {
        this.googleTestResult.set(res);
        this.testingGoogle.set(false);
        if (res.ok) {
          this.showMessage('✅ Kết nối Google Ads thành công!', 'success');
        } else {
          this.showMessage('❌ ' + (res.error || res.message), 'error');
        }
      },
      error: (err) => {
        this.googleTestResult.set({ error: err?.error?.message || err.message });
        this.testingGoogle.set(false);
        this.showMessage('❌ Lỗi test: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  saveGoogle() {
    if (!this.googleForm.clientId || !this.googleForm.refreshToken || !this.googleForm.developerToken) {
      this.showMessage('Vui lòng nhập đầy đủ thông tin', 'error');
      return;
    }
    this.savingGoogle.set(true);

    this.http.post(`${this.baseUrl}/api-tokens/settings/google`, {
      clientId: this.googleForm.clientId,
      clientSecret: this.googleForm.clientSecret,
      refreshToken: this.googleForm.refreshToken,
      developerToken: this.googleForm.developerToken,
      loginCustomerId: this.googleForm.loginCustomerId
    }).subscribe({
      next: (res: any) => {
        this.savingGoogle.set(false);
        if (res.ok) {
          this.showMessage('✅ Đã lưu cấu hình Google Ads!', 'success');
          this.loadSettings();
        } else {
          this.showMessage('❌ ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.savingGoogle.set(false);
        this.showMessage('❌ Lỗi lưu: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  // TikTok
  testTikTok() {
    if (!this.tiktokForm.accessToken || !this.tiktokForm.testAdvertiserId) {
      this.showMessage('Vui lòng nhập Access Token và Advertiser ID', 'error');
      return;
    }
    this.testingTikTok.set(true);
    this.tiktokTestResult.set(null);

    this.http.post(`${this.baseUrl}/api-tokens/test/tiktok`, {
      accessToken: this.tiktokForm.accessToken,
      advertiserId: this.tiktokForm.testAdvertiserId
    }).subscribe({
      next: (res: any) => {
        this.tiktokTestResult.set(res);
        this.testingTikTok.set(false);
        if (res.ok) {
          this.showMessage('✅ Kết nối TikTok Ads thành công!', 'success');
        } else {
          this.showMessage('❌ ' + (res.error || res.message), 'error');
        }
      },
      error: (err) => {
        this.tiktokTestResult.set({ error: err?.error?.message || err.message });
        this.testingTikTok.set(false);
        this.showMessage('❌ Lỗi test: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  saveTikTok() {
    if (!this.tiktokForm.accessToken) {
      this.showMessage('Vui lòng nhập Access Token', 'error');
      return;
    }
    this.savingTikTok.set(true);

    this.http.post(`${this.baseUrl}/api-tokens/settings/tiktok`, {
      accessToken: this.tiktokForm.accessToken,
      appId: this.tiktokForm.appId,
      appSecret: this.tiktokForm.appSecret
    }).subscribe({
      next: (res: any) => {
        this.savingTikTok.set(false);
        if (res.ok) {
          this.showMessage('✅ Đã lưu cấu hình TikTok Ads!', 'success');
          this.loadSettings();
        } else {
          this.showMessage('❌ ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.savingTikTok.set(false);
        this.showMessage('❌ Lỗi lưu: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  // Test Sync
  testSync(platform: 'facebook' | 'google' | 'tiktok') {
    this.syncing.set(true);
    this.syncResult.set('');
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);

    this.http.post(`${this.baseUrl}/advertising-cost/fetch/${platform}?date=${dateStr}`, {}).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        const results = Array.isArray(res) ? res : [res];
        const summary = results.map((r: any) => `${r.date}: ${r.updated || 0} ad groups`).join(', ');
        this.syncResult.set(`✅ Sync thành công! ${summary}`);
        this.showMessage(`✅ Đã sync ${platform} cho ngày ${dateStr}`, 'success');
      },
      error: (err) => {
        this.syncing.set(false);
        this.syncResult.set(`❌ Lỗi: ${err?.error?.message || err.message}`);
        this.showMessage('❌ Lỗi sync: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }
}
