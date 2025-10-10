import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { CreateSalaryConfigDto, SalaryConfig, UpdateSalaryConfigDto } from './salary-config.model';

@Injectable({ providedIn: 'root' })
export class SalaryConfigService {
  private apiUrl = `${environment.apiUrl}/salary-config`;
  constructor(private http: HttpClient) {}

  list(): Observable<SalaryConfig[]> {
    return this.http.get<SalaryConfig[]>(this.apiUrl);
  }

  create(dto: CreateSalaryConfigDto): Observable<SalaryConfig> {
    return this.http.post<SalaryConfig>(this.apiUrl, dto);
  }

  update(id: string, dto: UpdateSalaryConfigDto): Observable<SalaryConfig> {
    return this.http.patch<SalaryConfig>(`${this.apiUrl}/${id}`, dto);
  }

  updateField(id: string, patch: Partial<UpdateSalaryConfigDto>): Observable<SalaryConfig> {
    return this.http.patch<SalaryConfig>(`${this.apiUrl}/${id}/field`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
