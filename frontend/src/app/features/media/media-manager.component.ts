import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MediaService, MediaItem } from './media.service';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../product/product.service';
import { FanpageService, Fanpage } from '../fanpage/fanpage.service';

@Component({
  selector: 'app-media-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './media-manager.component.html',
  styleUrls: ['./media-manager.component.css']
})
export class MediaManagerComponent {
  private media = inject(MediaService);
  auth = inject(AuthService);
  private productService = inject(ProductService);
  private fanpageService = inject(FanpageService);

  // Filters and state
  productId = '';
  fanpageId = '';
  tag = '';
  page = 1;
  limit = 30;
  items = signal<MediaItem[]>([]);
  total = signal(0);
  // selection
  selected = signal<Record<string, boolean>>({});
  anySelected = computed(() => Object.values(this.selected()).some(v => v));
  allOnPageSelected = computed(() => {
    const sel = this.selected();
    const ids = this.items().map(i => i._id);
    return ids.length > 0 && ids.every(id => sel[id]);
  });

  // Upload/import state
  file?: File;
  importUrl = '';
  alt = '';
  sourceType: 'gallery'|'feedback'|'ugc'|'marketing' = 'gallery';
  attachProductId = '';
  attachFanpageId = '';
  attaching = false;
  products = signal<{_id:string; name:string}[]>([]);
  fanpages = signal<Fanpage[]>([]);
  previewUrl = signal<string | null>(null);

  ngOnInit() {
    this.load();
    // Load dropdown data
    this.productService.getAll({ status: 'Hoạt động' }).subscribe(list => {
      const mapped = (list || []).map(p => ({ _id: (p as any)._id, name: (p as any).name }));
      this.products.set(mapped);
    });
    this.fanpageService.list().subscribe(list => this.fanpages.set(list || []));
  }

  load() {
    this.media.list({ productId: this.productId || undefined, fanpageId: this.fanpageId || undefined, tag: this.tag || undefined, page: this.page, limit: this.limit })
      .subscribe((res: { items: MediaItem[]; total: number }) => {
        this.items.set(res.items);
        this.total.set(res.total);
        // reset selection for current page
        const map: Record<string, boolean> = {};
        res.items.forEach(i => map[i._id] = false);
        this.selected.set(map);
      });
  }

  onFileChange(e: any) { this.file = e.target.files?.[0]; }

  upload() {
    if (!this.file) return;
    this.media.upload(this.file, { productId: this.productId || undefined, fanpageId: this.fanpageId || undefined, tags: this.tag || undefined, alt: this.alt || undefined, sourceType: this.sourceType })
      .subscribe(() => { this.file = undefined as any; (document.getElementById('fileInput') as HTMLInputElement).value=''; this.load(); });
  }

  importByUrl() {
    if (!this.importUrl) return;
    this.media.importByUrl(this.importUrl, { productId: this.productId || undefined, fanpageId: this.fanpageId || undefined, tags: this.tag || undefined, alt: this.alt || undefined, sourceType: this.sourceType })
      .subscribe(() => { this.importUrl = ''; this.load(); });
  }

  copyUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  remove(id: string) {
    if (!confirm('Xóa ảnh này?')) return;
    this.media.delete(id).subscribe(() => this.load());
  }

  toggleSelectAll(checked: boolean) {
    const map: Record<string, boolean> = { ...this.selected() };
    this.items().forEach(i => map[i._id] = checked);
    this.selected.set(map);
  }

  bulkDelete() {
    const ids = this.items().filter(i => this.selected()[i._id]).map(i => i._id);
    if (ids.length === 0) { alert('Hãy chọn ít nhất 1 ảnh để xóa.'); return; }
    if (!confirm(`Xóa ${ids.length} ảnh đã chọn?`)) return;
    this.media.bulkDelete(ids).subscribe({
      next: (res) => {
        const r = res.data;
        alert(`Đã xóa: ${r.deleted}\nLỗi: ${r.failed}${r.errors.length? `\nChi tiết: ${r.errors.join('\n')}`:''}`);
        this.load();
      },
      error: (err) => {
        alert('Lỗi xóa hàng loạt: ' + (err?.error?.message || err.message));
      }
    })
  }

  attachVisibleToVariation() {
    if (!this.attachProductId || !this.attachFanpageId) return;
    const urls = this.items().filter(i => this.selected()[i._id]).map((i: MediaItem) => i.url);
    if (urls.length === 0) { alert('Hãy chọn ít nhất 1 ảnh để gắn.'); return; }
    this.attaching = true;
    this.media.setProductVariationImages(this.attachProductId, this.attachFanpageId, urls)
      .subscribe({
        next: () => { this.attaching = false; alert('Đã gắn ảnh vào variation'); },
        error: () => { this.attaching = false; }
      });
  }

  // Pagination helpers (avoid using Math in template)
  decPage() {
    this.page = Math.max(1, this.page - 1);
    this.load();
  }

  incPage() {
    this.page = this.page + 1;
    this.load();
  }

  openPreview(url: string) { this.previewUrl.set(url); }
  closePreview() { this.previewUrl.set(null); }

  onSelectChange(id: string, checked: boolean) {
    const cur = this.selected();
    this.selected.set({ ...cur, [id]: checked });
  }

  onImgError(ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (img) img.style.opacity = '0.2';
  }
}
