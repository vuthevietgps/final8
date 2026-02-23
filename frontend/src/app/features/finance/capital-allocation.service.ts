import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CapitalAllocationPolicy,
  CapitalAllocationSnapshot,
  AllocationComputation,
  ReinvestmentBudget
} from './capital-allocation.model';

@Injectable({ providedIn: 'root' })
export class CapitalAllocationService {
  private api = `${environment.apiUrl}/capital-allocation`;

  constructor(private http: HttpClient) {}

  // ========== POLICIES ==========

  createPolicy(dto: Partial<CapitalAllocationPolicy>): Observable<CapitalAllocationPolicy> {
    return this.http.post<CapitalAllocationPolicy>(`${this.api}/policies`, dto);
  }

  getAllPolicies(): Observable<CapitalAllocationPolicy[]> {
    return this.http.get<CapitalAllocationPolicy[]>(`${this.api}/policies`);
  }

  getActivePolicy(): Observable<CapitalAllocationPolicy> {
    return this.http.get<CapitalAllocationPolicy>(`${this.api}/policies/active`);
  }

  updatePolicy(id: string, dto: Partial<CapitalAllocationPolicy>): Observable<CapitalAllocationPolicy> {
    return this.http.patch<CapitalAllocationPolicy>(`${this.api}/policies/${id}`, dto);
  }

  deletePolicy(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.api}/policies/${id}`);
  }

  // ========== ALLOCATION ==========

  computeAllocation(policyId?: string): Observable<AllocationComputation> {
    const params: Record<string, string> = {};
    if (policyId) {
      params['policyId'] = policyId;
    }
    return this.http.get<AllocationComputation>(`${this.api}/compute`, { params });
  }

  // ========== SNAPSHOTS ==========

  captureSnapshot(note?: string, policyId?: string): Observable<CapitalAllocationSnapshot> {
    return this.http.post<CapitalAllocationSnapshot>(`${this.api}/snapshots`, { note, policyId });
  }

  getSnapshots(limit = 30): Observable<CapitalAllocationSnapshot[]> {
    return this.http.get<CapitalAllocationSnapshot[]>(`${this.api}/snapshots`, {
      params: { limit: limit.toString() }
    });
  }

  getLatestSnapshot(): Observable<CapitalAllocationSnapshot> {
    return this.http.get<CapitalAllocationSnapshot>(`${this.api}/snapshots/latest`);
  }

  updateSnapshotUsage(snapshotId: string, updates: {
    reinvestmentUsed?: number;
    safetyReserveUsed?: number;
    personalIncomeWithdrawn?: number;
    longTermAssetInvested?: number;
  }): Observable<CapitalAllocationSnapshot> {
    return this.http.patch<CapitalAllocationSnapshot>(`${this.api}/snapshots/${snapshotId}/usage`, updates);
  }

  // ========== REINVESTMENT BUDGET ==========

  getReinvestmentBudget(): Observable<ReinvestmentBudget> {
    return this.http.get<ReinvestmentBudget>(`${this.api}/reinvestment-budget`);
  }
}
