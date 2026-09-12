import { Types } from 'mongoose';
import { OrderShipmentService } from './order-shipment.service';
import { OrderCalculationService } from './order-calculation.service';

function harness(extra = {}) {
  const attempt = (status:string,returned:number) => ({_id:new Types.ObjectId(),status,trackingNumber:status,
    quantity:1,deliveredQuantity:0,shippingCost:20000,returnCost:returned,dealerShippingCharge:20000,
    dealerReturnCharge:returned,feePayeeKind:'supplier',senderKind:'supplier',returnHolderKind:'supplier',
    feesConfirmed:false,feeRevisions:[]});
  const order:any={_id:new Types.ObjectId(),financialModelVersion:2,agentId:new Types.ObjectId(),supplierId:new Types.ObjectId(),
    productId:new Types.ObjectId(),quantity:1,productionStatus:'Đã trả kết quả',trackingNumber:'reship',
    productSource:'supplier',orderDate:new Date(),agentQuoteId:'aq',supplierQuoteId:'sq',
    agentAppliedPrice:250000,supplierAppliedPrice:120000,dealerSaleRecognizedAt:new Date(),dealerReturnedAt:new Date(),
    advertisingCost:0,laborCostAllocation:0,otherCostAllocation:0,
    shipments:[attempt('returned',30000),attempt('dispatched',0)],...extra};
  order.save=jest.fn(async()=>order);
  const inventory:any={prepareOrderSource:jest.fn(),commitOrderStock:jest.fn(),releaseOrderReservation:jest.fn()};
  const payable:any={upsertForOrder:jest.fn()};
  const calc=new OrderCalculationService({} as any,{} as any,{} as any,{} as any,
    {getReturnStatusNames:async()=>['Hàng hoàn']} as any,{} as any);
  jest.spyOn(calc, 'recalculateOrdersForDate').mockResolvedValue({ date: '2026-09-05', updated: 1 });
  return {order,inventory,payable,service:new OrderShipmentService({findById:async()=>order} as any,inventory,calc,payable,{emit:jest.fn()} as any)};
}
const amendment={requestKey:'fee-revision-001',shippingCost:25000,returnCost:30000,
  dealerShippingCharge:25000,dealerReturnCharge:30000,evidence:'Carrier statement corrected outbound fee'};

describe('Shipment fee reconciliation and recognition boundaries',()=>{
  it('amends an earlier shipment without selling the goods twice and retains the old fee',async()=>{
    const h=harness(),id=String(h.order._id),sid=String(h.order.shipments[0]._id);
    await h.service.amendFees(id,sid,amendment,'actor');
    await h.service.amendFees(id,sid,amendment,'actor');
    expect(h.order.shipments).toHaveLength(2);
    expect(h.order.shipments[0].feeRevisions).toHaveLength(1);
    expect(h.order.shipments[0].feeRevisions[0].before.shippingCost).toBe(20000);
    expect(h.order.dealerContractAmount).toBe(325000);
    expect(h.order.supplierContractAmount).toBe(195000);
    expect(h.order.recognizedGoodsCost).toBe(120000);
    expect(h.order.grossProfit).toBe(130000);
    expect(h.payable.upsertForOrder).not.toHaveBeenCalled();
  });
  it('rejects changed content under the same fee revision key',async()=>{
    const h=harness(),id=String(h.order._id),sid=String(h.order.shipments[0]._id);
    await h.service.amendFees(id,sid,amendment,'actor');
    await expect(h.service.amendFees(id,sid,{...amendment,shippingCost:26000},'actor')).rejects.toThrow('nội dung khác');
  });
  it('does not create return freight on a delivered or still outbound shipment',async()=>{
    const h=harness();
    await expect(h.service.amendFees(String(h.order._id),String(h.order.shipments[1]._id),amendment,'actor')).rejects.toThrow('Chưa phát sinh hoàn');
  });
  it('requires an explicit retail selling price before dispatching',async()=>{
    const h=harness({agentId:undefined,shipments:[],trackingNumber:undefined,dealerSaleRecognizedAt:undefined});
    await expect(h.service.create(String(h.order._id),{requestKey:'dispatch-01',trackingNumber:'new'} as any,'actor')).rejects.toThrow('tổng giá bán lẻ');
    expect(h.inventory.commitOrderStock).not.toHaveBeenCalled();
  });
});

