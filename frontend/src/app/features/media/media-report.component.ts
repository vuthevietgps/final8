import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type ReportItem = { _id: string; name: string; fanpageId: string; fanpageName?: string; customImages: string[]; customImagesCount: number };
type ReportResponse = { success: boolean; data: { items: ReportItem[]; total: number; page: number; limit: number; totalPages: number } };

@Component({
  selector: 'app-media-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="media-report">
    <h2>📊 Báo cáo ảnh sản phẩm theo Fanpage</h2>
    <div class="filters">
      <input [(ngModel)]="search" placeholder="Tìm theo tên sản phẩm" />
      <input [(ngModel)]="fanpageId" placeholder="Fanpage ID" />
      <button (click)="load()">🔍 Lọc</button>
    </div>
    
    <div class="action-buttons">
      <button (click)="syncMediaFiles()" [disabled]="loading()" class="btn-sync">
        {{loading() ? '⏳ Đang đồng bộ...' : '🔄 Đồng bộ ảnh'}}
      </button>
      <button (click)="load()" [disabled]="loading()" class="btn-refresh">
        {{loading() ? '⏳ Đang tải...' : '� Làm mới báo cáo'}}
      </button>
    </div>

    <div class="sync-results" *ngIf="syncResult()">
      <h3>🎉 Kết quả đồng bộ hoàn chỉnh:</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <strong>📁 Tổng files:</strong> {{syncResult()?.summary?.totalFiles || 0}}
        </div>
        <div class="stat-item">
          <strong>🗄️ Media records:</strong> {{syncResult()?.summary?.totalMediaRecords || 0}}
        </div>
        <div class="stat-item added">
          <strong>📦 Product refs:</strong> {{syncResult()?.summary?.totalProductReferences || 0}}
        </div>
        <div class="stat-item" [class.valid]="syncResult()?.summary?.syncedSuccessfully" [class.invalid]="!syncResult()?.summary?.syncedSuccessfully">
          <strong>✅ Trạng thái:</strong> {{syncResult()?.summary?.syncedSuccessfully ? 'Thành công' : 'Có lỗi'}}
        </div>
      </div>
      
      <div class="phase-details" *ngIf="syncResult()?.phase1">
        <h4>📋 Chi tiết các giai đoạn:</h4>
        <ul>
          <li><strong>Phase 1 (Files→DB):</strong> Tìm {{syncResult().phase1.filesFound}} files, tạo {{syncResult().phase1.mediaRecordsCreated}} records</li>
          <li><strong>Phase 2 (DB→Products):</strong> Giữ {{syncResult().phase2.validReferences}} refs, xóa {{syncResult().phase2.invalidReferencesRemoved}} refs</li>
          <li><strong>Phase 3 (Cleanup):</strong> Xóa {{syncResult().phase3.orphanedFilesRemoved}} files, {{syncResult().phase3.orphanedRecordsRemoved}} records</li>
        </ul>
      </div>
    </div>

    <div class="validation-results" *ngIf="validationReport()">
      <h3>📋 Báo cáo kiểm tra:</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <strong>Tổng sản phẩm:</strong> {{validationReport()?.totalProducts}}
        </div>
        <div class="stat-item valid">
          <strong>Ảnh hợp lệ:</strong> {{(validationReport()?.validMainImages || 0) + (validationReport()?.validFanpageImages || 0)}}
        </div>
        <div class="stat-item invalid">
          <strong>Ảnh lỗi:</strong> {{(validationReport()?.invalidMainImages || 0) + (validationReport()?.invalidFanpageImages || 0)}}
        </div>
      </div>
      
      <div class="invalid-images" *ngIf="validationReport()?.invalidImagesList?.length">
        <h4>🚨 Ảnh lỗi cần xử lý:</h4>
        <div class="invalid-list">
          <div *ngFor="let img of validationReport()?.invalidImagesList?.slice(0, 10)" class="invalid-item">
            <span class="product-name">{{img.productName}}</span>
            <span class="image-type">{{img.imageType === 'main' ? 'Ảnh chính' : 'Ảnh fanpage'}}</span>
            <span class="image-url">{{img.imageUrl}}</span>
          </div>
          <div *ngIf="validationReport()?.invalidImagesList?.length > 10">
            ...và {{validationReport()?.invalidImagesList?.length - 10}} ảnh khác
          </div>
        </div>
      </div>
    </div>

    <div class="cleanup-results" *ngIf="cleanupResults()">
      <h3>✅ Kết quả làm sạch:</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <strong>Sản phẩm đã cập nhật:</strong> {{cleanupResults()?.productsUpdated}}
        </div>
        <div class="stat-item">
          <strong>Ảnh lỗi đã xóa:</strong> {{cleanupResults()?.invalidImagesRemoved}}
        </div>
        <div class="stat-item">
          <strong>Ảnh đã kiểm tra:</strong> {{(cleanupResults()?.mainImagesChecked || 0) + (cleanupResults()?.fanpageVariationsChecked || 0)}}
        </div>
      </div>
    </div>
    <table class="table">
      <thead>
        <tr>
          <th>Sản phẩm</th>
          <th>Fanpage</th>
          <th>Số ảnh</th>
          <th>Links</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let r of items()">
          <td>{{r.name}} ({{r._id}})</td>
          <td>{{r.fanpageName || r.fanpageId}}</td>
          <td>{{r.customImagesCount}}</td>
          <td>
            <div class="links">
              <a *ngFor="let u of r.customImages" [href]="u" target="_blank">{{u}}</a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="pagination" *ngIf="total() > items().length">
      <button (click)="dec()">«</button>
      <span>Trang {{page}}</span>
      <button (click)="inc()">»</button>
    </div>
  </div>
  `,
  styles: [`
  .media-report { padding: 16px; }
  .filters { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .filters input { padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; }
  .table { width: 100%; border-collapse: collapse; }
  .table th, .table td { border: 1px solid #eee; padding: 8px; text-align: left; vertical-align: top; }
  .links { display: flex; gap: 6px; flex-wrap: wrap; }
  .pagination { display: flex; gap: 8px; justify-content: center; padding: 12px; }
  
  /* Action buttons */
  .action-buttons { 
    display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; 
    padding: 12px; background: #f8f9fa; border-radius: 8px; 
  }
  .btn-sync { background: #007bff; color: white; }
  .btn-refresh { background: #6c757d; color: white; }
  .action-buttons button {
    padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer;
    font-weight: 500; transition: opacity 0.2s;
  }
  .action-buttons button:hover:not(:disabled) { opacity: 0.9; }
  .action-buttons button:disabled { opacity: 0.6; cursor: not-allowed; }
  
  /* Results sections */
  .validation-results, .cleanup-results, .sync-results {
    background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px;
    padding: 16px; margin: 16px 0;
  }
  .validation-results h3, .cleanup-results h3 { margin: 0 0 12px 0; color: #495057; }
  
  .stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px; margin-bottom: 16px;
  }
  .stat-item {
    padding: 12px; background: white; border-radius: 6px; border: 1px solid #e9ecef;
  }
  .stat-item.valid { border-left: 4px solid #28a745; }
  .stat-item.invalid { border-left: 4px solid #dc3545; }
  .stat-item.added { border-left: 4px solid #17a2b8; }
  .stat-item.removed { border-left: 4px solid #fd7e14; }
  .sync-message { margin-top: 12px; font-weight: 500; color: #155724; }
  
  .phase-details {
    margin-top: 16px; padding: 12px; background: white; border-radius: 6px;
    border-left: 4px solid #17a2b8;
  }
  .phase-details h4 { margin: 0 0 8px 0; color: #495057; }
  .phase-details ul { margin: 0; padding-left: 20px; }
  .phase-details li { margin-bottom: 4px; }
  
  .invalid-images h4 { margin: 16px 0 8px 0; color: #dc3545; }
  .invalid-list { max-height: 300px; overflow-y: auto; }
  .invalid-item {
    display: grid; grid-template-columns: 2fr 1fr 3fr; gap: 8px;
    padding: 8px; margin-bottom: 4px; background: #fff3cd; border-radius: 4px;
    border-left: 3px solid #ffc107; font-size: 0.9em;
  }
  .product-name { font-weight: 500; }
  .image-type { color: #6c757d; font-style: italic; }
  .image-url { font-family: monospace; word-break: break-all; color: #dc3545; }
  `]
})
export class MediaReportComponent {
  private http = inject(HttpClient);
  private base = environment.apiUrl || '/api';

  items = signal<ReportItem[]>([]);
  total = signal(0);
  loading = signal(false);
  validationReport = signal<any>(null);
  cleanupResults = signal<any>(null);
  syncResult = signal<any>(null);
  
  page = 1;
  limit = 20;
  search = '';
  fanpageId = '';

  ngOnInit() { this.load(); }

  load() {
    const params = new URLSearchParams();
    if (this.search) params.set('search', this.search);
    if (this.fanpageId) params.set('fanpageId', this.fanpageId);
    params.set('page', String(this.page));
    params.set('limit', String(this.limit));
    this.http.get<ReportResponse>(`${this.base}/products/variation-images-report?${params.toString()}`)
      .subscribe(res => {
        this.items.set(res.data.items);
        this.total.set(res.data.total);
      });
  }

  dec() { this.page = Math.max(1, this.page - 1); this.load(); }
  inc() { this.page = this.page + 1; this.load(); }

  /**
   * 🔍 Validate images - check for broken/missing images
   */
  validateImages() {
    this.loading.set(true);
    this.validationReport.set(null);
    
    const params = new URLSearchParams();
    if (this.fanpageId) params.set('fanpageId', this.fanpageId);
    
    this.http.get<any>(`${this.base}/products/validate-images-report?${params.toString()}`)
      .subscribe({
        next: (res) => {
          this.validationReport.set(res.data);
          this.loading.set(false);
          console.log('🔍 Validation report:', res.data);
        },
        error: (err) => {
          console.error('Validation failed:', err);
          alert('Lỗi kiểm tra ảnh: ' + (err.error?.message || err.message));
          this.loading.set(false);
        }
      });
  }

  /**
   * 🧹 Cleanup images - remove references to missing/broken images
   */
  cleanupImages() {
    if (!confirm('Bạn có chắc muốn làm sạch và xóa tất cả ảnh lỗi? Hành động này không thể hoàn tác.')) {
      return;
    }
    
    this.loading.set(true);
    this.cleanupResults.set(null);
    
    this.http.post<any>(`${this.base}/products/cleanup-images`, {})
      .subscribe({
        next: (res) => {
          this.cleanupResults.set(res.data);
          this.loading.set(false);
          console.log('🧹 Cleanup results:', res.data);
          alert(`✅ Làm sạch thành công! Đã cập nhật ${res.data.productsUpdated} sản phẩm, xóa ${res.data.invalidImagesRemoved} ảnh lỗi.`);
          
          // Refresh the report
          this.load();
          if (this.validationReport()) {
            this.validateImages();
          }
        },
        error: (err) => {
          console.error('Cleanup failed:', err);
          alert('Lỗi làm sạch: ' + (err.error?.message || err.message));
          this.loading.set(false);
        }
      });
  }

  /**
   * 🔄 Reset fanpage images - remove all or invalid images for specific fanpage
   */
  resetFanpageImages() {
    const fanpageFilter = this.fanpageId ? ` cho fanpage ${this.fanpageId}` : ' cho tất cả fanpage';
    if (!confirm(`Bạn có chắc muốn reset ảnh fanpage${fanpageFilter}? Sẽ chỉ xóa ảnh lỗi.`)) {
      return;
    }
    
    this.loading.set(true);
    
    const body: any = { removeInvalidOnly: true };
    if (this.fanpageId) body.fanpageId = this.fanpageId;
    
    this.http.post<any>(`${this.base}/products/reset-fanpage-images`, body)
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          console.log('🔄 Reset results:', res.data);
          alert(`✅ Reset thành công! Đã xóa ${res.data.totalImagesRemoved} ảnh lỗi từ ${res.data.variationsUpdated} variations.`);
          
          // Refresh the report
          this.load();
          if (this.validationReport()) {
            this.validateImages();
          }
        },
        error: (err) => {
          console.error('Reset failed:', err);
          alert('Lỗi reset: ' + (err.error?.message || err.message));
          this.loading.set(false);
        }
      });
  }
  
  syncMediaFiles() {
    console.log('syncMediaFiles called');
    this.loading.set(true);
    this.syncResult.set(null);
    
    console.log('Making request to:', `${this.base}/media/master-sync`);
    this.http.post(`${this.base}/media/master-sync`, {})
      .subscribe({
        next: (result: any) => {
          console.log('Master sync success:', result);
          this.syncResult.set(result.data);
          this.loading.set(false);
          
          const data = result.data;
          const summary = data?.summary || {};
          const phaseErrors = [
            ...(data?.phase1?.errors || []),
            ...(data?.phase2?.errors || []),
            ...(data?.phase3?.errors || []),
          ].filter(Boolean);

          if (summary.syncedSuccessfully) {
            alert(
              `Dong bo anh thanh cong.\n` +
              `Files: ${summary.totalFiles || 0}\n` +
              `Media records: ${summary.totalMediaRecords || 0}\n` +
              `Product refs: ${summary.totalProductReferences || 0}`
            );
          } else {
            alert(
              `Dong bo anh hoan tat nhung con loi.\n` +
              `${phaseErrors.join('\n') || 'Khong co chi tiet loi.'}`
            );
          }

          // Tá»± Ä‘á»™ng refresh láº¡i bÃ¡o cÃ¡o sau khi sync
          setTimeout(() => this.load(), 1000);
          return;
          alert(`🧹 Làm sạch tự động thành công!
� Sản phẩm đã kiểm tra: ${data.totalProducts || 0}
�️ Ảnh không hợp lệ đã xóa: ${data.invalidImages || 0}
✨ Sản phẩm đã cập nhật: ${data.cleanedProducts || 0}`);
          
          // Tự động refresh lại báo cáo sau khi sync
          setTimeout(() => this.load(), 1000);
        },
        error: (err) => {
          console.error('Sync failed:', err);
          this.loading.set(false);
          alert('Lỗi khi đồng bộ: ' + (err.error?.message || err.message));
        }
      });
  }
}
