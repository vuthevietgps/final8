import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ProductService } from '../product/product.service';
import {
  AdsBusinessContextApi,
  BusinessDailyNoteContext,
  BusinessDailyNotePayload,
  BusinessNoteSource,
  LandingPageContext,
  LandingPagePayload,
} from './ads-business-context.service';

@Component({
  selector: 'app-ads-business-context',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ads-business-context.component.html',
  styleUrls: ['./ads-business-context.component.css'],
})
export class AdsBusinessContextComponent implements OnInit {
  products = signal<Array<{ _id: string; name: string }>>([]);
  landingPages = signal<LandingPageContext[]>([]);
  dailyNotes = signal<BusinessDailyNoteContext[]>([]);
  loading = signal(false);
  saving = signal(false);
  actionId = signal<string | null>(null);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  landingEditId = '';
  landingUrl = '';
  landingProductId = '';
  landingTitle = '';
  landingMainCta = '';
  landingNotes = '';
  landingLastCheckedAt = '';

  noteEditId = '';
  noteDate = new Date().toISOString().slice(0, 10);
  noteSummary = '';
  noteNotes = '';
  noteAnomalies = '';
  noteSource: BusinessNoteSource = 'manual';
  noteSeverity: 'info' | 'warning' | 'critical' = 'info';
  affectedCustomerId = '';
  affectedCampaignId = '';
  affectedAdGroupId = '';
  affectedProductId = '';

  readonly noteSources: BusinessNoteSource[] = ['manual', 'ads', 'finance', 'operations', 'supply'];

  constructor(
    private readonly api: AdsBusinessContextApi,
    private readonly productService: ProductService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.productService.getAll().subscribe({
      next: (rows: any[]) => this.products.set(rows.map((row) => ({ _id: row._id, name: row.name }))),
      error: () => this.error.set('Không thể tải danh sách sản phẩm.'),
    });
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.error.set(null);
    let pending = 2;
    const done = () => {
      pending -= 1;
      if (pending === 0) this.loading.set(false);
    };
    this.api.listLandingPages().subscribe({
      next: (result) => { this.landingPages.set(result.data || []); done(); },
      error: (error) => { this.error.set(this.message(error, 'Không thể tải landing page.')); done(); },
    });
    this.api.listDailyNotes().subscribe({
      next: (result) => { this.dailyNotes.set(result.data || []); done(); },
      error: (error) => { this.error.set(this.message(error, 'Không thể tải business notes.')); done(); },
    });
  }

  canWrite(): boolean {
    return this.authService.hasPermission('google-ads.plan');
  }

  canApprove(): boolean {
    return this.authService.hasPermission('google-ads.approve');
  }

