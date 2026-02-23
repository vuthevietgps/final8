import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface EmployeeKpiSummary {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  
  totalAdGroups: number;
  profitableAdGroups: number;
  unprofitableAdGroups: number;
  profitableRate: number;
  
  kpiProfitableRateTarget: number;
  kpiProfitableRateMet: boolean;
  
  platformBreakdown: PlatformBreakdown[];
  alerts: KpiAlert[];
  
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  avgROI: number;
  
  periodStart: string;
  periodEnd: string;
}

export interface PlatformBreakdown {
  platform: 'facebook' | 'google' | 'tiktok';
  productCategoryId: string;
  productCategoryName?: string;
  
  totalGroups: number;
  profitableGroups: number;
  unprofitableGroups: number;
  
  kpiMinGroupsMet: boolean;
  kpiMinGroupsTarget: number;
  
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  avgROI: number;
}

export interface KpiAlert {
  type: 'WARNING' | 'CRITICAL' | 'INFO';
  code: string;
  message: string;
  details?: any;
  createdAt: string;
  employeeId?: string;
  employeeName?: string;
}

export interface AdGroupPerformance {
  adGroupId: string;
  adGroupName: string;
  platform: string;
  productCategoryId: string;
  productCategoryName?: string;
  
  spend: number;
  revenue: number;
  profit: number;
  roi: number;
  isProfitable: boolean;
  
  orders: number;
  successOrders: number;
  returnOrders: number;
  successRate: number;
}

export interface AllEmployeesKpiResponse {
  employees: EmployeeKpiSummary[];
  summary: {
    totalEmployees: number;
    employeesMeetingKpi: number;
    employeesNotMeetingKpi: number;
    overallProfitableRate: number;
  };
}

export interface AlertsResponse {
  alerts: KpiAlert[];
  summary: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface AssignableEmployee {
  _id: string;
  fullName: string;
  email: string;
  role: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeAdsKpiService {
  private baseUrl = `${environment.apiUrl}/employee-ads-kpi`;

  constructor(private http: HttpClient) {}

  // Lấy KPI tất cả nhân viên
  getAllEmployeesKpi(from?: string, to?: string): Observable<AllEmployeesKpiResponse> {
    let params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;

    return this.http.get<AllEmployeesKpiResponse>(
      this.baseUrl,
      { params, withCredentials: true }
    );
  }

  // Lấy KPI một nhân viên
  getEmployeeKpi(employeeId: string, from?: string, to?: string): Observable<EmployeeKpiSummary> {
    let params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;

    return this.http.get<EmployeeKpiSummary>(
      `${this.baseUrl}/${employeeId}`,
      { params, withCredentials: true }
    );
  }

  // Lấy danh sách ad groups của nhân viên
  getEmployeeAdGroups(employeeId: string, from?: string, to?: string): Observable<AdGroupPerformance[]> {
    let params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;

    return this.http.get<AdGroupPerformance[]>(
      `${this.baseUrl}/${employeeId}/ad-groups`,
      { params, withCredentials: true }
    );
  }

  // Lấy danh sách nhân viên có thể gán
  getAssignableEmployees(): Observable<AssignableEmployee[]> {
    return this.http.get<AssignableEmployee[]>(
      `${this.baseUrl}/meta/employees`,
      { withCredentials: true }
    );
  }

  // Lấy tất cả alerts
  getAllAlerts(from?: string, to?: string, type?: string): Observable<AlertsResponse> {
    let params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (type) params.type = type;

    return this.http.get<AlertsResponse>(
      `${this.baseUrl}/meta/alerts`,
      { params, withCredentials: true }
    );
  }

  // Gán nhân viên cho ad group
  assignEmployee(adGroupId: string, employeeId: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/assign`,
      { adGroupId, employeeId },
      { withCredentials: true }
    );
  }

  // Gán nhân viên cho nhiều ad groups
  bulkAssignEmployee(adGroupIds: string[], employeeId: string): Observable<{ success: number; failed: number; message: string }> {
    return this.http.post<{ success: number; failed: number; message: string }>(
      `${this.baseUrl}/bulk-assign`,
      { adGroupIds, employeeId },
      { withCredentials: true }
    );
  }
}
