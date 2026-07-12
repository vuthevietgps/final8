/**
 * File: features/ad-group/ad-group.component.ts
 * Mục đích: Giao diện quản lý Nhóm Quảng Cáo (tối giản, bỏ AI/khuyến mại) - Modern Modal UI
 */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdGroupService } from './ad-group.service';
import { AdGroup, AdGroupRecommendation } from './models/ad-group.model';
import { FanpageService } from '../fanpage/fanpage.service';
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


@Component({
  selector: 'app-ad-group',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './ad-group.component.html',
  styleUrls: ['./ad-group.component.css']
})
export class AdGroupComponent implements OnInit {
  private adGroupService = inject(AdGroupService);
  private userService = inject(UserService);
  private adAccountService = inject(AdAccountService);
  private fanpageService = inject(FanpageService);
  private fb = inject(FormBuilder);

  // Data signals
  adGroups = signal<AdGroup[]>([]);
  users = signal<User[]>([]);
  adsOperators = signal<User[]>([]);
  adAccounts = signal<AdAccount[]>([]);
  fanpages = signal<Fanpage[]>([]);
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
      selectedProductId: [''],
      agentId: ['', Validators.required],
      assignedEmployeeId: [''],
      adAccountId: ['', Validators.required],
      platform: ['facebook', Validators.required]
    });
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.error.set(null);
    
    // Load all required data
    Promise.all([
      this.loadAdGroups(),
      this.loadFanpages(),
      this.loadProducts(),
      this.loadAgents(),
      this.loadAdsOperators(),
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

  private async loadProducts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.adGroupService.getProducts().subscribe({
        next: (products) => { this.availableProducts.set(products as any); resolve(); },
        error: reject
      });
    });
  }

  private async loadAgents(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userService.getAgentsForAds().subscribe({
        next: (agents) => { this.users.set(agents as any); resolve(); },
        error: reject
      });
    });
  }

  private async loadAdsOperators(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.userService.getAdsOperators().subscribe({
        next: (operators) => { this.adsOperators.set(operators as any); resolve(); },
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
      selectedProductId: ''
    });
    this.showModal.set(true);
  }

  editItem(group: AdGroup): void {
    this.isEditing.set(true);
    this.editingId = group._id!;
    const selectedProductId = this.extractFirstSelectedProductId(group);
    
    this.adGroupForm.patchValue({
      name: group.name,
      adGroupId: group.adGroupId,
      fanpageId: this.extractId(group.fanpageId) || '',
      selectedProductId: selectedProductId || '',
      agentId: this.extractId((group as any).agentId) || '',
      assignedEmployeeId: this.extractId((group as any).assignedEmployeeId) || '',
      adAccountId: this.extractId((group as any).adAccountId) || '',
      platform: (group as any).platform || 'facebook'
    });
    
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
    if (!this.adGroupForm.valid) {
      this.adGroupForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const formValue = { ...this.adGroupForm.value } as any;
    const selectedProductId = String(formValue.selectedProductId || '').trim();
    const assignedEmployeeId = String(formValue.assignedEmployeeId || '').trim();
    const formData = {
      ...formValue,
      selectedProducts: selectedProductId ? [selectedProductId] : [],
      assignedEmployeeId: assignedEmployeeId || undefined,
    };
    delete formData.selectedProductId;

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
          const msg = (error && (error.error?.message || error.message)) || 'Loi cap nhat';
          this.error.set('Loi cap nhat: ' + msg);
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
          const msg = (error && (error.error?.message || error.message)) || 'Loi tao moi';
          this.error.set('Loi tao moi: ' + msg);
          this.isSaving.set(false);
        }
      });
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

  getSelectedProductName(group: AdGroup): string {
    const selected = (group.selectedProducts || [])[0] as any;
    if (!selected) return 'Khong gan';

    if (typeof selected === 'object' && selected?.name) {
      return selected.name;
    }

    const productId = this.extractId(selected);
    if (!productId) return 'Khong gan';

    const product = this.availableProducts().find(p => this.extractId((p as any)._id) === productId);
    return product?.name || 'Khong tim thay san pham';
  }

  getSelectedProductCategory(group: AdGroup): string {
    const selected = (group.selectedProducts || [])[0] as any;
    const categoryRef = typeof selected === 'object' ? selected?.categoryId : undefined;
    if (categoryRef?.name) return categoryRef.name;

    const productId = this.extractId(selected);
    if (!productId) return 'Khong gan';

    const product = this.availableProducts().find(p => this.extractId((p as any)._id) === productId) as any;
    return product?.categoryId?.name || 'Khong gan';
  }

  getAssignedEmployeeName(group: AdGroup): string {
    const id = this.extractId(group.assignedEmployeeId);
    if (!id) return 'Chua gan';
    if (typeof group.assignedEmployeeId === 'object' && (group.assignedEmployeeId.fullName || group.assignedEmployeeId.email)) {
      return group.assignedEmployeeId.fullName || group.assignedEmployeeId.email || id;
    }
    const user = this.adsOperators().find((item) => item._id === id);
    return user?.fullName || user?.email || id;
  }

  getAdAccountSummary(group: AdGroup): string {
    const account = group.adAccountId as any;
    if (account?.name && account?.accountId) {
      const businessCenter = account?.businessCenterId ? ` / BC ${account.businessCenterId}` : '';
      const managementMode = account?.managementMode ? ` / ${String(account.managementMode).toUpperCase()}` : '';
      return `${account.name} (${account.accountId})${managementMode}${businessCenter}`;
    }
    return 'Chua map tai khoan';
  }

  formatLastOperatorActivity(group: AdGroup): string {
    if (!group.lastOperatorActivityAt) return '-';
    const value = new Date(group.lastOperatorActivityAt);
    if (Number.isNaN(value.getTime())) return '-';
    return `${value.toLocaleDateString('vi-VN')} ${value.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  private extractFirstSelectedProductId(group: AdGroup): string {
    const selected = (group.selectedProducts || [])[0];
    return this.extractId(selected);
  }

  // Utility methods
  getFanpageName(fanpageId?: any): string {
    const id = this.extractId(fanpageId);
    if (!id) return 'Chưa chọn';
    const fanpage = this.fanpages().find(f => f._id === id);
    return fanpage?.name || 'Không tìm thấy';
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
  private extractId(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (typeof value._id === 'string') return value._id;
      if (typeof value.id === 'string') return value.id;
    }
    return '';
  }

}
