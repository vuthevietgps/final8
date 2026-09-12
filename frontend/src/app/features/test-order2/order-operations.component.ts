import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-order-operations', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  template: `
  <div class="backdrop"><section role="dialog" aria-modal="true" aria-labelledby="operation-title">
    <header><h2 id="operation-title">Giao hàng & hàng hoàn · {{ order?.customerName }}</h2><button (click)="closed.emit()" [disabled]="busy">Đóng</button></header>
    <p *ngIf="error" role="alert" class="error">{{ error }}</p>
    <p *ngIf="message" role="status">{{ message }}</p>
    <ng-container *ngIf="order">
      <p>{{ order.saleMode === 'dealer' ? 'Bán cho đại lý ngoài: tiền hàng được ghi nhận một lần khi xuất; đại lý chịu phí của từng lần giao và hoàn.' : 'Công ty bán lẻ: doanh thu theo lượng giao thành công. Hàng nhận lại có giá trị sẽ vào kho công ty.' }}</p>
      <p *ngIf="order.profitAssessment"><b>{{ order.profitAssessment.label }}</b> · {{ order.profitAssessment.reasons.join('; ') }}</p>
      <div class="totals"><span>Doanh thu hàng: {{ order.recognizedRevenue | number }} đ</span><span>Giá vốn đã ghi nhận: {{ order.recognizedGoodsCost | number }} đ</span><span>Lãi trước điều chỉnh sổ: {{ order.netProfit | number }} đ</span></div>
      <p>Con số trên đã trừ chi phí phân bổ. Các điều chỉnh nhập riêng được tính thêm trong báo cáo Sổ kinh doanh theo đơn hàng.</p>
      <a routerLink="/finance/business-ledger" [queryParams]="{orderId: order._id}">Mở công nợ và ghi nhận thu / chi thực tế</a>

      <fieldset *ngIf="!order.shipments?.length && !order.trackingNumber" [disabled]="busy">
        <legend>Nguồn hàng</legend>
        <label>Nguồn <select [(ngModel)]="source"><option value="supplier">Mua mới từ nhà cung cấp</option><option value="inventory">Hàng công ty đang có</option><option *ngIf="order.agentId" value="dealer_custody">Hàng đang giữ hộ chính đại lý này</option></select></label>
        <label *ngIf="source !== 'supplier'">Lô hàng <select [(ngModel)]="batchId" (ngModelChange)="chooseBatch()"><option value="">Chọn lô</option><option *ngFor="let b of eligibleBatches()" [value]="b._id">{{ batchLabel(b) }}</option></select></label>
        <button (click)="saveSource()">Lưu nguồn và giữ hàng</button>
      </fieldset>

      <h3>Lịch sử từng lần giao</h3>
      <table><thead><tr><th>Mã vận đơn</th><th>Trạng thái</th><th>Bên gửi → nhận hoàn</th><th>Phí giao / hoàn</th><th>Thu đại lý giao / hoàn</th><th>Đối soát phí</th></tr></thead><tbody>
        <tr *ngFor="let s of order.shipments"><td>{{ s.trackingNumber }}</td><td>{{ statusLabel(s.status) }}<br>{{ s.deliveredQuantity || 0 }}/{{ s.quantity }} đã giao</td><td>{{ partyName(s.senderKind,s.senderId) }} → {{ partyName(s.returnHolderKind,s.returnHolderId) }}</td><td>{{ s.shippingCost | number }} / {{ s.returnCost | number }}</td><td>{{ s.dealerShippingCharge | number }} / {{ s.dealerReturnCharge | number }}</td><td>{{ s.feesConfirmed ? 'Đã xác nhận' : 'Tạm tính' }}<br><button (click)="editFees(s)">Xác nhận / điều chỉnh phí</button><small *ngFor="let r of s.feeRevisions">{{ r.at | date:'short' }} · {{ r.evidence }} · Giao {{ r.before.shippingCost | number }} → {{ r.after.shippingCost | number }}, hoàn {{ r.before.returnCost | number }} → {{ r.after.returnCost | number }}</small></td></tr>
      </tbody></table>
      <p *ngIf="!order.shipments?.length">Chưa có lịch sử lần giao. {{ order.trackingNumber ? 'Đơn có vận đơn cũ cần đối chiếu trước khi chuyển sang luồng mới.' : '' }}</p>

      <button *ngIf="last?.status === 'preparing'" [disabled]="busy" (click)="resumeShipment()">Tiếp tục lần xuất đang xử lý</button>
      <fieldset *ngIf="canDispatch()" [disabled]="busy"><legend>{{ last ? 'Giao lại hàng của đại lý' : 'Xuất hàng' }}</legend>
        <p *ngIf="last">Chọn đúng hàng của đại lý đã nhận hoàn. Lần này chỉ phát sinh phí mới, không bán lại tiền hàng.</p>
        <label *ngIf="last">Lô hàng hoàn <select [(ngModel)]="batchId" (ngModelChange)="chooseBatch()"><option value="">Chọn lô</option><option *ngFor="let b of eligibleBatches()" [value]="b._id">{{ batchLabel(b) }}</option></select></label>
        <label>Mã vận đơn <input [(ngModel)]="dispatch.trackingNumber" required /></label>
        <label>Bên gửi <select [(ngModel)]="dispatch.senderKind" (ngModelChange)="dispatch.senderId='' "><option value="company">Công ty</option><option value="supplier">Nhà cung cấp</option><option value="agent">Đại lý</option></select></label>
        <label *ngIf="dispatch.senderKind !== 'company'">Người gửi <select [(ngModel)]="dispatch.senderId"><option value="">Chọn người gửi</option><option *ngFor="let p of parties(dispatch.senderKind)" [value]="p._id">{{ p.name || p.fullName }}</option></select></label>
        <label>Địa chỉ gửi <input [(ngModel)]="dispatch.senderAddress" /></label>
        <label><input type="checkbox" [(ngModel)]="differentReturn" /> Nhận hoàn ở nơi khác bên gửi</label>
        <ng-container *ngIf="differentReturn">
          <label>Bên nhận hoàn <select [(ngModel)]="dispatch.returnHolderKind" (ngModelChange)="dispatch.returnHolderId='' "><option value="company">Công ty</option><option value="supplier">Nhà cung cấp</option><option value="agent">Đại lý</option></select></label>
          <label *ngIf="dispatch.returnHolderKind !== 'company'">Người nhận hoàn <select [(ngModel)]="dispatch.returnHolderId"><option value="">Chọn người nhận</option><option *ngFor="let p of parties(dispatch.returnHolderKind)" [value]="p._id">{{ p.name || p.fullName }}</option></select></label>
          <label>Địa chỉ nhận hoàn <input [(ngModel)]="dispatch.returnAddress" /></label>
        </ng-container>
        <div class="grid"><label>Phí giao phải trả <input type="number" min="0" [(ngModel)]="dispatch.shippingCost" /></label><label>Phí hoàn dự kiến <input type="number" min="0" [(ngModel)]="dispatch.returnCostQuote" /></label>
          <label *ngIf="order.agentId">Phí giao thu đại lý <input type="number" min="0" [(ngModel)]="dispatch.dealerShippingCharge" /></label><label *ngIf="order.agentId">Phí hoàn báo đại lý <input type="number" min="0" [(ngModel)]="dispatch.dealerReturnChargeQuote" /></label></div>
        <label>Trả phí cho <select [(ngModel)]="dispatch.feePayeeKind"><option value="supplier">Nhà cung cấp của đơn</option><option value="other">Đơn vị vận chuyển / bên khác</option></select></label>
        <label *ngIf="dispatch.feePayeeKind === 'other'">Tên bên nhận phí <input [(ngModel)]="dispatch.feePayeeName" /></label>
        <button (click)="createShipment()">Xác nhận xuất hàng</button>
      </fieldset>

      <fieldset *ngIf="last && ['dispatched','returning'].includes(last.status)" [disabled]="busy"><legend>Kết quả giao hàng</legend>
        <label>Kết quả <select [(ngModel)]="completion.status"><option value="delivered">Giao thành công toàn bộ</option><option value="partial">Giao thành công một phần</option><option value="returning">Đang hoàn hàng</option><option value="returned">Đã hoàn về bên gửi</option></select></label>
        <label *ngIf="completion.status === 'partial'">Số lượng giao thành công <input type="number" min="1" [max]="last.quantity-1" [(ngModel)]="completion.deliveredQuantity" /></label>
        <label *ngIf="completion.status !== 'delivered'">Phí hoàn thực tế <input type="number" min="0" [(ngModel)]="completion.returnCost" /></label>
        <label *ngIf="completion.status !== 'delivered' && order.agentId">Phí hoàn thu đại lý <input type="number" min="0" [(ngModel)]="completion.dealerReturnCharge" /></label>
        <label><input type="checkbox" [(ngModel)]="completion.feesConfirmed" /> Đã kiểm tra phí với bên giao hàng</label>
        <button (click)="completeShipment()">Lưu kết quả</button>
      </fieldset>

      <fieldset *ngIf="last && ['returning','returned','partial'].includes(last.status)" [disabled]="busy"><legend>Nhận và kiểm tra hàng hoàn</legend>
        <p>Chủ hàng: {{ order.saleMode === 'dealer' ? partyName('agent',id(order.agentId)) : 'Công ty' }}. Nơi nhận: {{ partyName(last.returnHolderKind,last.returnHolderId) }}. Đã nhận {{ order.receivedReturnQuantity || 0 }}/{{ last.quantity-(last.deliveredQuantity || 0) }} món.</p>
        <label>Số lượng đang nhận <input type="number" min="1" [(ngModel)]="receiptQuantity" /></label>
        <label>Kết quả kiểm tra <select [(ngModel)]="receiptDecision"><option *ngIf="order.resalePolicySnapshot !== 'not_resellable'" value="restock">Còn dùng được — nhập lô có thể giao lại</option><option value="scrap">Không còn giá trị — ghi nhận loại bỏ</option></select></label>
        <label *ngIf="receiptDecision === 'restock'">Giá trị thu hồi mỗi món (tối đa {{ order.inventoryUnitCostSnapshot ?? order.supplierAppliedPrice | number }} đ) <input type="number" min="0" [(ngModel)]="recoveryCost" /></label>
        <label>Ghi chú kiểm tra <input [(ngModel)]="receiptNote" /></label>
        <button (click)="receiveReturn()">Xác nhận nhận hàng hoàn</button>
      </fieldset>
      <fieldset *ngIf="feeShipmentId" [disabled]="busy"><legend>Đối soát phí vận đơn {{ feeTracking }}</legend>
        <label>Phí giao phải trả <input type="number" min="0" [(ngModel)]="feeEdit.shippingCost" /></label>
        <label>Phí hoàn phải trả <input type="number" min="0" [(ngModel)]="feeEdit.returnCost" /></label>
        <label *ngIf="order.agentId">Phí giao thu đại lý <input type="number" min="0" [(ngModel)]="feeEdit.dealerShippingCharge" /></label>
        <label *ngIf="order.agentId">Phí hoàn thu đại lý <input type="number" min="0" [(ngModel)]="feeEdit.dealerReturnCharge" /></label>
        <label>Chứng từ / lý do điều chỉnh <input [(ngModel)]="feeEdit.evidence" /></label>
        <button (click)="saveFees()">Xác nhận phí và lưu lịch sử</button><button (click)="feeShipmentId=''">Hủy</button>
      </fieldset>
      <h3>Phiếu nhận hoàn</h3><p *ngFor="let r of receipts">{{ r.createdAt | date:'short' }} · {{ r.status === 'resolved' ? 'Đã nhận và xử lý' : 'Đang chờ xử lý — bấm xác nhận nhận hàng để tiếp tục' }} · {{ r.reason }}</p>
    </ng-container>
  </section></div>`,
  styles: [`:host{position:relative;z-index:2000}.backdrop{position:fixed;inset:0;background:#0008;display:flex;align-items:flex-start;justify-content:center;padding:3vh 16px;overflow:auto}section{background:#fff;color:#182434;padding:24px;border-radius:12px;width:min(1080px,100%);box-shadow:0 12px 60px #0004}header,.totals{display:flex;gap:20px;justify-content:space-between;align-items:center}h2{margin:0}fieldset{margin:20px 0;padding:16px;border:1px solid #cbd5e1;border-radius:8px}label{display:block;margin:10px 0}input:not([type=checkbox]),select{display:block;padding:8px;border:1px solid #94a3b8;border-radius:4px;width:100%;box-sizing:border-box}button{padding:9px 14px;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}table{width:100%;border-collapse:collapse}td,th{padding:9px;text-align:left;border-bottom:1px solid #ddd}.error{color:#b91c1c;background:#fef2f2;padding:12px}@media(max-width:600px){.grid{grid-template-columns:1fr}.totals{display:block}section{padding:12px}}`],
})
export class OrderOperationsComponent implements OnInit {
  @Input({required:true}) orderId!: string;
  @Input() suppliers: any[] = [];
  @Input() agents: any[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() changed = new EventEmitter<void>();
  private http = inject(HttpClient); private base = environment.apiUrl;
  order: any; batches: any[] = []; receipts: any[] = []; busy=false; error=''; message='';
  feeShipmentId=''; feeTracking=''; feeEdit:any={};
  source='supplier'; batchId=''; differentReturn=false;
  dispatch: any = {requestKey: crypto.randomUUID(),trackingNumber:'',senderKind:'company',senderId:'',senderAddress:'',returnHolderKind:'company',returnHolderId:'',returnAddress:'',shippingCost:0,returnCostQuote:0,dealerShippingCharge:0,dealerReturnChargeQuote:0,feePayeeKind:'supplier',feePayeeName:''};
  completion: any = {status:'delivered',deliveredQuantity:1,returnCost:0,dealerReturnCharge:0,feesConfirmed:false};
  receiptQuantity=1; receiptDecision='restock'; recoveryCost=0; receiptNote='';
  id(value:any):string { return value?._id || value || ''; }
  get last():any { return this.order?.shipments?.at(-1); }
  parties(kind:string):any[] { return kind === 'supplier' ? this.suppliers : this.agents; }
  partyName(kind:string,id?:string):string { return kind === 'company' ? 'Công ty' : this.parties(kind).find(p=>p._id===id)?.name || this.parties(kind).find(p=>p._id===id)?.fullName || (kind === 'supplier' ? 'Nhà cung cấp' : 'Đại lý'); }
  statusLabel(s:string):string { return ({preparing:'Đang chuẩn bị',dispatched:'Đang giao',delivered:'Giao thành công',returning:'Đang hoàn',returned:'Đã hoàn',partial:'Giao một phần'} as any)[s] || s; }
  batchLabel(b:any):string { return `${b.receivedAt?.slice(0,10)} · còn ${b.quantityRemaining-(b.quantityReserved || 0)} · ${b.unitCost.toLocaleString('vi-VN')} đ · giữ tại ${this.partyName(b.holderKind,b.holderId)} · lô …${b._id.slice(-6)}`; }
  eligibleBatches():any[] { return this.batches.filter(b=> (this.last || this.source === 'dealer_custody') ? b.ownerKind==='dealer' && b.ownerId===this.id(this.order.agentId) : b.ownerKind==='company'); }
  chooseBatch():void { const b=this.batches.find(b=>b._id===this.batchId); if(b) {this.dispatch.senderKind=b.holderKind;this.dispatch.senderId=b.holderId || '';this.dispatch.senderAddress=b.holderAddress || '';} }
  canDispatch():boolean { return !!this.order && ((!this.last && !this.order.trackingNumber) || (!!this.order.agentId && this.last?.status==='returned' && this.order.receivedReturnQuantity>=this.last.quantity)); }
  ngOnInit():void { void this.run(()=>this.load()); }
  async load():Promise<void> {
    this.order=await firstValueFrom(this.http.get<any>(`${this.base}/test-order2/${this.orderId}`));
    this.source=this.order.productSource || 'supplier';this.batchId=this.id(this.order.inventoryBatchId);
    const results=await Promise.allSettled([
      firstValueFrom(this.http.get<any[]>(`${this.base}/inventory/batches`,{params:{productId:this.id(this.order.productId),orderId:this.orderId}})),
      firstValueFrom(this.http.get<any[]>(`${this.base}/returns`,{params:{orderId:this.orderId}})),
    ]);
    this.batches=results[0].status==='fulfilled'?results[0].value:[];
    this.receipts=results[1].status==='fulfilled'?results[1].value:[];
    if(results.some(r=>r.status==='rejected')) this.error='Không tải được kho hoặc phiếu hoàn. Cần quyền quản lý kho/nhập hàng để sử dụng đầy đủ.';
    this.dispatch.senderKind=this.order.senderKind || (this.order.supplierId?'supplier':'company');
    this.dispatch.senderId=this.order.senderId || this.id(this.order.supplierId);
    this.dispatch.shippingCost=this.order.supplierShippingFeeSnapshot ?? this.order.shippingFee ?? 0;
    this.dispatch.returnCostQuote=this.order.supplierReturnFeeSnapshot ?? this.order.returnFee ?? 0;
    this.dispatch.dealerShippingCharge=this.order.dealerShippingFeeSnapshot ?? this.dispatch.shippingCost;
    this.dispatch.dealerReturnChargeQuote=this.order.dealerReturnFeeSnapshot ?? this.dispatch.returnCostQuote;
    this.completion.returnCost=this.last?.returnCostQuote ?? this.dispatch.returnCostQuote;
    this.completion.dealerReturnCharge=this.last?.dealerReturnChargeQuote ?? this.dispatch.dealerReturnChargeQuote;
    this.recoveryCost=this.order.inventoryUnitCostSnapshot ?? this.order.supplierAppliedPrice ?? 0;
    if(this.order.resalePolicySnapshot==='not_resellable') this.receiptDecision='scrap';
    this.chooseBatch();
  }
  async run(action:()=>Promise<void>):Promise<void> { if(this.busy)return;this.busy=true;this.error='';this.message='';try{await action();}catch(e:any){this.error=Array.isArray(e?.error?.message)?e.error.message.join('; '):e?.error?.message || e.message || 'Không thực hiện được';}finally{this.busy=false;} }
  saveSource():void { void this.run(async()=>{await firstValueFrom(this.http.patch(`${this.base}/test-order2/${this.orderId}`,{productSource:this.source,inventoryBatchId:this.source==='supplier'?null:this.batchId}));await this.load();this.changed.emit();this.message='Đã lưu nguồn hàng.';}); }
  editFees(s:any):void { this.feeShipmentId=s._id;this.feeTracking=s.trackingNumber;this.feeEdit={requestKey:crypto.randomUUID(),shippingCost:s.shippingCost,returnCost:s.returnCost,dealerShippingCharge:this.order.saleMode==='dealer'?s.dealerShippingCharge:0,dealerReturnCharge:this.order.saleMode==='dealer'?s.dealerReturnCharge:0,evidence:''}; }
  saveFees():void {void this.run(async()=>{await firstValueFrom(this.http.patch(this.base+'/test-order2/'+this.orderId+'/shipments/'+this.feeShipmentId+'/fees',this.feeEdit));this.feeShipmentId='';await this.load();this.changed.emit();this.message='Đã lưu đối soát phí, giữ lại giá trước điều chỉnh.';});}
  resumeShipment():void { void this.run(async()=>{await firstValueFrom(this.http.post(`${this.base}/test-order2/${this.orderId}/shipments/${this.last._id}/resume`,{}));await this.load();this.changed.emit();}); }
  createShipment():void { void this.run(async()=>{const body={...this.dispatch};if(this.order.saleMode!=='dealer'){body.dealerShippingCharge=0;body.dealerReturnChargeQuote=0;}if(!this.differentReturn){delete body.returnHolderKind;delete body.returnHolderId;delete body.returnAddress;}for(const k of ['senderId','returnHolderId'])if(!body[k])delete body[k];if(this.batchId)body.inventoryBatchId=this.batchId;await firstValueFrom(this.http.post(`${this.base}/test-order2/${this.orderId}/shipments`,body));this.dispatch.requestKey=crypto.randomUUID();this.dispatch.trackingNumber='';await this.load();this.changed.emit();this.message='Đã ghi nhận lần xuất hàng.';}); }
  completeShipment():void { void this.run(async()=>{await firstValueFrom(this.http.patch(`${this.base}/test-order2/${this.orderId}/shipments/${this.last._id}`,this.completion));await this.load();this.changed.emit();this.message='Đã cập nhật kết quả giao hàng.';}); }
  receiveReturn():void { void this.run(async()=>{
    let receipt=this.receipts.find(r=>r.status==='pending');
    if(!receipt){receipt=await firstValueFrom(this.http.post<any>(`${this.base}/returns`,{orderId:this.orderId,shipmentId:this.last._id,reason:this.receiptNote,items:[{productId:this.id(this.order.productId),quantityReturned:this.receiptQuantity}]}));this.receipts.unshift(receipt);}
    await firstValueFrom(this.http.patch(`${this.base}/returns/${receipt._id}/resolve`,{reason:this.receiptNote,items:receipt.items.map((i:any)=>({itemId:i._id,quantity:i.quantityReturned,decision:this.receiptDecision,...(this.receiptDecision==='restock'?{recoveryUnitCost:this.recoveryCost}:{})}))}));
    await this.load();this.changed.emit();this.message='Đã nhận hàng và cập nhật chủ hàng, tồn kho, giá trị thu hồi.';
  }); }
}
