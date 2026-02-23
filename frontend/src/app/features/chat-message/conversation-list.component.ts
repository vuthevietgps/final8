/** Component: ConversationList - danh sách hội thoại fanpage */
import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, NgFor, NgForOf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatMessageService, ConversationSummary, ChatMessage } from './chat-message.service';
import { findLastAdGroupFromMessages } from './utils/chat-message.utils';
import { PendingOrderService, PendingOrder, AgentOption, SupplierOption } from './pending-order.service';
import { ProductService } from '../product/product.service';
import { MediaPickerService, MediaItem } from './media-picker.service';
import { Product } from '../product/models/product.interface';
import { FanpageService, Fanpage } from '../fanpage/fanpage.service';
import { AdvertisingCostService } from '../advertising-cost/advertising-cost.service';

@Component({
  selector: 'app-conversations',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgIf, NgFor, NgForOf],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.css']
})
export class ConversationListComponent implements OnInit, OnDestroy {
  private service = inject(ChatMessageService);
  private pendingSvc = inject(PendingOrderService);
  private productSvc = inject(ProductService);
  private mediaSvc = inject(MediaPickerService);
  private fanpageSvc = inject(FanpageService);
  private adCostSvc = inject(AdvertisingCostService);
  loading = signal(false);
  error = signal<string|undefined>(undefined);
  page = signal(1);
  limit = signal(20);
  total = signal(0);
  items = signal<ConversationSummary[]>([]);
  filter = signal<{fanpageId?: string; senderPsid?: string; needsHuman?: string; orderCustomerName?: string; orderPhone?: string}>({});

  // detail modal
  showDetail = signal(false);
  detailLoading = signal(false);
  currentConv = signal<ConversationSummary|undefined>(undefined);
  messages = signal<ChatMessage[]>([]);
  replyText = signal('');
  sending = signal(false);
  imageSending = signal(false);
  picking = signal(false);
  mediaItems = signal<MediaItem[]>([]);
  mediaPage = signal(1);
  mediaTotal = signal(0);
  now = signal(Date.now());
  // Order draft form state
  orderExtractLoading = signal(false);
  orderDraft = signal<PendingOrder|undefined>(undefined);
  approveLoading = signal(false);
  draftSaving = signal(false); // trạng thái lưu nháp
  draftMsg = signal<string|undefined>(undefined); // thông báo cho khu vực đơn hàng
  extractSuggestions = signal<any|undefined>(undefined);
  products = signal<Product[]>([]);
  agents = signal<AgentOption[]>([]);
  suppliers = signal<SupplierOption[]>([]);
  createdOrderId = signal<string|undefined>(undefined); // ID đơn test-order2 được tạo sau approve
  // auto refresh time every 30s for time-ago display
  private interval?: any;
  private es?: EventSource | null;
  toasts = signal<{title: string; desc: string; meta?: string; at: number}[]>([]);
  // Bản đồ id/pageId -> thông tin fanpage để hiển thị tên và pageId
  fanpageInfoMap = signal<Record<string,{name:string; pageId:string}>>({});
  // Bản đồ adGroupId -> tổng chi phí để hiển thị trong danh sách hội thoại
  adGroupCostMap = signal<Map<string, number>>(new Map());

