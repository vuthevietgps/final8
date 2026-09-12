import { Types } from 'mongoose';
import { ReturnRequestService } from './return-request.service';
import { OrderCalculationService } from '../test-order2/services/order-calculation.service';

function fixture(extra:any={}) {
  const supplierId=new Types.ObjectId(), shipmentId=new Types.ObjectId();
  const order:any={_id:new Types.ObjectId(),productId:new Types.ObjectId(),supplierId,quantity:2,productSource:'supplier',
    productionStatus:'Đã trả kết quả',orderStatus:'Đang hoàn',trackingNumber:'VN',supplierQuoteId:new Types.ObjectId(),
    supplierAppliedPrice:120000,retailSaleAmount:600000,agentQuoteId:'aq',agentAppliedPrice:250000,
    resalePolicySnapshot:'resellable',shippingFee:20000,returnFee:30000,deliveredQuantity:0,
    advertisingCost:0,laborCostAllocation:0,otherCostAllocation:0,
    shipments:[{_id:shipmentId,status:'returning',quantity:2,returnHolderKind:'supplier',returnHolderId:String(supplierId),returnAddress:'NCC address'}],...extra};
  order.save=jest.fn(async()=>order);
  const receipt:any={_id:new Types.ObjectId(),orderId:order._id,shipmentId:String(shipmentId),items:[{_id:new Types.ObjectId(),productId:order.productId,quantityReturned:2}],
    save:jest.fn(async()=>{}),toObject(){return this;}};
  let pending=true;
  // Deliberately no transaction emulation: rollback/concurrency need real Mongo.
  const session={withTransaction:jest.fn(async(fn:any)=>fn()),endSession:jest.fn()};
  const model:any={db:{startSession:async()=>session},findOneAndUpdate:jest.fn(async()=>{if(!pending)return null;pending=false;receipt.status='resolved';return receipt;}),
    findById:()=>({session:async()=>receipt})};
  const inventory={recordReturnFromRMA:jest.fn(async(..._args:any[])=>{})};const events={emit:jest.fn()};
  const calc=new OrderCalculationService({} as any,{} as any,{} as any,{} as any,{getReturnStatusNames:async()=>['Hàng hoàn']} as any,{} as any);
  const service=new ReturnRequestService(model,{findById:()=>({session:async()=>order})} as any,inventory as any,calc,events as any);
  const resolve=(overrides:any={})=>service.resolve(String(receipt._id),{items:[{itemId:String(receipt.items[0]._id),quantity:2,decision:'restock',recoveryUnitCost:120000}],...overrides});
  return {order,receipt,inventory,events,session,resolve};
}
describe('Return ownership, custody and recovery business rules (mock persistence)',()=>{
  it('retail recovery restores cost value but never credits supplier goods debt',async()=>{
    const h=fixture();await h.resolve();expect(h.order.recoveredInventoryValue).toBe(240000);
    expect(h.order.recognizedGoodsCost).toBe(0);expect(h.order.grossProfit).toBe(-50000);expect(h.order.supplierContractAmount).toBe(290000);
    expect(h.inventory.recordReturnFromRMA.mock.calls[0][3]).toEqual(expect.objectContaining({ownerKind:'company',holderKind:'supplier',holderId:String(h.order.supplierId)}));
    expect(h.order.shipments[0].status).toBe('returned');
  });
  it('dealer-owned returns held by company do not recover company COGS or cancel the sale',async()=>{
    const agentId=new Types.ObjectId(),h=fixture({agentId});await h.resolve({holderKind:'company'});
    expect(h.inventory.recordReturnFromRMA.mock.calls[0][3]).toEqual(expect.objectContaining({ownerKind:'dealer',ownerId:String(agentId),holderKind:'company',holderId:undefined}));
    expect(h.order.recoveredInventoryValue||0).toBe(0);expect(h.order.recognizedRevenue).toBe(500000);
    expect(h.order.recognizedGoodsCost).toBe(240000);expect(h.order.dealerContractAmount).toBe(550000);
  });
  it('a different return holder does not inherit the old holder ID/address',async()=>{
    const h=fixture(),holderId=String(new Types.ObjectId());await h.resolve({holderKind:'agent',holderId});
    expect(h.receipt.holderId).toBe(holderId);expect(h.receipt.holderAddress).toBeUndefined();expect(h.receipt.ownerKind).toBe('company');
  });
  it('rejects an unspecified non-company holder',async()=>{
    const h=fixture();await expect(h.resolve({holderKind:'agent'})).rejects.toThrow('bên đang nhận');expect(h.inventory.recordReturnFromRMA).not.toHaveBeenCalled();
  });
  it('rejects resale of a worthless bespoke product',async()=>{
    const h=fixture({resalePolicySnapshot:'not_resellable'});await expect(h.resolve()).rejects.toThrow('Hàng độc bản');expect(h.inventory.recordReturnFromRMA).not.toHaveBeenCalled();
  });
  it('scraps a worthless return without adding saleable stock or recovering COGS',async()=>{
    const h=fixture({resalePolicySnapshot:'not_resellable'});await h.resolve({items:[{itemId:String(h.receipt.items[0]._id),quantity:2,decision:'scrap'}]});
    expect(h.inventory.recordReturnFromRMA).not.toHaveBeenCalled();expect(h.order.recognizedGoodsCost).toBe(240000);expect(h.order.grossProfit).toBe(-290000);
  });
  it.each([-1,120001])('rejects recovery valuation %s outside the acquisition cost',async value=>{
    const h=fixture();await expect(h.resolve({items:[{itemId:String(h.receipt.items[0]._id),quantity:2,decision:'restock',recoveryUnitCost:value}]})).rejects.toThrow('giá vốn');
    expect(h.inventory.recordReturnFromRMA).not.toHaveBeenCalled();
  });
  it('cannot receive more than the undelivered quantity',async()=>{
    const h=fixture({deliveredQuantity:1});await expect(h.resolve()).rejects.toThrow('vượt số lượng');expect(h.inventory.recordReturnFromRMA).not.toHaveBeenCalled();
  });
  it('keeps a partially received return open and only recovers the received amount',async()=>{
    const h=fixture();await h.resolve({items:[{itemId:String(h.receipt.items[0]._id),quantity:1,decision:'restock',recoveryUnitCost:80000}]});
    expect(h.order.receivedReturnQuantity).toBe(1);expect(h.order.shipments[0].status).toBe('returning');expect(h.order.recoveredInventoryValue).toBe(80000);
  });
  it('rejects replay of a resolved receipt without receiving stock a second time',async()=>{
    const h=fixture();await h.resolve();await expect(h.resolve()).rejects.toThrow('Phieu da xu ly');expect(h.inventory.recordReturnFromRMA).toHaveBeenCalledTimes(1);
  });
  it('does not emit a completed event when the inventory write fails',async()=>{
    const h=fixture();h.inventory.recordReturnFromRMA.mockRejectedValueOnce(new Error('write failed'));
    await expect(h.resolve()).rejects.toThrow('write failed');expect(h.events.emit).not.toHaveBeenCalled();expect(h.order.save).not.toHaveBeenCalled();expect(h.session.endSession).toHaveBeenCalled();
  });
});