describe('Shipment lifecycle, return custody and reship regression (mock persistence)',()=>{
  const shipment=(extra:any={})=>({requestKey:'dispatch-001',trackingNumber:'VN-1',senderKind:'company',shippingCost:20000,
    returnCostQuote:30000,dealerShippingCharge:20000,dealerReturnChargeQuote:30000,feePayeeKind:'supplier',...extra} as any);
  const fresh=(extra:any={})=>harness({shipments:[],trackingNumber:undefined,dealerSaleRecognizedAt:undefined,dealerReturnedAt:undefined,...extra});
  it('captures sender as return destination and recognizes dealer sale before end delivery',async()=>{
    const h=fresh(),senderId=String(new Types.ObjectId());
    await h.service.create(String(h.order._id),shipment({senderKind:'supplier',senderId,senderAddress:'Sender address'}),'actor');
    expect(h.order.shipments[0]).toEqual(expect.objectContaining({returnHolderKind:'supplier',returnHolderId:senderId,returnAddress:'Sender address',status:'dispatched'}));
    expect(h.order.recognizedRevenue).toBe(250000);expect(h.order.recognizedGoodsCost).toBe(120000);expect(h.order.dealerContractAmount).toBe(270000);
  });
  it('a changed return party must not inherit the sender’s address',async()=>{
    const h=fresh();await h.service.create(String(h.order._id),shipment({senderKind:'supplier',senderId:String(h.order.supplierId),senderAddress:'NCC address',returnHolderKind:'company'}),'actor');
    expect(h.order.shipments[0].returnHolderId).toBeUndefined();expect(h.order.shipments[0].returnAddress).toBeUndefined();
  });
  it('another supplier is a different return destination even with the same party type',async()=>{
    const h=fresh(),returnHolderId=String(new Types.ObjectId());
    await h.service.create(String(h.order._id),shipment({senderKind:'supplier',senderId:String(h.order.supplierId),senderAddress:'NCC A',returnHolderKind:'supplier',returnHolderId}),'actor');
    expect(h.order.shipments[0].returnHolderId).toBe(returnHolderId);expect(h.order.shipments[0].returnAddress).toBeUndefined();
  });
  it('retains an explicit address for the changed return destination',async()=>{
    const h=fresh();await h.service.create(String(h.order._id),shipment({senderKind:'supplier',senderId:String(h.order.supplierId),senderAddress:'NCC',returnHolderKind:'company',returnAddress:'Company warehouse'}),'actor');
    expect(h.order.shipments[0].returnAddress).toBe('Company warehouse');
  });
  it('replaying dispatch does not create another shipment or stock issue',async()=>{
    const h=fresh(),dto=shipment();await h.service.create(String(h.order._id),dto,'actor');await h.service.create(String(h.order._id),dto,'actor');
    expect(h.order.shipments).toHaveLength(1);expect(h.inventory.commitOrderStock).toHaveBeenCalledTimes(1);
    await expect(h.service.create(String(h.order._id),{...dto,trackingNumber:'changed'},'actor')).rejects.toThrow('nội dung khác');
  });
  it('uses actual return fees, retains goods sale and prevents reship before physical receipt',async()=>{
    const h=fresh(),id=String(h.order._id);await h.service.create(id,shipment(),'actor');
    await h.service.complete(id,String(h.order.shipments[0]._id),{status:'returned',returnCost:35000,dealerReturnCharge:40000,feesConfirmed:true});
    expect(h.order.dealerContractAmount).toBe(310000);expect(h.order.supplierContractAmount).toBe(175000);expect(h.order.grossProfit).toBe(135000);
    await expect(h.service.create(id,shipment({requestKey:'dispatch-002',trackingNumber:'VN-2',inventoryBatchId:String(new Types.ObjectId())}),'actor')).rejects.toThrow('Chưa nhận đủ');
  });
  it('reships received dealer stock without repeating goods revenue or COGS',async()=>{
    const h=fresh(),id=String(h.order._id);await h.service.create(id,shipment(),'actor');
    await h.service.complete(id,String(h.order.shipments[0]._id),{status:'returned',feesConfirmed:true});
    h.order.receivedReturnQuantity=1;
    h.inventory.prepareOrderSource.mockImplementation(async(stock:any)=>{if(stock.productSource==='dealer_custody'){stock.inventoryUnitCostSnapshot=120000;stock.senderKind='company';}});
    await h.service.create(id,shipment({requestKey:'dispatch-002',trackingNumber:'VN-2',inventoryBatchId:String(new Types.ObjectId())}),'actor');
    await h.service.complete(id,String(h.order.shipments[1]._id),{status:'delivered',feesConfirmed:true});
    expect(h.order.shipments).toHaveLength(2);expect(h.order.recognizedRevenue).toBe(250000);expect(h.order.recognizedGoodsCost).toBe(120000);
    expect(h.order.shippingFee).toBe(40000);expect(h.order.returnFee).toBe(30000);expect(h.order.dealerContractAmount).toBe(320000);expect(h.order.grossProfit).toBe(130000);
    expect(h.order.shipments[1].stockSource).toBe('dealer_custody');
  });
  it('rejects changing the initial inventory lot at dispatch after its cost was snapshotted',async()=>{
    const h=fresh({productSource:'inventory',inventoryBatchId:new Types.ObjectId(),inventoryUnitCostSnapshot:120000});
    h.inventory.prepareOrderSource.mockImplementation(async(stock:any)=>{stock.senderKind='company';stock.inventoryUnitCostSnapshot=50000;});
    await expect(h.service.create(String(h.order._id),shipment({inventoryBatchId:String(new Types.ObjectId())}),'actor')).rejects.toThrow('lô');
    expect(h.inventory.commitOrderStock).not.toHaveBeenCalled();
  });
  it('rejects a sender who does not hold the chosen inventory lot',async()=>{
    const h=fresh({productSource:'inventory',inventoryBatchId:new Types.ObjectId(),inventoryUnitCostSnapshot:120000});
    h.inventory.prepareOrderSource.mockImplementation(async(stock:any)=>{stock.senderKind='supplier';stock.senderId=String(h.order.supplierId);stock.inventoryUnitCostSnapshot=120000;});
    await expect(h.service.create(String(h.order._id),shipment(),'actor')).rejects.toThrow('nơi đang giữ');expect(h.inventory.commitOrderStock).not.toHaveBeenCalled();
  });
  it('a failed stock commit stays preparing and can resume without a second shipment',async()=>{
    const h=fresh({productSource:'inventory',inventoryBatchId:new Types.ObjectId(),inventoryUnitCostSnapshot:120000}),id=String(h.order._id);
    h.inventory.prepareOrderSource.mockImplementation(async(stock:any)=>{stock.senderKind='company';stock.inventoryUnitCostSnapshot=120000;});
    h.inventory.commitOrderStock.mockRejectedValueOnce(new Error('interrupted'));
    await expect(h.service.create(id,shipment(),'actor')).rejects.toThrow('interrupted');expect(h.order.shipments[0].status).toBe('preparing');
    await h.service.resume(id,String(h.order.shipments[0]._id));expect(h.order.shipments).toHaveLength(1);expect(h.order.shipments[0].status).toBe('dispatched');
    expect(h.order.supplierContractAmount).toBe(20000);expect(h.order.recognizedGoodsCost).toBe(120000);
  });
});
