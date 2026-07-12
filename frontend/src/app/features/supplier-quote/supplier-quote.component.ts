import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../product/product.service';
import { SupplierService, Supplier } from '../supplier/supplier.service';
import { SupplierQuoteApi, SupplierQuote } from './supplier-quote.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-supplier-quote',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './supplier-quote.component.html',
  styleUrls: ['./supplier-quote.component.css']
})
export class SupplierQuoteComponent implements OnInit {
  products = signal<Array<{ _id: string; name: string }>>([]);
  suppliers = signal<Supplier[]>([]);
  quotes = signal<SupplierQuote[]>([]);

  selectedProduct = signal<string>('');
  selectedSupplier = signal<string>('');
  price = signal<number>(0);
  currency = signal<string>('VND');
  isReturnableOverride = signal<string>('returnable');
  shippingFee = signal<number>(0);
  returnFee = signal<number>(0);
  effectiveAt = signal<string>('');
  note = signal<string>('');

  filterProduct = signal<string>('');
  filterSupplier = signal<string>('');
  filterApprovalStatus = signal<'' | 'pending' | 'approved' | 'rejected'>('');

  isSubmitting = signal(false);
  actionQuoteId = signal<string | null>(null);
  error = signal<string | null>(null);

  constructor(
    private productService: ProductService,
    private supplierService: SupplierService,
    private api: SupplierQuoteApi,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadDropdowns();
    this.refresh();
  }

  loadDropdowns(): void {
    this.productService.getAll().subscribe({
      next: (items: any[]) => this.products.set(items.map(it => ({ _id: it._id, name: it.name }))),
      error: (e) => console.error(e)
    });
    this.supplierService.list({ active: true, minimal: true }).subscribe({
      next: (items) => this.suppliers.set(items),
      error: (e) => console.error(e)
    });
  }

  refresh(): void {
    this.api.list({
      productId: this.filterProduct() || undefined,
      supplierId: this.filterSupplier() || undefined,
      approvalStatus: this.filterApprovalStatus() || undefined,
      limit: 100,
    }).subscribe({
      next: (res) => this.quotes.set(res.data || []),
      error: (e) => { console.error(e); this.error.set('Không thể tải báo giá'); }
    });
  }

  submit(): void {
    if (!this.selectedProduct() || !this.selectedSupplier() || this.price() <= 0) {
      this.error.set('Chọn sản phẩm, nhà cung cấp và giá');
      return;
    }
    this.isSubmitting.set(true);
    this.error.set(null);
    this.api.create({
      productId: this.selectedProduct(),
      supplierId: this.selectedSupplier(),
      price: this.price(),
      currency: this.currency(),
      isReturnableOverride: this.isReturnableOverride() === 'returnable',
      shippingFee: this.shippingFee() || 0,
      returnFee: this.returnFee() || 0,
      effectiveAt: this.effectiveAt() || undefined,
      note: this.note() || undefined,
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.note.set('');
        this.shippingFee.set(0);
        this.returnFee.set(0);
        this.refresh();
      },
      error: (e) => {
        this.isSubmitting.set(false);
        this.error.set('Không thể lưu báo giá');
        console.error(e);
      }
    });
  }

  supplierName(id: string): string {
    const s = this.suppliers().find(x => x._id === id);
    return s?.fullName || id;
  }

  productName(id: string): string {
    const p = this.products().find(x => x._id === id);
    return p?.name || id;
  }

  canApprove(): boolean {
    return this.authService.hasPermission('supplier-quotes.approve');
  }

  hasTrustedProvenance(quote: SupplierQuote): boolean {
    return quote.provenanceComplete === true
      || (!!quote.createdBy && !!quote.lastCommercialEditedBy);
  }

  isMakerOrEditor(quote: SupplierQuote): boolean {
    const userId = this.authService.user()?.id;
    return !!userId && (userId === quote.createdBy || userId === quote.lastCommercialEditedBy);
  }

  canDecideQuote(quote: SupplierQuote): boolean {
    return this.canApprove() && this.hasTrustedProvenance(quote) && !this.isMakerOrEditor(quote);
  }

  decisionBlockReason(quote: SupplierQuote): string {
    if (!this.hasTrustedProvenance(quote)) {
      return 'Báo giá cũ thiếu provenance: một người cần nhận bàn giao, sau đó người khác duyệt.';
    }
    if (this.isMakerOrEditor(quote)) {
      return 'Người tạo/chỉnh điều khoản gần nhất không được tự duyệt hoặc từ chối.';
    }
    return '';
  }

  approvalStatus(quote: SupplierQuote): 'pending' | 'approved' | 'rejected' {
    return quote.approvalStatus === 'approved' || quote.approvalStatus === 'rejected'
      ? quote.approvalStatus
      : 'pending';
  }

  approvalLabel(quote: SupplierQuote): string {
    const labels = {
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Từ chối',
    } as const;
    return labels[this.approvalStatus(quote)];
  }

  lastDecisionActor(quote: SupplierQuote): string {
    const history = quote.approvalHistory || [];
    return history.length ? history[history.length - 1].actorLabel || '' : '';
  }

  approveQuote(quote: SupplierQuote): void {
    if (!quote._id || !this.canDecideQuote(quote) || this.actionQuoteId()) return;
    if (!confirm('Duyệt báo giá này để cho phép sử dụng trong nghiệp vụ?')) return;
    this.actionQuoteId.set(quote._id);
    this.error.set(null);
    this.api.approve(quote._id).subscribe({
      next: (updated) => {
        this.replaceQuote(updated);
        this.actionQuoteId.set(null);
      },
      error: (e) => {
        this.error.set(e?.error?.message || 'Không thể duyệt báo giá');
        this.actionQuoteId.set(null);
      },
    });
  }

  rejectQuote(quote: SupplierQuote): void {
    if (!quote._id || !this.canDecideQuote(quote) || this.actionQuoteId()) return;
    const reason = window.prompt('Nhập lý do từ chối báo giá:')?.trim();
    if (!reason) return;
    this.actionQuoteId.set(quote._id);
    this.error.set(null);
    this.api.reject(quote._id, reason).subscribe({
      next: (updated) => {
        this.replaceQuote(updated);
        this.actionQuoteId.set(null);
      },
      error: (e) => {
        this.error.set(e?.error?.message || 'Không thể từ chối báo giá');
        this.actionQuoteId.set(null);
      },
    });
  }

  claimProvenance(quote: SupplierQuote): void {
    if (!quote._id || this.hasTrustedProvenance(quote) || this.actionQuoteId()) return;
    if (!confirm('Nhận bàn giao provenance cho báo giá cũ? Sau thao tác này phải có người khác duyệt.')) return;
    this.actionQuoteId.set(quote._id);
    this.error.set(null);
    this.api.claimProvenance(quote._id).subscribe({
      next: (updated) => {
        this.replaceQuote(updated);
        this.actionQuoteId.set(null);
      },
      error: (e) => {
        this.error.set(e?.error?.message || 'Không thể nhận bàn giao provenance');
        this.actionQuoteId.set(null);
      },
    });
  }

  private replaceQuote(updated: SupplierQuote): void {
    this.quotes.update((items) => items.map((item) => item._id === updated._id ? updated : item));
  }
}
