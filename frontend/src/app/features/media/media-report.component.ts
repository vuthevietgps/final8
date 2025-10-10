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
      <button (click)="load()">Lọc</button>
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
  `]
})
export class MediaReportComponent {
  private http = inject(HttpClient);
  private base = environment.apiUrl || '/api';

  items = signal<ReportItem[]>([]);
  total = signal(0);
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
}
