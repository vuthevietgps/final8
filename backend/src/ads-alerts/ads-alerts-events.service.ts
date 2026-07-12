/**
 * File: ads-alerts/ads-alerts-events.service.ts
 * Mục đích: Service quản lý SSE stream cho real-time Ads Alerts
 */
import { Injectable } from '@nestjs/common';
import { Observable, Subject, BehaviorSubject } from 'rxjs';

export type AlertType = 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
export type AlertCategory = 'SCALE' | 'KILL' | 'BUDGET' | 'ROI' | 'PERFORMANCE' | 'KPI';

export interface AdsAlert {
  id: string;
  type: AlertType;
  category: AlertCategory;
  title: string;
  message: string;
  dedupeKey?: string;
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
  createdAt: Date;
  expiresAt?: Date;
}

export interface AdsAlertEvent {
  type: 'new-alert' | 'update-alert' | 'dismiss-alert' | 'clear-all';
  alert?: AdsAlert;
  alertId?: string;
}

export type CreateAlertParams = Omit<AdsAlert, 'id' | 'createdAt' | 'isRead'>;

@Injectable()
export class AdsAlertsEventsService {
  private subject = new Subject<AdsAlertEvent>();

  // Store alerts in memory for quick access
  private alertsStore = new BehaviorSubject<AdsAlert[]>([]);
  private unreadCount = new BehaviorSubject<number>(0);

  /**
   * Emit new alert event
   */
  emit(event: AdsAlertEvent): void {
    this.subject.next(event);

    // Update store based on event type
    const currentAlerts = this.alertsStore.value;

    switch (event.type) {
      case 'new-alert':
        if (event.alert) {
          // Add to front, limit to 100 alerts
          const newAlerts = [event.alert, ...currentAlerts].slice(0, 100);
          this.alertsStore.next(newAlerts);
          this.updateUnreadCount();
        }
        break;

      case 'update-alert':
        if (event.alert) {
          const updated = currentAlerts.map(a =>
            a.id === event.alert!.id ? event.alert! : a
          );
          this.alertsStore.next(updated);
          this.updateUnreadCount();
        }
        break;

      case 'dismiss-alert':
        if (event.alertId) {
          const filtered = currentAlerts.filter(a => a.id !== event.alertId);
          this.alertsStore.next(filtered);
          this.updateUnreadCount();
        }
        break;

      case 'clear-all':
        this.alertsStore.next([]);
        this.unreadCount.next(0);
        break;
    }
  }

  /**
   * Get SSE stream for real-time updates
   */
  stream(): Observable<AdsAlertEvent> {
    return this.subject.asObservable();
  }

  /**
   * Get all current alerts
   */
  getAllAlerts(): AdsAlert[] {
    // Filter out expired alerts
    const now = new Date();
    const validAlerts = this.alertsStore.value.filter(a =>
      !a.expiresAt || new Date(a.expiresAt) > now
    );

    if (validAlerts.length !== this.alertsStore.value.length) {
      this.alertsStore.next(validAlerts);
      this.updateUnreadCount();
    }

    return validAlerts;
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.unreadCount.value;
  }

  /**
   * Mark alert as read
   */
  markAsRead(alertId: string): void {
    const alerts = this.alertsStore.value;
    const updated = alerts.map(a =>
      a.id === alertId ? { ...a, isRead: true } : a
    );
    this.alertsStore.next(updated);
    this.updateUnreadCount();

    const alert = updated.find(a => a.id === alertId);
    if (alert) {
      this.emit({ type: 'update-alert', alert });
    }
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    const alerts = this.alertsStore.value;
    const updated = alerts.map(a => ({ ...a, isRead: true }));
    this.alertsStore.next(updated);
    this.unreadCount.next(0);
  }

  /**
   * Dismiss/delete alert
   */
  dismissAlert(alertId: string): void {
    this.emit({ type: 'dismiss-alert', alertId });
  }

  /**
   * Clear all alerts
   */
  clearAll(): void {
    this.emit({ type: 'clear-all' });
  }

  private updateUnreadCount(): void {
    const count = this.alertsStore.value.filter(a => !a.isRead).length;
    this.unreadCount.next(count);
  }

  private isAlertActive(alert: AdsAlert, now: Date = new Date()): boolean {
    return !alert.expiresAt || new Date(alert.expiresAt) > now;
  }

  /**
   * Create and emit a new alert
   */
  createAlert(params: CreateAlertParams): AdsAlert {
    if (params.dedupeKey) {
      const existing = this.getAllAlerts().find(
        (alert) =>
          alert.dedupeKey === params.dedupeKey &&
          this.isAlertActive(alert),
      );

      if (existing) {
        const updated: AdsAlert = {
          ...existing,
          ...params,
          id: existing.id,
          createdAt: existing.createdAt,
          isRead: false,
        };

        this.emit({ type: 'update-alert', alert: updated });
        return updated;
      }
    }

    const alert: AdsAlert = {
      ...params,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isRead: false,
      createdAt: new Date(),
    };

    this.emit({ type: 'new-alert', alert });
    return alert;
  }
}
