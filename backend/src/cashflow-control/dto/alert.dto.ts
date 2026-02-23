/**
 * File: cashflow-control/dto/alert.dto.ts
 * Purpose: DTO for cashflow alerts
 * 
 * Alerts are proactive warnings to prevent cashflow crises.
 * They help Owner/CFO take action BEFORE problems become critical.
 */

import { AlertType, AlertSeverity } from '../interfaces/cashflow.interfaces';

export class AlertDto {
  /** Unique identifier for the alert */
  id: string;

  /** Type of alert */
  alertType: AlertType;

  /** Severity level */
  severity: AlertSeverity;

  /** Short title for the alert */
  title: string;

  /** Detailed message explaining the situation */
  message: string;

  /** When the alert was triggered */
  triggeredAt: Date;

  /** Whether immediate action is required */
  actionRequired: boolean;

  /** Suggested action to resolve the alert */
  suggestedAction: string | null;

  /** Related entity (fund name, metric, etc.) */
  relatedEntity: string | null;
}

export class AlertsResponseDto {
  /** List of active alerts */
  alerts: AlertDto[];

  /** Total number of alerts */
  totalCount: number;

  /** Number of critical alerts requiring immediate attention */
  criticalCount: number;

  /** Summary by severity */
  bySeverity: {
    info: number;
    warning: number;
    danger: number;
    critical: number;
  };

  /** Timestamp of data */
  asOf: Date;
}