  saveLandingPage(): void {
    if (!this.canWrite() || !this.landingUrl.trim() || !this.landingProductId) {
      this.error.set('URL và sản phẩm là bắt buộc.');
      return;
    }
    const payload: LandingPagePayload = {
      url: this.landingUrl.trim(),
      productId: this.landingProductId,
      title: optional(this.landingTitle),
      mainCta: optional(this.landingMainCta),
      notes: optional(this.landingNotes),
      lastCheckedAt: this.landingLastCheckedAt ? new Date(this.landingLastCheckedAt).toISOString() : undefined,
    };
    this.saving.set(true);
    this.error.set(null);
    const request = this.landingEditId
      ? this.api.updateLandingPage(this.landingEditId, payload)
      : this.api.createLandingPage(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(this.landingEditId ? 'Đã cập nhật landing page; thay đổi thương mại sẽ reset duyệt.' : 'Đã tạo landing page chờ duyệt.');
        this.resetLandingForm();
        this.refresh();
      },
      error: (error) => { this.saving.set(false); this.error.set(this.message(error, 'Không thể lưu landing page.')); },
    });
  }

  editLandingPage(page: LandingPageContext): void {
    if (!this.canWrite()) return;
    this.landingEditId = page._id;
    this.landingUrl = page.url;
    this.landingProductId = entityId(page.productId);
    this.landingTitle = page.title || '';
    this.landingMainCta = page.mainCta || '';
    this.landingNotes = page.notes || '';
    this.landingLastCheckedAt = toLocalInput(page.lastCheckedAt);
  }

  approveLandingPage(page: LandingPageContext): void {
    if (!this.canApprove() || this.actionId()) return;
    if (!confirm(`Duyệt landing page ${page.domain} cho quảng cáo?`)) return;
    this.runLandingAction(page._id, this.api.approveLandingPage(page._id), 'Đã duyệt landing page.');
  }

  rejectLandingPage(page: LandingPageContext): void {
    if (!this.canApprove() || this.actionId()) return;
    const reason = prompt('Lý do từ chối landing page:')?.trim();
    if (!reason) return;
    this.runLandingAction(page._id, this.api.rejectLandingPage(page._id, reason), 'Đã từ chối landing page.');
  }

  saveDailyNote(): void {
    if (!this.canWrite() || !this.noteDate || !this.noteSummary.trim()) {
      this.error.set('Ngày và tóm tắt business note là bắt buộc.');
      return;
    }
    const payload: BusinessDailyNotePayload = {
      date: this.noteDate,
      summary: this.noteSummary.trim(),
      notes: optional(this.noteNotes),
      anomalies: this.noteAnomalies.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      source: this.noteSource,
      severity: this.noteSeverity,
      affectedCustomerId: optional(this.affectedCustomerId),
      affectedCampaignId: optional(this.affectedCampaignId),
      affectedAdGroupId: optional(this.affectedAdGroupId),
      affectedProductId: optional(this.affectedProductId),
    };
    this.saving.set(true);
    this.error.set(null);
    const request = this.noteEditId
      ? this.api.updateDailyNote(this.noteEditId, payload)
      : this.api.createDailyNote(payload);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(this.noteEditId ? 'Đã cập nhật business note.' : 'Đã tạo business note.');
        this.resetNoteForm();
        this.refresh();
      },
      error: (error) => { this.saving.set(false); this.error.set(this.message(error, 'Không thể lưu business note.')); },
    });
  }

  editDailyNote(note: BusinessDailyNoteContext): void {
    if (!this.canWrite()) return;
    this.noteEditId = note._id;
    this.noteDate = note.date;
    this.noteSummary = note.summary;
    this.noteNotes = note.notes || '';
    this.noteAnomalies = (note.anomalies || []).join('\n');
    this.noteSource = note.source;
    this.noteSeverity = note.severity;
    this.affectedCustomerId = note.affectedCustomerId || '';
    this.affectedCampaignId = note.affectedCampaignId || '';
    this.affectedAdGroupId = note.affectedAdGroupId || '';
    this.affectedProductId = entityId(note.affectedProductId);
  }

  resetLandingForm(): void {
    this.landingEditId = '';
    this.landingUrl = '';
    this.landingProductId = '';
    this.landingTitle = '';
    this.landingMainCta = '';
    this.landingNotes = '';
    this.landingLastCheckedAt = '';
  }

  resetNoteForm(): void {
    this.noteEditId = '';
    this.noteDate = new Date().toISOString().slice(0, 10);
    this.noteSummary = '';
    this.noteNotes = '';
    this.noteAnomalies = '';
    this.noteSource = 'manual';
    this.noteSeverity = 'info';
    this.affectedCustomerId = '';
    this.affectedCampaignId = '';
    this.affectedAdGroupId = '';
    this.affectedProductId = '';
  }

  productName(value: LandingPageContext['productId'] | BusinessDailyNoteContext['affectedProductId']): string {
    const id = entityId(value);
    return this.products().find((product) => product._id === id)?.name || id || '—';
  }

  private runLandingAction(id: string, request: any, success: string): void {
    this.actionId.set(id);
    this.error.set(null);
    request.subscribe({
      next: () => { this.actionId.set(null); this.success.set(success); this.refresh(); },
      error: (error: any) => { this.actionId.set(null); this.error.set(this.message(error, 'Không thể cập nhật trạng thái landing page.')); },
    });
  }

  private message(error: any, fallback: string): string {
    const value = error?.error?.message;
    return Array.isArray(value) ? value.join('; ') : value || fallback;
  }
}

function optional(value: string): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function entityId(value: any): string {
  return typeof value === 'string' ? value : String(value?._id || '');
}

function toLocalInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
