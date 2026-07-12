import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { User, CreateUserDto, UpdateUserDto } from './user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  private buildActiveParams(active?: boolean): HttpParams {
    let params = new HttpParams();
    if (active !== undefined) {
      params = params.set('active', String(active));
    }
    return params;
  }

  getUsers(role?: string, active?: boolean): Observable<User[]> {
    let params = new HttpParams();
    if (role) {
      params = params.set('role', role);
    }
    if (active !== undefined) {
      params = params.set('active', active.toString());
    }
    return this.http.get<User[]>(this.apiUrl, { params, withCredentials: true });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${id}`, { withCredentials: true }).pipe(timeout(10000));
  }

  createUser(user: CreateUserDto): Observable<User> {
    return this.http.post<User>(this.apiUrl, user, { withCredentials: true });
  }

  updateUser(id: string, user: UpdateUserDto): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, user, { withCredentials: true });
  }

  deleteUser(id: string): Observable<User> {
    return this.http.delete<User>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }

  getUserByEmail(email: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/email/${email}`, { withCredentials: true });
  }

  getAgents(active?: boolean): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/agents`, {
      params: this.buildActiveParams(active),
      withCredentials: true,
    });
  }

  getAgentsForAds(active?: boolean): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/agents-for-ads`, {
      params: this.buildActiveParams(active),
      withCredentials: true,
    });
  }

  getSuppliersForOrders(active?: boolean): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/suppliers-for-orders`, {
      params: this.buildActiveParams(active),
      withCredentials: true,
    });
  }

  getAdsOperators(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/ads-operators`, { withCredentials: true });
  }
}
