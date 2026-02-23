/**
 * File: quality-control-dashboard.component.ts
 * Mục đích: Dashboard hiển thị quality control metrics cho AI optimization
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface QualityMetrics {
  overallAccuracy: number;
  recentAccuracy: number;
  predictionCount: number;
  validatedCount: number;
  riskScore: number;
}

interface DeliveryMetrics {
  successRate: number;
  avgDeliveryDays: number;
}

interface SafetyCheck {
  shouldPause: boolean;
  shouldReduceBudget: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
}

interface AdGroupQualityReport {
  adGroupId: string;
  qualityMetrics: QualityMetrics;
  deliveryMetrics: DeliveryMetrics;
  safetyCheck: SafetyCheck;
  predictions: any[];
  lastUpdated: string;
}

interface SystemQualityOverview {
  overallMetrics: {
    totalAdGroups: number;
    avgAccuracy: number;
    highRiskCount: number;
    pausedCount: number;
    systemHealth: string;
  };
  adGroupReports: AdGroupQualityReport[];
}

@Component({
  selector: 'app-quality-control-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="quality-control-dashboard">
      <div class="dashboard-header">
        <h2>🔍 Quality Control Dashboard</h2>
        <div class="header-actions">
          <button 
            class="btn btn-primary" 
            (click)="refreshData()"
            [disabled]="loading()">
            {{ loading() ? 'Đang tải...' : '🔄 Làm mới' }}
          </button>
          <button 
            class="btn btn-secondary" 
            (click)="triggerValidation()"
            [disabled]="validating()">
            {{ validating() ? 'Đang validate...' : '✅ Validate ngay' }}
          </button>
        </div>
      </div>

      <!-- System Overview -->
      <div class="overview-section" *ngIf="systemOverview()">
        <h3>📊 Tổng quan hệ thống</h3>
        <div class="overview-cards">
          <div class="metric-card">
            <div class="metric-value">{{ systemOverview()!.overallMetrics.totalAdGroups }}</div>
            <div class="metric-label">Nhóm quảng cáo</div>
          </div>
          <div class="metric-card" [class]="getAccuracyClass(systemOverview()!.overallMetrics.avgAccuracy)">
            <div class="metric-value">{{ formatPercent(systemOverview()!.overallMetrics.avgAccuracy) }}</div>
            <div class="metric-label">Độ chính xác TB</div>
          </div>
          <div class="metric-card risk" *ngIf="systemOverview()!.overallMetrics.highRiskCount > 0">
            <div class="metric-value">{{ systemOverview()!.overallMetrics.highRiskCount }}</div>
            <div class="metric-label">Rủi ro cao</div>
          </div>
          <div class="metric-card warning" *ngIf="systemOverview()!.overallMetrics.pausedCount > 0">
            <div class="metric-value">{{ systemOverview()!.overallMetrics.pausedCount }}</div>
            <div class="metric-label">Đã tạm dừng</div>
          </div>
          <div class="metric-card" [class]="getHealthClass(systemOverview()!.overallMetrics.systemHealth)">
            <div class="metric-value">{{ systemOverview()!.overallMetrics.systemHealth }}</div>
            <div class="metric-label">Tình trạng hệ thống</div>
          </div>
        </div>
      </div>

      <!-- Ad Group Reports -->
      <div class="reports-section" *ngIf="systemOverview()">
        <h3>📈 Báo cáo chi tiết theo nhóm quảng cáo</h3>
        <div class="reports-grid">
          <div 
            class="ad-group-card" 
            *ngFor="let report of systemOverview()!.adGroupReports"
            [class]="getRiskLevelClass(report.safetyCheck.riskLevel)">
            
            <div class="card-header">
              <h4>{{ report.adGroupId }}</h4>
              <span class="risk-badge" [class]="getRiskLevelClass(report.safetyCheck.riskLevel)">
                {{ report.safetyCheck.riskLevel }}
              </span>
            </div>

            <div class="card-metrics">
              <!-- Quality Metrics -->
              <div class="metric-row">
                <span class="metric-name">Độ chính xác gần đây:</span>
                <span class="metric-value" [class]="getAccuracyClass(report.qualityMetrics.recentAccuracy)">
                  {{ formatPercent(report.qualityMetrics.recentAccuracy) }}
                </span>
              </div>
              
              <div class="metric-row">
                <span class="metric-name">Tỷ lệ giao hàng thành công:</span>
                <span class="metric-value" [class]="getDeliveryClass(report.deliveryMetrics.successRate)">
                  {{ formatPercent(report.deliveryMetrics.successRate) }}
                </span>
              </div>

              <div class="metric-row">
                <span class="metric-name">Thời gian giao hàng TB:</span>
                <span class="metric-value">{{ report.deliveryMetrics.avgDeliveryDays.toFixed(1) }} ngày</span>
              </div>

              <div class="metric-row">
                <span class="metric-name">Số dự đoán:</span>
                <span class="metric-value">{{ report.qualityMetrics.validatedCount }}/{{ report.qualityMetrics.predictionCount }}</span>
              </div>
            </div>

            <!-- Safety Warnings -->
            <div class="safety-warnings" *ngIf="report.safetyCheck.reasons.length > 0">
              <h5>⚠️ Cảnh báo an toàn:</h5>
              <ul>
                <li *ngFor="let reason of report.safetyCheck.reasons">{{ reason }}</li>
              </ul>
            </div>

            <!-- Action Buttons -->
            <div class="card-actions">
              <button 
                class="btn btn-sm btn-info" 
                (click)="viewDetailedReport(report.adGroupId)">
                📊 Chi tiết
              </button>
              <button 
                class="btn btn-sm btn-warning" 
                *ngIf="report.safetyCheck.shouldPause"
                (click)="resumeOptimization(report.adGroupId)">
                ▶️ Tiếp tục
              </button>
            </div>

            <div class="card-footer">
              <small>Cập nhật: {{ formatDateTime(report.lastUpdated) }}</small>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading() && !systemOverview()">
        <div class="spinner"></div>
        <p>Đang tải dữ liệu quality control...</p>
      </div>

      <!-- Error State -->
      <div class="error-state" *ngIf="error()">
        <p class="error-message">{{ error() }}</p>
        <button class="btn btn-primary" (click)="refreshData()">Thử lại</button>
      </div>
    </div>
  `,
  styleUrls: ['./quality-control-dashboard.component.css']
})
export class QualityControlDashboardComponent implements OnInit {
  systemOverview = signal<SystemQualityOverview | null>(null);
  loading = signal(false);
  validating = signal(false);
  error = signal<string | null>(null);

  private apiUrl = `${environment.apiUrl}/advertising-cost-suggestion`;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.refreshData();
  }

  async refreshData() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await this.http.get<any>(`${this.apiUrl}/quality-control/overview`).toPromise();
      this.systemOverview.set(response.data);
    } catch (error: any) {
      this.error.set(error.message || 'Không thể tải dữ liệu');
    } finally {
      this.loading.set(false);
    }
  }

  async triggerValidation() {
    this.validating.set(true);

    try {
      await this.http.post(`${this.apiUrl}/quality-control/validate`, {}).toPromise();
      // Refresh data after validation
      setTimeout(() => {
        this.refreshData();
      }, 2000);
    } catch (error: any) {
      this.error.set('Không thể thực hiện validation: ' + error.message);
    } finally {
      this.validating.set(false);
    }
  }

  async viewDetailedReport(adGroupId: string) {
    try {
      const response = await this.http.get<any>(`${this.apiUrl}/quality-control/${adGroupId}`).toPromise();
      
      // Hiển thị modal hoặc navigate to detailed view
      console.log('Detailed report:', response.data);
      // TODO: Implement detailed view
      
    } catch (error: any) {
      this.error.set('Không thể tải báo cáo chi tiết: ' + error.message);
    }
  }

  async resumeOptimization(adGroupId: string) {
    // TODO: Implement resume optimization
    console.log('Resuming optimization for:', adGroupId);
  }

  // Helper methods
  formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }

  formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('vi-VN');
  }

  getAccuracyClass(accuracy: number): string {
    if (accuracy >= 80) return 'success';
    if (accuracy >= 60) return 'warning';
    return 'danger';
  }

  getDeliveryClass(rate: number): string {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'warning';
    return 'danger';
  }

  getRiskLevelClass(level: string): string {
    switch (level) {
      case 'LOW': return 'low-risk';
      case 'MEDIUM': return 'medium-risk';
      case 'HIGH': return 'high-risk';
      default: return '';
    }
  }

  getHealthClass(health: string): string {
    switch (health) {
      case 'GOOD': return 'success';
      case 'WARNING': return 'warning';
      case 'CRITICAL': return 'danger';
      default: return '';
    }
  }
}