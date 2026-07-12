import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductCategoryService } from '../../product-category/product-category.service';
import { ProductCategory } from '../../product-category/models/product-category.interface';
import {
  BudgetBucket,
  BudgetBucketsService,
  SaveBudgetBucket,
} from './budget-buckets.service';

@Component({
  selector: 'app-budget-buckets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-buckets.component.html',
  styleUrls: ['./budget-buckets.component.css'],
})
export class BudgetBucketsComponent implements OnInit {
  buckets = signal<BudgetBucket[]>([]);
  categories = signal<ProductCategory[]>([]);
  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);
  editingId = signal<string | null>(null);

  form: SaveBudgetBucket = this.emptyForm();

  constructor(
    private readonly budgetBuckets: BudgetBucketsService,
    private readonly productCategories: ProductCategoryService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      buckets: this.budgetBuckets.list(),
      categories: this.productCategories.getAll(),
    }).subscribe({
      next: ({ buckets, categories }) => {
        this.buckets.set((buckets || []).map((bucket) => ({
          ...bucket,
          productGroupIds: bucket.productGroupIds || [],
          dailyCap: Number(bucket.dailyCap || 0),
          weeklyCap: Number(bucket.weeklyCap || 0),
          monthlyCap: Number(bucket.monthlyCap || 0),
          active: bucket.active !== false,
        })));
        this.categories.set(categories || []);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(this.errorMessage(error, 'Không thể tải budget buckets'));
        this.loading.set(false);
      },
    });
  }

  save(): void {
    const validationError = this.validateForm();
    if (validationError) {
      this.error.set(validationError);
      return;
    }

    const payload: SaveBudgetBucket = {
      name: this.form.name.trim(),
      code: this.form.code?.trim().toUpperCase() || undefined,
      productGroupIds: Array.from(new Set(this.form.productGroupIds || [])),
      dailyCap: Number(this.form.dailyCap || 0),
      weeklyCap: Number(this.form.weeklyCap || 0),
      monthlyCap: Number(this.form.monthlyCap || 0),
      active: this.form.active !== false,
      notes: this.form.notes?.trim() || undefined,
    };
    const editingId = this.editingId();
    const request = editingId
      ? this.budgetBuckets.update(editingId, payload)
      : this.budgetBuckets.create(payload);

    this.saving.set(true);
    this.error.set(null);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelEdit();
        this.load();
      },
      error: (error) => {
        this.error.set(this.errorMessage(error, 'Không thể lưu budget bucket'));
        this.saving.set(false);
      },
    });
  }

  edit(bucket: BudgetBucket): void {
    this.editingId.set(bucket._id);
    this.form = {
      name: bucket.name,
      code: bucket.code || '',
      productGroupIds: [...(bucket.productGroupIds || [])],
      dailyCap: Number(bucket.dailyCap || 0),
      weeklyCap: Number(bucket.weeklyCap || 0),
      monthlyCap: Number(bucket.monthlyCap || 0),
      active: bucket.active !== false,
      notes: bucket.notes || '',
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form = this.emptyForm();
    this.error.set(null);
  }

  toggleActive(bucket: BudgetBucket): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.budgetBuckets.update(bucket._id, { active: !bucket.active }).subscribe({
      next: (updated) => {
        this.buckets.update((rows) => rows.map((row) => row._id === updated._id ? {
          ...updated,
          productGroupIds: updated.productGroupIds || [],
        } : row));
        this.saving.set(false);
      },
      error: (error) => {
        this.error.set(this.errorMessage(error, 'Không thể đổi trạng thái bucket'));
        this.saving.set(false);
      },
    });
  }

  scopeLabel(bucket: BudgetBucket): string {
    if (!bucket.productGroupIds?.length) return 'Global — áp dụng mọi nhóm sản phẩm';
    return bucket.productGroupIds.map((id) => this.categoryName(id)).join(', ');
  }

  categoryName(id: string): string {
    return this.categories().find((category) => category._id === id)?.name || id;
  }

  formatVnd(value: number): string {
    if (!value) return 'Không giới hạn';
    return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
  }

  trackById(_index: number, row: BudgetBucket): string {
    return row._id;
  }

  private validateForm(): string | null {
    if (!this.form.name?.trim()) return 'Tên bucket là bắt buộc';
    const daily = Number(this.form.dailyCap || 0);
    const weekly = Number(this.form.weeklyCap || 0);
    const monthly = Number(this.form.monthlyCap || 0);
    if (![daily, weekly, monthly].every((value) => Number.isFinite(value) && value >= 0)) {
      return 'Mọi cap phải là số không âm';
    }
    if (daily > 0 && weekly > 0 && weekly < daily) {
      return 'Weekly cap phải bằng 0 hoặc không nhỏ hơn daily cap';
    }
    if (weekly > 0 && monthly > 0 && monthly < weekly) {
      return 'Monthly cap phải bằng 0 hoặc không nhỏ hơn weekly cap';
    }
    if (daily > 0 && monthly > 0 && monthly < daily) {
      return 'Monthly cap phải bằng 0 hoặc không nhỏ hơn daily cap';
    }
    return null;
  }

  private emptyForm(): SaveBudgetBucket {
    return {
      name: '',
      code: '',
      productGroupIds: [],
      dailyCap: 0,
      weeklyCap: 0,
      monthlyCap: 0,
      active: true,
      notes: '',
    };
  }

  private errorMessage(error: any, fallback: string): string {
    const message = error?.error?.message;
    return Array.isArray(message) ? message.join('; ') : message || fallback;
  }
}
