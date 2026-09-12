import { quoteValidity } from './quote-validity';
import { QuoteService } from './quote.service';
import { SupplierQuoteService } from '../supplier-quote/supplier-quote.service';
import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateSupplierQuoteDto } from '../supplier-quote/dto/create-supplier-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
describe('Dealer quote commercial integrity',()=>{
  it('covers the complete Vietnam business day including the last evening',()=>{
    const v=quoteValidity('2026-09-01','2026-09-04');
    expect(v.validFrom.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(v.validUntil.toISOString()).toBe('2026-09-04T16:59:59.999Z');
  });
  it.each([['2026-09-05','2026-09-04'],['2026-02-30','2026-03-01'],['invalid','2026-09-04']])('rejects invalid interval %s to %s',(a,b)=>expect(()=>quoteValidity(a,b)).toThrow());
  function fixture(){
    const doc:any={_id:'quote',__v:2,productId:'p',agentId:'a',unitPrice:250000,status:'Đã duyệt',...quoteValidity('2026-09-01','2026-09-30')};
    const model:any={findById:()=>({lean:async()=>doc}),findOneAndUpdate:jest.fn((_filter,update)=>{const chain={populate:()=>chain,exec:async()=>({...doc,...update.$set})};return chain;})};
    return{service:new QuoteService(model,{} as any,{} as any),model,doc};
  }
  it('changing commercial terms resets approval even if the submitted status is approved',async()=>{
    const h=fixture(),r=await h.service.update('quote',{unitPrice:270000,status:'Đã duyệt'},'actor');
    expect((r as any).status).toBe('Chờ duyệt');expect(h.model.findOneAndUpdate.mock.calls[0][0]).toEqual({_id:'quote',__v:2});
    expect(h.model.findOneAndUpdate.mock.calls[0][1].$push.commercialHistory.before.unitPrice).toBe(250000);
  });
  it('a separate approval keeps unchanged prices and records the actor',async()=>{
    const h=fixture();h.doc.status='Chờ duyệt';const r=await h.service.update('quote',{status:'Đã duyệt'},'approver');
    expect((r as any).status).toBe('Đã duyệt');expect(h.model.findOneAndUpdate.mock.calls[0][1].$push.commercialHistory.actorId).toBe('approver');
  });
  it('does not accept a supplier as dealer even when the caller supplies display names',async()=>{
    const users={findById:()=>({exec:async()=>({role:'external_supplier',fullName:'Supplier'})})};
    const service=new QuoteService({db:{models:{User:users}}} as any,{findById:()=>({exec:async()=>({name:'Product'})})} as any,{} as any);
    await expect(service.create({productId:'p',agentId:'s',product:'Forged product',agentName:'Forged dealer',unitPrice:1,status:'Chờ duyệt',validFrom:'2026-09-01',validUntil:'2026-09-30'})).rejects.toThrow('đại lý');
  });
  it('bulk creation excludes supplier roles and limits duplicate checks to overlapping active periods',async()=>{
    let userFilter:any,quoteFilter:any;
    const users={find:(filter:any)=>{userFilter=filter;return{exec:async()=>[{_id:'agent',fullName:'Dealer'}]};}};
    const model:any=class{constructor(public data:any){} async save(){return this.data;}};
    model.db={models:{User:users}};
    model.findOne=(filter:any)=>{quoteFilter=filter;return{exec:async()=>null};};
    const service=new QuoteService(model,{findById:()=>({exec:async()=>({name:'Product'})})} as any,{} as any);
    const rows=await service.create({productId:'p',applyToAllAgents:true,unitPrice:0,status:'Chờ duyệt',validFrom:'2026-09-01',validUntil:'2026-09-30'});
    expect(rows).toHaveLength(1);expect(userFilter.role.$in).toEqual(['external_agent']);
    expect(quoteFilter.validUntil.$gte.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(quoteFilter.validFrom.$lte.toISOString()).toBe('2026-09-30T16:59:59.999Z');
    expect(quoteFilter.status.$nin).toContain('Hết hiệu lực');
  });
  it('rejects a company internal agent as a dealer quote recipient',async()=>{
    const users={findById:()=>({exec:async()=>({role:'internal_agent',fullName:'Company'})})};
    const service=new QuoteService({db:{models:{User:users}}} as any,{findById:()=>({exec:async()=>({name:'Product'})})} as any,{} as any);
    await expect(service.create({productId:'p',agentId:'company',unitPrice:1,status:'Chờ duyệt',validFrom:'2026-09-01',validUntil:'2026-09-30'})).rejects.toThrow('đại lý ngoài');
  });
  it('effective supplier quotes cannot use legacy records created after the order date',async()=>{
    let filter:any;const model={findOne:(q:any)=>{filter=q;return{sort:()=>({lean:async()=>null})};}};
    const date=new Date('2026-09-01T03:00:00Z');
    await new SupplierQuoteService(model as any).getEffectiveAt(String(new Types.ObjectId()),String(new Types.ObjectId()),date);
    expect(filter.approvalStatus).toBe('approved');
    expect(filter.$or.find((r:any)=>r.effectiveAt.$exists===false).createdAt).toEqual({$lte:date});
  });
  it('rejects fractional/unsafe supplier amounts and a string false that could enable bulk creation',async()=>{
    const price=plainToInstance(CreateSupplierQuoteDto,{productId:String(new Types.ObjectId()),supplierId:String(new Types.ObjectId()),price:1.5,shippingFee:Number.MAX_SAFE_INTEGER+1});
    expect((await validate(price)).map(e=>e.property)).toEqual(expect.arrayContaining(['price','shippingFee']));
    const bulk=plainToInstance(CreateQuoteDto,{applyToAllAgents:'false'});
    expect((await validate(bulk)).some(e=>e.property==='applyToAllAgents')).toBe(true);
  });
});
