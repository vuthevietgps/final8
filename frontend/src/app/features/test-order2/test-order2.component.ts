import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, ElementRef, HostListener, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdGroupService } from '../ad-group/ad-group.service';
import { DeliveryStatusService } from '../delivery-status/delivery-status.service';
import { ProductService } from '../product/product.service';
import { ProductionStatusService } from '../production-status/production-status.service';
import { UserService } from '../user/user.service';
import { CreateTestOrder2, NamedItem, TestOrder2 } from './models';
import { TestOrder2Service } from './test-order2.service';
import { buildProductStyle, buildStatusStyle, getContrastTextColor, normalizeHex } from './style-utils';
import { buildCsvFromObjects, downloadCsv } from './csv-utils';
import { attachScrollSync } from './scroll-utils';

@Component({
  selector: 'app-test-order2',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './test-order2.component.html',
  styleUrls: ['./test-order2.component.css']
})
export class TestOrder2Component implements OnInit, AfterViewInit {
  orders = signal<TestOrder2[]>([]);
  products = signal<NamedItem[]>([]);
  agents = signal<NamedItem[]>([]);
  adGroups = signal<NamedItem[]>([]);
  productionStatuses = signal<string[]>([]);
  orderStatuses = signal<string[]>([]);
  // name -> color maps
  productionStatusColors = signal<Record<string, string>>({});
  deliveryStatusColors = signal<Record<string, string>>({});

  isLoading = signal(false);
  error = signal<string | null>(null);

  // Upload/Delivery features removed per requirements

  // Refs for measuring sticky offsets
  @ViewChild('dateHeader', { static: false }) dateHeader?: ElementRef<HTMLElement>;
  @ViewChild('tableEl', { static: false }) tableEl?: ElementRef<HTMLElement>;
  @ViewChild('fixedPane', { static: false }) fixedPane?: ElementRef<HTMLElement>;
  @ViewChild('scrollPane', { static: false }) scrollPane?: ElementRef<HTMLElement>;

  // Filters
  q = signal('');
  selectedProduct = signal('all');
  selectedAgent = signal('all');
  selectedAdGroup = signal('all');
  selectedActive = signal('all');
  from = signal('');
  to = signal('');
  selectedProductionStatus = signal('all');
  selectedOrderStatus = signal('all');

