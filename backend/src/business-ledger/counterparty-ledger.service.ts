import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { TestOrder2 } from '../test-order2/schemas/test-order2.schema';
import { LedgerEntry } from './business-ledger.schema';
import { counterpartyBalances } from './counterparty-balances';
import { businessDay } from '../common/business-day';
import { debtPaymentTiming, debtScheduleSummary } from './debt-schedule.rules';

@Injectable()
export class CounterpartyLedgerService {
  constructor(@InjectModel(TestOrder2.name) private orders:Model<TestOrder2>,@InjectModel(LedgerEntry.name) private entries:Model<LedgerEntry>){}
  async snapshot(partyKey?:string,session?:any){
    if(partyKey&&!/^(supplier|agent):[a-f0-9]{24}$/i.test(partyKey))throw new BadRequestException('Đối tác không hợp lệ.');
    // MongoDB transactions do not support parallel operations on one session.
    const asOf = new Date();
    const orders=await this.orders.find({isActive:{$ne:false}}).limit(10001).session(session||null).lean();
    const entries=await this.entries.find({status:{$in:['confirmed','draft']},occurredAt:{$lte:asOf}}).limit(50001).session(session||null).lean();
    const purchases=await this.orders.db.collection('purchaseorders').find({financialModelVersion:2,'items.quantityReceived':{$gt:0}}, {session}).limit(10001).toArray();
    if(orders.length>10000||entries.length>50000||purchases.length>10000)throw new BadRequestException('Vượt giới hạn đối soát; cần tổng hợp sổ, không cắt bớt số liệu.');
    let rows:any[];
    try{rows=counterpartyBalances(orders,entries,purchases).filter(r=>!partyKey||r.partyKey===partyKey);}catch(e){throw new BadRequestException(e.message);}
    const revisions = await this.orders.db.collection('businessledgerdebtschedules')
      .find({ ...(partyKey ? { partyKey } : {}), recordedAt: { $lte: asOf } }, { session }).limit(50001).toArray();
    if (revisions.length > 50000) throw new BadRequestException('Lịch công nợ vượt giới hạn; cần lọc theo đối tác.');
    const legacy = await this.orders.db.collection('supplierpayables').find({ dueDate: { $ne: null },
      ...(partyKey?.startsWith('supplier:') ? { supplierId: new Types.ObjectId(partyKey.split(':')[1]) } : {}) },
      { session, projection: { orderId: 1, supplierId: 1, dueDate: 1 } }).limit(10001).toArray();
    if (legacy.length > 10000) throw new BadRequestException('Nguồn ngày đến hạn cũ vượt giới hạn; cần đối chiếu theo đối tác.');
    const legacyByKey = new Map<string, any[]>();
    const candidate = (key: string, source: string, sourceId: string, date: any, legacyDirection: string) => {
      if (!date || !Number.isFinite(+new Date(date))) return;
      legacyByKey.set(key, [...(legacyByKey.get(key) || []), { source, sourceId, dueDate: businessDay(date),
        legacyDirection, requiresReconciliation: true }]);
    };
    for (const r of legacy) candidate(`supplier:${r.supplierId}|${r.orderId}`, 'supplierpayables.dueDate', String(r._id), r.dueDate, 'receivable');
    for (const o of orders) if (o.agentId) candidate(`agent:${o.agentId}|${o._id}`, 'ordertest2.agentPaymentDueDate', String(o._id), o.agentPaymentDueDate, 'payable');
    const schedulesByKey = new Map<string, any[]>(), journalByOrder = new Map<string, any[]>();
    for (const r of revisions) { const key = `${r.partyKey}|${r.orderId}`; schedulesByKey.set(key, [...(schedulesByKey.get(key) || []), r]); }
    for (const e of entries) { const key = e.orderId; journalByOrder.set(key, [...(journalByOrder.get(key) || []), e]); }
    rows = rows.map(row => ({ ...row, paymentTiming: { ...debtPaymentTiming(row, schedulesByKey.get(row.key) || [], journalByOrder.get(row.orderId) || [], asOf),
      legacyCandidates: legacyByKey.get(row.key) || [] } }));
    return{rows,sourceHash:this.hash(rows),evidenceHash:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      schemaVersion:'counterparty-capital-evidence-v1',generatedAt:asOf.toISOString(),basis:'current_obligations_and_confirmed_journal',
      paymentSchedule: debtScheduleSummary(rows, asOf)};
  }
  // Deadline metadata/time passing must not invalidate a confirmed financial settlement.
  hash(rows:any[]){return createHash('sha256').update(JSON.stringify(rows.map(value=>{
    if(value && typeof value==='object' && 'paymentTiming' in value){const {paymentTiming,...row}=value;return row;}
    return value;
  }))).digest('hex');}
  async summary(kind:'supplier'|'agent',filter:{partyId?:string;from?:string;to?:string}={}){
    if(!['supplier','agent'].includes(kind))throw new BadRequestException('Loại đối tác không hợp lệ.');
    for(const day of [filter.from,filter.to].filter(Boolean)){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(+new Date(day+'T00:00:00+07:00'))||businessDay(day+'T00:00:00+07:00')!==day)throw new BadRequestException('Ngày lọc phải có dạng YYYY-MM-DD và hợp lệ.');
    }
    if(filter.from&&filter.to&&filter.from>filter.to)throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc.');
    const snapshot=await this.snapshot(filter.partyId?`${kind}:${filter.partyId}`:undefined);
    const rows=snapshot.rows.filter(r=>r.partyKey.startsWith(`${kind}:`)&&(!filter.from||r.orderDate&&businessDay(r.orderDate)>=filter.from)&&(!filter.to||r.orderDate&&businessDay(r.orderDate)<=filter.to));
    const users=await this.orders.db.collection('users').find({}, {projection:{fullName:1,name:1}}).limit(10001).toArray();
    if(users.length>10000)throw new BadRequestException('Danh sách đối tác vượt giới hạn.');
    const names=new Map(users.map(u=>[String(u._id),u.fullName||u.name]));
    const groups=new Map<string,any>();
    for(const row of rows){const id=row.partyKey.split(':')[1];let group=groups.get(id);
      if(!group){group={partyId:id,partyKey:row.partyKey,name:names.get(id)||id,receivable:0,payable:0,net:0,reviewCount:0,orders:[]};groups.set(id,group);}
      group.receivable+=row.receivable;group.payable+=row.payable;group.net+=row.balance;group.reviewCount+=row.reviewReasons.length?1:0;group.orders.push(row);
      if(![group.receivable,group.payable,group.net].every(Number.isSafeInteger))throw new BadRequestException('Tổng vượt giới hạn chính xác.');
    }
    const data=[...groups.values()];
    if(!['receivable','payable'].every(key=>Number.isSafeInteger(data.reduce((n,g)=>n+g[key],0))))throw new BadRequestException('Tổng đối tác vượt giới hạn số nguyên chính xác.');
    return{data,basis:snapshot.basis,generatedAt:snapshot.generatedAt,
      paymentSchedule:debtScheduleSummary(rows,new Date(snapshot.generatedAt))};
  }
}
