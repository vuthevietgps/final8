import {settlementPlan} from './settlement.rules';
const row=(orderId:string,balance:number,extra={})=>({orderId,balance,reviewReasons:[],context:{orderId},...extra});
describe('Exact allocation and offset rules',()=>{
  it('allocates only the actual partial payment',()=>{
    const r=settlementPlan([row('a',1000000)],[{orderId:'a',amount:10000}],'payment','bank');expect(r.net).toBe(10000);expect(r.plans[0].row.balance-r.plans[0].amount).toBe(990000);
  });
  it('accepts a company payout as a negative debt movement allocation',()=>expect(settlementPlan([row('a',-100)],[{orderId:'a',amount:-40}],'payment','bank').net).toBe(-40));
  it.each([0,101,-1,1.5])('rejects invalid allocation %s',amount=>expect(()=>settlementPlan([row('a',100)],[{orderId:'a',amount}],'payment','bank')).toThrow());
  it('rejects duplicate order allocations',()=>expect(()=>settlementPlan([row('a',100)],[{orderId:'a',amount:20},{orderId:'a',amount:20}],'payment','bank')).toThrow('Trùng'));
  it('rejects disputed data and missing source orders',()=>{
    expect(()=>settlementPlan([row('a',100,{reviewReasons:['missing fees']})],[{orderId:'a',amount:20}],'payment','bank')).toThrow();
    expect(()=>settlementPlan([],[{orderId:'a',amount:20}],'payment','bank')).toThrow();
  });
  it('allows balanced offset without creating cash',()=>expect(settlementPlan([row('a',100),row('b',-80)],[{orderId:'a',amount:80},{orderId:'b',amount:-80}],'offset').net).toBe(0));
  it('rejects an unbalanced offset and offset with a bank account',()=>{
    const rows=[row('a',100),row('b',-100)];
    expect(()=>settlementPlan(rows,[{orderId:'a',amount:80},{orderId:'b',amount:-70}],'offset')).toThrow('bằng');
    expect(()=>settlementPlan(rows,[{orderId:'a',amount:80},{orderId:'b',amount:-80}],'offset','bank')).toThrow('thu chi');
  });
  it('does not disguise gross receipts and payouts as one net cash transfer',()=>expect(()=>settlementPlan([row('a',100),row('b',-100)],[{orderId:'a',amount:100},{orderId:'b',amount:-80}],'payment','bank')).toThrow('cùng chiều'));
});
