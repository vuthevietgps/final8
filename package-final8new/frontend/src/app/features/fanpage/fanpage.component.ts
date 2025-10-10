/**
 * File: fanpage/fanpage.component.ts
 * Mục đích: Component quản lý Fanpage với modal form và error handling
 * Chức năng: CRUD fanpage, hiển thị danh sách, form thêm/sửa
 */
import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FanpageService, Fanpage, CreateFanpageRequest } from './fanpage.service';
import { OpenAIConfigService, OpenAIConfig } from '../openai-config/openai-config.service';
import { ProductService } from '../product/product.service';
import { ApiTokenService, ApiToken } from '../api-token/api-token.service';
import TokenRecoveryComponent from '../../shared/token-recovery/token-recovery.component';

interface Product {
  _id: string;
  name: string;
  importPrice: number;
  images: Array<{url: string, description: string}>;
}

interface ProductVariation {
  productId: string;
  productName: string;
  fanpageId: string;
  customName?: string;
  customDescription?: string;
  price?: number;
  priority: number;
  isActive: boolean;
  customImages?: string[];
}

@Component({
  selector: 'app-fanpage',
  standalone: true,
  imports: [CommonModule, FormsModule, TokenRecoveryComponent],
  templateUrl: './fanpage.component.html',
  styleUrls: ['./fanpage.component.css']
})
export class FanpageComponent implements OnInit, OnDestroy {
  private service = inject(FanpageService);
  private aiConfigSvc = inject(OpenAIConfigService);
  private productService = inject(ProductService);
  private apiTokenService = inject(ApiTokenService);

