import {Component,OnInit,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {environment} from '../../../environments/environment';
@Component({selector:'app-counterparty-ledger',standalone:true,imports:[CommonModule,FormsModule,RouterLink],
  templateUrl:'./counterparty.component.html',styles:[`
  :host{display:block;padding:24px;color:#e8eef6} h1,h2{margin:8px 0 16px}p{line-height:1.6;color:#adbdd1}
  section{background:#152338;border:1px solid #304259;border-radius:12px;padding:18px;margin:16px 0;overflow:auto}
  table{width:100%;border-collapse:collapse}td,th{padding:10px;text-align:left;border-bottom:1px solid #304259}th{color:#92c7ff}
  input,select,button,a{padding:8px;margin:4px;border-radius:6px}input,select{background:#0c1828;color:#fff;border:1px solid #50627a}
  button{cursor:pointer;background:#2268a8;color:#fff;border:0}button:disabled{opacity:.45;cursor:default}a{color:#86c2ff}
  .error{color:#ffb3b3;background:#522323;padding:12px}.notice{color:#b4edc6}.warn{color:#ffda8e}small{display:block}
  .money{text-align:right;white-space:nowrap}.actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  label{display:inline-flex;align-items:center}input[type=number]{width:130px}.evidence{width:min(700px,90%)}
  `]})
export class CounterpartyComponent implements OnInit{
  private http=inject(HttpClient);private route=inject(ActivatedRoute);private api=`${environment.apiUrl}/finance/business-ledger`;
  kind='supplier';groups:any[]=[];party:any=null;snapshot:any=null;statements:any[]=[];statement:any=null;accounts:any[]=[];
  selected=new Set<string>();amounts:Record<string,number>={};busy=false;error='';message='';evidence='';confirmation='';operationEvidence='';
  mode='payment';direction='receive';accountId='';paymentAmount=0;requestKey=crypto.randomUUID();operationKey=crypto.randomUUID();
  reference='';occurredAt=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  private reversalKeys=new Map<string,string>();
  timingRow:any=null;scheduleKey=crypto.randomUUID();
  schedule={dueDate:'',promisedDate:'',reason:'',evidence:''};
  editTiming(row:any){this.timingRow=row;this.scheduleKey=crypto.randomUUID();this.schedule={
    dueDate:row.paymentTiming?.dueDate||'',promisedDate:row.paymentTiming?.promisedDate||'',reason:'',evidence:''};}
  timingState(value:string){return ({settled:'Đã hết số dư',unscheduled:'Chưa có hạn',overdue:'Quá hạn',not_due:'Trong hạn'} as any)[value]||value;}
  saveTiming(){void this.run(async()=>{
    const row=this.timingRow;
    await firstValueFrom(this.http.post(`${this.api}/debt-schedules`,{
      requestKey:this.scheduleKey,partyKey:row.partyKey,orderId:row.orderId,
      direction:row.paymentTiming.direction,expectedRevision:row.paymentTiming.revision,sourceHash:this.snapshot.sourceHash,
      dueDate:this.schedule.dueDate||null,promisedDate:this.schedule.promisedDate||null,
      reason:this.schedule.reason,evidence:this.schedule.evidence,
    }));
    this.timingRow=null;await this.loadParty();await this.reload();
    this.message='Đã lưu lịch và căn cứ. Lịch sử cũ được giữ nguyên; tiền và lợi nhuận không thay đổi.';
  });}
  exportCapital(){void this.run(async()=>{
    const data=await firstValueFrom(this.http.get<any>(`${this.api}/capital-evidence`));
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='cong-no-lich-von-can-cu.json';a.click();URL.revokeObjectURL(url);
  });}
  ngOnInit(){this.kind=this.route.snapshot.data['counterpartyKind']||'supplier';void this.run(async()=>{
    this.accounts=await firstValueFrom(this.http.get<any[]>(`${this.api}/accounts`));await this.reload();
  });}
  async run(work:()=>Promise<void>){if(this.busy)return;this.busy=true;this.error='';this.message='';try{await work();}catch(e:any){this.error=Array.isArray(e.error?.message)?e.error.message.join('; '):e.error?.message||e.message||'Không thực hiện được. Số liệu không được coi là đã lưu.';}finally{this.busy=false;}}
  async reload(){const r=await firstValueFrom(this.http.get<any>(`${this.api}/counterparties`,{params:{kind:this.kind}}));this.groups=r.data;}
  switchKind(){this.party=null;this.statement=null;this.snapshot=null;this.timingRow=null;void this.run(()=>this.reload());}
  async loadParty(){this.snapshot=await firstValueFrom(this.http.get<any>(`${this.api}/counterparties/${this.party.partyKey}`));this.statements=await firstValueFrom(this.http.get<any[]>(`${this.api}/settlements`,{params:{partyKey:this.party.partyKey}}));}
  selectParty(g:any){void this.run(async()=>{this.party=g;this.statement=null;this.timingRow=null;await this.loadParty();this.selected=new Set(this.snapshot.rows.filter((r:any)=>r.balance&&!r.reviewReasons.length).map((r:any)=>r.orderId));this.requestKey=crypto.randomUUID();});}
  toggle(id:string,checked:boolean){checked?this.selected.add(id):this.selected.delete(id);}
  create(){void this.run(async()=>{const r:any=await firstValueFrom(this.http.post(`${this.api}/settlements`,{requestKey:this.requestKey,partyKey:this.party.partyKey,sourceHash:this.snapshot.sourceHash,orderIds:[...this.selected],evidence:this.evidence}));this.requestKey=crypto.randomUUID();await this.loadParty();await this.open(r._id);this.message='Đã lập bảng. Hai bên cần đối chiếu và xác nhận trước khi thanh toán.';});}
  async open(id:string){this.statement=await firstValueFrom(this.http.get<any>(`${this.api}/settlements/${id}`));this.amounts={};this.operationKey=crypto.randomUUID();}
  view(id:string){void this.run(()=>this.open(id));}
  confirm(){void this.run(async()=>{await firstValueFrom(this.http.post(`${this.api}/settlements/${this.statement._id}/confirm`,{evidence:this.confirmation}));await this.open(this.statement._id);this.message='Đã lưu bảng được xác nhận. Việc xác nhận chưa tạo thu/chi tiền.';});}
  allocate(){
    this.amounts={};const rows=this.statement.currentRows.filter((r:any)=>!r.reviewReasons.length);
    if(this.mode==='offset'){
      const positive=rows.reduce((n:number,r:any)=>n+Math.max(0,r.balance),0),negative=rows.reduce((n:number,r:any)=>n+Math.max(0,-r.balance),0);
      for(const sign of [1,-1]){let left=Math.min(positive,negative);for(const r of rows.filter((x:any)=>Math.sign(x.balance)===sign)){const take=Math.min(left,Math.abs(r.balance));this.amounts[r.orderId]=take;left-=take;}}
    }else{let left=this.paymentAmount;const sign=this.direction==='receive'?1:-1;for(const r of rows.filter((x:any)=>Math.sign(x.balance)===sign)){const take=Math.min(left,Math.abs(r.balance));this.amounts[r.orderId]=take;left-=take;}if(left>0)this.error='Số tiền vượt công nợ có thể phân bổ. Tiền ứng/trả thừa ghi riêng trong Sổ kinh doanh.';}
  }
  get allocatedTotal(){return (this.statement?.currentRows||[]).reduce((n:number,r:any)=>n+Number(this.amounts[r.orderId]||0)*Math.sign(r.balance),0);}
  operate(){void this.run(async()=>{
    if(Object.values(this.amounts).some(a=>!Number.isSafeInteger(Number(a))||Number(a)<0))throw new Error('Số phân bổ phải là số nguyên đồng không âm.');
    const allocations=this.statement.currentRows.filter((r:any)=>Number(this.amounts[r.orderId])>0).map((r:any)=>({orderId:r.orderId,amount:Number(this.amounts[r.orderId])*Math.sign(r.balance)}));
    if(this.mode==='payment'&&Math.abs(this.allocatedTotal)!==this.paymentAmount)throw new Error('Tổng phân bổ phải bằng đúng số tiền thực thu/chi đã nhập.');
    if(this.mode==='payment'&&Math.sign(this.allocatedTotal)!==(this.direction==='receive'?1:-1))throw new Error('Chiều thu/chi không khớp các khoản đã phân bổ.');
    await firstValueFrom(this.http.post(`${this.api}/settlements/${this.statement._id}/operations`,{requestKey:this.operationKey,sourceHash:this.statement.currentHash,mode:this.mode,allocations,evidence:this.operationEvidence,occurredAt:new Date(this.occurredAt).toISOString(),...(this.mode==='payment'?{accountId:this.accountId,reference:this.reference}:{})}));
    await this.open(this.statement._id);await this.loadParty();await this.reload();this.message='Đã ghi chứng từ và phân bổ. Chỉ khoản hết số dư được coi là tất toán.';
  });}
  reverse(op:any){void this.run(async()=>{if(!this.operationEvidence.trim())throw new Error('Nhập căn cứ đảo chứng từ ở ô chứng từ bên dưới.');
    const key=`${this.statement._id}:${op.requestKey}`;
    if(!this.reversalKeys.has(key))this.reversalKeys.set(key,crypto.randomUUID());
    await firstValueFrom(this.http.post(`${this.api}/settlements/${this.statement._id}/reverse`,{requestKey:this.reversalKeys.get(key),originalKey:op.requestKey,evidence:this.operationEvidence}));
    await this.open(this.statement._id);await this.loadParty();await this.reload();this.message='Đã đảo toàn bộ giao dịch và giữ lịch sử.';
  });}
  state(value:string){return ({draft:'Chờ đối chiếu',confirmed:'Đã xác nhận',outstanding:'Còn công nợ',partial:'Còn dư sau giao dịch',settled:'Đã hết số dư',needs_review:'Cần rà soát dữ liệu'} as any)[value]||value;}
  export(){
    const rows=this.statement?.rows||this.snapshot?.rows||[];const cell=(v:any)=>`"${String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,"'")}"`;
    const lines=[['Bảng đối soát',this.statement?._id||'Chưa chốt'],['Đối tác',this.party?.name],['Căn cứ',this.statement?.evidence||''],['Đơn/PO','Mã vận đơn','Nghĩa vụ (+thu/-trả)','Điều chỉnh','Biến động thanh toán','Còn lại','Cần rà soát'],...rows.map((r:any)=>[r.orderId,r.reference,r.obligation,r.adjustments,r.paymentMovement,r.balance,r.reviewReasons.join('; ')])];
    const url=URL.createObjectURL(new Blob(['\ufeff'+lines.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='doi-soat.csv';a.click();URL.revokeObjectURL(url);
  }
}
