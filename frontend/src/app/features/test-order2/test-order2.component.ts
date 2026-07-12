import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, ElementRef, HostListener, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AdGroupService } from '../ad-group/ad-group.service';
import { DeliveryStatusService } from '../delivery-status/delivery-status.service';
import { ProductService } from '../product/product.service';
import { ProductionStatusService } from '../production-status/production-status.service';
import { UserService } from '../user/user.service';
import { Supplier } from '../supplier/supplier.service';
import { SupplierQuoteApi } from '../supplier-quote/supplier-quote.service';
import { CreateTestOrder2, NamedItem, ProductWithSuppliers, TestOrder2 } from './models';
import { TestOrder2Service } from './test-order2.service';
import { buildProductStyle, buildStatusStyle, getContrastTextColor, normalizeHex } from './style-utils';
import { buildCsvFromObjects, downloadCsv } from './csv-utils';

/** Fields that suppliers are allowed to edit */
const SUPPLIER_EDITABLE_FIELDS = new Set([
  'serviceDetails', 'productionStatus', 'orderStatus',
  'submitLink', 'trackingNumber', 'depositAmount',
  'codAmount', 'receiverName', 'receiverPhone', 'receiverAddress',
]);

@Component({
  selector: 'app-test-order2',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './test-order2.component.html',
  styleUrls: ['./test-order2.component.css']
})
export class TestOrder2Component implements OnInit, AfterViewInit {
  private static readonly EMPTY_STYLE: Record<string, string> = {};
  private static readonly EMPTY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [];
  // P2 FIX: Math for template
  Math = Math;
  orders = signal<TestOrder2[]>([]);
  products = signal<ProductWithSuppliers[]>([]);
  agents = signal<NamedItem[]>([]);
  adGroups = signal<NamedItem[]>([]);
  suppliers = signal<Supplier[]>([]);
  productionStatuses = signal<string[]>([]);
  orderStatuses = signal<string[]>([]);
  // name -> color maps
  productionStatusColors = signal<Record<string, string>>({});
  deliveryStatusColors = signal<Record<string, string>>({});

  isLoading = signal(false);
  error = signal<string | null>(null);
  confirmingOrderIds = signal<ReadonlySet<string>>(new Set());

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
  selectedSupplier = signal('all');
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

  // Role-based visibility
  currentUserRole = computed(() => this.authService.userRole());
  isSupplier = computed(() => {
    const role = this.currentUserRole();
    return role === 'internal_supplier' || role === 'external_supplier';
  });
  canAddNew = computed(() => !this.isSupplier()); // Supplier không thể tạo mới
  canDelete = computed(() => !this.isSupplier()); // Supplier không thể xóa
  canEditSupplier = computed(() => !this.isSupplier()); // Supplier không thể chọn NCC khác

  /** Check if current user can edit a specific field */
  canEditField(field: string): boolean {
    if (this.currentUserRole() === 'internal_agent' || this.currentUserRole() === 'external_agent') return false;
    if (!this.isSupplier()) return true;
    return SUPPLIER_EDITABLE_FIELDS.has(field);
  }

  canConfirmBusiness(): boolean {
    return this.authService.hasPermission('orders.confirm-business');
  }

  constructor(
    private authService: AuthService,
    private service: TestOrder2Service,
    private productService: ProductService,
    private userService: UserService,
    private adGroupService: AdGroupService,
    private productionStatusService: ProductionStatusService,
    private deliveryStatusService: DeliveryStatusService,
    private supplierQuoteApi: SupplierQuoteApi,
  ) { }

  ngOnInit(): void {
    this.loadAll();
  }

  ngAfterViewInit(): void {
    // Adjust sticky offsets after initial view render
    setTimeout(() => this.updateStickyOffsets(), 0);
  }

  onFixedScroll(evt: Event) {
    const scroll = this.scrollPane?.nativeElement;
    const source = evt.target as HTMLElement;
    if (scroll && scroll.scrollTop !== source.scrollTop) {
      scroll.scrollTop = source.scrollTop;
    }
  }

