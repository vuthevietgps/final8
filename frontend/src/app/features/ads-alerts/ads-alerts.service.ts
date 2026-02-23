/**
 * File: ads-alerts/ads-alerts.service.ts
 * Mục đích: Service cho Ads Alerts frontend
 * - Connect SSE stream
 * - Get/manage alerts
 */
import { Injectable, signal, computed, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export type AlertType = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
export type AlertCategory = 'SCALE' | 'KILL' | 'BUDGET' | 'ROI' | 'PERFORMANCE' | 'KPI';

export interface AdsAlert {
  id: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  message: string;
  adGroupId?: string;
  adGroupName?: string;
  platform?: string;
  metrics?: {
    roi?: number;
    csi?: number;
    spend?: number;
    revenue?: number;
    profit?: number;
  };
  action?: {
    type: 'SCALE' | 'KILL' | 'REVIEW' | 'OPTIMIZE';
    url?: string;
    label?: string;
  };
  isRead: boolean;
  createdAt: Date | string;
  expiresAt?: Date | string;
}

export interface AlertsResponse {
  success: boolean;
  alerts: AdsAlert[];
  total: number;
  unread: number;
}

export interface AlertsSummary {
  success: boolean;
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
  successCount: number;
  byCategory: Record<string, number>;
}

/**
 * Interface cho Optimal Spend Suggestion
 */
export interface OptimalSpendSuggestion {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  lastSpend: number;
  suggestedSpend: number;
  currentROI: number;
  scaleAction: 'increase' | 'decrease' | 'maintain' | 'kill';
  confidence: number;
  reason: string;
}

export interface OptimalSpendResponse {
  success: boolean;
  totalGroups: number;
  suggestions: OptimalSpendSuggestion[];
  summary: {
    toIncrease: number;
    toDecrease: number;
    toMaintain: number;
    toKill: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdsAlertsService implements OnDestroy {
  // Sử dụng relative URL để đi qua Angular proxy
  private baseUrl = '/api/ads-alerts';
  private optimalSpendUrl = '/api/ad-group-profit-report/optimal-spend';
  private destroy$ = new Subject<void>();
  private eventSource: EventSource | null = null;

  // Signals for reactive state
  alerts = signal<AdsAlert[]>([]);
  unreadCount = signal<number>(0);
  isConnected = signal<boolean>(false);
  lastUpdate = signal<Date | null>(null);
  
  // Optimal spend suggestions
  spendSuggestions = signal<OptimalSpendSuggestion[]>([]);
  isLoadingSuggestions = signal<boolean>(false);

  // Computed signals
  criticalCount = computed(() => this.alerts().filter(a => a.type === 'CRITICAL').length);
  warningCount = computed(() => this.alerts().filter(a => a.type === 'WARNING').length);
  hasUnread = computed(() => this.unreadCount() > 0);
  
  // Computed for suggestions summary
  suggestionsSummary = computed(() => {
    const suggestions = this.spendSuggestions();
    return {
      toIncrease: suggestions.filter(s => s.scaleAction === 'increase').length,
      toDecrease: suggestions.filter(s => s.scaleAction === 'decrease').length,
      toMaintain: suggestions.filter(s => s.scaleAction === 'maintain').length,
      toKill: suggestions.filter(s => s.scaleAction === 'kill').length,
    };
  });

  // Event emitter for new alerts
  private newAlertSubject = new BehaviorSubject<AdsAlert | null>(null);
  newAlert$ = this.newAlertSubject.asObservable();

  constructor(private http: HttpClient) {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectSSE();
  }

  /**
   * Initialize SSE connection for real-time updates
   */
  connectSSE(token: string): void {
    if (this.eventSource) {
      this.disconnectSSE();
    }

    // Note: SSE doesn't support custom headers, we need to pass token via URL
    // For now, we'll use polling as fallback
    this.startPolling();
  }

  /**
   * Disconnect SSE
   */
  disconnectSSE(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected.set(false);
  }

  /**
   * Start polling for updates (fallback for SSE)
   */
  private pollingInterval: any = null;

  startPolling(intervalMs: number = 30000): void {
    this.stopPolling();
    this.loadAlerts(); // Initial load
    this.pollingInterval = setInterval(() => {
      this.loadAlerts();
    }, intervalMs);
    this.isConnected.set(true);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Load all alerts from API
   */
  loadAlerts(): void {
    // Kiểm tra token tồn tại trước khi gọi API
    const token = localStorage.getItem('access_token');
    const user = localStorage.getItem('current_user');
    if (!token || !user) {
      // Không gọi API nếu chưa đăng nhập hoặc chưa có user data
      this.isConnected.set(false);
      return;
    }
    
    this.http.get<AlertsResponse>(this.baseUrl).subscribe({
      next: (res) => {
        const currentAlerts = this.alerts();
        const newAlerts = res.alerts;
        
        // Check for new alerts
        const newIds = new Set(newAlerts.map(a => a.id));
        const currentIds = new Set(currentAlerts.map(a => a.id));
        
        for (const alert of newAlerts) {
          if (!currentIds.has(alert.id)) {
            // Emit new alert event
            this.newAlertSubject.next(alert);
          }
        }
        
        this.alerts.set(newAlerts);
        this.unreadCount.set(res.unread);
        this.lastUpdate.set(new Date());
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
      }
    });
  }

  /**
   * Get alerts summary
   */
  getSummary(): Observable<AlertsSummary> {
    return this.http.get<AlertsSummary>(`${this.baseUrl}/summary`);
  }

  /**
   * Trigger manual alert check
   */
  triggerCheck(): Observable<any> {
    return this.http.post(`${this.baseUrl}/check`, {});
  }

  /**
   * Mark alert as read
   */
  markAsRead(alertId: string): void {
    this.http.patch(`${this.baseUrl}/${alertId}/read`, {}).subscribe({
      next: () => {
        const updated = this.alerts().map(a => 
          a.id === alertId ? { ...a, isRead: true } : a
        );
        this.alerts.set(updated);
        this.unreadCount.update(c => Math.max(0, c - 1));
      },
      error: (err) => console.error('Error marking as read:', err)
    });
  }

  /**
   * Mark all alerts as read
   */
  markAllAsRead(): void {
    this.http.post(`${this.baseUrl}/mark-all-read`, {}).subscribe({
      next: () => {
        const updated = this.alerts().map(a => ({ ...a, isRead: true }));
        this.alerts.set(updated);
        this.unreadCount.set(0);
      },
      error: (err) => console.error('Error marking all as read:', err)
    });
  }

  /**
   * Dismiss/delete an alert
   */
  dismissAlert(alertId: string): void {
    this.http.delete(`${this.baseUrl}/${alertId}`).subscribe({
      next: () => {
        const alert = this.alerts().find(a => a.id === alertId);
        const filtered = this.alerts().filter(a => a.id !== alertId);
        this.alerts.set(filtered);
        if (alert && !alert.isRead) {
          this.unreadCount.update(c => Math.max(0, c - 1));
        }
      },
      error: (err) => console.error('Error dismissing alert:', err)
    });
  }

  /**
   * Clear all alerts
   */
  clearAll(): void {
    this.http.delete(this.baseUrl).subscribe({
      next: () => {
        this.alerts.set([]);
        this.unreadCount.set(0);
      },
      error: (err) => console.error('Error clearing alerts:', err)
    });
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Get alert type color
   */
  getAlertColor(type: AlertType): string {
    switch (type) {
      case 'CRITICAL': return '#dc3545';
      case 'WARNING': return '#ffc107';
      case 'INFO': return '#17a2b8';
      case 'SUCCESS': return '#28a745';
      default: return '#6c757d';
    }
  }

  /**
   * Get alert type icon
   */
  getAlertIcon(type: AlertType): string {
    switch (type) {
      case 'CRITICAL': return '🚨';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
      case 'SUCCESS': return '🚀';
      default: return '📢';
    }
  }

  /**
   * Get category icon
   */
  getCategoryIcon(category: AlertCategory): string {
    switch (category) {
      case 'SCALE': return '📈';
      case 'KILL': return '⛔';
      case 'BUDGET': return '💰';
      case 'ROI': return '📊';
      case 'PERFORMANCE': return '⚡';
      case 'KPI': return '🎯';
      default: return '📢';
    }
  }

  /**
   * Load optimal spend suggestions
   */
  loadSpendSuggestions(lookbackDays = 7, minROI = 50): void {
    // Kiểm tra token tồn tại trước khi gọi API
    const token = localStorage.getItem('access_token');
    if (!token) {
      return; // Không gọi API nếu chưa đăng nhập
    }
    
    this.isLoadingSuggestions.set(true);
    this.http.get<OptimalSpendResponse>(
      `${this.optimalSpendUrl}?lookbackDays=${lookbackDays}&minROI=${minROI}`
    ).subscribe({
      next: (res) => {
        if (res.success && res.suggestions) {
          this.spendSuggestions.set(res.suggestions);
        }
        this.isLoadingSuggestions.set(false);
      },
      error: (err) => {
        console.error('Error loading spend suggestions:', err);
        this.isLoadingSuggestions.set(false);
      }
    });
  }

  /**
   * Get action icon for spend suggestion
   */
  getActionIcon(action: string): string {
    switch (action) {
      case 'increase': return '📈';
      case 'decrease': return '📉';
      case 'maintain': return '➡️';
      case 'kill': return '⛔';
      default: return '❓';
    }
  }

  /**
   * Get action color for spend suggestion
   */
  getActionColor(action: string): string {
    switch (action) {
      case 'increase': return '#28a745';
      case 'decrease': return '#ffc107';
      case 'maintain': return '#17a2b8';
      case 'kill': return '#dc3545';
      default: return '#6c757d';
    }
  }

  /**
   * Get action label for spend suggestion
   */
  getActionLabel(action: string): string {
    switch (action) {
      case 'increase': return 'Tăng ngân sách';
      case 'decrease': return 'Giảm ngân sách';
      case 'maintain': return 'Giữ nguyên';
      case 'kill': return 'Nên tắt';
      default: return 'Không rõ';
    }
  }

  /**
   * Format percentage
   */
  formatPercentage(value: number): string {
    return value.toFixed(1) + '%';
  }
}
