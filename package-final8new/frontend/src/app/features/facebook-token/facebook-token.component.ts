/**
 * File: facebook-token.component.ts
 * Mục đích: Component quản lý Facebook Access Tokens
 */
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { FacebookTokenService, FacebookToken, CreateFacebookToken, TokenTestResult } from './facebook-token.service';

@Component({
  selector: 'app-facebook-token',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './facebook-token.component.html',
  styleUrls: ['./facebook-token.component.css']
})
export class FacebookTokenComponent implements OnInit {
  // State
  tokens = signal<FacebookToken[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showModal = signal(false);
  editingId: string | null = null;

  // Form
  form: any;

  constructor(
    private fb: FormBuilder,
    private facebookTokenService: FacebookTokenService
  ) {
    // Initialize form in constructor
    this.form = this.fb.group({
      name: ['', Validators.required],
      accessToken: ['', Validators.required],
      tokenType: ['user', Validators.required],
      appId: [''],
      userId: [''],
      expiresAt: [''],
      permissions: [''],
      isActive: [true],
      isDefault: [false],
      notes: ['']
    });
  }

  ngOnInit() {
    this.loadTokens();
  }

  async loadTokens() {
    try {
      this.loading.set(true);
      const tokens = await firstValueFrom(this.facebookTokenService.getAll());
      this.tokens.set(tokens);
    } catch (error: any) {
      this.error.set(error.error?.message || error.message || 'Failed to load tokens');
    } finally {
      this.loading.set(false);
    }
  }

  openCreate() {
    this.editingId = null;
    this.form.reset({
      tokenType: 'user',
      isActive: true,
      isDefault: false
    });
    this.showModal.set(true);
  }

  openEdit(token: FacebookToken) {
    this.editingId = token._id!;
    
    // Convert permissions array to comma-separated string
    const permissionsStr = Array.isArray(token.permissions) 
      ? token.permissions.join(', ') 
      : '';

    this.form.patchValue({
      name: token.name,
      accessToken: '', // Don't show encrypted token
      tokenType: token.tokenType,
      appId: token.appId || '',
      userId: token.userId || '',
      expiresAt: token.expiresAt ? token.expiresAt.split('T')[0] : '',
      permissions: permissionsStr,
      isActive: token.isActive,
      isDefault: token.isDefault,
      notes: token.notes || ''
    });
    
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId = null;
    this.form.reset();
  }

  async save() {
    if (this.form.invalid) return;

    try {
      this.loading.set(true);
      this.error.set(null);

      const formValue = this.form.value;
      
      // Convert permissions string to array
      const permissions = formValue.permissions 
        ? formValue.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p)
        : [];

      const tokenData: CreateFacebookToken = {
        name: formValue.name!,
        accessToken: formValue.accessToken!,
        tokenType: formValue.tokenType!,
        appId: formValue.appId || undefined,
        userId: formValue.userId || undefined,
        expiresAt: formValue.expiresAt || undefined,
        permissions,
        isActive: formValue.isActive!,
        isDefault: formValue.isDefault!,
        notes: formValue.notes || undefined
      };

      if (this.editingId) {
        // For edit, don't send accessToken if it's empty
        const updateData: any = { ...tokenData };
        if (!updateData.accessToken) {
          delete updateData.accessToken;
        }
        await firstValueFrom(this.facebookTokenService.update(this.editingId, updateData));
      } else {
        await firstValueFrom(this.facebookTokenService.create(tokenData));
      }

      await this.loadTokens();
      this.closeModal();

    } catch (error: any) {
      this.error.set(error.error?.message || error.message || 'Failed to save token');
    } finally {
      this.loading.set(false);
    }
  }

  async delete(id: string) {
    if (!confirm('Are you sure you want to delete this token?')) return;

    try {
      this.loading.set(true);
      await firstValueFrom(this.facebookTokenService.delete(id));
      await this.loadTokens();
    } catch (error: any) {
      this.error.set(error.error?.message || error.message || 'Failed to delete token');
    } finally {
      this.loading.set(false);
    }
  }

  async setDefault(id: string) {
    try {
      this.loading.set(true);
      await firstValueFrom(this.facebookTokenService.setDefault(id));
      await this.loadTokens();
    } catch (error: any) {
      this.error.set(error.error?.message || error.message || 'Failed to set default token');
    } finally {
      this.loading.set(false);
    }
  }

  async testToken(id: string) {
    try {
      this.loading.set(true);
      const result: TokenTestResult = await firstValueFrom(this.facebookTokenService.testToken(id));
      
      if (result.valid) {
        alert(`Token is valid!\nPermissions: ${result.permissions?.join(', ') || 'None'}`);
      } else {
        alert(`Token is invalid!\nError: ${result.error}`);
      }
    } catch (error: any) {
      this.error.set(error.error?.message || error.message || 'Failed to test token');
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  formatPermissions(permissions: string[]): string {
    if (!permissions || permissions.length === 0) return 'None';
    return permissions.join(', ');
  }

  get hasDefaultToken(): boolean {
    return this.tokens().some(token => token.isDefault && token.isActive);
  }
}