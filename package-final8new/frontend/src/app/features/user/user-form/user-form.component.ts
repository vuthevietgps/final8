/**
 * File: features/user/user-form/user-form.component.ts
 * Mục đích: Biểu mẫu tạo/cập nhật Người dùng (Reactive Forms, validate frontend).
 */
import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { UserService } from '../user.service';
import { User, UserRole, CreateUserDto, UpdateUserDto } from '../user.model';
import { finalize, take } from 'rxjs/operators';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form.component.html',
  styleUrls: ['./user-form.component.css']
})
export class UserFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userService = inject(UserService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  userForm: FormGroup;
  isEditMode = false;
  isViewMode = false;
  loading = false;
  error: string | null = null;
  userId: string | null = null;
  
  userRoles = Object.values(UserRole);

  // Regex chấp nhận link Google Sheets (docs.google.com/spreadsheets/d/<id>) và Google Drive
  private googleSheetRegex: RegExp = /^https?:\/\/(docs\.google\.com\/spreadsheets\/d\/[A-Za-z0-9-_]+(?:\/[^\s]*)?|drive\.google\.com\/[^^\s]+)$/i;

  constructor() {
    this.userForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9+\-\s()]*$/)]],
      role: ['', Validators.required],
      address: [''],
      isActive: [true],
      departmentId: [''],
      managerId: [''],
  notes: [''],
  googleDriveLink: ['', [Validators.pattern(this.googleSheetRegex)]],
      // allowedLoginIps nhập theo dạng một IP mỗi dòng
      allowedLoginIps: ['']
    });
  }

  ngOnInit(): void {
    // Lắng nghe tham số route để hỗ trợ điều hướng lặp lại giữa các user khác nhau
    const id = this.route.snapshot.paramMap.get('id');
    this.isViewMode = !!this.route.snapshot.data?.['viewMode'];
    this.userId = id;
    this.isEditMode = !!id;

    if (this.isEditMode) {
      // In edit mode, password is not required
      this.userForm.get('password')?.clearValidators();
      this.userForm.get('password')?.updateValueAndValidity();
      this.loadUser();
    }

    if (this.isViewMode) {
      this.userForm.disable();
    }
  }

  loadUser(): void {
    if (!this.userId) return;
    
    this.loading = true;
  this.userService.getUser(this.userId).pipe(take(1), finalize(() => { this.loading = false; this.cdr.detectChanges(); })).subscribe({
      next: (user) => {
        if (!user) {
          this.error = 'Không tìm thấy người dùng';
          this.cdr.detectChanges();
          return;
        }
        this.userForm.patchValue({
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          address: user.address,
          isActive: user.isActive,
          departmentId: user.departmentId,
          managerId: user.managerId,
          notes: user.notes,
          googleDriveLink: user.googleDriveLink,
          allowedLoginIps: (user.allowedLoginIps || []).join('\n')
        });
        this.cdr.detectChanges();
      },
      error: (error) => {
  this.error = error?.status === 404 ? 'Không tìm thấy người dùng' : 'Không tải được dữ liệu người dùng';
        console.error('Error loading user:', error);
        this.cdr.detectChanges();
      }
    });
  }

  onSubmit(): void {
    if (this.userForm.valid) {
      this.loading = true;
      this.error = null;

      const formValue = this.userForm.value;
      // Chuyển đổi allowedLoginIps từ textarea (string) -> string[]
      const allowedLoginIps = (formValue.allowedLoginIps || '')
        .split(/\r?\n/)
        .map((s: string) => s.trim())
        .filter((s: string) => !!s);

      // Yêu cầu allowedLoginIps khi role là manager/employee
      const role = formValue.role as UserRole;
      if ((role === UserRole.MANAGER || role === UserRole.EMPLOYEE) && allowedLoginIps.length === 0) {
        this.loading = false;
        this.error = 'Với vai trò Quản Lý hoặc Nhân Viên, cần cấu hình ít nhất 1 IP được phép đăng nhập';
        this.cdr.detectChanges();
        return;
      }
      
      if (this.isEditMode) {
        // Remove password if empty in edit mode
  const updateData: UpdateUserDto = { ...formValue, allowedLoginIps };
        if (!updateData.password) {
          delete updateData.password;
        }
        
        this.userService.updateUser(this.userId!, updateData).subscribe({
          next: () => {
            this.router.navigate(['/users']);
          },
          error: (error) => {
            this.error = 'Failed to update user';
            this.loading = false;
            console.error('Error updating user:', error);
          }
        });
      } else {
  const createData: CreateUserDto = { ...formValue, allowedLoginIps };
        this.userService.createUser(createData).subscribe({
          next: () => {
            this.router.navigate(['/users']);
          },
          error: (error) => {
            this.error = 'Failed to create user';
            this.loading = false;
            console.error('Error creating user:', error);
          }
        });
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  markFormGroupTouched(): void {
    Object.keys(this.userForm.controls).forEach(key => {
      const control = this.userForm.get(key);
      control?.markAsTouched();
    });
  }

  onCancel(): void {
    this.router.navigate(['/users']);
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

  isFieldInvalid(fieldName: string): boolean {
    const field = this.userForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }

  getFieldError(fieldName: string): string {
    const field = this.userForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return `${fieldName} là bắt buộc`;
      if (field.errors['email']) return 'Email không hợp lệ';
      if (field.errors['minlength']) return `${fieldName} phải có ít nhất ${field.errors['minlength'].requiredLength} ký tự`;
      if (field.errors['pattern']) {
        if (fieldName === 'phone') return 'Số điện thoại không đúng định dạng';
        if (fieldName === 'googleDriveLink') return 'Link không hợp lệ';
        return `${fieldName} không đúng định dạng`;
      }
    }
    return '';
  }
}
