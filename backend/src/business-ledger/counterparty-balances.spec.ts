import {counterpartyBalances} from './counterparty-balances';
import {operationalEntries} from './operational-projection';
import {buildLedgerReport} from './business-ledger.report';
import {reverseEffects} from './business-ledger.rules';
const order:any={_id:'o',productId:'p',supplierId:'s',agentId:'a',orderDate:'2026-09-01T03:00:00Z',quantity:1,
  financialModelVersion:2,isActive:true,dealerProfitState:'recognized',agentQuoteId:'aq',recognizedRevenue:250000,recognizedGoodsCost:120000,
  supplierContractAmount:170000,dealerContractAmount:300000,grossProfit:130000,shipments:[]};
const entry=(kind:string,amount:number,party='agent:a')=>({_id:kind,orderId:'o',status:'confirmed',kind,occurredAt:order.orderDate,
  effects:{revenue:0,cogs:0,expense:0,cash:[],debts:[{partyKey:party,amount}]}});
describe('One counterparty balance source',()=>{
  it('includes confirmed discounts separately from actual settlements',()=>{
    const rows=counterpartyBalances([order],[entry('sale_credit',-20000),entry('payment',-100000)],[]);
    expect(rows.find(r=>r.partyKey==='agent:a')).toMatchObject({obligation:300000,adjustments:-20000,paymentMovement:-100000,balance:180000,paymentState:'partial'});
  });
  it('zero supplier collection does not substitute COD or fabricate money received',()=>{
    const rows=counterpartyBalances([{...order,codAmount:300000,codCollectedBySupplier:0}],[],[]);
    expect(rows.find(r=>r.partyKey==='supplier:s').balance).toBe(-170000);
  });
  it('supplier collection creates its debt to company without company cash',()=>{
    const rows=counterpartyBalances([order],[entry('payment',300000,'supplier:s')],[]);
    expect(rows.find(r=>r.partyKey==='supplier:s')).toMatchObject({obligation:-170000,paymentMovement:300000,receivable:130000,payable:0});
  });
  it('payment reversal restores the original debt and keeps overpayment credits',()=>{
    const p=entry('payment',-400000),reversal={...entry('reversal',0),reversalOf:'payment',effects:reverseEffects(p.effects)};
    expect(counterpartyBalances([order],[p],[]).find(r=>r.partyKey==='agent:a').balance).toBe(-100000);
    expect(counterpartyBalances([order],[p,reversal],[]).find(r=>r.partyKey==='agent:a').balance).toBe(300000);
  });
  it('does not count drafts and clearly marks unresolved legacy orders',()=>{
    const rows=counterpartyBalances([{...order,financialModelVersion:undefined}],[{...entry('payment',-100000),status:'draft'}],[]);
    expect(rows.find(r=>r.partyKey==='agent:a').balance).toBe(0);expect(rows.find(r=>r.partyKey==='agent:a').reviewReasons).toHaveLength(2);
  });
  it('includes received purchase stock obligation and partial PO payments',()=>{
    const po={_id:'po',supplierId:'s',createdAt:order.orderDate,grandTotal:200000,items:[{quantity:2,quantityReceived:1,unitPrice:100000}]};
    const rows=counterpartyBalances([], [{...entry('payment',40000,'supplier:s'),orderId:'purchase:po'}],[po]);
    expect(rows[0]).toMatchObject({obligation:-100000,paymentMovement:40000,balance:-60000});
  });
  it('matches the business ledger debt totals including non-payment adjustments',()=>{
    const entries=[entry('sale_credit',-20000),entry('payment',-100000)];
    const report=buildLedgerReport({orders:[order],entries,profiles:[],accounts:[],ads:[],from:'2026-09-01',to:'2026-09-02'});
    const rows=counterpartyBalances([order],entries,[]);
    for(const debt of report.debts)expect(rows.filter(r=>r.partyKey===debt.partyKey).reduce((n,r)=>n+r.balance,0)).toBe(debt.net);
  });
  it('does not create dealer debt for a company internal agent',()=>{
    const internal={...order,saleMode:'retail',agentRoleSnapshot:'internal_agent',dealerProfitState:undefined,
      retailProfitState:'recognized',dealerContractAmount:0};
    expect(counterpartyBalances([internal],[],[]).some(r=>r.partyKey==='agent:a')).toBe(false);
  });
});
