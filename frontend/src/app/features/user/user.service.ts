/**
 * File: features/user/user.service.ts
 * Mục đích: Giao tiếp API Người dùng (CRUD, lọc theo vai trò, kích hoạt...).
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { User, CreateUserDto, UpdateUserDto } from './user.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

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

  /**
   * Lấy danh sách đại lý (tối giản) cho dropdown, không cần quyền 'users'.
   * Backend bảo vệ bằng quyền 'orders'.
   */
  getAgents(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/agents`, { withCredentials: true });
  }
}
