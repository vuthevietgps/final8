import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  EmployeeAdsKpiService, 
  EmployeeKpiSummary, 
  AllEmployeesKpiResponse,
  AdGroupPerformance,
  KpiAlert 
} from './employee-ads-kpi.service';

@Component({
  selector: 'app-employee-ads-kpi',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './employee-ads-kpi.component.html',
  styleUrl: './employee-ads-kpi.component.css'
})
export class EmployeeAdsKpiComponent implements OnInit {
  // Filters
  fromDate = '';
  toDate = '';

  // Data
  data = signal<AllEmployeesKpiResponse | null>(null);
  selectedEmployee = signal<EmployeeKpiSummary | null>(null);
  employeeAdGroups = signal<AdGroupPerformance[]>([]);
  allAlerts = signal<KpiAlert[]>([]);

  // Loading states
  loading = signal(false);
  loadingDetails = signal(false);

  // UI state
  activeTab = signal<'overview' | 'alerts' | 'details'>('overview');
  showDetailsModal = signal(false);

  constructor(private service: EmployeeAdsKpiService) {}

  ngOnInit() {
    // Set default date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.toDate = now.toISOString().split('T')[0];
    this.fromDate = thirtyDaysAgo.toISOString().split('T')[0];

    this.loadData();
    this.loadAlerts();
  }

  loadData() {
    this.loading.set(true);
    
    this.service.getAllEmployeesKpi(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading KPI data:', err);
        this.loading.set(false);
      }
    });
  }

  loadAlerts() {
    this.service.getAllAlerts(this.fromDate, this.toDate).subscribe({
      next: (res) => {
        this.allAlerts.set(res.alerts);
      },
      error: (err) => {
        console.error('Error loading alerts:', err);
      }
    });
  }

  viewEmployeeDetails(employee: EmployeeKpiSummary) {
    this.selectedEmployee.set(employee);
    this.loadingDetails.set(true);
    this.showDetailsModal.set(true);

    this.service.getEmployeeAdGroups(employee.employeeId, this.fromDate, this.toDate).subscribe({
      next: (adGroups) => {
        this.employeeAdGroups.set(adGroups);
        this.loadingDetails.set(false);
      },
      error: (err) => {
        console.error('Error loading ad groups:', err);
        this.loadingDetails.set(false);
      }
    });
  }

  closeDetailsModal() {
    this.showDetailsModal.set(false);
    this.selectedEmployee.set(null);
    this.employeeAdGroups.set([]);
  }

  getKpiStatusClass(employee: EmployeeKpiSummary): string {
    if (employee.kpiProfitableRateMet) return 'status-success';
    if (employee.profitableRate >= 0.5) return 'status-warning';
    return 'status-danger';
  }

  getKpiStatusText(employee: EmployeeKpiSummary): string {
    if (employee.kpiProfitableRateMet) return '✅ Đạt KPI';
    return '❌ Chưa đạt KPI';
  }

  getAlertIcon(type: string): string {
    switch (type) {
      case 'CRITICAL': return '🚨';
      case 'WARNING': return '⚠️';
      case 'INFO': return 'ℹ️';
      default: return '📌';
    }
  }

  getAlertClass(type: string): string {
    switch (type) {
      case 'CRITICAL': return 'alert-critical';
      case 'WARNING': return 'alert-warning';
      case 'INFO': return 'alert-info';
      default: return '';
    }
  }

  getPlatformIcon(platform: string): string {
    switch (platform) {
      case 'facebook': return '📘';
      case 'google': return '🔍';
      case 'tiktok': return '🎵';
      default: return '📱';
    }
  }

  get criticalAlertCount(): number {
    return this.allAlerts().filter(a => a.type === 'CRITICAL').length;
  }

  get warningAlertCount(): number {
    return this.allAlerts().filter(a => a.type === 'WARNING').length;
  }

  formatPercent(value: number): string {
    return (value * 100).toFixed(1) + '%';
  }

  formatNumber(value: number): string {
    return value.toLocaleString('vi-VN');
  }
}