  // State signals
  fanpages = signal<Fanpage[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  showAddModal = signal(false);
  editingFanpage = signal<Fanpage | null>(null);

  // Product management signals
  availableProducts = signal<Product[]>([]);
  fanpageProducts = signal<ProductVariation[]>([]);
  productSearchQuery = '';
  showProductModal = signal(false);
  editingProductVariation = signal<ProductVariation | null>(null);
  productFormData = signal<Partial<ProductVariation>>({
    priority: 0,
    isActive: true
  });

  // Token Recovery
  showTokenRecovery = signal(false);
  tokenRecoveryData = signal<{
    id: string;
    status: 'valid' | 'expired' | 'invalid' | 'unknown';
    message: string;
    lastChecked: string;
    fanpageId: string;
    fanpageName: string;
  }>({
    id: '',
    status: 'unknown',
    message: '',
    lastChecked: '',
    fanpageId: '',
    fanpageName: ''
  });
  hasBackupTokens = signal(false);
  backupTokenCount = signal(0);

  // Form data for new/edit
  formData = signal<Partial<CreateFanpageRequest>>({
    status: 'active',
    messageQuota: 10000,
    subscriberCount: 0,
    aiEnabled: false,
    subscribedWebhook: false,
    timezone: 'Asia/Ho_Chi_Minh'
  });

  aiConfigs = signal<OpenAIConfig[]>([]);
  aiConfigLoading = signal(false);
  // Token states
  tokens = signal<ApiToken[]>([]);
  tokenLoading = signal(false);
  validatingTokenFor = signal<string | null>(null); // fanpageId currently validating

  private tokenRefreshTimer: any;
  private onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.loadTokens();
    }
  };
  private loadAIConfigs(){
    this.aiConfigLoading.set(true);
    this.aiConfigSvc.list({ status: 'active' }).subscribe({
      next: list=>{ this.aiConfigs.set(list); this.aiConfigLoading.set(false); },
      error: _=>{ this.aiConfigLoading.set(false); }
    });
  }

  ngOnInit(){
    this.load(); this.loadAIConfigs(); this.loadTokens();
    // Refresh token list every 120s only when tab is visible to reduce load
    this.tokenRefreshTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.loadTokens();
      }
    }, 120000);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  ngOnDestroy(){
    if(this.tokenRefreshTimer) clearInterval(this.tokenRefreshTimer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private loadTokens(){
    this.tokenLoading.set(true);
    this.apiTokenService.list().subscribe({
      next: list=>{ this.tokens.set(list); this.tokenLoading.set(false); },
      error: _=>{ this.tokenLoading.set(false); }
    });
  }

  /**
   * Tải danh sách fanpage từ server
   */
  load(){
    this.loading.set(true);
    this.error.set(null);
    this.service.list().subscribe({
      next: data => {
        this.fanpages.set(data);
        this.loading.set(false);
      },
      error: err => {
        this.handleError(err, 'Không thể tải danh sách fanpage');
        this.loading.set(false);
      }
    });
  }

  /**
   * Mở modal thêm fanpage mới
   */
  openAddModal(){
    this.formData.set({
      status: 'active',
      messageQuota: 10000,
      subscriberCount: 0,
      aiEnabled: false,
      subscribedWebhook: false,
      timezone: 'Asia/Ho_Chi_Minh'
    });
    this.editingFanpage.set(null);
    
    // Reset product management state for new fanpage
    this.fanpageProducts.set([]);
    this.availableProducts.set([]);
    this.productSearchQuery = '';
    
    this.showAddModal.set(true);
    this.loadAIConfigs();
    
    // Load all products for selection even when creating new fanpage
    this.loadAllProducts();
  }



  /**
   * Đóng modal
   */
  closeModal(){
    this.showAddModal.set(false);
    this.editingFanpage.set(null);
    this.formData.set({});
    
    // Reset product management state
    this.fanpageProducts.set([]);
    this.availableProducts.set([]);
    this.productSearchQuery = '';
  }

  /**
   * Lưu fanpage (tạo mới hoặc cập nhật)
   */
  saveFanpage(){
    const raw = this.formData();
    const data: any = this.buildPayload(raw);
    
    // Validation
    if (!data.pageId?.trim()) {
      alert('Vui lòng nhập Page ID');
      return;
    }
    if (!data.name?.trim()) {
      alert('Vui lòng nhập tên fanpage');
      return;
    }
    if (!data.accessToken?.trim()) {
      alert('Vui lòng nhập Access Token');
      return;
    }

    const editing = this.editingFanpage();
    if (editing) {
      // Cập nhật fanpage existing
      this.service.update(editing._id, data).subscribe({
        next: updated => {
          this.fanpages.update(list => list.map(f => f._id === updated._id ? updated : f));
          
          // Save fanpage products if any changes
          if (this.fanpageProducts().length > 0) {
            console.log('Products to be updated for fanpage:', this.fanpageProducts());
            // TODO: Call API to save fanpage products
            // this.saveFanpageProducts(updated._id, this.fanpageProducts());
          }
          
          this.closeModal();
        },
        error: err => this.handleError(err, 'Không thể cập nhật fanpage')
      });
    } else {
      // Tạo mới fanpage
      this.service.create(data as CreateFanpageRequest).subscribe({
        next: created => {
          this.fanpages.update(list => [created, ...list]);
          
          // Save fanpage products after fanpage is created
          if (this.fanpageProducts().length > 0) {
            console.log('Products to be saved for new fanpage:', this.fanpageProducts());
            
            // Update fanpageId for all products from temp to real ID
            const updatedProducts = this.fanpageProducts().map(p => ({
              ...p,
              fanpageId: created._id
            }));
            
            // TODO: In a real app, call API to save fanpage products
            // this.saveFanpageProducts(created._id, updatedProducts);
            
            console.log('New fanpage created with products:', {
              fanpage: created,
              products: updatedProducts
            });
          }
          
          this.closeModal();
        },
        error: err => this.handleError(err, 'Không thể tạo fanpage mới')
      });
    }
  }

  /**
   * Loại bỏ các field chỉ đọc (_id, createdAt, updatedAt, __v) và chỉ giữ các field hợp lệ DTO
   */
  private buildPayload(src: any){
    if(!src) return {};
    const allowed = ['pageId','name','accessToken','status','avatarUrl','connectedBy','defaultProductGroup','description','greetingScript','clarifyScript','productSuggestScript','fallbackScript','closingScript','messageQuota','subscriberCount','sentThisMonth','aiEnabled','subscribedWebhook','timezone','openAIConfigId'];
    const out: any = {};
    for(const k of allowed){ if(src[k] !== undefined && src[k] !== null) out[k]=src[k]; }
    return out;
  }

  /**
   * Xóa fanpage
   */
  deleteFanpage(fanpage: Fanpage){
    if (!confirm(`Bạn có chắc muốn xóa fanpage "${fanpage.name}"?`)) {
      return;
    }

    this.service.delete(fanpage._id).subscribe({
      next: () => {
        this.fanpages.update(list => list.filter(f => f._id !== fanpage._id));
      },
      error: err => this.handleError(err, 'Không thể xóa fanpage')
    });
  }

  /**
   * Toggle trạng thái AI
   */
  toggleAI(fanpage: Fanpage){
    this.service.update(fanpage._id, { aiEnabled: !fanpage.aiEnabled }).subscribe({
      next: updated => {
        this.fanpages.update(list => list.map(f => f._id === updated._id ? updated : f));
      },
      error: err => this.handleError(err, 'Không thể thay đổi trạng thái AI')
    });
  }

  /**
   * Tạo config AI cho fanpage chưa có config
   */
  createAIConfig(fanpage: Fanpage){
    if (!confirm(`Tạo cấu hình AI mới cho fanpage "${fanpage.name}"?`)) return;
    
    // Gọi endpoint đặc biệt để tạo config AI cho fanpage hiện có
    this.service.createAIConfig(fanpage._id).subscribe({
      next: () => {
        // Reload fanpage để lấy thông tin mới
        this.load();
      },
      error: err => this.handleError(err, 'Không thể tạo config AI')
    });
  }

  /**
   * Xử lý lỗi API
   */
  private handleError(error: any, defaultMessage: string){
    let errorMessage = defaultMessage;
    
    if (error?.status === 403) {
      errorMessage = 'Bạn không có quyền truy cập chức năng này';
    } else if (error?.status === 400 && error?.error?.message) {
      errorMessage = error.error.message;
    } else if (error?.error?.message) {
      errorMessage = error.error.message;
    }
    
    this.error.set(errorMessage);
    console.error('Fanpage API Error:', error);
  }

  /**
   * Cập nhật form data
   */
  updateFormField(field: keyof CreateFanpageRequest, value: any){
    this.formData.update(data => ({ ...data, [field]: value }));
  }

  /**
   * Xử lý input event
   */
  onInputChange(event: Event, field: keyof CreateFanpageRequest) {
    const target = event.target as HTMLInputElement;
    this.updateFormField(field, target.value);
  }

  /**
   * Xử lý number input event
   */
  onNumberChange(event: Event, field: keyof CreateFanpageRequest) {
    const target = event.target as HTMLInputElement;
    this.updateFormField(field, +target.value);
  }

  /**
   * Xử lý checkbox event
   */
  onCheckboxChange(event: Event, field: keyof CreateFanpageRequest) {
    const target = event.target as HTMLInputElement;
    this.updateFormField(field, target.checked);
  }

  trackById(index: number, item: Fanpage){ return item._id; }

  // ======== TOKEN HELPERS ========
  private tokensForFanpage(fanpageId: string){ return this.tokens().filter(t => t.fanpageId === fanpageId); }
  hasApiTokens(fanpageId: string){ return this.tokensForFanpage(fanpageId).length > 0; }
  hasFanpageAccessToken(fp: Fanpage){ return !!fp.accessToken; }
  getPrimaryToken(fanpageId: string): ApiToken | undefined {
    const list = this.tokensForFanpage(fanpageId);
    if(!list.length) return undefined;
    const primary = list.find(t => !!t.isPrimary);
    return primary || list[0];
  }
  getTokenStatus(fanpageId: string): { label: string; css: string; detail?: string }{
    const t = this.getPrimaryToken(fanpageId);
    if(!t) return { label: 'Chưa có', css: 'status-unknown' };
    const status = t.lastCheckStatus || 'unknown';
    if(status === 'valid') return { label: 'Hợp lệ', css: 'status-valid', detail: t.lastCheckedAt ? new Date(t.lastCheckedAt).toLocaleString() : undefined };
    if(status === 'expired') return { label: 'Hết hạn', css: 'status-expired', detail: t.lastCheckedAt ? new Date(t.lastCheckedAt).toLocaleString() : undefined };
    if(status === 'invalid') return { label: 'Không hợp lệ', css: 'status-invalid', detail: t.lastCheckedAt ? new Date(t.lastCheckedAt).toLocaleString() : undefined };
    return { label: 'Chưa kiểm tra', css: 'status-unknown' };
  }
  checkToken(f: Fanpage){
    const t = this.getPrimaryToken(f._id);
    if(!t) { alert('Fanpage chưa có API Token. Vào mục API & Token để thêm.'); return; }
    this.validatingTokenFor.set(f._id);
    this.apiTokenService.validate(t._id).subscribe({
      next: updated => {
        // update local tokens list
        this.tokens.update(list => list.map(x => x._id === updated._id ? updated : x));
        this.validatingTokenFor.set(null);
      },
      error: err => { this.validatingTokenFor.set(null); this.handleError(err, 'Kiểm tra token thất bại'); }
    });
  }

  // ======== TOKEN RECOVERY METHODS ========
  openTokenRecovery(fanpage: Fanpage) {
    const token = this.getPrimaryToken(fanpage._id);
    if (!token) {
      alert('Fanpage chưa có API Token');
      return;
    }

    // Set recovery data
    this.tokenRecoveryData.set({
      id: token._id,
      status: token.lastCheckStatus as any || 'unknown',
      message: token.lastCheckMessage || 'Chưa có thông tin',
      lastChecked: token.lastCheckedAt || '',
      fanpageId: fanpage._id,
      fanpageName: fanpage.name
    });

    // Check for backup tokens (simulate - in real app would call API)
    this.checkBackupTokens(fanpage._id);

    this.showTokenRecovery.set(true);
  }

  closeTokenRecovery() {
    this.showTokenRecovery.set(false);
  }

  async handleTokenRecovery(event: {method: string, data: any}) {
    const { method, data } = event;
    const tokenData = this.tokenRecoveryData();

    try {
      switch (method) {
        case 'manual':
          await this.refreshTokenManually(tokenData.id, data.newToken);
          break;
        case 'oauth':
          await this.initiateOAuthFlow(tokenData.fanpageId);
          break;
        case 'backup':
          await this.activateBackupToken(tokenData.fanpageId);
          break;
      }

      // Refresh token list and fanpage list
      await this.loadTokens();
      this.load();
      
      this.closeTokenRecovery();
      alert(`Token đã được khôi phục thành công bằng phương pháp: ${this.getRecoveryMethodName(method)}`);
      
    } catch (error: any) {
      this.handleError(error, `Khôi phục token thất bại (${method})`);
    }
  }

  private async refreshTokenManually(tokenId: string, newToken: string) {
    return new Promise((resolve, reject) => {
      this.apiTokenService.refreshManually(tokenId, newToken).subscribe({
        next: resolve,
        error: reject
      });
    });
  }

  private async initiateOAuthFlow(fanpageId: string) {
    // In real implementation, this would:
    // 1. Redirect to Facebook OAuth
    // 2. Handle callback with new token
    // 3. Update token in backend
    throw new Error('OAuth flow chưa được implement - sẽ có trong version tiếp theo');
  }

  private async activateBackupToken(fanpageId: string) {
    return new Promise((resolve, reject) => {
      this.apiTokenService.activateBackup(fanpageId).subscribe({
        next: resolve,
        error: reject
      });
    });
  }

  private checkBackupTokens(fanpageId: string) {
    // Count backup tokens for this fanpage
    const backupTokens = this.tokens().filter(t => 
      t.fanpageId === fanpageId && 
      !t.isPrimary && 
      t.status === 'active'
    );
    
    this.hasBackupTokens.set(backupTokens.length > 0);
    this.backupTokenCount.set(backupTokens.length);
  }

  private getRecoveryMethodName(method: string): string {
    switch (method) {
      case 'manual': return 'Nhập token thủ công';
      case 'oauth': return 'Kết nối Facebook OAuth';
      case 'backup': return 'Chuyển token dự phòng';
      default: return 'Không xác định';
    }
  }

  // no explicit sync UI; backend may auto-sync elsewhere

  // ======== OPENAI CONFIG HELPERS ========
  getOpenAIConfigName(fp: Fanpage): string | null {
    const id = fp.openAIConfigId;
    if(!id) return null;
    const list = this.aiConfigs();
    const cfg = list.find(c => c._id === id);
    return cfg?.name || `Cfg:${id.slice(-6)}`;
  }

  // ======== PRODUCT MANAGEMENT METHODS ========

  /**
   * Load all products for selection
   */
  loadAllProducts() {
    this.productService.getAll().subscribe({
      next: (products: any[]) => {
        // Filter out products already in fanpage
        const currentFanpageProductIds = this.fanpageProducts().map(fp => fp.productId);
        const available = products.filter((p: any) => !currentFanpageProductIds.includes(p._id));
        this.availableProducts.set(available);
        console.log('Loaded products:', available.length, 'available,', currentFanpageProductIds.length, 'already selected');
      },
      error: (err: any) => this.handleError(err, 'Không thể tải danh sách sản phẩm')
    });
  }

  /**
   * Search products by query
   */
  searchProducts() {
    if (!this.productSearchQuery.trim()) {
      this.availableProducts.set([]);
      return;
    }

    this.productService.getAll({ search: this.productSearchQuery }).subscribe({
      next: (products: any[]) => {
        const currentFanpageProductIds = this.fanpageProducts().map(fp => fp.productId);
        const available = products.filter((p: any) => !currentFanpageProductIds.includes(p._id));
        this.availableProducts.set(available);
      },
      error: (err: any) => this.handleError(err, 'Không thể tìm kiếm sản phẩm')
    });
  }

  /**
   * Add product to fanpage
   */
  addProductToFanpage(product: Product) {
    const currentFanpage = this.editingFanpage();
    
    const variation: ProductVariation = {
      productId: product._id,
      productName: product.name,
      fanpageId: currentFanpage ? currentFanpage._id : 'temp-new-fanpage',
      priority: 0,
      isActive: true
    };

    // Add to fanpage products list
    this.fanpageProducts.update(products => [...products, variation]);
    
    // Remove from available products
    this.availableProducts.update(products => 
      products.filter(p => p._id !== product._id)
    );

    console.log('Added product to fanpage:', variation);
  }

  /**
   * Remove product from fanpage
   */
  removeProductFromFanpage(variation: ProductVariation) {
    if (!confirm(`Xóa sản phẩm "${variation.productName}" khỏi fanpage?`)) return;

    this.fanpageProducts.update(products => 
      products.filter(p => p.productId !== variation.productId)
    );

    // Reload available products to include this one back
    this.loadAllProducts();
  }

  /**
   * Edit product variation
   */
  editProductVariation(variation: ProductVariation) {
    this.editingProductVariation.set(variation);
    this.productFormData.set({
      customName: variation.customName,
      customDescription: variation.customDescription,
      price: variation.price,
      priority: variation.priority,
      isActive: variation.isActive,
      customImages: variation.customImages || []
    });
    this.showProductModal.set(true);
  }

  /**
   * Save product variation changes
   */
  saveProductVariation() {
    const editing = this.editingProductVariation();
    const formData = this.productFormData();
    
    if (!editing) return;

    // Update the variation in the list
    this.fanpageProducts.update(products =>
      products.map(p => 
        p.productId === editing.productId 
          ? { ...p, ...formData }
          : p
      )
    );

    this.closeProductModal();
  }

  /**
   * Close product modal
   */
  closeProductModal() {
    this.showProductModal.set(false);
    this.editingProductVariation.set(null);
    this.productFormData.set({
      priority: 0,
      isActive: true
    });
  }

  /**
   * Load fanpage products when editing
   */
  private loadFanpageProducts(fanpageId: string) {
    // In a real app, this would call an API to get fanpage products
    // For now, we'll simulate with empty array
    this.fanpageProducts.set([]);
    this.loadAllProducts();
  }

  /**
   * Handle product form input changes
   */
  onProductInputChange(event: Event, field: keyof ProductVariation) {
    const target = event.target as HTMLInputElement;
    this.productFormData.update(data => ({ ...data, [field]: target.value }));
  }

  onProductNumberChange(event: Event, field: keyof ProductVariation) {
    const target = event.target as HTMLInputElement;
    this.productFormData.update(data => ({ ...data, [field]: +target.value }));
  }

  onProductCheckboxChange(event: Event, field: keyof ProductVariation) {
    const target = event.target as HTMLInputElement;
    this.productFormData.update(data => ({ ...data, [field]: target.checked }));
  }

  onCustomImagesChange(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    const urls = target.value.split('\n').filter(url => url.trim()).map(url => url.trim());
    this.productFormData.update(data => ({ ...data, customImages: urls }));
  }

  // ======== OVERRIDE EXISTING METHODS TO HANDLE PRODUCTS ========

  /**
   * Override openEditModal to load fanpage products
   */
  openEditModal(fanpage: Fanpage) {
    this.editingFanpage.set(fanpage);
    this.formData.set({
      pageId: fanpage.pageId,
      name: fanpage.name,
      accessToken: fanpage.accessToken,
      status: fanpage.status,
      avatarUrl: fanpage.avatarUrl,
      description: fanpage.description,
      greetingScript: fanpage.greetingScript,
      clarifyScript: fanpage.clarifyScript,
      productSuggestScript: fanpage.productSuggestScript,
      fallbackScript: fanpage.fallbackScript,
      closingScript: fanpage.closingScript,
      messageQuota: fanpage.messageQuota,
      subscriberCount: fanpage.subscriberCount,
      sentThisMonth: fanpage.sentThisMonth,
      timezone: fanpage.timezone,
      subscribedWebhook: fanpage.subscribedWebhook,
      aiEnabled: fanpage.aiEnabled,
      openAIConfigId: fanpage.openAIConfigId,
      connectedBy: fanpage.connectedBy,
      defaultProductGroup: fanpage.defaultProductGroup
    });
    
    // Load fanpage products
    this.loadFanpageProducts(fanpage._id);
    
    this.showAddModal.set(true);
  }
}