  // Pagination
  currentPage = signal(1);
  pageSize = signal(50);
  totalItems = signal(0);
  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));
  sortBy = signal('createdAt');
  sortOrder = signal<'asc' | 'desc'>('desc');

  // Row highlighting for split table
  highlightedRowIndex: number | null = null;

  // Quick stats for header badges
  stats = computed(() => {
    const filtered = this.orders().length;
    const total = this.totalItems();
    const active = this.orders().filter(o => !!o.isActive).length;
    return { total, filtered, active };
  });

  constructor(
    private service: TestOrder2Service,
    private productService: ProductService,
    private userService: UserService,
    private adGroupService: AdGroupService,
    private productionStatusService: ProductionStatusService,
    private deliveryStatusService: DeliveryStatusService,
  ) { }

  ngOnInit(): void {
    this.loadAll();
  }

  ngAfterViewInit(): void {
    // Adjust sticky offsets after initial view render
    setTimeout(() => this.updateStickyOffsets(), 0);
    // Attach scroll sync if elements are present later
    setTimeout(() => this.attachScrollSync(), 50);
  }

  private attachScrollSync() { attachScrollSync(this.fixedPane?.nativeElement, this.scrollPane?.nativeElement); }

  onFixedScroll(evt: Event) { const scroll = this.scrollPane?.nativeElement; if (scroll) scroll.scrollTop = (evt.target as HTMLElement).scrollTop; }
  onScrollPane(evt: Event) { const fixed = this.fixedPane?.nativeElement; if (fixed) fixed.scrollTop = (evt.target as HTMLElement).scrollTop; }

  @HostListener('window:resize')
  onResize() { this.updateStickyOffsets(); }

  private updateStickyOffsets(): void {
    const th = this.dateHeader?.nativeElement;
    const table = this.tableEl?.nativeElement;
    if (th && table) {
      const width = th.offsetWidth; // includes borders with box-sizing
      table.style.setProperty('--date-col-width', `${width}px`);
    }
  }

  loadAll(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.loadDropdowns();
    this.refresh();
  }

  refresh(): void {
    this.isLoading.set(true);
    // Clear style cache on refresh to ensure updated colors
    this.styleCache.clear();
    this.productStyles.clear();
    this.productionStyles.clear();
    this.deliveryStyles.clear();
    
    this.service.getAll({
      q: this.q() || undefined,
      productId: this.selectedProduct() !== 'all' ? this.selectedProduct() : undefined,
      agentId: this.selectedAgent() !== 'all' ? this.selectedAgent() : undefined,
      adGroupId: this.selectedAdGroup() !== 'all' ? this.selectedAdGroup() : undefined,
      isActive: this.selectedActive() !== 'all' ? this.selectedActive() : undefined,
      from: this.from() || undefined,
      to: this.to() || undefined,
      productionStatus: this.selectedProductionStatus() !== 'all' ? this.selectedProductionStatus() : undefined,
      orderStatus: this.selectedOrderStatus() !== 'all' ? this.selectedOrderStatus() : undefined,
      page: this.currentPage(),
      limit: this.pageSize(),
      sortBy: this.sortBy(),
      sortOrder: this.sortOrder(),
    }).subscribe({
      next: (response) => {
        // Handle paginated response
        const normalized = (response.data || []).map((r: any) => ({
          ...r,
          productionStatus: r.productionStatus || 'Chưa làm',
          orderStatus: r.orderStatus || 'Chưa có mã vận đơn',
        }));
        this.orders.set(normalized);
        this.totalItems.set(response.pagination?.total || 0);
        this.isLoading.set(false);
        this.error.set(null);
        // Hợp nhất các giá trị orderStatus mới gặp phải vào danh sách để UI luôn hiển thị được
        const existing = new Set(this.orderStatuses());
        let changed = false;
        for (const o of normalized) {
          if (o.orderStatus && !existing.has(o.orderStatus)) {
            existing.add(o.orderStatus);
            changed = true;
          }
        }
        if (changed) {
          this.orderStatuses.set(Array.from(existing));
        }
        // After data renders, recalc sticky offsets
        setTimeout(() => this.updateStickyOffsets(), 0);
      },
      error: (err) => { 
        this.error.set('Không thể tải dữ liệu'); 
        this.isLoading.set(false); 
        console.error(err); 
      }
    });
  }

  loadDropdowns(): void {
    this.loadProducts();
    this.userService.getAgents().subscribe({
      next: (items: any) => this.agents.set(items.map((u: any) => ({ _id: u._id, name: u.fullName || u.email }))),
      error: (e: any) => console.error(e)
    });
    this.adGroupService.getAll().subscribe({
      next: (items) => this.adGroups.set([
        { _id: '0', name: '0' },
        ...items.map((g: any) => ({ _id: g.adGroupId, name: g.adGroupId }))
      ]),
      error: (e) => console.error(e)
    });
    this.productionStatusService.getProductionStatuses(true).subscribe({
      next: (items: any[]) => {
        const names: string[] = items.map((s: any) => s.name);
        if (!names.includes('Chưa làm')) names.unshift('Chưa làm');
        this.productionStatuses.set(names);
        const map: Record<string, string> = {};
        for (const s of items) {
          if (s?.name && s?.color) map[s.name] = s.color;
        }
        this.productionStatusColors.set(map);
      },
      error: (e: any) => console.error(e)
    });
    this.deliveryStatusService.getAll().subscribe({
      next: (items: any[]) => {
        const names: string[] = items.map((s: any) => s.name);
        if (!names.includes('Chưa có mã vận đơn')) names.unshift('Chưa có mã vận đơn');
        this.orderStatuses.set(names);
        const map: Record<string, string> = {};
        for (const s of items) {
          if (s?.name && s?.color) map[s.name] = s.color;
        }
        this.deliveryStatusColors.set(map);
        // Precompute all styles after all data is loaded
        this.precomputeStyles();
      },
      error: (e: any) => console.error(e)
    });
  }

  loadProducts(): void {
    this.productService.getAll().subscribe({
      next: (items) => {
        this.products.set(items.map((i: any) => ({ _id: i._id, name: i.name, color: i.color })));
        // Precompute styles after products are loaded
        this.precomputeStyles();
      },
      error: (e) => console.error(e)
    });
  }

  addNew(): void {
    const data: CreateTestOrder2 = {
      productId: typeof this.products()[0]?._id === 'string' ? this.products()[0]._id : '',
      customerName: 'Khách hàng mới',
      quantity: 1,
      agentId: typeof this.agents()[0]?._id === 'string' ? this.agents()[0]._id : '',
      adGroupId: '0',
      isActive: true,
      serviceDetails: '',
      productionStatus: 'Chưa làm',
      orderStatus: 'Chưa có mã vận đơn',
      submitLink: '',
      trackingNumber: '',
      depositAmount: 0,
      codAmount: 0,
      receiverName: '',
      receiverPhone: '',
      receiverAddress: ''
    };
    this.service.create(data).subscribe({
      next: (created) => this.orders.update(list => [created, ...list]),
      error: (e) => { this.error.set('Không thể tạo đơn'); console.error(e); }
    });
  }

  onBlurUpdate(order: TestOrder2, field: keyof TestOrder2, value: any): void {
    const id = order._id;
    // Normalize payload values by field type to match backend expectations
    const normalizeValue = (f: keyof TestOrder2, v: any) => {
      if (v === null || v === undefined) return v;
      switch (f as string) {
        case 'quantity':
        case 'depositAmount':
        case 'codAmount':
        case 'manualPayment':
          return typeof v === 'number' ? v : (parseFloat(String(v)) || 0);
        case 'isActive':
          if (typeof v === 'boolean') return v;
          if (v === 'true' || v === '1') return true;
          if (v === 'false' || v === '0') return false;
          return !!v;
        case 'productId':
        case 'agentId':
          return String(v).trim();
        case 'adGroupId': {
          const s = String(v ?? '').trim();
          return s || '0';
        }
        default:
          return typeof v === 'string' ? v.trim() : v;
      }
    };
    const payload: any = { [field]: normalizeValue(field, value) };
    this.service.update(id, payload).subscribe({
      next: (updated) => {
        // In case backend doesn't populate names, keep UI consistent
        const normalized = {
          ...updated,
          productionStatus: updated.productionStatus || 'Chưa làm',
          orderStatus: updated.orderStatus || 'Chưa có mã vận đơn',
        } as TestOrder2;
        this.orders.update(rows => rows.map(r => r._id === id ? normalized : r));
      },
      error: (e) => { console.error(e); }
    });
  }

  onSelectUpdate(order: TestOrder2, field: keyof TestOrder2, event: Event): void {
    const target = event.target as HTMLSelectElement;
    let value = (target.value ?? '').toString().trim();
    
    if (field === 'adGroupId' && !value) value = '0';
    
    if (field === 'productId' && value && value !== '0' && value !== '') {
      const payload = { productId: value };
      this.service.update(order._id, payload).subscribe({
        next: (updated) => {
          const normalized = {
            ...updated,
            productionStatus: updated.productionStatus || 'Chưa làm',
            orderStatus: updated.orderStatus || 'Chưa có mã vận đơn',
          } as TestOrder2;
          this.orders.update(rows => rows.map(r => r._id === order._id ? normalized : r));
        },
        error: (e) => { console.error(e); }
      });
    } else {
      this.onBlurUpdate(order, field, value);
    }
  }

  // Autocomplete (datalist) support for adGroupId input
  onAdGroupIdBlur(order: TestOrder2, event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = (target.value || '').trim();
    if (!value) value = '0';
    // Optimistic UI update so value sticks immediately
    const newVal = value;
    this.orders.update(rows => rows.map(r => r._id === order._id ? { ...r, adGroupId: newVal } : r));
    this.onBlurUpdate(order, 'adGroupId', newVal);
  }

  onInputUpdate(order: TestOrder2, field: keyof TestOrder2, event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    let value: any = target.value;
    if (['quantity', 'depositAmount', 'codAmount'].includes(field as string)) {
      value = parseFloat(value) || 0;
    }
    if (field === 'isActive') {
      value = target instanceof HTMLInputElement ? target.checked : !!value;
    }
    this.onBlurUpdate(order, field, value);
  }

  delete(order: TestOrder2): void {
    if (!confirm('Xóa đơn này?')) return;
    this.service.delete(order._id).subscribe({
      next: () => this.orders.update(rows => rows.filter(r => r._id !== order._id)),
      error: (e) => console.error(e)
    });
  }

  // TrackBy to render long lists smoother
  trackById(index: number, o: TestOrder2): string { return o._id; }

  // Reset all filters to default
  resetFilters(): void {
    this.q.set('');
    this.selectedProduct.set('all');
    this.selectedAgent.set('all');
    this.selectedAdGroup.set('all');
    this.selectedActive.set('all');
    this.from.set('');
    this.to.set('');
    this.selectedProductionStatus.set('all');
    this.selectedOrderStatus.set('all');
    this.refresh();
  }

  onFilterChange(filterType: string, value: string): void {
    switch (filterType) {
      case 'q':
        this.q.set(value);
        break;
      case 'product':
        this.selectedProduct.set(value);
        break;
      case 'agent':
        this.selectedAgent.set(value);
        break;
      case 'adGroup':
        this.selectedAdGroup.set(value);
        break;
      case 'productionStatus':
        this.selectedProductionStatus.set(value);
        break;
      case 'orderStatus':
        this.selectedOrderStatus.set(value);
        break;
      case 'active':
        this.selectedActive.set(value);
        break;
      case 'from':
        this.from.set(value);
        break;
      case 'to':
        this.to.set(value);
        break;
    }
    
    // Reset về trang đầu khi filter thay đổi
    this.currentPage.set(1);
    
    // Tự động refresh sau khi filter thay đổi
    this.refresh();
  }

  onSortChange(sortField: string): void {
    this.sortBy.set(sortField);
    this.currentPage.set(1); // Reset về trang đầu khi sort thay đổi
    this.refresh(); // Tự động refresh
  }

  // Helper to extract id from string or populated object
  getId(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    return val._id || '';
  }

  // Format date dd/MM/yyyy
  formatDate(value?: string): string {
    if (!value) return '';
    const d = new Date(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  downloadCSV(): void {
    const data = this.orders();
    if (data.length === 0) { alert('Không có dữ liệu để tải xuống'); return; }
    const headers = [
      'Ngày','Khách hàng','Sản phẩm','Số lượng','Đại lý','ID Nhóm QC','Kích hoạt','Chi tiết dịch vụ','Trạng thái sản xuất','Trạng thái vận đơn','Link nộp','Mã vận đơn','Đặt cọc','COD','Người nhận','SĐT nhận','Địa chỉ nhận'
    ];
    const rows = data.map(order => ({
      'Ngày': this.formatDate(order.createdAt),
      'Khách hàng': order.customerName || '',
      'Sản phẩm': this.getNameById(order.productId, this.products()),
      'Số lượng': order.quantity || 0,
      'Đại lý': this.getNameById(order.agentId, this.agents()),
      'ID Nhóm QC': order.adGroupId || '',
      'Kích hoạt': order.isActive ? 'Có' : 'Không',
      'Chi tiết dịch vụ': order.serviceDetails || '',
      'Trạng thái sản xuất': order.productionStatus || '',
      'Trạng thái vận đơn': order.orderStatus || '',
      'Link nộp': order.submitLink || '',
      'Mã vận đơn': order.trackingNumber || '',
      'Đặt cọc': order.depositAmount || 0,
      'COD': order.codAmount || 0,
      'Người nhận': order.receiverName || '',
      'SĐT nhận': order.receiverPhone || '',
      'Địa chỉ nhận': order.receiverAddress || '',
    }));
    const csvContent = buildCsvFromObjects(headers, rows);
    downloadCsv(`don-hang-thu-nghiem-2-${new Date().toISOString().split('T')[0]}.csv`, csvContent, true);
  }

  private getNameById(id: any, items: NamedItem[]): string {
    const itemId = this.getId(id);
    const item = items.find(i => i._id === itemId);
    return item?.name || itemId || '';
  }

  // Status and color helpers
  private normalizeHex = normalizeHex;
  private getContrastTextColor = getContrastTextColor;

  getProductionColor(name?: string): string | undefined {
    if (!name) return undefined;
    return this.productionStatusColors()[name];
  }

  getDeliveryColor(name?: string): string | undefined {
    if (!name) return undefined;
    return this.deliveryStatusColors()[name];
  }

  statusCellStyle(kind: 'prod' | 'del', name?: string): Record<string, string> {
    // Remove background color from cell to allow dropdown border to be visible
    return {};
  }

  // Cache for style calculations to improve performance
  private styleCache = new Map<string, Record<string, string>>();
  private productStyles = new Map<string, Record<string, string>>();
  private productionStyles = new Map<string, Record<string, string>>();
  private deliveryStyles = new Map<string, Record<string, string>>();

  // Pre-compute all styles when data loads
  private precomputeStyles(): void {
    // Clear existing caches
    this.productStyles.clear();
    this.productionStyles.clear();
    this.deliveryStyles.clear();
    
    // Pre-compute product styles
    this.products().forEach(product => {
      const style = this.calculateProductStyle(product._id);
      this.productStyles.set(product._id, style);
    });
    
    // Pre-compute production status styles
    this.productionStatuses().forEach(statusName => {
      const style = this.calculateStatusStyle('prod', statusName);
      this.productionStyles.set(statusName, style);
    });
    
    // Pre-compute delivery status styles - using keys from deliveryStatusColors
    Object.keys(this.deliveryStatusColors()).forEach(statusName => {
      const style = this.calculateStatusStyle('del', statusName);
      this.deliveryStyles.set(statusName, style);
    });
  }

  private calculateProductStyle(productId: string): Record<string, string> {
    const product = this.products().find(p => p._id === productId);
    const productColor = product?.color || '#3B82F6';
    return buildProductStyle(productColor);
  }

  private calculateStatusStyle(kind: 'prod' | 'del', name: string): Record<string, string> {
    const color = kind === 'prod' ? this.getProductionColor(name) : this.getDeliveryColor(name);
    return buildStatusStyle(color);
  }

  statusSelectStyle(kind: 'prod' | 'del', name?: string): Record<string, string> {
    if (!name) return {};
    
    // Use pre-computed styles for instant response
    const styleMap = kind === 'prod' ? this.productionStyles : this.deliveryStyles;
    const cachedStyle = styleMap.get(name);
    if (cachedStyle) return cachedStyle;
    
    // Fallback to calculation if not in cache
    const cacheKey = `${kind}-${name}`;
    if (this.styleCache.has(cacheKey)) {
      return this.styleCache.get(cacheKey)!;
    }

    const style = this.calculateStatusStyle(kind, name);
    this.styleCache.set(cacheKey, style);
    return style;
  }

  productSelectStyle(productId?: string | { _id: string }): Record<string, string> {
    const id = typeof productId === 'string' ? productId : productId?._id;
    if (!id) return {};
    
    // Use pre-computed styles for instant response
    const cachedStyle = this.productStyles.get(id);
    if (cachedStyle) return cachedStyle;
    
    // Fallback to calculation if not in cache
    const cacheKey = `product-${id}`;
    if (this.styleCache.has(cacheKey)) {
      return this.styleCache.get(cacheKey)!;
    }

    const style = this.calculateProductStyle(id);
    this.styleCache.set(cacheKey, style);
    return style;
  }

  getProductOptionStyle(productId: string): Record<string, string> {
    // Use the same pre-computed styles for options for maximum performance
    const cachedStyle = this.productStyles.get(productId);
    if (cachedStyle) {
      // Return simplified style for options (just background and color)
      return {
        'background-color': cachedStyle['background-color'],
        'color': cachedStyle['color']
      };
    }
    
    // Fallback calculation
    const product = this.products().find(p => p._id === productId);
    const bg = this.normalizeHex(product?.color || '#3B82F6');
    if (!bg) return {};
    const fg = this.getContrastTextColor(bg);
    return { 'background-color': bg, color: fg };
  }
  
  getStatusOptionStyle(kind: 'prod' | 'del', name?: string): Record<string, string> {
    const color = kind === 'prod' ? this.getProductionColor(name) : this.getDeliveryColor(name);
    const bg = this.normalizeHex(color);
    if (!bg) return {};
    const fg = this.getContrastTextColor(bg);
    return { 'background-color': bg, color: fg };
  }

  // Pagination Methods
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.refresh();
  }

  changePageSize(size: string): void {
    const newSize = parseInt(size);
    this.pageSize.set(newSize);
    this.currentPage.set(1); // Reset to first page
    this.refresh();
  }

  // Row highlighting methods for split table
  highlightRow(index: number): void {
    this.highlightedRowIndex = index;
  }

  unhighlightRow(): void {
    this.highlightedRowIndex = null;
  }

  // Make Math available in template
  Math = Math;
}
