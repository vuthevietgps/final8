import {Types} from 'mongoose';
import {createHash} from 'crypto';
import {SettlementService} from './settlement.service';
const actor=String(new Types.ObjectId()),supplier=String(new Types.ObjectId()),account=String(new Types.ObjectId());
const query=(v:any)=>{const q:any={lean:async()=>v,session:()=>q,then:(resolve:any,reject:any)=>Promise.resolve(v).then(resolve,reject)};return q;};
function setup(){
  const id=String(new Types.ObjectId()),orderA=String(new Types.ObjectId()),orderB=String(new Types.ObjectId());const journal:any[]=[];
  const bases=[{orderId:orderA,balance:100000,reference:'A',context:{orderId:orderA}},{orderId:orderB,balance:-80000,reference:'B',context:{orderId:orderB}}].map(r=>({...r,partyKey:`supplier:${supplier}`,reviewReasons:[]}));
  const hash=(r:any[])=>createHash('sha256').update(JSON.stringify(r)).digest('hex');
  const rows=()=>bases.map(r=>({...r,balance:r.balance+journal.filter(e=>e.orderId===r.orderId).reduce((n,e)=>n+e.effects.debts[0].amount,0)}));
  const counterparty:any={hash,snapshot:async()=>({rows:rows(),sourceHash:hash(rows())})};
  const statement:any={_id:id,status:'confirmed',rows:structuredClone(bases),partyKey:`supplier:${supplier}`,sourceHash:hash(bases),operations:[],save:jest.fn(async()=>{}),markModified:jest.fn()};
  const statements:any={findById:()=>query(statement),findOne:()=>query(null),create:jest.fn(async d=>d)};
  const writes:any[]=[];const session={withTransaction:async(fn:any)=>fn(),endSession:jest.fn()};
  const receiptWrite=jest.fn(async(..._args:any[])=>{}),sourceWrite=jest.fn(async(..._args:any[])=>{});
  const entries:any={db:{startSession:async()=>session,collection:(name:string)=>({updateOne:name==='businessledgerpaymentreceipts'?receiptWrite:async()=>{},updateMany:sourceWrite})},
    create:jest.fn(async(docs:any[],options:any)=>{writes.push(options);const saved=docs.map(d=>({...d,_id:new Types.ObjectId()}));journal.push(...saved);return saved;}),
    find:(f:any)=>query(journal.filter(e=>f._id.$in.includes(String(e._id))&&e.status===f.status)),
    exists:(f:any)=>query(journal.some(e=>f.reversalOf.$in.includes(e.reversalOf)&&e.status===f.status))};
  const accounts:any={findById:()=>query({_id:account,openingAt:new Date('2026-01-01')})};
  const service=new SettlementService(statements,entries,accounts,counterparty);
  const dto=(allocations:any[],extra={})=>({requestKey:'operation-01',sourceHash:hash(rows()),mode:'payment',accountId:account,evidence:'Synthetic receipt',reference:'BANK-001',occurredAt:'2026-09-04T03:00:00Z',allocations,...extra} as any);
  return{service,statement,statements,entries,journal,writes,session,rows,dto,id,orderA,orderB,receiptWrite,sourceWrite,counterparty};
}
describe('Settlement orchestration with mocked persistence (not Mongo rollback proof)',()=>{
  it('records a partial payment per order and leaves the snapshot immutable',async()=>{
    const h=setup(),snapshot=structuredClone(h.statement.rows),dto=h.dto([{orderId:h.orderA,amount:10000}]);
    await h.service.operate(h.id,dto,actor);await h.service.operate(h.id,dto,actor);
    expect(h.journal).toHaveLength(1);expect(h.rows()[0].balance).toBe(90000);expect(h.rows()[1].balance).toBe(-80000);
    expect(h.journal[0].effects.cash).toEqual([{accountId:account,amount:10000}]);expect(h.statement.rows).toEqual(snapshot);
    expect(h.writes[0].session).toBe(h.session);expect(h.statement.operations).toHaveLength(1);
  });
  it('rejects stale preview before any money is posted',async()=>{
    const h=setup();await expect(h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10000}],{sourceHash:'stale'}),actor)).rejects.toThrow('Số dư đã thay đổi');expect(h.entries.create).not.toHaveBeenCalled();
  });
  it('rejects changed payload under an existing operation key',async()=>{
    const h=setup();await h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10000}]),actor);
    await expect(h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:20000}]),actor)).rejects.toThrow('nội dung khác');
  });
  it('posts a balanced offset with zero cash and can reverse both sides once',async()=>{
    const h=setup(),dto=h.dto([{orderId:h.orderA,amount:80000},{orderId:h.orderB,amount:-80000}],{mode:'offset',accountId:undefined});
    await h.service.operate(h.id,dto,actor);expect(h.journal.flatMap(e=>e.effects.cash)).toEqual([]);expect(h.rows().map(r=>r.balance)).toEqual([20000,0]);
    const reverse={requestKey:'reverse-01',originalKey:'operation-01',evidence:'Correction'};
    await h.service.reverse(h.id,reverse,actor);await h.service.reverse(h.id,reverse,actor);
    expect(h.journal).toHaveLength(4);expect(h.rows().map(r=>r.balance)).toEqual([100000,-80000]);
    await expect(h.service.reverse(h.id,{...reverse,requestKey:'reverse-02'},actor)).rejects.toThrow('đã được đảo');
  });
  it('does not pay an unconfirmed statement',async()=>{
    const h=setup();h.statement.status='draft';await expect(h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10}]),actor)).rejects.toThrow('chưa được');
  });
  it('rejects confirmation when the underlying facts have changed',async()=>{
    const h=setup();h.statement.status='draft';h.statement.sourceHash='old';await expect(h.service.confirm(h.id,'Both parties confirmed',actor)).rejects.toThrow('Số liệu đã đổi');
  });
  it('rejects a duplicate bank reference before writing allocated entries',async()=>{
    const h=setup();h.receiptWrite.mockRejectedValueOnce(Object.assign(new Error('duplicate reference'),{code:11000}));
    await expect(h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10000}]),actor)).rejects.toThrow('đã tồn tại');
    expect(h.entries.create).not.toHaveBeenCalled();expect(h.statement.save).not.toHaveBeenCalled();expect(h.session.endSession).toHaveBeenCalled();
  });
  it.each([{occurredAt:'invalid'},{occurredAt:'2100-01-01T00:00:00Z'},{occurredAt:'2025-12-31T00:00:00Z'},{reference:' '}])('rejects invalid actual payment evidence/date %j',async extra=>{
    const h=setup();await expect(h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10000}],extra),actor)).rejects.toThrow();
    expect(h.entries.create).not.toHaveBeenCalled();
  });
  it('never treats a missing source order as settled',async()=>{
    const h=setup();h.counterparty.snapshot=async()=>({rows:[],sourceHash:'empty'});
    expect((await h.service.detail(h.id)).paymentState).toBe('needs_review');
    await expect(h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10}]),actor)).rejects.toThrow('Thiếu đơn');
  });
  it('restores the receipt reference only when the whole payment is reversed',async()=>{
    const h=setup();await h.service.operate(h.id,h.dto([{orderId:h.orderA,amount:10000}]),actor);
    expect(h.journal[0].occurredAt.toISOString()).toBe('2026-09-04T03:00:00.000Z');
    await h.service.reverse(h.id,{requestKey:'reverse-payment',originalKey:'operation-01',evidence:'Bank correction'},actor);
    expect(h.receiptWrite.mock.calls[1][1]).toEqual({$set:{status:'reversed'}});
    expect(h.rows()[0].balance).toBe(100000);
  });
});
