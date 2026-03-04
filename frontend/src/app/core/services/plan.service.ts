import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface PlanInfo {
  plan: string;
  maxUsers: number | string;
  currentUsers: number;
  modules: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  private readonly API_URL = `${environment.apiUrl}/plan`;

  private readonly planInfoSignal = signal<PlanInfo | null>(null);
  readonly planInfo = this.planInfoSignal.asReadonly();

  constructor(private http: HttpClient) {}

  loadPlanInfo(): void {
    this.http.get<PlanInfo>(`${this.API_URL}/info`).subscribe({
      next: (info) => this.planInfoSignal.set(info),
      error: (err) => console.error('Failed to load plan info:', err)
    });
  }

  hasModuleAccess(moduleName: string): boolean {
    const info = this.planInfoSignal();
    if (!info) return true; // Cho phép nếu chưa load xong (sẽ bị backend chặn)
    return info.modules.includes('*') || info.modules.includes(moduleName);
  }

  getPlan(): string {
    return this.planInfoSignal()?.plan || 'enterprise';
  }
}
