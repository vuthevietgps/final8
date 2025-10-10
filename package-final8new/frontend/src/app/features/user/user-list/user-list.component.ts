/**
 * File: features/user/user-list/user-list.component.ts
 * Mục đích: Hiển thị danh sách người dùng với phân trang/tìm kiếm/các thao tác.
 */
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UserService } from '../user.service';
import { User, UserRole } from '../user.model';
import { ExportUserComponent } from '../../export-user/export-user.component';
import { ImportUserComponent } from '../../import-user/import-user.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ExportUserComponent, ImportUserComponent],
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {
  private userService = inject(UserService);
  
  // Dùng Signals để tương thích zoneless change detection và cập nhật UI tức thì
  users = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  selectedRole: string = '';
  
  userRoles = Object.values(UserRole);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
  this.loading.set(true);
  this.error.set(null);
    
    this.userService.getUsers(this.selectedRole || undefined).subscribe({
      next: (users) => {
    this.users.set(users);
    this.loading.set(false);
      },
      error: (error) => {
    this.error.set('Failed to load users');
    this.loading.set(false);
        console.error('Error loading users:', error);
      }
    });
  }

  onRoleChange(): void {
    this.loadUsers();
  }

  deleteUser(id: string): void {
    if (confirm('Are you sure you want to delete this user?')) {
      this.userService.deleteUser(id).subscribe({
        next: () => {
          this.loadUsers();
        },
        error: (error) => {
          this.error.set('Failed to delete user');
          console.error('Error deleting user:', error);
        }
      });
    }
  }

  getRoleDisplayName(role: UserRole): string {
    const roleNames: Record<UserRole, string> = {
      [UserRole.DIRECTOR]: 'Giám Đốc',
      [UserRole.MANAGER]: 'Quản Lý',
      [UserRole.EMPLOYEE]: 'Nhân Viên',
      [UserRole.INTERNAL_AGENT]: 'Đại Lý Nội Bộ',
      [UserRole.EXTERNAL_AGENT]: 'Đại Lý Ngoài',
      [UserRole.INTERNAL_SUPPLIER]: 'Nhà Cung Cấp Nội Bộ',
      [UserRole.EXTERNAL_SUPPLIER]: 'Nhà Cung Cấp Ngoài'
    };
    return roleNames[role] || role;
  }
}
