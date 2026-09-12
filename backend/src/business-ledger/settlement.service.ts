import {BadRequestException,ConflictException,Injectable,NotFoundException,OnModuleInit,Optional} from '@nestjs/common';
import {EventEmitter2} from '@nestjs/event-emitter';
import {notifyLedgerChanged} from './ledger-events';
import {InjectModel} from '@nestjs/mongoose';
import {Model,Types} from 'mongoose';
import {LedgerSettlement} from './settlement.schema';
import {LedgerEntry,LedgerAccount} from './business-ledger.schema';
import {CounterpartyLedgerService} from './counterparty-ledger.service';
import {CreateSettlementDto,SettlementOperationDto,ReverseSettlementDto} from './settlement.dto';
import {reverseEffects} from './business-ledger.rules';
import {settlementPlan} from './settlement.rules';
@Injectable()
export class SettlementService implements OnModuleInit{
  constructor(@InjectModel(LedgerSettlement.name) private statements:Model<LedgerSettlement>,
    @InjectModel(LedgerEntry.name) private entries:Model<LedgerEntry>,@InjectModel(LedgerAccount.name) private accounts:Model<LedgerAccount>,
    private counterparties:CounterpartyLedgerService,@Optional() private events?:EventEmitter2){}
  async onModuleInit(){await this.statements.createIndexes();}
  private actor(id:string){if(!Types.ObjectId.isValid(id))throw new BadRequestException('Người thao tác không hợp lệ.');}
  private identifier(id:string){if(!Types.ObjectId.isValid(id))throw new BadRequestException('Mã bảng không hợp lệ.');}
  private async touchSources(rows:any[],session:any){
    const ids=rows.map(r=>r.orderId);
    const orders=ids.filter(x=>Types.ObjectId.isValid(x)).map(x=>new Types.ObjectId(x));
    const purchases=ids.filter(x=>x.startsWith('purchase:')&&Types.ObjectId.isValid(x.slice(9))).map(x=>new Types.ObjectId(x.slice(9)));
    if(orders.length)await this.entries.db.collection('ordertest2').updateMany({_id:{$in:orders}},{$inc:{__v:1}},{session});
    if(purchases.length)await this.entries.db.collection('purchaseorders').updateMany({_id:{$in:purchases}},{$inc:{__v:1}},{session});
  }
  private async atomic<T>(work:(session:any)=>Promise<T>){
    const session=await this.entries.db.startSession();let result:T;
    try{await session.withTransaction(async()=>{
      await this.entries.db.collection('businessledgerlocks').updateOne({_id:'journal' as any},{$inc:{revision:1}},{upsert:true,session});
      result=await work(session);
    });notifyLedgerChanged(this.events);return result;}catch(e){if(e.code===11000)throw new ConflictException('Yêu cầu đã tồn tại; tải lại để kiểm tra.');throw e;}finally{await session.endSession();}
  }
  async create(dto:CreateSettlementDto,actor:string){
    this.actor(actor);if(!dto.evidence.trim())throw new BadRequestException('Cần căn cứ lập bảng.');
    const requestHash=this.counterparties.hash([dto]);
    const old=await this.statements.findOne({requestKey:dto.requestKey}).lean();
    if(old){if(old.requestHash!==requestHash)throw new ConflictException('Mã yêu cầu đã dùng cho nội dung khác.');return old;}
    const snapshot=await this.counterparties.snapshot(dto.partyKey);
    if(snapshot.sourceHash!==dto.sourceHash)throw new ConflictException('Công nợ đã thay đổi; tải lại trước khi lập bảng.');
    const rows=snapshot.rows.filter(r=>dto.orderIds.includes(r.orderId));
    if(rows.length!==dto.orderIds.length||rows.some(r=>r.reviewReasons.length||!r.context))throw new BadRequestException('Chỉ lập bảng cho các đơn đã đủ dữ liệu và không trùng.');
    return this.statements.create({requestKey:dto.requestKey,requestHash,partyKey:dto.partyKey,rows,sourceHash:this.counterparties.hash(rows),evidence:dto.evidence,createdBy:actor});
  }
  async list(partyKey?:string){
    if(partyKey&&!/^(supplier|agent):[a-f0-9]{24}$/i.test(partyKey))throw new BadRequestException('Đối tác không hợp lệ.');
    return this.statements.find(partyKey?{partyKey}:{}).sort({createdAt:-1}).limit(100).lean();
  }
  async detail(id:string){
    if(!Types.ObjectId.isValid(id))throw new BadRequestException('Mã bảng không hợp lệ.');
    const statement=await this.statements.findById(id).lean();if(!statement)throw new NotFoundException('Không tìm thấy bảng đối soát.');
    const snapshot=await this.counterparties.snapshot(statement.partyKey);
    const currentRows=snapshot.rows.filter(r=>statement.rows.some(x=>x.orderId===r.orderId));
    return{...statement,currentRows,currentHash:this.counterparties.hash(currentRows),
      paymentState:currentRows.length!==statement.rows.length||currentRows.some(r=>r.reviewReasons.length)?'needs_review':currentRows.every(r=>r.balance===0)?'settled':statement.operations.length?'partial':'outstanding'};
  }
  async confirm(id:string,evidence:string,actor:string){
    this.identifier(id);this.actor(actor);if(!evidence?.trim())throw new BadRequestException('Cần bằng chứng hai bên xác nhận.');
    return this.atomic(async session=>{
      const statement=await this.statements.findById(id).session(session);if(!statement)throw new NotFoundException('Không tìm thấy bảng.');
      if(statement.status==='confirmed')return statement;
      const snapshot=await this.counterparties.snapshot(statement.partyKey,session);
      const rows=snapshot.rows.filter(r=>statement.rows.some(x=>x.orderId===r.orderId));
      if(this.counterparties.hash(rows)!==statement.sourceHash)throw new ConflictException('Số liệu đã đổi; lập bảng đối soát mới.');
      await this.touchSources(rows,session);
      statement.status='confirmed';statement.confirmedAt=new Date();statement.confirmedBy=actor;statement.confirmationEvidence=evidence;
      await statement.save({session});return statement;
    });
  }
  async operate(id:string,dto:SettlementOperationDto,actor:string){
    this.identifier(id);this.actor(actor);if(!dto.evidence?.trim())throw new BadRequestException('Cần chứng từ thanh toán/đối trừ.');
    const occurredAt=new Date(dto.occurredAt);
    if(!Number.isFinite(+occurredAt)||+occurredAt>Date.now())throw new BadRequestException('Ngày giao dịch không hợp lệ hoặc ở tương lai.');
    return this.atomic(async session=>{
      const statement=await this.statements.findById(id).session(session);if(!statement||statement.status!=='confirmed')throw new BadRequestException('Bảng chưa được hai bên xác nhận.');
      const hash=this.counterparties.hash([dto]);const old=statement.operations.find(o=>o.requestKey===dto.requestKey);
      if(old){if(old.hash!==hash)throw new ConflictException('Mã giao dịch đã dùng cho nội dung khác.');return statement;}
      const snapshot=await this.counterparties.snapshot(statement.partyKey,session);
      const rows=snapshot.rows.filter(r=>statement.rows.some(x=>x.orderId===r.orderId));
      if(rows.length!==statement.rows.length)throw new ConflictException('Thiếu đơn trong bảng; cần rà soát nguồn dữ liệu.');
      if(this.counterparties.hash(rows)!==dto.sourceHash)throw new ConflictException('Số dư đã thay đổi; tải lại để phân bổ đúng.');
      let plan;try{plan=settlementPlan(rows,dto.allocations,dto.mode,dto.accountId);}catch(e){throw new BadRequestException(e.message);}
      const now=new Date();let receiptKey:string;
      if(dto.mode==='payment'){
        const account=await this.accounts.findById(dto.accountId).session(session).lean();
        if(!account||+new Date(account.openingAt)>+occurredAt)throw new BadRequestException('Tài khoản nhận/chi hoặc ngày so với số dư đầu kỳ không hợp lệ.');
        if(!dto.reference?.trim())throw new BadRequestException('Cần mã giao dịch ngân hàng hoặc số phiếu thu/chi duy nhất.');
        receiptKey=this.counterparties.hash([dto.accountId,dto.reference.trim()]);
        // A bank/cash receipt cannot be posted twice, even with another request key or statement.
        await this.entries.db.collection('businessledgerpaymentreceipts').updateOne({_id:receiptKey as any,status:'reversed'},
          {$set:{status:'active',statementId:id,operationKey:dto.requestKey,reference:dto.reference.trim(),accountId:dto.accountId}},{upsert:true,session});
      }
      // Touch affected orders in the same transaction to conflict with concurrent operational edits.
      await this.touchSources(plan.plans.map(p=>p.row),session);
      const docs=plan.plans.map(({row,amount},i)=>({
        idempotencyKey:`settlement:${id}:${dto.requestKey}:${i}`,requestHash:hash,
        kind:dto.mode==='payment'?'payment':'debt_offset',amount:Math.abs(amount),status:'confirmed',occurredAt,
        evidence:dto.evidence,description:`${dto.mode==='payment'?'Thanh toán':'Đối trừ'} bảng ${id}`,
        posting:{kind:dto.mode==='payment'?'payment':'debt_offset',amount:Math.abs(amount)},
        effects:{revenue:0,cogs:0,expense:0,debts:[{partyKey:statement.partyKey,amount:-amount}],cash:dto.mode==='payment'?[{accountId:dto.accountId,amount}]:[]},
        context:row.context,orderId:row.orderId,createdBy:actor,confirmedBy:actor,confirmedAt:now,settlementId:id,
      }));
      const inserted=await this.entries.create(docs,{session});
      statement.operations.push({requestKey:dto.requestKey,hash,mode:dto.mode,net:plan.net,allocations:dto.allocations,evidence:dto.evidence,at:now,occurredAt,accountId:dto.accountId,reference:dto.reference,receiptKey,actorId:actor,entryIds:inserted.map(e=>String(e._id))});
      statement.markModified('operations');await statement.save({session});return statement;
    });
  }
  async reverse(id:string,dto:ReverseSettlementDto,actor:string){
    this.identifier(id);this.actor(actor);if(!dto.evidence?.trim())throw new BadRequestException('Cần căn cứ đảo chứng từ.');
    return this.atomic(async session=>{
      const statement=await this.statements.findById(id).session(session);if(!statement||statement.status!=='confirmed')throw new BadRequestException('Bảng chưa xác nhận.');
      const hash=this.counterparties.hash([dto]);const prior=statement.operations.find(o=>o.requestKey===dto.requestKey);
      if(prior){if(prior.hash!==hash)throw new ConflictException('Mã yêu cầu đã dùng cho nội dung khác.');return statement;}
      const op=statement.operations.find(o=>o.requestKey===dto.originalKey&&o.mode!=='reversal');
      if(!op)throw new BadRequestException('Không tìm thấy giao dịch gốc.');
      const originals=await this.entries.find({_id:{$in:op.entryIds},status:'confirmed'}).session(session).lean();
      if(originals.length!==op.entryIds.length||await this.entries.exists({reversalOf:{$in:op.entryIds},status:'confirmed'}).session(session))throw new ConflictException('Giao dịch gốc thiếu hoặc đã được đảo.');
      const now=new Date();
      const created=await this.entries.create(originals.map((e,i)=>({
        idempotencyKey:`settlement:${id}:${dto.requestKey}:reverse:${i}`,requestHash:hash,kind:'reversal',amount:e.amount,status:'confirmed',occurredAt:now,
        evidence:dto.evidence,description:`Đảo giao dịch ${dto.originalKey}`,posting:{kind:'reversal',amount:e.amount},effects:reverseEffects(e.effects),
        orderId:e.orderId,context:e.context,productName:e.productName,reversalOf:String(e._id),createdBy:actor,confirmedBy:actor,confirmedAt:now,settlementId:id,
      })),{session});
      if(op.receiptKey)await this.entries.db.collection('businessledgerpaymentreceipts').updateOne({_id:op.receiptKey},{$set:{status:'reversed'}},{session});
      statement.operations.push({requestKey:dto.requestKey,originalKey:dto.originalKey,hash,mode:'reversal',net:-op.net,evidence:dto.evidence,at:now,actorId:actor,entryIds:created.map(e=>String(e._id))});
      statement.markModified('operations');await statement.save({session});return statement;
    });
  }
}
