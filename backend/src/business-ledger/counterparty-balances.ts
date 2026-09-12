import { operationalEntries } from './operational-projection';
import { receivedPurchaseValue } from '../purchase/purchase-costs';
import { isDealerSale } from '../test-order2/order-sale-mode';
export function counterpartyBalances(orders:any[], journal:any[], purchases:any[]) {
  const byOrder=new Map(orders.map(o=>[String(o._id),o]));
  const entries=[...operationalEntries(orders),...journal];
  for(const po of purchases) entries.push({_id:`po:${po._id}`,orderId:`purchase:${po._id}`,status:'confirmed',operationalProjection:true,
    kind:'opening_payable',effects:{debts:[{partyKey:`supplier:${po.supplierId}`,amount:-receivedPurchaseValue(po)}]}});
  const originals=new Map(journal.map(e=>[String(e._id),e]));
  const rows=new Map<string,any>();
  const ensure=(partyKey:string,orderId:string)=>{
    const key=`${partyKey}|${orderId}`;
    if(!rows.has(key)){
      const o=byOrder.get(orderId),po=orderId.startsWith('purchase:')?purchases.find(p=>String(p._id)===orderId.slice(9)):null;
      const orderDate=o?.orderDate||o?.createdAt;
      const hasDate=orderDate&&Number.isFinite(+new Date(orderDate));
      rows.set(key,{key,partyKey,orderId,orderDate:orderDate||po?.createdAt,reference:o?.trackingNumber||po?.poNumber||orderId,
        obligation:0,adjustments:0,paymentMovement:0,balance:0,reviewReasons:[],entryIds:[],
        context:o&&hasDate?{orderId,productId:String(o.productId?._id||o.productId),supplierId:o.supplierId?String(o.supplierId):undefined,
          agentId:isDealerSale(o)&&o.agentId?String(o.agentId):undefined,adGroupId:o.adGroupId,quantity:o.quantity,orderDate:new Date(orderDate).toISOString(),
          saleMode:isDealerSale(o)?'dealer':'retail',fulfillment:o.productSource==='supplier'?'supplier_direct':'inventory'}:
          po&&Number.isFinite(+new Date(po.createdAt))?{orderId,productId:'inventory_purchase',supplierId:String(po.supplierId),quantity:0,orderDate:new Date(po.createdAt).toISOString(),saleMode:'retail',fulfillment:'inventory'}:undefined});
    }
    return rows.get(key);
  };
  for(const o of orders){
    for(const partyKey of [o.supplierId?`supplier:${o.supplierId}`:null,isDealerSale(o)&&o.agentId?`agent:${o.agentId}`:null].filter(Boolean)){
      const r=ensure(partyKey,String(o._id));
      if(o.financialModelVersion!==2)r.reviewReasons.push('Đơn lịch sử chưa đối chiếu mô hình mới');
      if(!r.context)r.reviewReasons.push('Thiếu ngày hoặc nguồn chứng từ hợp lệ');
      if(o.financialModelVersion===2&&o.productionStatus==='Đã trả kết quả'&&o.productSource==='supplier'&&!o.supplierQuoteId)r.reviewReasons.push('Thiếu báo giá NCC đã duyệt');
      if(isDealerSale(o)&&o.dealerProfitState==='recognized'&&!o.agentQuoteId)r.reviewReasons.push('Thiếu bản chụp báo giá đại lý');
      if([o.dealerProfitState,o.retailProfitState].includes('missing_quotes'))r.reviewReasons.push('Thiếu báo giá hợp lệ');
      if(o.shipments?.some(s=>s.status==='preparing'||!s.feesConfirmed))r.reviewReasons.push('Lần giao hoặc phí chưa xác nhận');
    }
  }
  for(const e of entries){
    for(const d of e.effects?.debts||[]){
      if(!/^(supplier|agent):/.test(d.partyKey))continue;
      const row=ensure(d.partyKey,e.orderId||`unallocated:${e._id}`);
      if(e.status==='draft'){row.reviewReasons.push('Có chứng từ đang chờ xác nhận');continue;}
      if(e.status!=='confirmed')continue;
      if(!Number.isSafeInteger(d.amount))throw new Error('Công nợ có số tiền không phải số nguyên đồng hợp lệ.');
      const original=e.kind==='reversal'?originals.get(String(e.reversalOf)):null;
      const payment=e.kind==='payment'||original?.kind==='payment';
      const field=payment?'paymentMovement':e.operationalProjection||['sale','direct_cost','opening_receivable','opening_payable'].includes(e.kind)?'obligation':'adjustments';
      row[field]+=d.amount;row.balance+=d.amount;row.entryIds.push(String(e._id));
      if(!Number.isSafeInteger(row.balance)||!Number.isSafeInteger(row[field]))throw new Error('Tổng công nợ vượt giới hạn chính xác.');
      if(!row.context&&e.context)row.context=e.context;
    }
  }
  for(const r of rows.values()){
    if(!r.context)r.reviewReasons.push('Thiếu nguồn đơn hàng/PO để phân bổ');
    if(!byOrder.has(r.orderId)&&!purchases.some(p=>`purchase:${p._id}`===r.orderId))r.reviewReasons.push('Đơn hàng/PO nguồn không còn trong dữ liệu hoạt động');
  }
  return [...rows.values()].map(r=>({...r,reviewReasons:[...new Set(r.reviewReasons)],
    receivable:Math.max(0,r.balance),payable:Math.max(0,-r.balance),
    paymentState:r.reviewReasons.length?'needs_review':r.balance===0?'settled':r.paymentMovement?'partial':'outstanding',entryIds:r.entryIds.sort()})).sort((a,b)=>a.key.localeCompare(b.key));
}
