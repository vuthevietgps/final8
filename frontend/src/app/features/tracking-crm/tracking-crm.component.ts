import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tracking-crm', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tracking-crm.component.html',
  styleUrl: './tracking-crm.component.css',
})
export class TrackingCrmComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private requestNumber = 0;
  private optionsRequest?: Promise<void>;
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/tracking-crm`;
  rows: any[] = [];
  options: any = { agents: [], suppliers: [], products: [], ads: [], sources: [] };
  selected: any; form: any = {}; preview: any;
  search = ''; typeFilter = ''; conversionFilter = ''; orderFilter = ''; orderId = '';
  busy = false; loading = true; dirty = false; error = ''; message = '';
  labels: Record<string, string> = { noted: 'Đang tư vấn', confirmed: 'Đã đối chiếu', cancelled: 'Đã hủy' };
  events: Record<string, string> = { phone: 'Bấm gọi điện', zalo: 'Bấm Zalo', inbox: 'Bấm Messenger', form_submit: 'Gửi form', page_view: 'Xem trang', contact: 'Liên hệ', heartbeat: 'Ở lại trang', scroll: 'Cuộn trang' };
  filters: Record<string, string> = { provider: 'google', ip: '', from: '', to: '', landing: '', account: '',
    campaign: '', adGroup: '', sourceId: '', agentId: '', categoryId: '', productId: '', status: '', timeField: 'visit', confidence: '', followUp: '', contactChannel: '' };
  total = 0; page = 1; pageSize = 25; historyLoading = false; optionsLoading = false;
  get pages() { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  categories: any[] = [];
  advancedFilters = false;
  orderFields = false;
  get extraFilterCount() { return ['ip', 'account', 'campaign', 'adGroup', 'sourceId', 'agentId', 'categoryId', 'productId', 'confidence', 'followUp', 'contactChannel'].filter(key => !!this.filters[key]).length; }
  async quickView(view: string) {
    this.typeFilter = view === 'conversions' ? 'conversion' : '';
    this.orderFilter = view === 'official' ? 'created' : view === 'followup' ? 'pending' : '';
    this.filters['status'] = view === 'new' ? 'new' : '';
    this.filters['followUp'] = view === 'followup' ? 'due' : '';
    await this.applyFilters();
  }
  toLocalInput(value: string) { return value ? new Date(new Date(value).getTime() + 7 * 3600000).toISOString().slice(0, 16) : ''; }
  async conversionChoices() {
    const selected = this.selected;
    if (selected.events || this.historyLoading) return;
    this.historyLoading = true;
    try { const events = await firstValueFrom(this.http.get<any[]>(`${this.base}/visits/${selected.visitId}/events`));
      if (this.selected === selected) selected.events = events;
    } catch (error) { this.fail(error); }
    finally { this.historyLoading = false; this.cdr.markForCheck(); }
  }
  get contactEvents() { return (this.selected?.events || []).filter((event: any) => ['phone', 'zalo', 'inbox', 'contact', 'form_submit'].includes(event.eventType)); }

  trackVisit(_: number, row: any) { return row.visitId; }
  async applyFilters() { this.page = 1; await this.reload(); }
  async resetFilters() { this.filters = Object.fromEntries(Object.keys(this.filters).map(key => [key, ''])); this.filters['timeField'] = 'visit'; this.search = ''; this.typeFilter = ''; this.conversionFilter = ''; this.orderFilter = ''; await this.applyFilters(); }
  async changePage(delta: number) { this.page += delta; await this.reload(); }
  money(value: any) { return value == null ? 'Chưa có' : Number(value).toLocaleString('vi-VN') + ' đ'; }
  conversionLabel(types: string[] = []) {
    const labels: Record<string, string> = { zalo: 'Zalo', phone: 'Số điện thoại', inbox: 'Messenger', form_submit: 'Gửi form', contact: 'Liên hệ' };
    return types.map(type => labels[type] || type).join(' · ');
  }
  changed() { this.dirty = true; this.preview = null; this.message = ''; }
  ngOnInit() { void this.reload(); void this.loadOptions(); }
  private loadOptions() {
    if (this.optionsRequest) return this.optionsRequest;
    this.optionsLoading = true;
    this.optionsRequest = firstValueFrom(this.http.get<any>(this.base + '/options')).then(options => { this.options = options; this.categories = [...new Map(options.products.filter((p: any) => p.categoryId?._id).map((p: any) => [p.categoryId._id, p.categoryId])).values()]; })
      .catch(error => { this.optionsRequest = undefined; this.fail(error); })
      .finally(() => { this.optionsLoading = false; this.cdr.markForCheck(); });
    return this.optionsRequest;
  }
  async reload() {
    const request = ++this.requestNumber;
    this.loading = true;
    const values = { ...this.filters, search: this.search, type: this.typeFilter, conversion: this.conversionFilter,
      order: this.orderFilter, page: String(this.page), pageSize: String(this.pageSize) };
    const params = Object.fromEntries(Object.entries(values).filter(([, value]) => !!value));
    try {
      const result = await firstValueFrom(this.http.get<any>(this.base, { params }));
      if (request !== this.requestNumber) return;
      this.rows = result.items; this.total = result.total;
    } catch (error) { if (request === this.requestNumber) this.fail(error); }
    finally { if (request === this.requestNumber) { this.loading = false; this.cdr.markForCheck(); } }
  }
  async loadHistory(event: Event) {
    if (!(event.target as HTMLDetailsElement).open || this.selected.events || this.historyLoading) return;
    const selected = this.selected; this.historyLoading = true;
    try { const events = await firstValueFrom(this.http.get<any[]>(`${this.base}/visits/${selected.visitId}/events`));
      if (this.selected === selected) selected.events = events;
    } catch (error) { this.fail(error); }
    finally { this.historyLoading = false; this.cdr.markForCheck(); }
  }
  async open(row: any) {
    if (this.dirty && !window.confirm('Bỏ các thay đổi chưa lưu để mở hồ sơ khác?')) return;
    this.error = ''; this.message = ''; this.preview = null;
    this.historyLoading = false;
    this.orderFields = row.status === 'confirmed' || !!row.link;
    this.apply(row);
    void this.loadOptions();
  }
  close() { if (!this.dirty || window.confirm('Đóng và bỏ các thay đổi chưa lưu?')) { this.selected = null; this.dirty = false; } }
  private apply(data: any) {
    this.selected = data;
    this.form = { ...data, contactedAt: this.toLocalInput(data.contactedAt), nextFollowUpAt: this.toLocalInput(data.nextFollowUpAt), contactChannel: data.contactChannel || '', matchedEventId: data.matchedEventId || '', matchConfidence: data.matchConfidence || 'unknown', status: data.status === 'new' ? 'noted' : data.status, productId: data.productId || '', agentId: data.agentId || '',
      supplierId: data.supplierId || '', adSelectionKey: data.adSelectionKey || '',
      orderDate: data.orderDate ? data.orderDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      quantity: data.quantity || 1 };
    this.orderId = data.link?.orderId || ''; this.dirty = false;
  }
  async save() {
    this.busy = true; this.error = ''; this.message = '';
    const payload: any = { version: this.selected.__v, status: this.form.status };
    for (const key of ['customerName', 'recipientName', 'phone', 'shippingAddress', 'notes', 'agentId', 'supplierId', 'productId', 'adSelectionKey', 'orderDate', 'quantity', 'saleTotal', 'deposit', 'codAmount', 'matchEvidence', 'contactedAt', 'nextFollowUpAt', 'contactChannel', 'matchedEventId', 'matchConfidence']) {
      payload[key] = this.form[key] === '' || this.form[key] == null ? null : this.form[key];
    }
    for (const key of ['contactedAt', 'nextFollowUpAt']) if (payload[key]) payload[key] = new Date(payload[key] + ':00+07:00').toISOString();
    if (payload.orderDate) payload.orderDate = this.selected.link ? this.selected.orderDate : new Date(payload.orderDate).toISOString();
    try {
      const request = this.selected.leadId
        ? this.http.patch<any>(`${this.base}/${this.selected.leadId}`, payload)
        : this.http.post<any>(`${this.base}/visits/${this.selected.visitId}/lead`, payload);
      this.apply(await firstValueFrom(request));
      this.message = 'Đã lưu thông tin tư vấn.';
      await this.reload();
    } catch (error) { this.fail(error); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async showPreview() {
    this.busy = true; this.error = '';
    try { this.preview = await firstValueFrom(this.http.get<any>(`${this.base}/${this.selected._id}/preview`)); }
    catch (error) { this.fail(error); }
    finally { this.busy = false; this.cdr.markForCheck(); }
  }
  async link() {
    if (!this.orderId.trim()) { this.error = 'Nhập ID đơn OrderTest2 cần liên kết.'; return; }
    await this.orderAction('order-link', { orderId: this.orderId.trim() }, 'Đã liên kết đúng nhóm quảng cáo, đại lý, sản phẩm và NCC.');
  }
  async promote() {
    if (!window.confirm('Khách đã chốt đơn? Tạo một đơn OrderTest2 theo nhóm quảng cáo, đại lý và báo giá đã đối chiếu.')) return;
    await this.orderAction('promote', {}, 'Đã chuyển khách đã chốt sang OrderTest2.');
  }
  async sync() {
    if (!window.confirm('Cập nhật tên khách, thông tin người nhận và ghi chú sang đơn đã liên kết? Báo giá và số tiền trên đơn giữ theo nghiệp vụ OrderTest2.')) return;
    await this.orderAction('sync-order', {}, 'Đã cập nhật thông tin khách và ghi chú sang OrderTest2.');
  }
  private async orderAction(action: string, body: any, success: string) {
    this.busy = true; this.error = ''; const id = this.selected._id;
    try {
      await firstValueFrom(this.http.post(`${this.base}/${id}/${action}`, { version: this.selected.__v, ...body }));
      this.message = success;
    } catch (error) { this.fail(error); }
    finally {
      try { this.apply(await firstValueFrom(this.http.get<any>(`${this.base}/${id}`))); await this.reload(); }
      catch (error) { this.fail(error); }
      this.busy = false; this.cdr.markForCheck();
    }
  }
  private fail(error: any) { const message = error?.error?.message; this.error = Array.isArray(message) ? message.join(' · ') : message || 'Không kết nối được ERP. Hãy thử tải lại.'; }
}
