/** Component quản lý Ads API Tokens (danh sách + validate + rotate tối giản) */
import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiTokenService, ApiToken, CreateApiTokenRequest, RotateTokenRequest } from './api-token.service';

@Component({
  selector: 'app-api-tokens',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './api-token.component.html',
  styleUrls: ['./api-token.component.css']
})
export class ApiTokenComponent implements OnInit {
  private service = inject(ApiTokenService);
  tokens = signal<ApiToken[]>([]);
  loading = signal(false);
  error = signal<string|undefined>(undefined);
  activeTab = signal<'list' | 'guide'>('list');

  showModal = signal(false);
  rotating = signal<ApiToken|undefined>(undefined);
  form = signal<Partial<CreateApiTokenRequest>>({ provider: 'facebook', status: 'active' });
  rotateForm = signal<RotateTokenRequest>({ newToken: '' });

  // Cập nhật form (tránh dùng arrow function trực tiếp trong template vì Angular template parser không hỗ trợ =>)
  updateForm<K extends keyof CreateApiTokenRequest>(key: K, value: CreateApiTokenRequest[K]) {
    this.form.update(f => ({ ...f, [key]: value }));
  }
  updateRotateForm<K extends keyof RotateTokenRequest>(key: K, value: RotateTokenRequest[K]) {
    this.rotateForm.update(f => ({ ...f, [key]: value }));
  }
  syncLoading = signal(false);
  syncSystemLoading = signal(false);
  sync(){
    if(this.syncLoading()) return;
    this.syncLoading.set(true);
    this.service.syncFromFanpages().subscribe({
      next: res => { if(res.items?.length){ this.tokens.update(arr=>[...res.items, ...arr]); } this.syncLoading.set(false); },
      error: e => { this.error.set(e?.error?.message||'Sync lỗi'); this.syncLoading.set(false); }
    });
  }
  syncSystemUser(){
    if(this.syncSystemLoading()) return;
    this.syncSystemLoading.set(true);
    this.service.syncFromSystemUser().subscribe({
      next: () => { this.load(); this.syncSystemLoading.set(false); },
      error: e => { this.error.set(e?.error?.message||'Sync system token lỗi'); this.syncSystemLoading.set(false); }
    });
  }

  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.service.list().subscribe({
      next: d=>{ this.tokens.set(d); this.loading.set(false); },
      error: e=>{ this.error.set(e?.error?.message||'Lỗi tải danh sách'); this.loading.set(false); }
    });
  }
  openCreate(){ this.form.set({ provider:'facebook', status:'active' }); this.showModal.set(true);} 
  save(){
    const data = this.form();
    if(!data.name||!data.token){ this.error.set('Thiếu tên hoặc token'); return; }
    this.service.create(data as CreateApiTokenRequest).subscribe({
      next: t=>{ this.tokens.update(arr=>[t,...arr]); this.showModal.set(false); },
      error: e=> this.error.set(e?.error?.message||'Tạo thất bại')
    });
  }
  validate(t: ApiToken){ this.service.validate(t._id).subscribe({ next: u=> this.updateLocal(u)}); }
  setPrimary(t: ApiToken){ if(!t.fanpageId){ return; } this.service.setPrimary(t._id, t.fanpageId).subscribe({ next: u=> this.updateLocal(u)}); }
  delete(t: ApiToken){ if(!confirm('Xóa token?')) return; this.service.remove(t._id).subscribe({ next:()=> this.tokens.update(a=>a.filter(x=>x._id!==t._id))}); }
  startRotate(t: ApiToken){ this.rotating.set(t); this.rotateForm.set({ newToken:'', notes: t.notes }); }
  doRotate(){
    const tok = this.rotating();
    if(!tok) return;
    const body = this.rotateForm();
    if(!body.newToken) { this.error.set('Nhập token mới'); return; }
    this.service.rotate(tok._id, body).subscribe({
      next: () => { this.load(); this.rotating.set(undefined); },
      error: e => this.error.set(e?.error?.message || 'Rotate lỗi')
    });
  }
  cancelRotate(){ this.rotating.set(undefined); }
  updateLocal(updated: ApiToken){ this.tokens.update(list=> list.map(i=> i._id===updated._id? updated:i)); }
  maskToken(t?: string){ if(!t) return ''; return t.length>8? t.slice(0,6)+'••••••':'••••'; }

  // Test ad account access per row
  testAdAccountId: Record<string,string> = {};
  testResult: Record<string,string> = {};
  testing: Record<string,boolean> = {};
  // Lưu "tên" và "id" tài khoản quảng cáo đã test để hiển thị ở cột chính
  adAccountNames: Record<string,string> = {};
  adAccountIds: Record<string,string> = {};
  setTestId(tok: ApiToken, v: string){ this.testAdAccountId[tok._id] = v; }
  runTest(tok: ApiToken){
    const id = this.testAdAccountId[tok._id];
    if(!id){ this.error.set('Nhập adAccountId trước khi test'); return; }
    this.testing[tok._id] = true;
    this.service.testAdAccount(tok._id, id).subscribe({
      next: (res) => {
        if(res.ok){
          const status = res.account?.account_status;
          const name = res.account?.name || res.account?.id;
          const scope = res.scopeOk? '✔ ads_management' : '⚠ scope chưa ghi nhận';
          this.testResult[tok._id] = `OK: ${name} (status=${status}). ${scope}`;
          // Ghi nhận để hiển thị lên bảng
          this.adAccountNames[tok._id] = name || '';
          this.adAccountIds[tok._id] = res.account?.id || (id.startsWith('act_')? id: 'act_'+id);
        } else {
          this.testResult[tok._id] = `Lỗi: ${res.error || 'Không truy cập được'}`;
        }
        this.testing[tok._id] = false;
      },
      error: (e) => { this.testResult[tok._id] = e?.error?.message || 'Test lỗi'; this.testing[tok._id] = false; }
    });
  }
}
