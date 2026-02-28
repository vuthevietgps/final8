/** Component: ConversationList - danh sách hội thoại fanpage */
import { Component, signal, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, NgIf, NgFor, NgForOf } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatMessageService, ConversationSummary, ChatMessage, ChatRealtimeEvent } from './chat-message.service';
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
  private reconnectTimer?: any;
  private reconnectDelayMs = 1500;
  private listRefreshTimer?: any;
  private detailRefreshTimer?: any;
  private notificationRequested = false;
  private visibilityHandler = () => {
    if (typeof document === 'undefined' || document.hidden) return;
    this.scheduleListRefresh(100);
    this.scheduleDetailRefresh(120);
  };
  toasts = signal<{title: string; desc: string; meta?: string; at: number}[]>([]);
  // Bản đồ id/pageId -> thông tin fanpage để hiển thị tên và pageId
  fanpageInfoMap = signal<Record<string,{name:string; pageId:string}>>({});
  // Bản đồ adGroupId -> tổng chi phí để hiển thị trong danh sách hội thoại
  adGroupCostMap = signal<Map<string, number>>(new Map());
  @ViewChild('threadScroll') private threadScroll?: ElementRef<HTMLDivElement>;

  timeAgo = (d?: string) => {
    if(!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const s = Math.floor(diff/1000);
    if(s<60) return s+ 's';
    const m = Math.floor(s/60); if(m<60) return m+'m';
    const h = Math.floor(m/60); if(h<24) return h+'h';
    const day = Math.floor(h/24); return day+'d';
  };

  ngOnDestroy(){
    if(this.interval) clearInterval(this.interval);
    if(this.listRefreshTimer) clearTimeout(this.listRefreshTimer);
    if(this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if(this.detailRefreshTimer) clearTimeout(this.detailRefreshTimer);
    if(this.es){ try { this.es.close(); } catch {} this.es = null; }
    if(typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnInit(){
    this.load();
    this.interval = setInterval(()=> {
      this.now.set(Date.now());
      if(!this.es) this.connectRealtime();
    }, 30000);
    this.maybeRequestNotificationPermission();
    if(typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityHandler);
    // preload limited products (could enhance with pagination later)
    this.productSvc.getAll().subscribe({ next: list => this.products.set(list.slice(0,200)), error: _=>{} });
    // load agents list for assignment
    this.pendingSvc.listAgents().subscribe({ next: list => { this.agents.set(list); }, error: err=>{ console.warn('[Agents] load failed', err); } });
    // load suppliers list for assignment
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
    this.connectRealtime();
  }

  private connectRealtime(forceReconnect = false){
    if(forceReconnect && this.es){
      try { this.es.close(); } catch {}
      this.es = null;
    }
    if(this.es) return;
    this.es = this.service.connectEvents((ev) => this.handleRealtimeEvent(ev), {
      onOpen: () => {
        this.reconnectDelayMs = 1500;
        if(this.reconnectTimer){ clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; }
      },
      onError: () => this.scheduleRealtimeReconnect()
    });
    if(!this.es) this.scheduleRealtimeReconnect();
  }

  private scheduleRealtimeReconnect(){
    if(this.reconnectTimer) return;
    if(this.es){ try { this.es.close(); } catch {} this.es = null; }
    const waitMs = this.reconnectDelayMs;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connectRealtime(true);
    }, waitMs);
    this.reconnectDelayMs = Math.min(15000, this.reconnectDelayMs * 2);
  }

  private handleRealtimeEvent(ev: ChatRealtimeEvent){
    if(!ev?.fanpageId || !ev?.senderPsid) return;
    const isInbound = ev.direction === 'in';
    const title = isInbound ? 'Tin nhắn mới từ khách' : 'Cập nhật hội thoại';
    const desc = `${ev.senderPsid} • ${ev.snippet || ''}`.trim();
    this.pushToast(title, desc, this.timeAgo(String(ev.createdAt || new Date().toISOString())));
    if(isInbound) this.showDesktopNotification(ev);

    this.promoteConversationFromEvent(ev);
    if(this.page() !== 1) this.page.set(1);
    this.scheduleListRefresh(120);

    const current = this.currentConv();
    if(this.isSameConversation(current, ev.fanpageId, ev.senderPsid)){
      this.scheduleDetailRefresh(80);
      if(isInbound) setTimeout(() => this.extractOrder(), 120);
    }
  }

  private pushToast(title: string, desc: string, meta?: string){
    const at = Date.now();
    this.toasts.update(arr => [{ title, desc, meta, at }, ...arr].slice(0,5));
    setTimeout(() => {
      this.toasts.update(arr => arr.filter(t => t.at !== at));
    }, 8000);
  }

  private maybeRequestNotificationPermission(){
    if(this.notificationRequested) return;
    this.notificationRequested = true;
    const win: any = typeof window !== 'undefined' ? window : undefined;
    if(!win || !('Notification' in win)) return;
    if(Notification.permission === 'default'){
      try { Notification.requestPermission().catch(() => {}); } catch {}
    }
  }

  private showDesktopNotification(ev: ChatRealtimeEvent){
    const win: any = typeof window !== 'undefined' ? window : undefined;
    if(!win || !('Notification' in win)) return;
    if(Notification.permission !== 'granted') return;
    const n = new Notification('Tin nhắn mới từ khách hàng', {
      body: `${ev.senderPsid}: ${ev.snippet || 'Bạn có tin nhắn mới'}`,
      tag: `chat-${ev.fanpageId}-${ev.senderPsid}`,
    });
    n.onclick = () => { try { win.focus(); n.close(); } catch {} };
    setTimeout(() => { try { n.close(); } catch {} }, 6000);
  }

  private fanpageKeys(fanpageId: string | {pageId?: string; _id?: string; name?: string} | null | undefined): string[] {
    const out = new Set<string>();
    if(!fanpageId) return [];
    if(typeof fanpageId === 'string'){
      const raw = String(fanpageId);
      out.add(raw);
      const info = this.fanpageInfoMap()[raw];
      if(info?.pageId) out.add(String(info.pageId));
    } else {
      const obj: any = fanpageId;
      if(obj?._id) out.add(String(obj._id));
      if(obj?.pageId) out.add(String(obj.pageId));
    }
    return Array.from(out).filter(Boolean);
  }

  private isSameFanpage(convFanpageId: string | {pageId?: string; _id?: string; name?: string} | null | undefined, eventFanpageId: string): boolean {
    const eventId = String(eventFanpageId || '');
    if(!eventId) return false;
    const convIds = new Set(this.fanpageKeys(convFanpageId));
    if(convIds.has(eventId)) return true;
    const info = this.fanpageInfoMap()[eventId];
    if(info?.pageId && convIds.has(String(info.pageId))) return true;
    return false;
  }

  private isSameConversation(conv: ConversationSummary | undefined, fanpageId: string, senderPsid: string): boolean {
    if(!conv) return false;
    return conv.senderPsid === senderPsid && this.isSameFanpage(conv.fanpageId, fanpageId);
  }

  private promoteConversationFromEvent(ev: ChatRealtimeEvent){
    const createdAt = String(ev.createdAt || new Date().toISOString());
    this.items.update(list => {
      const next = [...list];
      const idx = next.findIndex(c => c.senderPsid === ev.senderPsid && this.isSameFanpage(c.fanpageId, ev.fanpageId));
      if(idx >= 0){
        const old = next[idx];
        const updated: ConversationSummary = {
          ...old,
          lastMessageSnippet: ev.snippet || old.lastMessageSnippet,
          lastMessageAt: createdAt,
          lastDirection: (ev.direction === 'in' || ev.direction === 'out') ? ev.direction : old.lastDirection,
          totalMessages: (old.totalMessages || 0) + 1,
          inboundCount: ev.direction === 'in' ? (old.inboundCount || 0) + 1 : (old.inboundCount || 0),
          outboundCount: ev.direction === 'out' ? (old.outboundCount || 0) + 1 : (old.outboundCount || 0),
          needsHuman: ev.direction === 'in' ? true : old.needsHuman,
          hasAwaitingHuman: ev.direction === 'in' ? true : old.hasAwaitingHuman,
          awaitingCount: ev.direction === 'in' ? Math.max(1, old.awaitingCount || 0) : (old.awaitingCount || 0),
        };
        next.splice(idx, 1);
        next.unshift(updated);
      } else if(this.page() === 1) {
        const fallback: ConversationSummary = {
          fanpageId: ev.fanpageId,
          senderPsid: ev.senderPsid,
          totalMessages: 1,
          inboundCount: ev.direction === 'in' ? 1 : 0,
          outboundCount: ev.direction === 'out' ? 1 : 0,
          awaitingCount: ev.direction === 'in' ? 1 : 0,
          lastMessageSnippet: ev.snippet || '',
          lastDirection: ev.direction === 'in' ? 'in' : 'out',
          lastMessageAt: createdAt,
          needsHuman: ev.direction === 'in',
          hasAwaitingHuman: ev.direction === 'in',
        };
        next.unshift(fallback);
        if(next.length > this.limit()) next.pop();
      }
      return next;
    });
  }

  private scheduleListRefresh(delayMs = 120){
    if(this.listRefreshTimer) return;
    this.listRefreshTimer = setTimeout(() => {
      this.listRefreshTimer = undefined;
      this.load();
    }, delayMs);
  }

  private scheduleDetailRefresh(delayMs = 100){
    if(this.detailRefreshTimer) return;
    this.detailRefreshTimer = setTimeout(() => {
      this.detailRefreshTimer = undefined;
      this.refreshCurrentConversation();
    }, delayMs);
  }

  private refreshCurrentConversation(){
    const c = this.currentConv();
    if(!c) return;
    const fpId = this.getFanpageId(c.fanpageId);
    if(!fpId) return;
    this.service.getConversation(fpId, c.senderPsid).subscribe({
      next: r => {
        this.currentConv.set(r.conversation);
        this.messages.set(r.messages.slice().sort((a,b)=> new Date(a.createdAt||'').getTime() - new Date(b.createdAt||'').getTime()));
        this.items.update(list => list.map(x => this.isSameConversation(x, fpId, c.senderPsid) ? r.conversation : x));
        const draft = this.orderDraft();
        const lastAdg: any = (r.conversation as any)?.lastAdGroupId;
        if(draft && !draft.adGroupId && lastAdg){
          this.orderDraft.set({ ...draft, adGroupId: lastAdg });
        }
        this.scrollMessagesToBottom();
      },
      error: _ => {}
    });
  }

  private scrollMessagesToBottom(){
    setTimeout(() => {
      const el = this.threadScroll?.nativeElement;
      if(!el) return;
      el.scrollTop = el.scrollHeight;
    }, 0);
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
        const cur = this.currentConv();
        if(cur){
          const curFpId = this.getFanpageId(cur.fanpageId);
          const matched = resp.items.find(x => this.isSameConversation(x, curFpId, cur.senderPsid));
          if(matched) this.currentConv.set(matched);
        }
        

        
        // Thu tháº­p thÃ´ng tin fanpage tá»« dá»¯ liá»‡u list (náº¿u backend tráº£ object)
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
        
        // Load chi phÃ­ quáº£ng cÃ¡o cho cÃ¡c adGroupId cÃ³ trong danh sÃ¡ch
        this.loadAdvertisingCosts(resp.items);
      },
      error: e=>{ this.error.set(e?.error?.message||'Lá»—i táº£i há»™i thoáº¡i'); this.loading.set(false); }
    });
  }

  open(conv: ConversationSummary){
    // Má»Ÿ modal ngay láº­p tá»©c vá»›i thÃ´ng tin cÃ³ sáºµn tá»« list
    this.showDetail.set(true);
    this.currentConv.set(conv);
    this.error.set('');
    this.messages.set([]); // Clear messages cÅ©
    
    const fpId = this.getFanpageId(conv.fanpageId);
    
  // Reset order panel state ngay - khÃ´ng cáº§n chá» API (prefill Ad Group náº¿u Ä‘Ã£ cÃ³)
  this.orderDraft.set({ fanpageId: fpId, senderPsid: conv.senderPsid, quantity:1, adGroupId: (conv.lastAdGroupId as any) });
  this.createdOrderId.set(undefined);
    
    // Chá»‰ load messages, khÃ´ng block modal
    this.detailLoading.set(true);
    
    // Load messages vá»›i timeout ngáº¯n Ä‘á»ƒ modal render trÆ°á»›c
    setTimeout(() => {
      this.service.getConversation(fpId, conv.senderPsid).subscribe({
        next: d=>{
          // Limit messages Ä‘á»ƒ render nhanh hÆ¡n (chá»‰ 50 tin nháº¯n gáº§n nháº¥t)
          const sortedMessages = d.messages.slice()
            .sort((a,b)=> new Date(b.createdAt||'').getTime() - new Date(a.createdAt||'').getTime())
            .slice(0, 50)
            .reverse(); // Äáº£o ngÆ°á»£c Ä‘á»ƒ tin nháº¯n cÅ© á»Ÿ trÃªn
          
          this.messages.set(sortedMessages);
          this.currentConv.set(d.conversation);
          // Cáº­p nháº­t thÃ´ng tin fanpage náº¿u payload cÃ³ object
          const fp: any = d.conversation?.fanpageId as any;
          if(fp && typeof fp === 'object' && (fp.pageId || fp._id) && fp.name){
            const map = { ...this.fanpageInfoMap() } as Record<string,{name:string; pageId:string}>;
            if(fp.pageId) map[fp.pageId] = { name: fp.name, pageId: fp.pageId };
            if(fp._id) map[fp._id] = { name: fp.name, pageId: fp.pageId || fp._id };
            this.fanpageInfoMap.set(map);
          }
          this.detailLoading.set(false);
          this.scrollMessagesToBottom();
          
          // Extract order cháº¡y ná»n, khÃ´ng block UI
          setTimeout(() => this.extractOrder(), 200);
          // Náº¿u Ad Group váº«n trá»‘ng, thá»­ láº¥y tá»« messages vá»«a náº¡p
          const draft = this.orderDraft();
          if(draft && !draft.adGroupId){
            const lastAdg = findLastAdGroupFromMessages(sortedMessages);
            if(lastAdg){ this.orderDraft.set({ ...draft, adGroupId: lastAdg as any }); }
          }
          // Náº¿u conversation cÃ³ lastAdGroupId mÃ  váº«n trá»‘ng, Ä‘iá»n tiáº¿p
          const convLastAdg: any = (d.conversation as any)?.lastAdGroupId;
          if(convLastAdg){
            const cur = this.orderDraft();
            if(cur && !cur.adGroupId){ this.orderDraft.set({ ...cur, adGroupId: convLastAdg }); }
          }
        },
        error: e=>{
          this.error.set(e?.error?.message||'Lá»—i táº£i há»™i thoáº¡i');
          this.detailLoading.set(false);
        }
      });
    }, 50); // Delay nhá» Ä‘á»ƒ modal render trÆ°á»›c
  }

  

  resolve(){
    const c = this.currentConv(); if(!c) return;
    const fpId = this.getFanpageId(c.fanpageId);
    this.service.resolveConversation(fpId, c.senderPsid).subscribe({
      next: d=>{ this.currentConv.set(d.conversation); this.messages.set(d.messages.slice().sort((a,b)=> new Date(a.createdAt||'').getTime() - new Date(b.createdAt||'').getTime())); this.items.update(arr=> arr.map(x=> this.isSameConversation(x, fpId, c.senderPsid) ? d.conversation : x)); this.scrollMessagesToBottom(); },
    });
  }

  toggleAI(){
    const c = this.currentConv(); if(!c) return;
    const target = !c.autoAiEnabled;
    const fpId = this.getFanpageId(c.fanpageId);
    this.service.toggleAutoAI(fpId, c.senderPsid, target).subscribe({
      next: res=>{
        this.currentConv.update(old=> old? {...old, autoAiEnabled: res.autoAiEnabled }: old);
        this.items.update(list=> list.map(x=> this.isSameConversation(x, fpId, c.senderPsid) ? {...x, autoAiEnabled: res.autoAiEnabled }: x));
      },
      error: e=> this.error.set(e?.error?.message||'Toggle AI tháº¥t báº¡i')
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
        const m = res.saved; // báº£n ghi Ä‘Ã£ lÆ°u sau khi gá»­i thÃ nh cÃ´ng
        this.messages.update(arr=> [...arr, m]);
        this.scrollMessagesToBottom();
        this.replyText.set('');
        this.promoteConversationFromEvent({
          type: 'new-message',
          fanpageId: fpId,
          senderPsid: c.senderPsid,
          direction: 'out',
          snippet: text.slice(0, 120),
          createdAt: new Date().toISOString(),
        });
        // Reload conversation summary Ä‘á»ƒ cáº­p nháº­t last message / counts
        this.service.getConversation(fpId, c.senderPsid).subscribe(r=>{
          this.currentConv.set(r.conversation);
          this.items.update(list=> list.map(x=> this.isSameConversation(x, fpId, c.senderPsid) ? r.conversation : x));
        });
        this.sending.set(false);
      },
      error: e=>{ this.sending.set(false); this.error.set(e?.error?.message||'Gá»­i tháº¥t báº¡i'); }
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
        this.scrollMessagesToBottom();
        this.promoteConversationFromEvent({
          type: 'new-message',
          fanpageId: fpId,
          senderPsid: c.senderPsid,
          direction: 'out',
          snippet: '[image]',
          createdAt: new Date().toISOString(),
        });
        // reload conversation summary
        this.service.getConversation(fpId, c.senderPsid).subscribe(r=>{
          this.currentConv.set(r.conversation);
          this.items.update(list=> list.map(x=> this.isSameConversation(x, fpId, c.senderPsid) ? r.conversation : x));
        });
        this.imageSending.set(false);
      },
      error: e => { this.error.set(e?.error?.message || 'Gá»­i áº£nh tháº¥t báº¡i'); this.imageSending.set(false); }
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
        this.scrollMessagesToBottom();
        this.promoteConversationFromEvent({
          type: 'new-message',
          fanpageId: fpId,
          senderPsid: c.senderPsid,
          direction: 'out',
          snippet: '[image]',
          createdAt: new Date().toISOString(),
        });
        // reload summary
        this.service.getConversation(fpId, c.senderPsid).subscribe(r=>{
          this.currentConv.set(r.conversation);
          this.items.update(list=> list.map(x=> this.isSameConversation(x, fpId, c.senderPsid) ? r.conversation : x));
        });
        this.imageSending.set(false);
        this.picking.set(false);
      },
      error: e => { this.error.set(e?.error?.message || 'Gá»­i áº£nh tháº¥t báº¡i'); this.imageSending.set(false); }
    });
  }

  extractOrder(){
    const c = this.currentConv(); if(!c) return; 
    
    // Set loading nhÆ°ng khÃ´ng block UI ngay
    this.orderExtractLoading.set(true);
    const fpId = this.getFanpageId(c.fanpageId);
    
    // Cháº¡y extract vá»›i delay Ä‘á»ƒ khÃ´ng áº£nh hÆ°á»Ÿng modal
    setTimeout(() => {
      this.service.extractOrder(fpId, c.senderPsid).subscribe({
        next: data=>{
          this.extractSuggestions.set(data);
          const s = data.suggestions||{};
          const current = this.orderDraft()||{};
          
          // Chá»‰ fill nhá»¯ng field chÆ°a cÃ³ data
          this.orderDraft.set({
            ...current,
            customerName: current.customerName || s.customerName,
            phone: current.phone || s.phone,
            address: current.address || s.address,
            quantity: current.quantity || s.quantity || 1,
            // Æ¯u tiÃªn gá»£i Ã½ tá»« backend; náº¿u chÆ°a cÃ³, fallback vá» lastAdGroupId cá»§a há»™i thoáº¡i
            adGroupId: current.adGroupId || s.adGroupId || (this.currentConv()?.lastAdGroupId as any) || findLastAdGroupFromMessages(this.messages())
          });
          
          this.orderExtractLoading.set(false);
        },
        error: err => {
          console.warn('Extract order failed:', err);
          this.orderExtractLoading.set(false);
        }
      });
    }, 300); // Delay lá»›n hÆ¡n Ä‘á»ƒ modal á»•n Ä‘á»‹nh trÆ°á»›c
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
    // Äáº£m báº£o quantity lÃ  sá»‘
    if(body.quantity) body.quantity = Number(body.quantity);
    this.draftSaving.set(true);
    const obs = draft._id ? this.pendingSvc.update(draft._id, body) : this.pendingSvc.create(body);
    obs.subscribe({
  next: p=>{ this.orderDraft.set(p); this.draftSaving.set(false); this.draftMsg.set(status==='draft' ? 'ÄÃ£ lÆ°u nhÃ¡p âœ…' : 'ÄÃ£ gá»­i chá» duyá»‡t âœ…'); },
      error: e=>{ console.warn('[PendingOrder] save failed', e); this.draftSaving.set(false); this.draftMsg.set(e?.error?.message || 'LÆ°u tháº¥t báº¡i'); }
    });
  }

  approve(){
    const draft = this.orderDraft();
    if(!draft){ return; }
    if(this.approveLoading() || this.draftSaving()) return; // trÃ¡nh double click
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
      this.draftMsg.set('Thiáº¿u: ' + missing.join(', '));
      return;
    }
    // Chuáº©n hÃ³a quantity
    const payload: PendingOrder = this.buildPendingPayload(draft, { quantity: Number(draft.quantity||1) });
    this.approveLoading.set(true);
    const persist$ = payload._id
      ? this.pendingSvc.update(payload._id, payload)
      : this.pendingSvc.create({ ...payload, status: 'draft' });
    persist$.subscribe({
      next: saved => {
  // persisted successfully, proceed to approve
        this.orderDraft.set(saved);
        // Gá»i approve
        this.pendingSvc.approve(saved._id!).subscribe({
          next: res => {
            // approved successfully
            this.approveLoading.set(false);
            const cur = this.orderDraft();
            this.orderDraft.set(cur ? { ...cur, status: 'approved' } : cur);
            // cáº­p nháº­t há»™i thoáº¡i
            this.currentConv.update(c => c ? { ...c, orderDraftStatus: 'approved', orderId: res.order?._id } : c);
            this.draftMsg.set('ÄÃ£ duyá»‡t & táº¡o Ä‘Æ¡n âœ…');
            if(res.order?._id) this.createdOrderId.set(res.order._id);
          },
          error: e => {
            console.warn('[PendingOrder] approve failed', e);
            this.approveLoading.set(false);
            const msg = e?.error?.message || 'Duyá»‡t tháº¥t báº¡i';
            // Náº¿u backend bÃ¡o field khÃ´ng há»£p lá»‡ -> gá»£i Ã½ nguyÃªn nhÃ¢n
            if(/should not exist/.test(msg)){
              this.draftMsg.set('Duyá»‡t tháº¥t báº¡i: dá»¯ liá»‡u gá»­i kÃ¨m field khÃ´ng há»£p lá»‡ (Ä‘Ã£ lá»c láº¡i, thá»­ láº¡i láº§n ná»¯a)');
            } else {
              // Náº¿u thiáº¿u productId hoáº·c agentId hoáº·c validate DTO
              if(/productId/.test(msg) && /MongoId/.test(JSON.stringify(e.error||{}))){
                this.draftMsg.set('Sai dinh dang productId (khong phai ObjectId hop le)');
              } else if(/agentId/.test(msg) && /MongoId/.test(JSON.stringify(e.error||{}))){
                this.draftMsg.set('Sai dinh dang agentId');
              } else if(/supplierId/.test(msg) && /MongoId/.test(JSON.stringify(e.error||{}))){
                this.draftMsg.set('Sai dinh dang supplierId');
              } else if(/fanpageId/.test(msg)){
                this.draftMsg.set('fanpageId khong hop le (hay mo lai cuoc hoi thoai)');
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
        this.draftMsg.set(e?.error?.message || 'LÆ°u trÆ°á»›c khi duyá»‡t tháº¥t báº¡i');
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
   * Chá»‰ chá»n cÃ¡c field há»£p lá»‡ theo DTO Ä‘á»ƒ trÃ¡nh ValidationPipe reject (whitelist + forbidNonWhitelisted).
   */
  private buildPendingPayload(src: PendingOrder, extra: Partial<PendingOrder> = {}): PendingOrder {
    const allowed: (keyof PendingOrder)[] = [
      'fanpageId','senderPsid','productId','agentId','supplierId','adGroupId','customerName','phone','address','quantity','status','notes','orderDate'
    ];
    const out: any = {};
    for(const k of allowed){ if((src as any)[k] !== undefined) out[k] = (src as any)[k]; }
    for(const [k,v] of Object.entries(extra)){ if(v !== undefined && allowed.includes(k as keyof PendingOrder)) out[k] = v; }
    if (!out.fanpageId) {
      const cur = this.currentConv();
      const fanpageId = cur ? this.getFanpageId(cur.fanpageId) : '';
      if (fanpageId) out.fanpageId = fanpageId;
    }
    return out as PendingOrder;
  }

  copyCreatedOrderId(){
    const id = this.createdOrderId(); if(!id) return;
    try {
      if(typeof navigator !== 'undefined' && (navigator as any).clipboard){
        (navigator as any).clipboard.writeText(id);
        this.draftMsg.set('ÄÃ£ copy ID Ä‘Æ¡n hÃ ng');
      } else {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = id; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        this.draftMsg.set('ÄÃ£ copy ID Ä‘Æ¡n hÃ ng');
      }
    } catch(err){
      console.warn('Copy failed', err);
      this.draftMsg.set('Copy ID tháº¥t báº¡i');
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
      'draft': 'ðŸ“ NhÃ¡p',
      'awaiting': 'â³ Chá» duyá»‡t', 
      'approved': 'âœ… ÄÃ£ duyá»‡t'
    };
    return statusMap[status as keyof typeof statusMap] || 'â“ KhÃ´ng xÃ¡c Ä‘á»‹nh';
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

  // Load chi phÃ­ quáº£ng cÃ¡o cho cÃ¡c adGroupId cÃ³ trong danh sÃ¡ch há»™i thoáº¡i
  private loadAdvertisingCosts(conversations: ConversationSummary[]): void {
    const uniqueAdGroupIds = Array.from(new Set(
      conversations
        .map(c => c.lastAdGroupId)
        .filter(id => id && String(id).trim())
    )) as string[];

    if (uniqueAdGroupIds.length === 0) return;

    const costMap = new Map<string, number>();
    
    // Load chi phÃ­ cho tá»«ng adGroupId
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

  // Helper Ä‘á»ƒ láº¥y chi phÃ­ theo adGroupId
  getAdvertisingCost(adGroupId?: string | null): number {
    if (!adGroupId) return 0;
    return this.adGroupCostMap().get(String(adGroupId)) || 0;
  }

  // ---- helpers ----
}


