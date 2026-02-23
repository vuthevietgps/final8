/**
 * Component: GoogleSheetSyncComponent
 * Chức năng: Cấu hình và đồng bộ đơn hàng lên Google Sheets cho đại lý và nhà cung cấp
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface AgentSupplier {
  _id: string;
  fullName: string;
  googleDriveLink: string;
  orderCount: number;
}

interface SyncStatus {
  enabled: boolean;
  autoSyncEnabled: boolean;
  cronSchedule: string;
  credentialsConfigured: boolean;
  credentialsSource: string;
}

@Component({
  selector: 'app-google-sheet-sync',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sync-container">
      <div class="header">
        <h2>📊 Đồng Bộ Google Sheets</h2>
        <p class="subtitle">Đồng bộ đơn hàng từ OrderTest2 lên Google Sheets của đại lý và nhà cung cấp</p>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button [class.active]="activeTab() === 'status'" (click)="activeTab.set('status')">📊 Trạng Thái</button>
        <button [class.active]="activeTab() === 'credentials'" (click)="activeTab.set('credentials')">🔑 Cấu Hình Credentials</button>
        <button [class.active]="activeTab() === 'agents'" (click)="activeTab.set('agents')">👥 Đại Lý</button>
        <button [class.active]="activeTab() === 'suppliers'" (click)="activeTab.set('suppliers')">🏭 Nhà Cung Cấp</button>
      </div>

      <!-- Messages -->
      <div *ngIf="message()" class="message" [class.error]="messageType() === 'error'" [class.success]="messageType() === 'success'">
        {{ message() }}
      </div>

      <!-- Status Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'status'">
        <div class="status-panel">
          <h3>📊 Trạng Thái Hệ Thống</h3>
          
          <div class="status-grid" *ngIf="status()">
            <div class="status-item">
              <span class="label">Google Sync:</span>
              <span [class.enabled]="status()?.enabled" [class.disabled]="!status()?.enabled">
                {{ status()?.enabled ? '✅ Đang bật' : '❌ Đang tắt' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">Auto Sync:</span>
              <span [class.enabled]="status()?.autoSyncEnabled" [class.disabled]="!status()?.autoSyncEnabled">
                {{ status()?.autoSyncEnabled ? '✅ Đang bật' : '❌ Đang tắt' }}
              </span>
            </div>
            <div class="status-item">
              <span class="label">Lịch Sync:</span>
              <span>{{ status()?.cronSchedule }} (mỗi 6 giờ)</span>
            </div>
            <div class="status-item">
              <span class="label">Credentials:</span>
              <span [class.enabled]="status()?.credentialsConfigured" [class.disabled]="!status()?.credentialsConfigured">
                {{ status()?.credentialsConfigured ? '✅ Đã cấu hình' : '❌ Chưa cấu hình' }}
              </span>
            </div>
            <div class="status-item" *ngIf="status()?.credentialsSource">
              <span class="label">Nguồn Credentials:</span>
              <span>{{ status()?.credentialsSource }}</span>
            </div>
          </div>

          <div class="action-buttons">
            <button class="btn primary" (click)="syncAllAgents()" [disabled]="syncing()">
              {{ syncing() ? '⏳ Đang sync...' : '🔄 Sync Tất Cả Đại Lý' }}
            </button>
            <button class="btn primary" (click)="syncAllSuppliers()" [disabled]="syncing()">
              {{ syncing() ? '⏳ Đang sync...' : '🔄 Sync Tất Cả NCC' }}
            </button>
          </div>

          <div class="sync-result" *ngIf="syncResult()">
            <pre>{{ syncResult() | json }}</pre>
          </div>
        </div>
      </div>

      <!-- Credentials Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'credentials'">
        <div class="credentials-panel">
          <h3>🔑 Cấu Hình Google Service Account</h3>
          
          <div class="help-text">
            <p>Để sử dụng tính năng này, bạn cần:</p>
            <ol>
              <li>Vào <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
              <li>Tạo Project mới hoặc chọn Project có sẵn</li>
              <li>Bật <strong>Google Sheets API</strong></li>
              <li>Vào <strong>IAM & Admin > Service Accounts</strong></li>
              <li>Tạo Service Account mới</li>
              <li>Tạo Key (JSON) và download file</li>
              <li>Paste nội dung file JSON vào ô bên dưới</li>
              <li><strong>Quan trọng:</strong> Share Google Sheet với email của Service Account (với quyền Editor)</li>
            </ol>
          </div>

          <div class="form-group">
            <label>Google Service Account JSON:</label>
            <textarea 
              [(ngModel)]="credentialsJson" 
              rows="15" 
              placeholder='Paste nội dung file JSON ở đây...'></textarea>
          </div>

          <div class="form-actions">
            <button class="btn secondary" (click)="testCredentials()" [disabled]="testing()">
              {{ testing() ? '⏳ Đang test...' : '🧪 Test Credentials' }}
            </button>
            <button class="btn primary" (click)="saveCredentials()" [disabled]="saving()">
              {{ saving() ? '⏳ Đang lưu...' : '💾 Lưu Credentials' }}
            </button>
          </div>

          <div class="test-result" *ngIf="testResult()">
            <pre>{{ testResult() | json }}</pre>
          </div>
        </div>
      </div>

      <!-- Agents Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'agents'">
        <div class="list-panel">
          <h3>👥 Danh Sách Đại Lý</h3>
          
          <table class="data-table" *ngIf="agents().length > 0">
            <thead>
              <tr>
                <th>Tên Đại Lý</th>
                <th>Google Sheet Link</th>
                <th>Số Đơn Hàng</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let agent of agents()">
                <td>{{ agent.fullName }}</td>
                <td>
                  <span *ngIf="agent.googleDriveLink" class="badge success">✅ Đã cấu hình</span>
                  <span *ngIf="!agent.googleDriveLink" class="badge warning">⚠️ Chưa có</span>
                </td>
                <td>{{ agent.orderCount }}</td>
                <td>
                  <button 
                    class="btn small" 
                    [disabled]="!agent.googleDriveLink || syncing()"
                    (click)="syncAgent(agent._id, agent.fullName)">
                    🔄 Sync
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="agents().length === 0" class="empty-state">
            Chưa có đại lý nào. Hãy thêm đại lý trong phần Quản Lý Người Dùng.
          </div>
        </div>
      </div>

      <!-- Suppliers Tab -->
      <div class="tab-content" *ngIf="activeTab() === 'suppliers'">
        <div class="list-panel">
          <h3>🏭 Danh Sách Nhà Cung Cấp</h3>
          
          <table class="data-table" *ngIf="suppliers().length > 0">
            <thead>
              <tr>
                <th>Tên Nhà Cung Cấp</th>
                <th>Google Sheet Link</th>
                <th>Số Đơn Hàng</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let supplier of suppliers()">
                <td>{{ supplier.fullName }}</td>
                <td>
                  <span *ngIf="supplier.googleDriveLink" class="badge success">✅ Đã cấu hình</span>
                  <span *ngIf="!supplier.googleDriveLink" class="badge warning">⚠️ Chưa có</span>
                </td>
                <td>{{ supplier.orderCount }}</td>
                <td>
                  <button 
                    class="btn small" 
                    [disabled]="!supplier.googleDriveLink || syncing()"
                    (click)="syncSupplier(supplier._id, supplier.fullName)">
                    🔄 Sync
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="suppliers().length === 0" class="empty-state">
            Chưa có nhà cung cấp nào. Hãy thêm nhà cung cấp trong phần Quản Lý Người Dùng.
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sync-container {
      padding: 20px;
      max-width: 1200px;
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
      flex-wrap: wrap;
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
    .tabs button.active { background: #4caf50; color: white; }

    .message {
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .message.error { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }
    .message.success { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }

    .tab-content { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .status-panel, .credentials-panel, .list-panel {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 25px;
    }
    .status-panel h3, .credentials-panel h3, .list-panel h3 {
      margin: 0 0 20px 0;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
    }
    .status-item .label { font-weight: 500; color: #555; }
    .status-item .enabled { color: #2e7d32; }
    .status-item .disabled { color: #c62828; }

    .action-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 20px;
    }

    .help-text {
      background: #e3f2fd;
      border: 1px solid #90caf9;
      border-radius: 8px;
      padding: 15px 20px;
      margin-bottom: 20px;
    }
    .help-text p { margin: 0 0 10px 0; }
    .help-text ol { margin: 0; padding-left: 20px; }
    .help-text li { margin: 5px 0; }
    .help-text a { color: #1976d2; }

    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-family: monospace;
      font-size: 13px;
      resize: vertical;
      box-sizing: border-box;
    }
    .form-group textarea:focus { border-color: #4caf50; outline: none; }

    .form-actions {
      display: flex;
      gap: 10px;
      margin-top: 20px;
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
    .btn.primary { background: #4caf50; color: white; }
    .btn.primary:hover { background: #388e3c; }
    .btn.secondary { background: #f5f5f5; color: #333; border: 1px solid #ddd; }
    .btn.secondary:hover { background: #e8e8e8; }
    .btn.small { padding: 6px 12px; font-size: 13px; }
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
    .test-result pre, .sync-result pre { margin: 0; white-space: pre-wrap; }

    .data-table {
      width: 100%;
      border-collapse: collapse;
    }
    .data-table th, .data-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    .data-table th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .data-table tr:hover td {
      background: #fafafa;
    }

    .badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge.success { background: #e8f5e9; color: #2e7d32; }
    .badge.warning { background: #fff3e0; color: #e65100; }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #888;
    }
  `]
})
export class GoogleSheetSyncComponent implements OnInit {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  activeTab = signal<'status' | 'credentials' | 'agents' | 'suppliers'>('status');
  message = signal('');
  messageType = signal<'error' | 'success'>('success');

  status = signal<SyncStatus | null>(null);
  agents = signal<AgentSupplier[]>([]);
  suppliers = signal<AgentSupplier[]>([]);

  credentialsJson = '';
  testing = signal(false);
  saving = signal(false);
  syncing = signal(false);
  testResult = signal<any>(null);
  syncResult = signal<any>(null);

  ngOnInit() {
    this.loadStatus();
    this.loadAgentsAndSuppliers();
  }

  loadStatus() {
    this.http.get<SyncStatus>(`${this.baseUrl}/order-sheet-sync/status`).subscribe({
      next: (data) => this.status.set(data),
      error: (err) => this.showMessage('Lỗi tải trạng thái: ' + (err?.error?.message || err.message), 'error')
    });
  }

  loadAgentsAndSuppliers() {
    this.http.get<{ agents: AgentSupplier[]; suppliers: AgentSupplier[] }>(
      `${this.baseUrl}/order-sheet-sync/agents-suppliers`
    ).subscribe({
      next: (data) => {
        this.agents.set(data.agents || []);
        this.suppliers.set(data.suppliers || []);
      },
      error: (err) => console.error('Error loading agents/suppliers:', err)
    });
  }

  showMessage(msg: string, type: 'error' | 'success') {
    this.message.set(msg);
    this.messageType.set(type);
    setTimeout(() => this.message.set(''), 5000);
  }

  testCredentials() {
    if (!this.credentialsJson.trim()) {
      this.showMessage('Vui lòng nhập credentials JSON', 'error');
      return;
    }
    this.testing.set(true);
    this.testResult.set(null);

    this.http.post(`${this.baseUrl}/order-sheet-sync/test-credentials`, {
      credentialsJson: this.credentialsJson
    }).subscribe({
      next: (res: any) => {
        this.testResult.set(res);
        this.testing.set(false);
        if (res.success) {
          this.showMessage('✅ ' + res.message, 'success');
        } else {
          this.showMessage('❌ ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.testing.set(false);
        this.showMessage('❌ Lỗi test: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  saveCredentials() {
    if (!this.credentialsJson.trim()) {
      this.showMessage('Vui lòng nhập credentials JSON', 'error');
      return;
    }
    this.saving.set(true);

    this.http.post(`${this.baseUrl}/order-sheet-sync/credentials`, {
      credentialsJson: this.credentialsJson
    }).subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res.success) {
          this.showMessage('✅ ' + res.message, 'success');
          this.loadStatus();
        } else {
          this.showMessage('❌ ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.showMessage('❌ Lỗi lưu: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  syncAllAgents() {
    this.syncing.set(true);
    this.syncResult.set(null);

    this.http.post(`${this.baseUrl}/order-sheet-sync/agents/all`, {}).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        this.syncResult.set(res);
        this.showMessage(`✅ Sync đại lý: ${res.success}/${res.total} thành công`, 'success');
      },
      error: (err) => {
        this.syncing.set(false);
        this.showMessage('❌ Lỗi sync: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  syncAllSuppliers() {
    this.syncing.set(true);
    this.syncResult.set(null);

    this.http.post(`${this.baseUrl}/order-sheet-sync/suppliers/all`, {}).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        this.syncResult.set(res);
        this.showMessage(`✅ Sync NCC: ${res.success}/${res.total} thành công`, 'success');
      },
      error: (err) => {
        this.syncing.set(false);
        this.showMessage('❌ Lỗi sync: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  syncAgent(agentId: string, name: string) {
    this.syncing.set(true);

    this.http.post(`${this.baseUrl}/order-sheet-sync/agent/${agentId}`, {}).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        if (res.success) {
          this.showMessage(`✅ Đã sync ${res.recordsSynced} đơn hàng cho ${name}`, 'success');
        } else {
          this.showMessage('❌ ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.syncing.set(false);
        this.showMessage('❌ Lỗi sync: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }

  syncSupplier(supplierId: string, name: string) {
    this.syncing.set(true);

    this.http.post(`${this.baseUrl}/order-sheet-sync/supplier/${supplierId}`, {}).subscribe({
      next: (res: any) => {
        this.syncing.set(false);
        if (res.success) {
          this.showMessage(`✅ Đã sync ${res.recordsSynced} đơn hàng cho ${name}`, 'success');
        } else {
          this.showMessage('❌ ' + res.message, 'error');
        }
      },
      error: (err) => {
        this.syncing.set(false);
        this.showMessage('❌ Lỗi sync: ' + (err?.error?.message || err.message), 'error');
      }
    });
  }
}