  onScrollPane(evt: Event) {
    const fixed = this.fixedPane?.nativeElement;
    const source = evt.target as HTMLElement;
    if (fixed && fixed.scrollTop !== source.scrollTop) {
      fixed.scrollTop = source.scrollTop;
    }
  }

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
    
    // Đặt timeout an toàn để tránh loading vô hạn
    const timeoutId = setTimeout(() => {
      if (this.isLoading()) {
        this.isLoading.set(false);
        this.error.set('Kết nối bị gián đoạn, vui lòng thử lại');
        console.warn('Request timeout after 30s');
      }
    }, 30000);
    
    this.service.getAll({
      q: this.q() || undefined,
      productId: this.selectedProduct() !== 'all' ? this.selectedProduct() : undefined,
      agentId: this.selectedAgent() !== 'all' ? this.selectedAgent() : undefined,
      supplierId: this.selectedSupplier() !== 'all' ? this.selectedSupplier() : undefined,
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
        clearTimeout(timeoutId);
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
        // Không merge orderStatus từ orders vào dropdown nữa
        // Chỉ sử dụng danh sách từ DeliveryStatus master data
        // After data renders, recalc sticky offsets
        setTimeout(() => this.updateStickyOffsets(), 0);
      },
      error: (err) => { 
        clearTimeout(timeoutId);
        this.error.set('Không thể tải dữ liệu'); 
        this.isLoading.set(false); 
        console.error(err); 
      }
    });
  }

  loadDropdowns(): void {
    this.loadProducts();
    this.loadSuppliers();
    this.userService.getAgents().subscribe({
      next: (items: any) => this.agents.set(items.map((u: any) => ({ _id: u._id, name: u.fullName || u.email }))),
      error: (e: any) => console.error(e)
    });
    this.adGroupService.getAll().subscribe({
      next: (items) => this.adGroups.set([
        { _id: '', name: 'Không có nhóm quảng cáo' },
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
    this.service.getProductsForOrders().subscribe({
      next: (items) => {
        // Keep suppliers info for source selection
        this.products.set(items as any);
        this.rebuildSourceOptionsCache();
        this.precomputeStyles();
      },
      error: (orderProductsErr) => {
        // Backward-compat fallback when backend has not deployed the new endpoint yet.
        console.warn('Order products endpoint failed, fallback to /products', orderProductsErr);
        this.productService.getAll().subscribe({
          next: (items) => {
            this.products.set(items as any);
            this.rebuildSourceOptionsCache();
            this.precomputeStyles();
          },
          error: (legacyErr) => {
            console.error(legacyErr);
          }
        });
      }
    });
  }

  loadSuppliers(): void {
    if (this.isSupplier()) {
      const user = this.authService.user();
      if (user && (user.role === 'internal_supplier' || user.role === 'external_supplier')) {
        this.suppliers.set([{
          _id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isActive: user.isActive
        }]);
      } else {
        this.suppliers.set([]);
      }
      this.rebuildSourceOptionsCache();
      return;
    }

    this.userService.getSuppliersForOrders().subscribe({
      next: (items: any[]) => {
        this.suppliers.set(items as Supplier[]);
        this.rebuildSourceOptionsCache();
      },
      error: (e) => console.error(e)
    });
  }

  addNew(): void {
    if (this.currentUserRole() === 'internal_agent' || this.currentUserRole() === 'external_agent') {
      this.error.set('Đại lý chỉ có quyền xem đơn hàng của mình');
      return;
    }
    const data: CreateTestOrder2 = {
      productId: typeof this.products()[0]?._id === 'string' ? this.products()[0]._id : '',
      productSource: 'supplier',
      supplierId: this.suppliers()[0]?._id || undefined,
      customerName: 'Khách hàng mới',
      quantity: 1,
      agentId: typeof this.agents()[0]?._id === 'string' ? this.agents()[0]._id : '',
      adGroupId: '',
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
        next: (created) => {
          this.orders.update(list => [created, ...list]);
          this.fetchAndApplyLatestQuote(created as any);
        },
      error: (e) => { this.error.set('Không thể tạo đơn'); console.error(e); }
    });
  }

  onBlurUpdate(order: TestOrder2, field: keyof TestOrder2, value: any): void {
    if (!this.canEditField(String(field))) return;

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
          return s === '0' ? '' : s;
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
    if (!this.canEditField(String(field))) return;

    const target = event.target as HTMLSelectElement;
    let value = (target.value ?? '').toString().trim();
    
    if (field === 'adGroupId' && value === '0') value = '';

    // Early handle source/supplier fields to avoid narrowing conflicts
    if (field === 'productSource') {
      order.productSource = value as any;
      if (value !== 'supplier') {
        order.supplierId = undefined;
        order.supplierAppliedPrice = undefined;
      }
      this.service.update(order._id, {
        productSource: order.productSource,
        supplierId: order.supplierId,
        supplierAppliedPrice: order.supplierAppliedPrice,
      }).subscribe({
        next: () => {},
        error: (e) => { this.error.set('Không thể cập nhật'); console.error(e); }
      });
      return;
    }

    if (field === 'supplierId') {
      order.supplierId = value || undefined;
      // Selecting a supplier should automatically switch source to supplier
      if (order.supplierId) {
        order.productSource = 'supplier' as any;
      }
      this.service.update(order._id, {
        supplierId: order.supplierId,
        productSource: order.productSource,
      }).subscribe({
        next: () => {
          this.fetchAndApplyLatestQuote(order);
        },
        error: (e) => { this.error.set('Không thể cập nhật'); console.error(e); }
      });
      return;
    }

    if (field === 'productId' && value && value !== '0' && value !== '') {
      const payload: any = { productId: value };
      // Preserve source/supplier selections when changing product
      if (order.productSource) payload.productSource = order.productSource;
      if (order.supplierId) payload.supplierId = order.supplierId;
      this.service.update(order._id, payload).subscribe({
        next: (updated) => {
          const normalized = {
            ...updated,
            productionStatus: updated.productionStatus || 'Chưa làm',
            orderStatus: updated.orderStatus || 'Chưa có mã vận đơn',
          } as TestOrder2;
          this.orders.update(rows => rows.map(r => r._id === order._id ? normalized : r));
          if (order.supplierId) this.fetchAndApplyLatestQuote(normalized);
        },
        error: (e) => { console.error(e); }
      });
    } else {
      this.onBlurUpdate(order, field, value);
    }
  }

  // Source selector (suppliers only)
  onSourceSelect(order: TestOrder2, event: Event): void {
    const target = event.target as HTMLSelectElement;
    const value = (target.value ?? '').toString();

    order.productSource = 'supplier' as any;
    order.supplierId = value || undefined;

    this.service.update(order._id, {
      productSource: order.productSource,
      supplierId: order.supplierId,
      supplierAppliedPrice: order.supplierAppliedPrice,
    }).subscribe({
      next: () => {
        this.fetchAndApplyLatestQuote(order);
      },
      error: (e) => { this.error.set('Không thể cập nhật'); console.error(e); }
    });
  }

  sourceOptionsFor(order: TestOrder2): Array<{ value: string; label: string }> {
    const productId = this.getId(order.productId);
    if (!productId) return TestOrder2Component.EMPTY_OPTIONS as Array<{ value: string; label: string }>;
    return (this.sourceOptionsCache.get(productId) || TestOrder2Component.EMPTY_OPTIONS) as Array<{ value: string; label: string }>;
  }

  getSourceSelection(order: TestOrder2): string {
    if (order.supplierId) return this.getId(order.supplierId);
    return '';
  }

  private fetchAndApplyLatestQuote(order: TestOrder2): void {
    const productId = this.getId(order.productId);
    const supplierId = this.getId(order.supplierId);
    if (!productId || !supplierId) return;
    this.supplierQuoteApi.latest(productId, supplierId).subscribe({
      next: (quote) => {
        order.supplierAppliedPrice = quote.price;
        this.service.update(order._id, { supplierAppliedPrice: quote.price }).subscribe({
          next: () => {
            this.orders.update(rows => rows.map(r => r._id === order._id ? { ...r, supplierAppliedPrice: quote.price } : r));
          },
          error: (e) => console.error(e)
        });
      },
      error: () => { /* silently ignore if chưa có báo giá */ }
    });
  }

  // Autocomplete (datalist) support for adGroupId input
  onAdGroupIdBlur(order: TestOrder2, event: Event): void {
    const target = event.target as HTMLInputElement;
    let value = (target.value || '').trim();
    if (value === '0') value = '';
    // Optimistic UI update so value sticks immediately
    const newVal = value;
    this.orders.update(rows => rows.map(r => r._id === order._id ? { ...r, adGroupId: newVal } : r));
    this.onBlurUpdate(order, 'adGroupId', newVal);
  }

  businessConfirmationAuditTitle(order: TestOrder2): string {
    const lines = ['Mốc xác nhận nghiệp vụ do máy chủ ghi một lần; không suy diễn từ thanh toán hoặc giao hàng.'];
    if (order.businessConfirmedBy) lines.push(`Xác nhận bởi: ${order.businessConfirmedBy}`);
    if (order.businessConfirmationSource) lines.push(`Nguồn: ${order.businessConfirmationSource}`);
    return lines.join('\n');
  }

  formatBusinessConfirmation(value?: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
  }

  confirmBusiness(order: TestOrder2): void {
    if (!this.canConfirmBusiness() || order.businessConfirmedAt || this.confirmingOrderIds().has(order._id)) return;
    if (!window.confirm('Xác nhận nghiệp vụ cho đơn này? Mốc thời gian do máy chủ ghi và không thể sửa hoặc xóa.')) return;

    this.setBusinessConfirmationLoading(order._id, true);
    this.service.confirmBusiness(order._id).subscribe({
      next: (confirmed) => {
        this.orders.update((rows) => rows.map((row) => row._id === order._id ? confirmed : row));
        this.setBusinessConfirmationLoading(order._id, false);
      },
      error: (error) => {
        this.error.set(error?.error?.message || 'Không thể xác nhận nghiệp vụ cho đơn');
        this.setBusinessConfirmationLoading(order._id, false);
      },
    });
  }

  private setBusinessConfirmationLoading(orderId: string, loading: boolean): void {
    this.confirmingOrderIds.update((ids) => {
      const next = new Set(ids);
      if (loading) next.add(orderId); else next.delete(orderId);
      return next;
    });
  }

  onInputUpdate(order: TestOrder2, field: keyof TestOrder2, event: Event): void {
    if (!this.canEditField(String(field))) return;

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
    if (this.currentUserRole() === 'internal_agent' || this.currentUserRole() === 'external_agent') {
      this.error.set('Đại lý không có quyền xóa đơn hàng');
      return;
    }
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
    this.selectedSupplier.set('all');
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
      case 'supplier':
        this.selectedSupplier.set(value);
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

  formatCurrency(value: number): string {
    if (!value && value !== 0) return '0';
    return new Intl.NumberFormat('vi-VN', { 
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(value);
  }

  downloadCSV(): void {
    const data = this.orders();
    if (data.length === 0) { alert('Không có dữ liệu để tải xuống'); return; }
    const headers = [
      'Ngày','Khách hàng','Sản phẩm','Số lượng','Đại lý','ID Nhóm QC','Kích hoạt','Chi tiết dịch vụ','Trạng thái sản xuất','Trạng thái vận đơn','Link nộp','Mã vận đơn','Đặt cọc','COD','Chi phí ship hàng','Chi phí hoàn hàng','Người nhận','SĐT nhận','Địa chỉ nhận'
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
      'Chi phí ship hàng': order.shippingFee || 0,
      'Chi phí hoàn hàng': order.returnFee || 0,
      'Người nhận': order.receiverName || '',
      'SĐT nhận': order.receiverPhone || '',
      'Địa chỉ nhận': order.receiverAddress || '',
    }));
    const csvContent = buildCsvFromObjects(headers, rows);
    downloadCsv(`don-hang-thu-nghiem-2-${new Date().toISOString().split('T')[0]}.csv`, csvContent, true);
  }

  downloadSupplierExcel(): void {
    const data = this.orders();
    if (data.length === 0) { alert('Không có dữ liệu để tải xuống'); return; }
    const headers = [
      'Ngày','Khách hàng','Sản phẩm','Số lượng','Nhà Cung Cấp','Báo giá nhà cung cấp','ID Nhóm QC','Kích hoạt','Chi tiết dịch vụ','Trạng thái sản xuất','Trạng thái vận đơn','Link nộp','Mã vận đơn','Đặt cọc','COD','Phí vận chuyển','Phí hoàn hàng','Người nhận','SĐT nhận','Địa chỉ nhận'
    ];
    const rows = data.map(order => ({
      'Ngày': this.formatDate(order.createdAt),
      'Khách hàng': order.customerName || '',
      'Sản phẩm': this.getNameById(order.productId, this.products()),
      'Số lượng': order.quantity || 0,
      'Nhà Cung Cấp': this.getSupplierName(order.supplierId),
      'Báo giá nhà cung cấp': order.supplierQuote || 0,
      'ID Nhóm QC': order.adGroupId || '',
      'Kích hoạt': order.isActive ? 'Có' : 'Không',
      'Chi tiết dịch vụ': order.serviceDetails || '',
      'Trạng thái sản xuất': order.productionStatus || '',
      'Trạng thái vận đơn': order.orderStatus || '',
      'Link nộp': order.submitLink || '',
      'Mã vận đơn': order.trackingNumber || '',
      'Đặt cọc': order.depositAmount || 0,
      'COD': order.codAmount || 0,
      'Phí vận chuyển': order.shippingFee || 0,
      'Phí hoàn hàng': order.returnFee || 0,
      'Người nhận': order.receiverName || '',
      'SĐT nhận': order.receiverPhone || '',
      'Địa chỉ nhận': order.receiverAddress || '',
    }));
    const csvContent = buildCsvFromObjects(headers, rows);
    downloadCsv(`bao-cao-nha-cung-cap-${new Date().toISOString().split('T')[0]}.csv`, csvContent, true);
  }

  downloadAgentExcel(): void {
    const data = this.orders();
    if (data.length === 0) { alert('Không có dữ liệu để tải xuống'); return; }
    const headers = [
      'Ngày','Khách hàng','Sản phẩm','Số lượng','Đại lý','Báo giá đại lý','ID Nhóm QC','Kích hoạt','Chi tiết dịch vụ','Trạng thái sản xuất','Trạng thái vận đơn','Link nộp','Mã vận đơn','Đặt cọc','COD','Phí vận chuyển','Phí hoàn hàng','Người nhận','SĐT nhận','Địa chỉ nhận'
    ];
    const rows = data.map(order => ({
      'Ngày': this.formatDate(order.createdAt),
      'Khách hàng': order.customerName || '',
      'Sản phẩm': this.getNameById(order.productId, this.products()),
      'Số lượng': order.quantity || 0,
      'Đại lý': this.getNameById(order.agentId, this.agents()),
      'Báo giá đại lý': order.agentQuote || 0,
      'ID Nhóm QC': order.adGroupId || '',
      'Kích hoạt': order.isActive ? 'Có' : 'Không',
      'Chi tiết dịch vụ': order.serviceDetails || '',
      'Trạng thái sản xuất': order.productionStatus || '',
      'Trạng thái vận đơn': order.orderStatus || '',
      'Link nộp': order.submitLink || '',
      'Mã vận đơn': order.trackingNumber || '',
      'Đặt cọc': order.depositAmount || 0,
      'COD': order.codAmount || 0,
      'Phí vận chuyển': order.shippingFee || 0,
      'Phí hoàn hàng': order.returnFee || 0,
      'Người nhận': order.receiverName || '',
      'SĐT nhận': order.receiverPhone || '',
      'Địa chỉ nhận': order.receiverAddress || '',
    }));
    const csvContent = buildCsvFromObjects(headers, rows);
    downloadCsv(`bao-cao-dai-ly-${new Date().toISOString().split('T')[0]}.csv`, csvContent, true);
  }

  getNameById(id: any, items: NamedItem[]): string {
    const itemId = this.getId(id);
    const item = items.find(i => i._id === itemId);
    return item?.name || itemId || '';
  }

  getSupplierName(supplierId: any): string {
    if (!supplierId) return '';
    const id = typeof supplierId === 'string' ? supplierId : (supplierId as any)?._id || '';
    const supplier = this.suppliers().find(s => s._id === id);
    return supplier?.fullName || id || '';
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
    return TestOrder2Component.EMPTY_STYLE;
  }

  // Cache for style calculations to improve performance
  private styleCache = new Map<string, Record<string, string>>();
  private productStyles = new Map<string, Record<string, string>>();
  private productionStyles = new Map<string, Record<string, string>>();
  private deliveryStyles = new Map<string, Record<string, string>>();
  private sourceOptionsCache = new Map<string, ReadonlyArray<{ value: string; label: string }>>();
  private productOptionStyles = new Map<string, Record<string, string>>();
  private productionOptionStyles = new Map<string, Record<string, string>>();
  private deliveryOptionStyles = new Map<string, Record<string, string>>();

  // Pre-compute all styles when data loads
  private precomputeStyles(): void {
    // Clear existing caches
    this.productStyles.clear();
    this.productionStyles.clear();
    this.deliveryStyles.clear();
    this.productOptionStyles.clear();
    this.productionOptionStyles.clear();
    this.deliveryOptionStyles.clear();
    
    // Pre-compute product styles
    this.products().forEach(product => {
      const style = this.calculateProductStyle(product._id);
      this.productStyles.set(product._id, style);
      this.productOptionStyles.set(product._id, this.toOptionStyle(style));
    });
    
    // Pre-compute production status styles
    this.productionStatuses().forEach(statusName => {
      const style = this.calculateStatusStyle('prod', statusName);
      this.productionStyles.set(statusName, style);
      this.productionOptionStyles.set(statusName, this.toOptionStyle(style));
    });
    
    // Pre-compute delivery status styles - using keys from deliveryStatusColors
    Object.keys(this.deliveryStatusColors()).forEach(statusName => {
      const style = this.calculateStatusStyle('del', statusName);
      this.deliveryStyles.set(statusName, style);
      this.deliveryOptionStyles.set(statusName, this.toOptionStyle(style));
    });
  }

  private rebuildSourceOptionsCache(): void {
    this.sourceOptionsCache.clear();

    for (const product of this.products()) {
      const options: Array<{ value: string; label: string }> = [
        { value: '', label: 'Chọn nhà cung cấp' }
      ];
      const ids = new Set<string>();

      if (product?.suppliers?.length) {
        for (const supplier of product.suppliers) {
          if (supplier?.supplierId) ids.add(supplier.supplierId);
        }
      }

      if (ids.size === 0) {
        this.suppliers().forEach(supplier => ids.add(supplier._id));
      }

      for (const id of ids) {
        options.push({ value: id, label: this.getSupplierName(id) });
      }

      this.sourceOptionsCache.set(product._id, options);
    }
  }

  private toOptionStyle(style: Record<string, string>): Record<string, string> {
    if (!style['background-color'] || !style['color']) {
      return TestOrder2Component.EMPTY_STYLE;
    }
    return {
      'background-color': style['background-color'],
      color: style['color'],
    };
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
    if (!name) return TestOrder2Component.EMPTY_STYLE;
    
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
    if (!id) return TestOrder2Component.EMPTY_STYLE;
    
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
    return this.productOptionStyles.get(productId) || TestOrder2Component.EMPTY_STYLE;
  }
  
  getStatusOptionStyle(kind: 'prod' | 'del', name?: string): Record<string, string> {
    if (!name) return TestOrder2Component.EMPTY_STYLE;
    const styleMap = kind === 'prod' ? this.productionOptionStyles : this.deliveryOptionStyles;
    return styleMap.get(name) || TestOrder2Component.EMPTY_STYLE;
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
}
