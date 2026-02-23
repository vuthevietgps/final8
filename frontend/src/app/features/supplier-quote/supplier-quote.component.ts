import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../product/product.service';
import { SupplierService, Supplier } from '../supplier/supplier.service';
import { SupplierQuoteApi, SupplierQuote } from './supplier-quote.service';

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

  isSubmitting = signal(false);
  error = signal<string | null>(null);

  constructor(
    private productService: ProductService,
    private supplierService: SupplierService,
    private api: SupplierQuoteApi,
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
    this.api.list({ productId: this.filterProduct() || undefined, supplierId: this.filterSupplier() || undefined, limit: 100 }).subscribe({
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
}