  timeAgo = (d?: string) => {
    if(!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const s = Math.floor(diff/1000);
    if(s<60) return s+ 's';
    const m = Math.floor(s/60); if(m<60) return m+'m';
    const h = Math.floor(m/60); if(h<24) return h+'h';
    const day = Math.floor(h/24); return day+'d';
  };

  ngOnDestroy(){ if(this.interval) clearInterval(this.interval); }

  ngOnInit(){
    this.load();
    this.interval = setInterval(()=> this.now.set(Date.now()), 30000);
    // preload limited products (could enhance with pagination later)
    this.productSvc.getAll().subscribe({ next: list => this.products.set(list.slice(0,200)), error: _=>{} });
    // load agents list for assignment
    this.pendingSvc.listAgents().subscribe({ next: list => { this.agents.set(list); }, error: err=>{ console.warn('[Agents] load failed', err); } });
    this.pendingSvc.listSuppliers().subscribe({ next: list => { this.suppliers.set(list); }, error: err=>{ console.warn('[Suppliers] load failed', err); } });

    // Load danh sách fanpage để hiển thị tên + pageId trong header
    this.fanpageSvc.list().subscribe({
      next: (pages: Fanpage[]) => {
        const map: Record<string,{name:string; pageId:string}> = {};
        for(const p of pages){
          map[p.pageId] = { name: p.name, pageId: p.pageId };
          map[p._id] = { name: p.name, pageId: p.pageId };
        }
        this.fanpageInfoMap.set(map);
      },
      error: _ => {}
    });

    // Connect SSE for live notifications
    this.es = this.service.connectEvents((ev) => {
      // Show toast and optionally auto-refresh list if current filters match fanpage
      const title = ev.direction === 'in' ? 'Tin nhắn mới' : 'Đã gửi';
      const desc = `${ev.senderPsid} • ${ev.snippet || ''}`.trim();
      this.toasts.update(arr => [{ title, desc, meta: this.timeAgo(String(ev.createdAt||'')), at: Date.now() }, ...arr].slice(0,5));
      // Light auto-refresh: if on first page and not currently loading, reload to surface recent
      if(this.page() === 1 && !this.loading()) {
        setTimeout(() => this.load(), 250);
      }
      // Nếu đang mở đúng hội thoại, refresh detail + re-extract để cập nhật gợi ý (adGroupId mới nhất)
      const cur = this.currentConv();
      if (cur) {
        const curFanId = this.getFanpageId(cur.fanpageId);
        if (curFanId === ev.fanpageId && cur.senderPsid === ev.senderPsid) {
          this.service.getConversation(curFanId, cur.senderPsid).subscribe({
            next: r => {
              this.currentConv.set(r.conversation);
              this.messages.set(r.messages.slice().sort((a,b)=> new Date(a.createdAt||'').getTime() - new Date(b.createdAt||'').getTime()));
              // chạy extract để auto-fill adGroupId nếu draft còn trống
              setTimeout(() => this.extractOrder(), 100);
              // Điền ngay Ad Group nếu conversation đã có lastAdGroupId mà ô đang trống
              const draft = this.orderDraft();
              const lastAdg: any = (r.conversation as any)?.lastAdGroupId;
              if(draft && !draft.adGroupId && lastAdg){
                this.orderDraft.set({ ...draft, adGroupId: lastAdg });
              }
            },
            error: _ => {}
          });
        }
      }
    });
  }

  updateFilter<K extends keyof ReturnType<typeof this.filter>>(key: K, value: any){ this.filter.update(f=> ({...f,[key]: value})); }
  setPage(p: number){ if(p<1) return; this.page.set(p); this.load(); }

  private getFanpageId(fanpageId: string | {pageId?: string; name?: string; _id?: string} | null | undefined): string {
    if(!fanpageId) return '';
    if(typeof fanpageId === 'string') return fanpageId;
    return (fanpageId as any)._id || (fanpageId as any).pageId || '';
  }

  // Helper methods for template
  getFanpagePageId(fanpageId: string | {pageId?: string; name?: string; _id?: string} | null | undefined): string {
    if(!fanpageId) return '';
    if(typeof fanpageId === 'string'){
      const info = this.fanpageInfoMap()[fanpageId];
      return (info && info.pageId) || fanpageId;
    }
    return ((fanpageId as any).pageId || (fanpageId as any)._id || '');
  }

  getFanpageName(fanpageId: string | {pageId?: string; name?: string; _id?: string} | null | undefined): string | undefined {
    if(!fanpageId) return undefined;
    if(typeof fanpageId === 'string'){
      const info = this.fanpageInfoMap()[fanpageId];
      return info?.name;
    }
    return (fanpageId as any).name;
  }

  isFanpageObject(fanpageId: string | {pageId?: string; name?: string; _id?: string} | null | undefined): boolean {
    return !!fanpageId && typeof fanpageId === 'object';
  }

  load(){
    this.loading.set(true);
    const q: any = { page: this.page(), limit: this.limit() };
    const f = this.filter();
    if(f.fanpageId) q.fanpageId = f.fanpageId;
    if(f.senderPsid) q.senderPsid = f.senderPsid;
    if(f.needsHuman==='true') q.needsHuman = true;
    if(f.needsHuman==='false') q.needsHuman = false;
  if(f.orderCustomerName) q.orderCustomerName = f.orderCustomerName;
  if(f.orderPhone) q.orderPhone = f.orderPhone;
    this.service.listConversations(q).subscribe({
      next: resp=>{ 
        this.items.set(resp.items); this.total.set(resp.total); this.loading.set(false);
        

        
        // Thu thập thông tin fanpage từ dữ liệu list (nếu backend trả object)
        const map = { ...this.fanpageInfoMap() } as Record<string,{name:string; pageId:string}>;
        for(const it of resp.items){
          const fp: any = it.fanpageId as any;
          if(fp && typeof fp === 'object'){
            const pid = fp.pageId || '';
            const id = fp._id || '';
            if((pid || id) && fp.name){
              if(pid) map[pid] = { name: fp.name, pageId: pid };
              if(id) map[id] = { name: fp.name, pageId: pid || id };
            }
          }
        }
        this.fanpageInfoMap.set(map);
        
        // Load chi phí quảng cáo cho các adGroupId có trong danh sách
        this.loadAdvertisingCosts(resp.items);
      },
      error: e=>{ this.error.set(e?.error?.message||'Lỗi tải hội thoại'); this.loading.set(false); }
    });
  }

  open(conv: ConversationSummary){
    // Mở modal ngay lập tức với thông tin có sẵn từ list
    this.showDetail.set(true);
    this.currentConv.set(conv);
    this.error.set('');
    this.messages.set([]); // Clear messages cũ
    
    const fpId = this.getFanpageId(conv.fanpageId);
    
  // Reset order panel state ngay - không cần chờ API (prefill Ad Group nếu đã có)
  this.orderDraft.set({ fanpageId: fpId, senderPsid: conv.senderPsid, quantity:1, adGroupId: (conv.lastAdGroupId as any) });
  this.createdOrderId.set(undefined);
    
    // Chỉ load messages, không block modal
    this.detailLoading.set(true);
    
    // Load messages với timeout ngắn để modal render trước
    setTimeout(() => {
      this.service.getConversation(fpId, conv.senderPsid).subscribe({
        next: d=>{
          // Limit messages để render nhanh hơn (chỉ 50 tin nhắn gần nhất)
          const sortedMessages = d.messages.slice()
            .sort((a,b)=> new Date(b.createdAt||'').getTime() - new Date(a.createdAt||'').getTime())
            .slice(0, 50)
            .reverse(); // Đảo ngược để tin nhắn cũ ở trên
          
          this.messages.set(sortedMessages);
          this.currentConv.set(d.conversation);
          // Cập nhật thông tin fanpage nếu payload có object
          const fp: any = d.conversation?.fanpageId as any;
          if(fp && typeof fp === 'object' && (fp.pageId || fp._id) && fp.name){
            const map = { ...this.fanpageInfoMap() } as Record<string,{name:string; pageId:string}>;
            if(fp.pageId) map[fp.pageId] = { name: fp.name, pageId: fp.pageId };
            if(fp._id) map[fp._id] = { name: fp.name, pageId: fp.pageId || fp._id };
            this.fanpageInfoMap.set(map);
          }
          this.detailLoading.set(false);
          
          // Extract order chạy nền, không block UI
          setTimeout(() => this.extractOrder(), 200);
          // Nếu Ad Group vẫn trống, thử lấy từ messages vừa nạp
          const draft = this.orderDraft();
          if(draft && !draft.adGroupId){
            const lastAdg = findLastAdGroupFromMessages(sortedMessages);
            if(lastAdg){ this.orderDraft.set({ ...draft, adGroupId: lastAdg as any }); }
          }
          // Nếu conversation có lastAdGroupId mà vẫn trống, điền tiếp
          const convLastAdg: any = (d.conversation as any)?.lastAdGroupId;
          if(convLastAdg){
            const cur = this.orderDraft();
            if(cur && !cur.adGroupId){ this.orderDraft.set({ ...cur, adGroupId: convLastAdg }); }
          }
        },
        error: e=>{
          this.error.set(e?.error?.message||'Lỗi tải hội thoại');
          this.detailLoading.set(false);
        }
      });
    }, 50); // Delay nhỏ để modal render trước
  }

  

  resolve(){
    const c = this.currentConv(); if(!c) return;
    const fpId = this.getFanpageId(c.fanpageId);
    this.service.resolveConversation(fpId, c.senderPsid).subscribe({
      next: d=>{ this.currentConv.set(d.conversation); this.messages.set(d.messages.slice().sort((a,b)=> new Date(a.createdAt||'').getTime() - new Date(b.createdAt||'').getTime())); this.items.update(arr=> arr.map(x=> this.getFanpageId(x.fanpageId)===fpId && x.senderPsid===c.senderPsid ? d.conversation : x)); },
    });
  }

  toggleAI(){
    const c = this.currentConv(); if(!c) return;
    const target = !c.autoAiEnabled;
    const fpId = this.getFanpageId(c.fanpageId);
    this.service.toggleAutoAI(fpId, c.senderPsid, target).subscribe({
      next: res=>{
        this.currentConv.update(old=> old? {...old, autoAiEnabled: res.autoAiEnabled }: old);
        this.items.update(list=> list.map(x=> this.getFanpageId(x.fanpageId)===fpId && x.senderPsid===c.senderPsid ? {...x, autoAiEnabled: res.autoAiEnabled }: x));
      },
      error: e=> this.error.set(e?.error?.message||'Toggle AI thất bại')
    });
  }

  sendReply(){
    const text = this.replyText().trim();
    const c = this.currentConv();
    if(!text || !c || this.sending()) return;
    this.sending.set(true);
    const fpId = this.getFanpageId(c.fanpageId);
    this.service.sendMessage(fpId, c.senderPsid, text).subscribe({
      next: res=>{
        const m = res.saved; // bản ghi đã lưu sau khi gửi thành công
        this.messages.update(arr=> [...arr, m]);
        this.replyText.set('');
        // Reload conversation summary để cập nhật last message / counts
        this.service.getConversation(fpId, c.senderPsid).subscribe(r=>{
          this.currentConv.set(r.conversation);
          this.items.update(list=> list.map(x=> this.getFanpageId(x.fanpageId)===fpId && x.senderPsid===c.senderPsid ? r.conversation : x));
        });
        this.sending.set(false);
      },
      error: e=>{ this.sending.set(false); this.error.set(e?.error?.message||'Gửi thất bại'); }
    });
  }
  onReplyKey(e: KeyboardEvent){ if(e.key==='Enter' && (e.ctrlKey||e.metaKey)) this.sendReply(); }

  onPickImage(evt: Event){
    const input = evt.target as HTMLInputElement;
    const file = input?.files && input.files[0];
    // allow selecting same file again
    if(input) input.value = '';
    const c = this.currentConv();
    if(!file || !c || this.imageSending()) return;
    const fpId = this.getFanpageId(c.fanpageId);
    this.imageSending.set(true);
    this.service.sendImage(fpId, c.senderPsid, file, file.name).subscribe({
      next: res => {
        const m = res.saved as any;
        this.messages.update(arr => [...arr, m]);
        // reload conversation summary
        this.service.getConversation(fpId, c.senderPsid).subscribe(r=>{
          this.currentConv.set(r.conversation);
          this.items.update(list=> list.map(x=> this.getFanpageId(x.fanpageId)===fpId && x.senderPsid===c.senderPsid ? r.conversation : x));
        });
        this.imageSending.set(false);
      },
      error: e => { this.error.set(e?.error?.message || 'Gửi ảnh thất bại'); this.imageSending.set(false); }
    });
  }

  openMediaPicker(){
    this.picking.set(true);
    this.loadMedia(1);
  }
  loadMedia(page: number){
    this.mediaPage.set(page);
    this.mediaSvc.list({ page, limit: 20 }).subscribe({
      next: res => { this.mediaItems.set(res.items); this.mediaTotal.set(res.total); },
      error: _ => {}
    });
  }
  sendMedia(item: MediaItem){
    const c = this.currentConv(); if(!c) return;
    const fpId = this.getFanpageId(c.fanpageId);
    if(this.imageSending()) return; this.imageSending.set(true);
    this.service.sendImageByUrl(fpId, c.senderPsid, item.url).subscribe({
      next: (res: any) => {
        const m = res.saved as any;
        this.messages.update(arr => [...arr, m]);
        // reload summary
        this.service.getConversation(fpId, c.senderPsid).subscribe(r=>{
          this.currentConv.set(r.conversation);
          this.items.update(list=> list.map(x=> this.getFanpageId(x.fanpageId)===fpId && x.senderPsid===c.senderPsid ? r.conversation : x));
        });
        this.imageSending.set(false);
        this.picking.set(false);
      },
      error: e => { this.error.set(e?.error?.message || 'Gửi ảnh thất bại'); this.imageSending.set(false); }
    });
  }

  extractOrder(){
    const c = this.currentConv(); if(!c) return; 
    
    // Set loading nhưng không block UI ngay
    this.orderExtractLoading.set(true);
    const fpId = this.getFanpageId(c.fanpageId);
    
    // Chạy extract với delay để không ảnh hưởng modal
    setTimeout(() => {
      this.service.extractOrder(fpId, c.senderPsid).subscribe({
        next: data=>{
          this.extractSuggestions.set(data);
          const s = data.suggestions||{};
          const current = this.orderDraft()||{};
          
          // Chỉ fill những field chưa có data
          this.orderDraft.set({
            ...current,
            customerName: current.customerName || s.customerName,
            phone: current.phone || s.phone,
            address: current.address || s.address,
            quantity: current.quantity || s.quantity || 1,
            // Ưu tiên gợi ý từ backend; nếu chưa có, fallback về lastAdGroupId của hội thoại
            adGroupId: current.adGroupId || s.adGroupId || (this.currentConv()?.lastAdGroupId as any) || findLastAdGroupFromMessages(this.messages())
          });
          
          this.orderExtractLoading.set(false);
        },
        error: err => {
          console.warn('Extract order failed:', err);
          this.orderExtractLoading.set(false);
        }
      });
    }, 300); // Delay lớn hơn để modal ổn định trước
  }

  saveDraft(status: 'draft'|'awaiting'){
    const draft = this.orderDraft(); if(!draft) return;
    this.draftMsg.set(undefined);
    const body = this.buildPendingPayload(draft, { status });
    if(!body.adGroupId || body.adGroupId === '0'){
      const fallback = this.resolveAdGroupIdFallback();
      if(fallback){
        body.adGroupId = fallback;
        this.orderDraft.set({ ...(draft||{} as any), adGroupId: fallback });
      }
    }
    // Đảm bảo quantity là số
    if(body.quantity) body.quantity = Number(body.quantity);
    this.draftSaving.set(true);
    const obs = draft._id ? this.pendingSvc.update(draft._id, body) : this.pendingSvc.create(body);
    obs.subscribe({
  next: p=>{ this.orderDraft.set(p); this.draftSaving.set(false); this.draftMsg.set(status==='draft' ? 'Đã lưu nháp ✅' : 'Đã gửi chờ duyệt ✅'); },
      error: e=>{ console.warn('[PendingOrder] save failed', e); this.draftSaving.set(false); this.draftMsg.set(e?.error?.message || 'Lưu thất bại'); }
    });
  }

  approve(){
    const draft = this.orderDraft();
    if(!draft){ return; }
    if(this.approveLoading() || this.draftSaving()) return; // tránh double click
    this.draftMsg.set(undefined);
    // Validate required fields
    const required: (keyof PendingOrder)[] = ['productId','customerName','phone','address','adGroupId'];
    if(!draft.adGroupId || draft.adGroupId === '0'){
      const fallback = this.resolveAdGroupIdFallback();
      if(fallback){
        draft.adGroupId = fallback;
        this.orderDraft.set({ ...(draft as any), adGroupId: fallback });
      }
    }
    const missing = required.filter(k => !(draft as any)[k]);
    if(missing.length){
      this.draftMsg.set('Thiếu: ' + missing.join(', '));
      return;
    }
    // Chuẩn hóa quantity
    const payload: PendingOrder = this.buildPendingPayload(draft, { quantity: Number(draft.quantity||1) });
    this.approveLoading.set(true);
    const persist$ = payload._id
      ? this.pendingSvc.update(payload._id, payload)
      : this.pendingSvc.create({ ...payload, status: 'draft' });
    persist$.subscribe({
      next: saved => {
  // persisted successfully, proceed to approve
        this.orderDraft.set(saved);
        // Gọi approve
        this.pendingSvc.approve(saved._id!).subscribe({
          next: res => {
            // approved successfully
            this.approveLoading.set(false);
            const cur = this.orderDraft();
            this.orderDraft.set(cur ? { ...cur, status: 'approved' } : cur);
            // cập nhật hội thoại
            this.currentConv.update(c => c ? { ...c, orderDraftStatus: 'approved', orderId: res.order?._id } : c);
            this.draftMsg.set('Đã duyệt & tạo đơn ✅');
            if(res.order?._id) this.createdOrderId.set(res.order._id);
          },
          error: e => {
            console.warn('[PendingOrder] approve failed', e);
            this.approveLoading.set(false);
            const msg = e?.error?.message || 'Duyệt thất bại';
            // Nếu backend báo field không hợp lệ -> gợi ý nguyên nhân
            if(/should not exist/.test(msg)){
              this.draftMsg.set('Duyệt thất bại: dữ liệu gửi kèm field không hợp lệ (đã lọc lại, thử lại lần nữa)');
            } else {
              // Nếu thiếu productId hoặc agentId hoặc validate DTO
              if(/productId/.test(msg) && /MongoId/.test(JSON.stringify(e.error||{}))){
                this.draftMsg.set('Sai định dạng productId (không phải ObjectId hợp lệ)');
              } else if(/agentId/.test(msg) && /MongoId/.test(JSON.stringify(e.error||{}))){
                this.draftMsg.set('Sai định dạng agentId');
              } else {
                this.draftMsg.set(msg);
              }
            }
          }
        });
      },
      error: e => {
        console.warn('[PendingOrder] persist (create/update) failed before approve', e);
        this.approveLoading.set(false);
        this.draftMsg.set(e?.error?.message || 'Lưu trước khi duyệt thất bại');
      }
    });
  }

  private resolveAdGroupIdFallback(): string | undefined {
    const draftVal = this.orderDraft();
    if(draftVal && draftVal.adGroupId && String(draftVal.adGroupId).trim() && draftVal.adGroupId !== '0'){
      return String(draftVal.adGroupId).trim();
    }
    const conv = this.currentConv();
    if(conv && conv.lastAdGroupId && String(conv.lastAdGroupId).trim()){
      return String(conv.lastAdGroupId).trim();
    }
    const fromMessages = findLastAdGroupFromMessages(this.messages());
    if(fromMessages) return String(fromMessages).trim();
    return undefined;
  }

  /**
   * Chỉ chọn các field hợp lệ theo DTO để tránh ValidationPipe reject (whitelist + forbidNonWhitelisted).
   */
  private buildPendingPayload(src: PendingOrder, extra: Partial<PendingOrder> = {}): PendingOrder {
    const allowed: (keyof PendingOrder)[] = [
      'fanpageId','senderPsid','productId','agentId','supplierId','adGroupId','customerName','phone','address','quantity','status','notes','orderDate'
    ];
    const out: any = {};
    for(const k of allowed){ if((src as any)[k] !== undefined) out[k] = (src as any)[k]; }
    for(const [k,v] of Object.entries(extra)){ if(v !== undefined && allowed.includes(k as keyof PendingOrder)) out[k] = v; }
    return out as PendingOrder;
  }

  copyCreatedOrderId(){
    const id = this.createdOrderId(); if(!id) return;
    try {
      if(typeof navigator !== 'undefined' && (navigator as any).clipboard){
        (navigator as any).clipboard.writeText(id);
        this.draftMsg.set('Đã copy ID đơn hàng');
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = id; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        this.draftMsg.set('Đã copy ID đơn hàng');
      }
    } catch(err){
      console.warn('Copy failed', err);
      this.draftMsg.set('Copy ID thất bại');
    }
  }

  // Field update helpers for template clarity
  setDraftField<K extends keyof PendingOrder>(key: K, value: PendingOrder[K]) {
    const cur = this.orderDraft(); if(!cur) return; this.orderDraft.set({ ...cur, [key]: value });
  }

  setOrderField<K extends keyof PendingOrder>(field: K, value: PendingOrder[K]){
    this.orderDraft.update(d => ({ ...(d||{} as any), [field]: value }) as any);
  }

  getStatusText(status: string): string {
    const statusMap = {
      'draft': '📝 Nháp',
      'awaiting': '⏳ Chờ duyệt', 
      'approved': '✅ Đã duyệt'
    };
    return statusMap[status as keyof typeof statusMap] || '❓ Không xác định';
  }

  dismissToast(i: number){ this.toasts.update(arr => arr.filter((_,idx)=> idx!==i)); }

  // UI helpers for list coloring
  hasPhone(c: ConversationSummary): boolean {
    // Only check orderPhone field - must have actual phone number stored
    return !!(c.orderPhone && String(c.orderPhone).trim());
  }
  isUnanswered(c: ConversationSummary): boolean {
    // Prefer backend flags if available; fallback to heuristic
    if (typeof c.needsHuman === 'boolean') return !!c.needsHuman;
    return (c.lastDirection === 'in' && (c.outboundCount || 0) === 0) || (c.awaitingCount || 0) > 0;
  }

  // Load chi phí quảng cáo cho các adGroupId có trong danh sách hội thoại
  private loadAdvertisingCosts(conversations: ConversationSummary[]): void {
    const uniqueAdGroupIds = Array.from(new Set(
      conversations
        .map(c => c.lastAdGroupId)
        .filter(id => id && String(id).trim())
    )) as string[];

    if (uniqueAdGroupIds.length === 0) return;

    const costMap = new Map<string, number>();
    
    // Load chi phí cho từng adGroupId
    uniqueAdGroupIds.forEach(adGroupId => {
      this.adCostSvc.getTotalSpentByAdGroup(adGroupId).subscribe({
        next: (result) => {
          costMap.set(adGroupId, result.totalSpent);
          this.adGroupCostMap.set(new Map(costMap));
        },
        error: (err) => {
          console.error(`Error loading cost for adGroupId ${adGroupId}:`, err);
          costMap.set(adGroupId, 0);
          this.adGroupCostMap.set(new Map(costMap));
        }
      });
    });
  }

  // Helper để lấy chi phí theo adGroupId
  getAdvertisingCost(adGroupId?: string | null): number {
    if (!adGroupId) return 0;
    return this.adGroupCostMap().get(String(adGroupId)) || 0;
  }

  // ---- helpers ----
}
