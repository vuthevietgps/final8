import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ConnectionInput, ConnectionKind, ProviderConnection, ProviderConnectionsService, WindsorAdsSnapshot } from './provider-connections.service';

@Component({
  selector: 'app-provider-connections', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './provider-connections.component.html',
  styleUrl: './provider-connections.component.css',
})
export class ProviderConnectionsComponent implements OnInit {
  private readonly service = inject(ProviderConnectionsService);
  readonly auth = inject(AuthService);
  readonly connections = signal<ProviderConnection[]>([]);
  readonly pages = signal<Array<{ pageId: string; name: string }>>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly storageEnabled = signal(false);
  readonly storageReason = signal('LOADING');
  readonly adsSnapshots = signal<Record<string, WindsorAdsSnapshot>>({});
  editingId?: string;
  form: ConnectionInput = this.emptyForm();
  accountsText = '';
  apiKey = '';
  signingSecret = '';

  canEdit() { return this.auth.hasPermission('google-ads.credentials.write') && this.auth.hasPermission('meta-ads.credentials.write'); }
  canReadAds() { return this.auth.hasPermission('google-ads.read'); }
  ngOnInit() { void this.load(); }
  private emptyForm(): ConnectionInput {
    return { kind: 'windsor-facebook', name: '', revision: 0, state: 'configured', accountIds: [] };
  }
  private async load() {
    this.busy.set(true);
    try {
      const [connections, pages, status] = await Promise.all([firstValueFrom(this.service.list()), firstValueFrom(this.service.pages()), firstValueFrom(this.service.status())]);
      this.connections.set(connections); this.pages.set(pages);
      this.storageEnabled.set(status.storageEnabled); this.storageReason.set(status.reason);
    } catch (error) { this.showError(error); }
    finally { this.busy.set(false); }
  }
  reset() {
    this.editingId = undefined; this.form = this.emptyForm(); this.accountsText = '';
    this.apiKey = ''; this.signingSecret = ''; this.error.set(''); this.notice.set('');
  }
  changeKind(kind: ConnectionKind) {
    this.form = { ...this.emptyForm(), kind, ...(kind === 'bird-messenger' ? { birdApi: 'bird-v1' as const } : {}) };
    this.apiKey = ''; this.signingSecret = ''; this.accountsText = '';
  }
  edit(row: ProviderConnection) {
    this.editingId = row.id;
    this.form = { kind: row.kind, name: row.name, revision: row.revision, state: row.state,
      accountIds: [...row.accountIds], birdApi: row.birdApi, workspaceId: row.workspaceId,
      channelId: row.channelId, pageId: row.pageId };
    this.accountsText = row.accountIds.join(', '); this.apiKey = ''; this.signingSecret = '';
    this.notice.set('Để trống key để giữ giá trị đã lưu. Lưu cấu hình sẽ yêu cầu kiểm tra kết nối lại.'); this.error.set('');
  }
  async save() {
    if (!this.canEdit() || this.busy() || !this.storageEnabled()) return;
    this.error.set(''); this.notice.set('');
    const body: ConnectionInput = { kind: this.form.kind, name: this.form.name, revision: this.form.revision,
      state: this.form.state, accountIds: [] };
    if (body.kind === 'bird-messenger') {
      Object.assign(body, { birdApi: this.form.birdApi, channelId: this.form.channelId, pageId: this.form.pageId });
      if (this.form.birdApi === 'bird-v1') body.workspaceId = this.form.workspaceId;
      if (this.signingSecret) body.signingSecret = this.signingSecret;
    } else {
      body.accountIds = [...new Set(this.accountsText.split(/[\s,;]+/).filter(Boolean).map(id => id.replace(/^act_/, '').replace(/-/g, '')))];
    }
    if (this.apiKey) body.apiKey = this.apiKey;
    this.apiKey = ''; this.signingSecret = ''; // Credentials never retained in browser storage or displayed again.
    this.busy.set(true);
    try {
      const row = await firstValueFrom(this.service.save(this.editingId, body));
      this.replace(row); this.edit(row);
      this.notice.set('Đã lưu kết nối. Chọn “Kiểm tra quyền truy cập” để kiểm tra cấu hình mới.');
    } catch (error) { this.showError(error); }
    finally { this.busy.set(false); }
  }
  async check(row: ProviderConnection) {
    if (!this.canEdit() || this.busy() || !this.storageEnabled()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await firstValueFrom(this.service.check(row.id)); this.replace(result);
      this.notice.set(this.checkMessage(result.check?.code));
    } catch (error) { this.showError(error); }
    finally { this.busy.set(false); }
  }
  async syncAds(row: ProviderConnection) {
    if (!this.canReadAds() || this.busy() || !this.storageEnabled() || row.kind !== 'windsor-google') return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await firstValueFrom(this.service.syncAds(row.id));
      this.connections.update(rows => rows.map(item => item.id === row.id ? {
        ...item, lastReadSyncAt: new Date().toISOString(), lastReadSyncStatus: result.status,
        lastReadSyncRunId: result.runId,
      } : item));
      const snapshot = await firstValueFrom(this.service.snapshot(row.id));
      this.adsSnapshots.update(values => ({ ...values, [row.id]: snapshot }));
      this.notice.set(result.status === 'success'
        ? `Đã lưu ${result.counts.dailyMetrics} dòng Windsor và đưa ${result.materialization.updated} dòng vào sổ chi phí quảng cáo.`
        : `Đồng bộ ${result.status === 'partial' ? 'chưa đủ' : 'thất bại'}; xem lịch sử sync để xử lý trước khi dùng số liệu.`);
      if (result.estimation?.rows) this.notice.update(text => `${text} Đã bổ sung ${result.estimation!.rows} dòng chi phí tạm tính từ lịch sử.`);
      if (result.estimation?.unresolved.length) this.notice.update(text => `${text} Còn ${result.estimation!.unresolved.length} lượt tài khoản/ngày chưa đủ dữ liệu để tính.`);
      if (result.projections?.some(item => !item.complete)) this.notice.update(text => `${text} Có ngày đang chờ cập nhật báo cáo tài chính.`);
      if (result.catalog) {
        this.notice.update(text => `${text} Đã cập nhật ${result.catalog!.accounts} tài khoản và ${result.catalog!.groups} nhóm vào hai màn quản lý.`);
        if (result.catalog.status !== 'success') this.error.set('Danh mục chưa cập nhật đầy đủ: ' + result.catalog.conflicts.map(item => `${item.providerId}: ${item.code}`).join('; '));
      }
    } catch (error) { this.showError(error); }
    finally { this.busy.set(false); }
  }
  async viewAds(row: ProviderConnection) {
    if (!this.canReadAds() || this.busy() || row.kind !== 'windsor-google') return;
    this.busy.set(true); this.error.set('');
    try {
      const snapshot = await firstValueFrom(this.service.snapshot(row.id));
      this.adsSnapshots.update(values => ({ ...values, [row.id]: snapshot }));
    } catch (error) { this.showError(error); }
    finally { this.busy.set(false); }
  }
  async syncCatalog(row: ProviderConnection) {
    if (!this.canReadAds() || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await firstValueFrom(this.service.syncCatalog(row.id));
      this.notice.set(`Đã cập nhật ${result.accounts} tài khoản và ${result.groups} nhóm từ dữ liệu Windsor đã lưu. Sản phẩm và người phụ trách được giữ nguyên.`);
      if (result.status !== 'success') this.error.set('Cần kiểm tra liên kết: ' + result.conflicts.map(item => `${item.providerId}: ${item.code}`).join('; '));
    } catch (error) { this.showError(error); }
    finally { this.busy.set(false); }
  }
  private replace(row: ProviderConnection) {
    this.connections.update(rows => [row, ...rows.filter(item => item.id !== row.id)]);
  }
  private showError(error: any) {
    const message = error?.error?.message;
    this.error.set(typeof message === 'string' ? message : 'Không thực hiện được. Kiểm tra dữ liệu, quyền truy cập và kết nối backend.');
  }
  label(kind: ConnectionKind) {
    return { 'windsor-facebook': 'Windsor · Facebook Ads', 'windsor-google': 'Windsor · Google Ads', 'bird-messenger': 'Bird · Messenger' }[kind];
  }
  checkMessage(code?: string) {
    const labels: Record<string, string> = {
      ACCOUNT_ACCESS_CONFIRMED: 'Đã xác nhận quyền truy cập các tài khoản đã chọn.',
      NO_CONNECTED_ACCOUNTS: 'Chưa có tài khoản quảng cáo được kết nối trên Windsor.',
      SELECT_ACCOUNTS: 'Đã lấy danh sách tài khoản. Chọn tài khoản, lưu và kiểm tra lại.',
      ACCOUNT_NOT_CONNECTED: 'Có tài khoản đã chọn chưa được kết nối hoặc không hoạt động trên Windsor.',
      ACTION_DISCOVERY_FAILED: 'Đọc được tài khoản nhưng chưa lấy được danh sách hành động Windsor.',
      CHANNEL_ACCESS_TRACKING_UNVERIFIED: 'Đọc được kênh Bird. Còn cần xác minh Fanpage và sự kiện có ID quảng cáo.',
      CONVERSATIONS_INACTIVE: 'Truy cập được kênh nhưng Conversations chưa hoạt động trên Bird.',
      CHANNEL_INACTIVE: 'Kênh MessageBird chưa hoạt động.',
      NOT_A_FACEBOOK_CHANNEL: 'Channel không khớp hoặc không phải Facebook Messenger.',
      ACCESS_DENIED: 'Key hoặc quyền truy cập không hợp lệ.',
      RESOURCE_NOT_FOUND: 'Không tìm thấy tài nguyên. Kiểm tra phiên bản API, workspace và channel.',
      RATE_LIMITED: 'Nhà cung cấp đang giới hạn lượt gọi. Chờ rồi kiểm tra lại.',
      PROVIDER_TIMEOUT: 'Nhà cung cấp phản hồi quá chậm. Kiểm tra lại sau.',
      INVALID_ACCOUNT_RESPONSE: 'Cấu trúc tài khoản Windsor khác hợp đồng đã hỗ trợ; cần đối chiếu API.',
      INVALID_CHANNEL_RESPONSE: 'Cấu trúc phản hồi Bird khác hợp đồng đã hỗ trợ; cần đối chiếu API.',
    };
    return code ? labels[code] || 'Chưa kiểm tra được kết nối. Thử lại sau hoặc đối chiếu phiên bản API.' : 'Chưa kiểm tra cấu hình này.';
  }
}
