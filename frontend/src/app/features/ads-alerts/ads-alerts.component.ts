/**
 * File: ads-alerts/ads-alerts.component.ts
 * Mục đích: Component hiển thị Ads Alerts real-time
 * - Notification bell với badge count
 * - Dropdown drawer với danh sách alerts
 * - Actions: mark read, dismiss, navigate
 */
import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdsAlertsService, AdsAlert, AlertType, AlertCategory, OptimalSpendSuggestion } from './ads-alerts.service';
import { AuthService } from '../../core/services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-ads-alerts',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="ads-alerts-container">
      <!-- Notification Bell -->
      <button class="notification-bell" 
              [class.has-unread]="service.hasUnread()" 
              (click)="toggleDrawer($event)">
        <span class="bell-icon">🔔</span>
        @if (service.unreadCount() > 0) {
          <span class="badge" [class.critical]="service.criticalCount() > 0">
            {{ service.unreadCount() > 99 ? '99+' : service.unreadCount() }}
          </span>
        }
      </button>

      <!-- Alerts Drawer -->
      @if (isDrawerOpen()) {
        <div class="alerts-drawer" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h3>🔔 Thông Báo Quảng Cáo</h3>
            <div class="header-actions">
              <button class="btn-icon" (click)="refresh()" title="Làm mới">🔄</button>
              @if (service.hasUnread()) {
                <button class="btn-text" (click)="service.markAllAsRead()">Đọc tất cả</button>
              }
            </div>
          </div>

          <!-- Tabs -->
          <div class="drawer-tabs">
            <button class="tab" [class.active]="activeTab() === 'alerts'" (click)="switchTab('alerts')">
              🚨 Cảnh báo
              @if (service.unreadCount() > 0) {
                <span class="tab-badge">{{ service.unreadCount() }}</span>
              }
            </button>
            <button class="tab" [class.active]="activeTab() === 'suggestions'" (click)="switchTab('suggestions')">
              💡 Gợi ý chi phí
              @if (service.spendSuggestions().length > 0) {
                <span class="tab-badge suggest">{{ service.spendSuggestions().length }}</span>
              }
            </button>
          </div>

          <!-- Alerts Tab Content -->
          @if (activeTab() === 'alerts') {
            <!-- Summary Stats -->
            <div class="summary-stats">
              <div class="stat critical" [class.active]="filterType() === 'CRITICAL'" (click)="toggleFilter('CRITICAL')">
                <span class="count">{{ service.criticalCount() }}</span>
                <span class="label">Nghiêm trọng</span>
              </div>
              <div class="stat warning" [class.active]="filterType() === 'WARNING'" (click)="toggleFilter('WARNING')">
                <span class="count">{{ service.warningCount() }}</span>
                <span class="label">Cảnh báo</span>
              </div>
              <div class="stat success" [class.active]="filterType() === 'SUCCESS'" (click)="toggleFilter('SUCCESS')">
                <span class="count">{{ successCount() }}</span>
                <span class="label">Scale</span>
              </div>
            </div>

            <!-- Alerts List -->
            <div class="alerts-list">
              @if (filteredAlerts().length === 0) {
                <div class="empty-state">
                  <span class="icon">✨</span>
                  <p>Không có cảnh báo nào</p>
                  <button class="btn-primary" (click)="triggerCheck()">
                    🔍 Kiểm tra ngay
                  </button>
                </div>
              } @else {
                @for (alert of filteredAlerts(); track alert.id) {
                  <div class="alert-item" 
                       [class.unread]="!alert.isRead"
                       [class]="'type-' + alert.type.toLowerCase()"
                       (click)="handleAlertClick(alert)">
                    
                    <div class="alert-icon">
                      {{ service.getAlertIcon(alert.type) }}
                    </div>
                    
                    <div class="alert-content">
                      <div class="alert-title">{{ alert.title }}</div>
                      <div class="alert-message">{{ alert.message }}</div>
                      
                      @if (alert.metrics) {
                        <div class="alert-metrics">
                          @if (alert.metrics.roi !== undefined) {
                            <span class="metric" [class.negative]="alert.metrics.roi < 100">
                              ROI: {{ alert.metrics.roi | number:'1.1-1' }}%
                            </span>
                          }
                          @if (alert.metrics.spend) {
                            <span class="metric">
                              Chi: {{ service.formatCurrency(alert.metrics.spend) }}
                            </span>
                          }
                          @if (alert.metrics.profit) {
                            <span class="metric" [class.negative]="alert.metrics.profit < 0">
                              {{ alert.metrics.profit >= 0 ? 'Lãi' : 'Lỗ' }}: 
                              {{ service.formatCurrency(Math.abs(alert.metrics.profit)) }}
                            </span>
                          }
                        </div>
                      }
                      
                      <div class="alert-footer">
                        <span class="time">{{ formatTime(alert.createdAt) }}</span>
                        <span class="platform" *ngIf="alert.platform">{{ alert.platform }}</span>
                      </div>
                    </div>
                    
                    <div class="alert-actions">
                      @if (alert.action?.url) {
                        <button class="btn-action" (click)="navigate(alert, $event)" [title]="alert.action?.label || 'Xem'">
                          👁️
                        </button>
                      }
                      <button class="btn-action dismiss" (click)="dismiss(alert, $event)" title="Xóa">
                        ✕
                      </button>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Footer Actions -->
            <div class="drawer-footer">
              <button class="btn-check" (click)="triggerCheck()" [disabled]="isChecking()">
                {{ isChecking() ? '⏳ Đang kiểm tra...' : '🔍 Kiểm tra ngay' }}
              </button>
              @if (service.alerts().length > 0) {
                <button class="btn-clear" (click)="service.clearAll()">🗑️ Xóa tất cả</button>
              }
            </div>
          }

          <!-- Suggestions Tab Content -->
          @if (activeTab() === 'suggestions') {
            <!-- Suggestions Summary -->
            <div class="suggestions-summary">
              <div class="suggest-stat increase">
                <span class="icon">📈</span>
                <span class="count">{{ service.suggestionsSummary().toIncrease }}</span>
                <span class="label">Tăng</span>
              </div>
              <div class="suggest-stat maintain">
                <span class="icon">➡️</span>
                <span class="count">{{ service.suggestionsSummary().toMaintain }}</span>
                <span class="label">Giữ</span>
              </div>
              <div class="suggest-stat decrease">
                <span class="icon">📉</span>
                <span class="count">{{ service.suggestionsSummary().toDecrease }}</span>
                <span class="label">Giảm</span>
              </div>
              <div class="suggest-stat kill">
                <span class="icon">⛔</span>
                <span class="count">{{ service.suggestionsSummary().toKill }}</span>
                <span class="label">Tắt</span>
              </div>
            </div>

            <!-- Suggestions List -->
            <div class="suggestions-list">
              @if (service.isLoadingSuggestions()) {
                <div class="loading-state">
                  <span class="spinner">⏳</span>
                  <p>Đang tính toán gợi ý...</p>
                </div>
              } @else if (service.spendSuggestions().length === 0) {
                <div class="empty-state">
                  <span class="icon">📊</span>
                  <p>Chưa có dữ liệu để gợi ý</p>
                  <small>Cần có dữ liệu chi phí quảng cáo để tính toán</small>
                </div>
              } @else {
                @for (suggest of service.spendSuggestions(); track suggest.adGroupId) {
                  <div class="suggestion-item" [class]="'action-' + suggest.scaleAction">
                    <div class="suggest-icon" [style.background]="service.getActionColor(suggest.scaleAction)">
                      {{ service.getActionIcon(suggest.scaleAction) }}
                    </div>
                    
                    <div class="suggest-content">
                      <div class="suggest-name">{{ suggest.adGroupName }}</div>
                      <div class="suggest-platform">{{ suggest.platform || 'Facebook' }}</div>
                      
                      <div class="suggest-spend-row">
                        <div class="spend-current">
                          <span class="label">Hiện tại:</span>
                          <span class="value">{{ service.formatCurrency(suggest.lastSpend) }}</span>
                        </div>
                        <span class="arrow">→</span>
                        <div class="spend-suggested">
                          <span class="label">Đề xuất:</span>
                          <span class="value" [style.color]="service.getActionColor(suggest.scaleAction)">
                            @if (suggest.scaleAction === 'kill') {
                              Tắt
                            } @else {
                              {{ service.formatCurrency(suggest.suggestedSpend) }}
                            }
                          </span>
                        </div>
                      </div>
                      
                      <div class="suggest-metrics">
                        <span class="metric">
                          ROI: 
                          <strong [class.negative]="suggest.currentROI < 100">
                            {{ suggest.currentROI | number:'1.1-1' }}%
                          </strong>
                        </span>
                        <span class="metric">
                          Độ tin: {{ suggest.confidence }}%
                        </span>
                      </div>
                      
                      <div class="suggest-reason">{{ suggest.reason }}</div>
                    </div>
                    
                    <div class="suggest-action-tag" [style.background]="service.getActionColor(suggest.scaleAction)">
                      {{ service.getActionLabel(suggest.scaleAction) }}
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Suggestions Footer -->
            <div class="drawer-footer">
              <button class="btn-check" (click)="loadSuggestions()" [disabled]="service.isLoadingSuggestions()">
                {{ service.isLoadingSuggestions() ? '⏳ Đang tính toán...' : '🔄 Cập nhật gợi ý' }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ads-alerts-container {
      position: relative;
      display: inline-block;
    }

    .notification-bell {
      position: relative;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 8px;
      border-radius: 50%;
      transition: all 0.2s ease;
    }

    .notification-bell:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    .notification-bell.has-unread {
      animation: bell-shake 0.5s ease-in-out;
    }

    @keyframes bell-shake {
      0%, 100% { transform: rotate(0); }
      20%, 60% { transform: rotate(-10deg); }
      40%, 80% { transform: rotate(10deg); }
    }

    .bell-icon {
      font-size: 1.5rem;
    }

    .badge {
      position: absolute;
      top: 0;
      right: 0;
      background: #dc3545;
      color: white;
      font-size: 0.7rem;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .badge.critical {
      background: #dc3545;
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }

    .alerts-drawer {
      position: absolute;
      top: 100%;
      right: 0;
      width: 450px;
      max-height: 80vh;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Tabs styling */
    .drawer-tabs {
      display: flex;
      border-bottom: 1px solid #eee;
      background: #f8f9fa;
    }

    .tab {
      flex: 1;
      padding: 12px 16px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      color: #666;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .tab:hover {
      background: #fff;
      color: #333;
    }

    .tab.active {
      background: #fff;
      color: #667eea;
      border-bottom: 2px solid #667eea;
    }

    .tab-badge {
      background: #dc3545;
      color: white;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 0.7rem;
      font-weight: bold;
    }

    .tab-badge.suggest {
      background: #17a2b8;
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #eee;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .drawer-header h3 {
      margin: 0;
      font-size: 1rem;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .btn-icon {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      padding: 6px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .btn-text {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.5);
      color: white;
      padding: 4px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
    }

    .btn-text:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .summary-stats {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #eee;
    }

    .stat {
      flex: 1;
      text-align: center;
      padding: 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .stat:hover, .stat.active {
      transform: translateY(-2px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .stat.critical { background: #fff5f5; border: 1px solid #fee; }
    .stat.critical.active { background: #dc3545; color: white; }
    .stat.warning { background: #fffbf0; border: 1px solid #fff3cd; }
    .stat.warning.active { background: #ffc107; color: #333; }
    .stat.success { background: #f0fff4; border: 1px solid #c6f6d5; }
    .stat.success.active { background: #28a745; color: white; }

    .stat .count {
      display: block;
      font-size: 1.2rem;
      font-weight: bold;
    }

    .stat .label {
      font-size: 0.7rem;
      opacity: 0.8;
    }

    .alerts-list {
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
    }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #888;
    }

    .empty-state .icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 16px;
    }

    .alert-item {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: all 0.2s;
    }

    .alert-item:hover {
      background: #f8f9fa;
    }

    .alert-item.unread {
      background: #fff8e1;
    }

    .alert-item.type-critical {
      border-left: 4px solid #dc3545;
    }

    .alert-item.type-warning {
      border-left: 4px solid #ffc107;
    }

    .alert-item.type-success {
      border-left: 4px solid #28a745;
    }

    .alert-item.type-info {
      border-left: 4px solid #17a2b8;
    }

    .alert-icon {
      font-size: 1.5rem;
      flex-shrink: 0;
    }

    .alert-content {
      flex: 1;
      min-width: 0;
    }

    .alert-title {
      font-weight: 600;
      font-size: 0.9rem;
      margin-bottom: 4px;
      color: #333;
    }

    .alert-message {
      font-size: 0.8rem;
      color: #666;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .alert-metrics {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 6px;
    }

    .metric {
      font-size: 0.75rem;
      padding: 2px 8px;
      background: #e9ecef;
      border-radius: 4px;
      color: #495057;
    }

    .metric.negative {
      background: #fee;
      color: #dc3545;
    }

    .alert-footer {
      display: flex;
      gap: 8px;
      font-size: 0.7rem;
      color: #999;
    }

    .platform {
      text-transform: uppercase;
      font-weight: 600;
      color: #667eea;
    }

    .alert-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .btn-action {
      background: #f0f0f0;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: all 0.2s;
    }

    .btn-action:hover {
      background: #e0e0e0;
    }

    .btn-action.dismiss:hover {
      background: #fee;
      color: #dc3545;
    }

    .drawer-footer {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid #eee;
      background: #f8f9fa;
    }

    .btn-check {
      flex: 1;
      padding: 10px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }

    .btn-check:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-check:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-clear {
      padding: 10px 16px;
      background: #fff;
      color: #dc3545;
      border: 1px solid #dc3545;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-clear:hover {
      background: #dc3545;
      color: white;
    }

    .btn-primary {
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 16px;
    }

    /* Dark mode support */
    :host-context(.dark-mode) .alerts-drawer {
      background: #1e1e1e;
      color: #fff;
    }

    :host-context(.dark-mode) .drawer-header {
      border-bottom-color: #333;
    }

    :host-context(.dark-mode) .summary-stats {
      background: #252525;
      border-bottom-color: #333;
    }

    :host-context(.dark-mode) .alert-item {
      border-bottom-color: #333;
    }

    :host-context(.dark-mode) .alert-item:hover {
      background: #2a2a2a;
    }

    :host-context(.dark-mode) .alert-item.unread {
      background: #3a3520;
    }

    :host-context(.dark-mode) .alert-title {
      color: #eee;
    }

    :host-context(.dark-mode) .alert-message {
      color: #aaa;
    }

    :host-context(.dark-mode) .drawer-footer {
      background: #252525;
      border-top-color: #333;
    }

    @media (max-width: 480px) {
      .alerts-drawer {
        position: fixed;
        top: 60px;
        right: 0;
        left: 0;
        width: 100%;
        max-height: calc(100vh - 60px);
        border-radius: 0;
      }
    }

    /* Suggestions Styles */
    .suggestions-summary {
      display: flex;
      gap: 8px;
      padding: 12px 16px;
      background: #f8f9fa;
      border-bottom: 1px solid #eee;
    }

    .suggest-stat {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 4px;
      border-radius: 8px;
      background: white;
      border: 1px solid #eee;
    }

    .suggest-stat .icon {
      font-size: 1.2rem;
      margin-bottom: 4px;
    }

    .suggest-stat .count {
      font-size: 1.1rem;
      font-weight: bold;
    }

    .suggest-stat .label {
      font-size: 0.65rem;
      color: #888;
    }

    .suggest-stat.increase { border-color: #c3e6cb; background: #f0fff4; }
    .suggest-stat.decrease { border-color: #fff3cd; background: #fffbf0; }
    .suggest-stat.maintain { border-color: #bee5eb; background: #f0f9ff; }
    .suggest-stat.kill { border-color: #f5c6cb; background: #fff5f5; }

    .suggestions-list {
      flex: 1;
      overflow-y: auto;
      max-height: 400px;
    }

    .loading-state {
      padding: 40px 20px;
      text-align: center;
      color: #888;
    }

    .loading-state .spinner {
      font-size: 2rem;
      display: block;
      margin-bottom: 12px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .suggestion-item {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      align-items: flex-start;
    }

    .suggestion-item.action-increase {
      border-left: 4px solid #28a745;
    }

    .suggestion-item.action-decrease {
      border-left: 4px solid #ffc107;
    }

    .suggestion-item.action-maintain {
      border-left: 4px solid #17a2b8;
    }

    .suggestion-item.action-kill {
      border-left: 4px solid #dc3545;
    }

    .suggest-icon {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
    }

    .suggest-content {
      flex: 1;
      min-width: 0;
    }

    .suggest-name {
      font-weight: 600;
      font-size: 0.9rem;
      color: #333;
      margin-bottom: 2px;
    }

    .suggest-platform {
      font-size: 0.75rem;
      color: #667eea;
      margin-bottom: 8px;
    }

    .suggest-spend-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      padding: 6px 8px;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .spend-current, .spend-suggested {
      display: flex;
      flex-direction: column;
    }

    .spend-current .label, .spend-suggested .label {
      font-size: 0.65rem;
      color: #888;
    }

    .spend-current .value, .spend-suggested .value {
      font-size: 0.85rem;
      font-weight: 600;
    }

    .arrow {
      color: #888;
      font-size: 1.2rem;
    }

    .suggest-metrics {
      display: flex;
      gap: 12px;
      margin-bottom: 6px;
    }

    .suggest-metrics .metric {
      font-size: 0.75rem;
      color: #666;
    }

    .suggest-metrics .metric strong {
      color: #333;
    }

    .suggest-metrics .metric strong.negative {
      color: #dc3545;
    }

    .suggest-reason {
      font-size: 0.75rem;
      color: #888;
      font-style: italic;
      line-height: 1.4;
    }

    .suggest-action-tag {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      color: white;
      white-space: nowrap;
    }
  `]
})
export class AdsAlertsComponent implements OnInit, OnDestroy {
  isDrawerOpen = signal(false);
  filterType = signal<AlertType | null>(null);
  isChecking = signal(false);
  activeTab = signal<'alerts' | 'suggestions'>('alerts');
  Math = Math;

  private newAlertSub?: Subscription;

  // Computed filtered alerts
  filteredAlerts = computed(() => {
    const filter = this.filterType();
    if (!filter) return this.service.alerts();
    return this.service.alerts().filter(a => a.type === filter);
  });

  successCount = computed(() => 
    this.service.alerts().filter(a => a.type === 'SUCCESS').length
  );

  constructor(
    public service: AdsAlertsService,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Chỉ start polling nếu đã authenticated
    if (this.authService.isAuthenticated()) {
      this.service.startPolling(30000); // Every 30 seconds

      // Subscribe to new alerts for notifications
      this.newAlertSub = this.service.newAlert$.subscribe(alert => {
        if (alert && alert.type === 'CRITICAL') {
          this.showNotification(alert);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.service.stopPolling();
    this.newAlertSub?.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.isDrawerOpen()) {
      this.isDrawerOpen.set(false);
    }
  }

  toggleDrawer(event: Event): void {
    event.stopPropagation();
    this.isDrawerOpen.update(v => !v);
  }

  toggleFilter(type: AlertType): void {
    if (this.filterType() === type) {
      this.filterType.set(null);
    } else {
      this.filterType.set(type);
    }
  }

  refresh(): void {
    this.service.loadAlerts();
  }

  triggerCheck(): void {
    this.isChecking.set(true);
    this.service.triggerCheck().subscribe({
      next: (res) => {
        console.log('Alert check result:', res);
        this.service.loadAlerts();
        this.isChecking.set(false);
      },
      error: (err) => {
        console.error('Error triggering check:', err);
        this.isChecking.set(false);
      }
    });
  }

  handleAlertClick(alert: AdsAlert): void {
    if (!alert.isRead) {
      this.service.markAsRead(alert.id);
    }
  }

  navigate(alert: AdsAlert, event: Event): void {
    event.stopPropagation();
    if (alert.action?.url) {
      this.isDrawerOpen.set(false);
      this.router.navigateByUrl(alert.action.url);
    }
  }

  dismiss(alert: AdsAlert, event: Event): void {
    event.stopPropagation();
    this.service.dismissAlert(alert.id);
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    return d.toLocaleDateString('vi-VN');
  }

  /**
   * Switch between tabs
   */
  switchTab(tab: 'alerts' | 'suggestions'): void {
    this.activeTab.set(tab);
    if (tab === 'suggestions' && this.service.spendSuggestions().length === 0) {
      this.loadSuggestions();
    }
  }

  /**
   * Load spend suggestions
   */
  loadSuggestions(): void {
    this.service.loadSpendSuggestions(7, 50);
  }

  private showNotification(alert: AdsAlert): void {
    // Browser notification (if permitted)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(alert.title, {
        body: alert.message,
        icon: '/assets/icons/alert.png',
        tag: alert.id,
      });
    }
  }
}
