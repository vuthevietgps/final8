/**
 * File: features/ad-group/ad-group.component.ts
 * Mục đích: Giao diện quản lý Nhóm Quảng Cáo (tối giản, bỏ AI/khuyến mại) - Modern Modal UI
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { AdGroupService } from './ad-group.service';
import { AdGroup, CreateAdGroup, AdPlatform, AdGroupRecommendation } from './models/ad-group.model';
import { ProductService } from '../product/product.service';
import { FanpageService } from '../fanpage/fanpage.service';
import { ProductCategoryService } from '../product-category/product-category.service';
import { UserService } from '../user/user.service';
import { AdAccountService } from '../ad-account/ad-account.service';
import { Product } from '../product/models/product.interface';
import { User } from '../user/user.model';
import { AdAccount } from '../ad-account/models/ad-account.model';

// Import chatbot related models and services
interface Fanpage {
  _id: string;
  name: string;
  pageId: string;
  accessToken?: string;
  isActive: boolean;
}

interface ProductCategory {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}


@Component({
  selector: 'app-ad-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ad-group.component.html',
  styleUrls: ['./ad-group.component.css']
})
export class AdGroupComponent implements OnInit {
  private adGroupService = inject(AdGroupService);
  private productService = inject(ProductService);
  private userService = inject(UserService);
  private adAccountService = inject(AdAccountService);
  private fanpageService = inject(FanpageService);
  private productCategoryService = inject(ProductCategoryService);
  private fb = inject(FormBuilder);

  // Data signals
  adGroups = signal<AdGroup[]>([]);
  products = signal<Product[]>([]);
  users = signal<User[]>([]);
  adAccounts = signal<AdAccount[]>([]);
  fanpages = signal<Fanpage[]>([]);
  productCategories = signal<ProductCategory[]>([]);
  availableProducts = signal<Product[]>([]);

  // UI state signals
  isLoading = signal(false);
  error = signal<string | null>(null);
  showModal = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);
  loadingRecommend = signal(false);
  applyingAuto = signal(false);
  
  // Filter signals
  searchQuery = signal('');
  filterPlatform = signal<'all' | 'facebook' | 'google' | 'tiktok'>('all');

  // AI đề xuất chi phí
  recommendations = signal<Record<string, AdGroupRecommendation>>({});
  autoApply = signal<Record<string, boolean>>({});
  
  // Form
  adGroupForm!: FormGroup;
  editingId: string | null = null;

  ngOnInit(): void {
    this.initForm();
    this.loadData();
  }

  private initForm(): void {
    this.adGroupForm = this.fb.group({
      name: ['', Validators.required],
      adGroupId: ['', Validators.required],
      fanpageId: ['', Validators.required],
      productCategoryId: ['', Validators.required],
      agentId: ['', Validators.required],
      adAccountId: ['', Validators.required],
      platform: ['facebook', Validators.required],
      selectedProducts: [[]],
      enableWebhook: [false],
      autoControlEnabled: [false],
      spendThresholdDaily: [0],
      cprThresholdDaily: [0],
      minConversations: [3],
      isActive: [true],
      notes: ['']
    });
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.error.set(null);
    
    // Load all required data
    Promise.all([
      this.loadAdGroups(),
      this.loadFanpages(),
      this.loadProductCategories(),
      this.loadAgents(),
      this.loadAdAccounts(),
    ]).then(() => {
      this.isLoading.set(false);
    }).catch((error) => {
      this.error.set('Lỗi tải dữ liệu: ' + error.message);
      this.isLoading.set(false);
    });
  }

  private async loadAdGroups(): Promise<void> {
    return new Promise((resolve, reject) => {
      const filter = this.filterPlatform() === 'all' ? undefined : { platform: this.filterPlatform() };
      this.adGroupService.getAll(filter).subscribe({
        next: (groups) => {
            this.adGroups.set(groups);
          resolve();
        },
        error: reject
      });
    });
  }

  // AI: tải đề xuất chi phí
  loadRecommendationsAI(): void {
    this.loadingRecommend.set(true);
    this.adGroupService.getRecommendations().subscribe({
      next: (recs) => {
        const map: Record<string, AdGroupRecommendation> = {};
        recs.forEach(r => { map[r.adGroupId] = r; });
        this.recommendations.set(map);

        // Gán đề xuất vào rows để hiển thị nhanh
        this.adGroups.update(rows => rows.map(r => {
          const rec = map[this.getGroupId(r)];
          return rec ? { ...r, aiSuggestedBudget: rec.suggestedBudget, aiChangePercent: rec.changePercent, aiReason: rec.reason } : r;
        }));

        this.loadingRecommend.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Không tính được đề xuất AI');
        this.loadingRecommend.set(false);
      }
    });
  }

  // AI: áp dụng cho các dòng đã bật Auto AI
  applyAutoAI(): void {
    const selectedIds = Object.entries(this.autoApply()).filter(([_, v]) => v).map(([id]) => id);
    if (!selectedIds.length) {
      alert('Chọn ít nhất 1 nhóm để áp dụng Auto AI');
      return;
    }
    this.applyingAuto.set(true);
    this.adGroupService.applyRecommendations(selectedIds).subscribe({
      next: res => {
        this.applyingAuto.set(false);
        // Cập nhật dailyBudget cho các nhóm đã áp dụng
        const appliedMap = new Map((res.applied || []).map(a => [a.adGroupId, a.suggestedBudget]));
        this.adGroups.update(rows => rows.map(r => {
          const id = this.getGroupId(r);
          if (appliedMap.has(id)) {
            return { ...r, dailyBudget: appliedMap.get(id) };
          }
          return r;
        }));
        const failedCount = (res.failed || []).length;
        alert(`Đã áp dụng ${res.applied?.length || 0} nhóm${failedCount ? `, lỗi ${failedCount}` : ''}`);
      },
      error: err => {
        console.error(err);
        this.applyingAuto.set(false);
        alert('Áp dụng Auto AI thất bại');
      }
    });
  }

  getGroupId(group: AdGroup): string {
    return (group as any)._id || group.adGroupId;
  }

  getAiSuggested(group: AdGroup): number | undefined {
    const rec = this.recommendations()[this.getGroupId(group)];
    return rec?.suggestedBudget;
  }

  toggleAutoApply(group: AdGroup, checked: boolean): void {
    const id = this.getGroupId(group);
    const next = { ...this.autoApply() } as Record<string, boolean>;
    next[id] = checked;
    this.autoApply.set(next);
  }

  private async loadFanpages(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fanpageService.list().subscribe({
        next: (pages) => { this.fanpages.set(pages as any); resolve(); },
        error: reject
      });
    });
  }

  private async loadProductCategories(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.productCategoryService.getAll().subscribe({
        next: (cats) => { this.productCategories.set(cats as any); resolve(); },
        error: reject
      });
    });
  }

  private async loadAgents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userService.getAgents().subscribe({
        next: (agents) => { this.users.set(agents as any); resolve(); },
        error: reject
      });
    });
  }

  private async loadAdAccounts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.adAccountService.getAdAccounts({ isActive: true }).subscribe({
        next: (accs) => { this.adAccounts.set(accs as any); resolve(); },
        error: reject
      });
    });
  }

  // removed AI config loader

  // Modal methods
  openModal(): void {
    this.isEditing.set(false);
    this.editingId = null;
    this.adGroupForm.reset();
    this.adGroupForm.patchValue({
      isActive: true,
      enableWebhook: false,
      selectedProducts: []
    });
    this.showModal.set(true);
  }

  editItem(group: AdGroup): void {
    this.isEditing.set(true);
    this.editingId = group._id!;
    
    this.adGroupForm.patchValue({
      name: group.name,
      adGroupId: group.adGroupId,
      fanpageId: group.fanpageId || '',
      productCategoryId: group.productCategoryId || '',
      agentId: (group as any).agentId || '',
      adAccountId: (group as any).adAccountId || '',
      platform: (group as any).platform || 'facebook',
      selectedProducts: group.selectedProducts || [],
      enableWebhook: group.enableWebhook || false,
      autoControlEnabled: group.autoControlEnabled || false,
      spendThresholdDaily: group.spendThresholdDaily || 0,
      cprThresholdDaily: group.cprThresholdDaily || 0,
      minConversations: group.minConversations || 3,
      isActive: group.isActive,
      notes: group.notes || ''
    });

    // Load products for selected category
    if (group.productCategoryId) {
      this.loadProductsByCategory(group.productCategoryId);
    }
    
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.isEditing.set(false);
    this.editingId = null;
    this.adGroupForm.reset();
  }

  closeModalIfOutside(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  saveItem(): void {
    if (this.adGroupForm.valid) {
      this.isSaving.set(true);
      const formData = this.adGroupForm.value;

      if (this.isEditing() && this.editingId) {
        this.adGroupService.update(this.editingId, formData).subscribe({
          next: (updated) => {
            this.adGroups.update(groups => 
              groups.map(g => g._id === updated._id ? updated : g)
            );
            this.closeModal();
            this.isSaving.set(false);
          },
          error: (error) => {
            const msg = (error && (error.error?.message || error.message)) || 'Lỗi cập nhật';
            this.error.set('Lỗi cập nhật: ' + msg);
            this.isSaving.set(false);
          }
        });
      } else {
        this.adGroupService.create(formData).subscribe({
          next: (created) => {
            this.adGroups.update(groups => [created, ...groups]);
            this.closeModal();
            this.isSaving.set(false);
          },
          error: (error) => {
            const msg = (error && (error.error?.message || error.message)) || 'Lỗi tạo mới';
            this.error.set('Lỗi tạo mới: ' + msg);
            this.isSaving.set(false);
          }
        });
      }
    }
  }

  deleteItem(group: AdGroup): void {
    if (!confirm(`Xóa nhóm quảng cáo "${group.name}"?`)) return;
    
    this.adGroupService.delete(group._id!).subscribe({
      next: () => {
        this.adGroups.update(groups => groups.filter(g => g._id !== group._id));
      },
      error: (error) => {
        this.error.set('Lỗi xóa: ' + error.message);
      }
    });
  }

  // Category change handler
  onCategoryChange(event: Event): void {
    const categoryId = (event.target as HTMLSelectElement).value;
    if (categoryId) {
      this.loadProductsByCategory(categoryId);
    } else {
      this.availableProducts.set([]);
    }
    // Clear selected products when category changes
    this.adGroupForm.get('selectedProducts')?.setValue([]);
  }

  private loadProductsByCategory(categoryId: string): void {
    this.productService.getByCategory(categoryId).subscribe({
      next: (products) => {
        this.availableProducts.set(products as any);
      },
      error: (error) => {
        const msg = (error && (error.error?.message || error.message)) || 'Lỗi tải sản phẩm theo danh mục';
        this.error.set(msg);
        this.availableProducts.set([]);
      }
    });
  }

  // Product selection methods
  isProductSelected(productId: string): boolean {
    const selected = this.adGroupForm.get('selectedProducts')?.value || [];
    return selected.includes(productId);
  }

  toggleProductSelection(productId: string, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    const selected = this.adGroupForm.get('selectedProducts')?.value || [];
    
    if (checkbox.checked) {
      this.adGroupForm.get('selectedProducts')?.setValue([...selected, productId]);
    } else {
      this.adGroupForm.get('selectedProducts')?.setValue(
        selected.filter((id: string) => id !== productId)
      );
    }
  }

  // Utility methods
  getFanpageName(fanpageId?: string): string {
    if (!fanpageId) return 'Chưa chọn';
    const fanpage = this.fanpages().find(f => f._id === fanpageId);
    return fanpage?.name || 'Không tìm thấy';
  }

  getCategoryName(categoryId?: string): string {
    if (!categoryId) return 'Chưa chọn';
    const category = this.productCategories().find(c => c._id === categoryId);
    return category?.name || 'Không tìm thấy';
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

  getProductPrice(product: any): string {
    const price = product.price || 0;
    return this.formatPrice(price);
  }

  // Stats methods
  getActiveCount(): number {
    return this.adGroups().filter(g => g.isActive).length;
  }

  // removed chatbot count (no AI)

  getWebhookEnabledCount(): number {
    return this.adGroups().filter(g => g.enableWebhook).length;
  }

  // Toggle methods
  toggleActive(group: AdGroup): void {
    this.adGroupService.update(group._id!, { isActive: !group.isActive }).subscribe({
      next: (updated) => {
        this.adGroups.update(groups => 
          groups.map(g => g._id === updated._id ? updated : g)
        );
      },
      error: (error) => {
        const msg = (error && (error.error?.message || error.message)) || 'Lỗi cập nhật trạng thái';
        this.error.set('Lỗi cập nhật trạng thái: ' + msg);
      }
    });
  }

  toggleWebhook(group: AdGroup, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.adGroupService.update(group._id!, { enableWebhook: checkbox.checked }).subscribe({
      next: (updated) => {
        this.adGroups.update(groups => 
          groups.map(g => g._id === updated._id ? updated : g)
        );
      },
      error: (error) => {
        const msg = (error && (error.error?.message || error.message)) || 'Lỗi cập nhật webhook';
        this.error.set('Lỗi cập nhật webhook: ' + msg);
        checkbox.checked = !checkbox.checked; // Revert checkbox
      }
    });
  }

  // Search and filter
  onSearch(): void {
    const query = this.searchQuery().trim();
    if (query) {
      this.adGroupService.search({ q: query }).subscribe({
        next: (results) => this.adGroups.set(results),
        error: (error) => {
          const msg = (error && (error.error?.message || error.message)) || 'Lỗi tìm kiếm';
          this.error.set('Lỗi tìm kiếm: ' + msg);
        }
      });
    } else {
      this.loadAdGroups();
    }
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.filterPlatform.set('all');
    this.loadAdGroups();
  }

  setPlatformFilter(p: 'all' | 'facebook' | 'google' | 'tiktok') {
    this.filterPlatform.set(p);
    this.loadAdGroups();
  }

  setSort(field: string): void {
    // Implement sorting if needed
    console.log('Sort by:', field);
  }

  // Helper to show last auto-paused reason for current editing item
  getEditingAutoPausedReason(): string | null {
    if (!this.editingId) return null;
    const g = this.adGroups().find(x => x._id === this.editingId);
    return g?.autoPausedReason || null;
  }
}
