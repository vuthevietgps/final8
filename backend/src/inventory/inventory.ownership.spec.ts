import { Types } from 'mongoose';
import { InventoryService } from './inventory.service';

function setup(batchExtra:any={},orderExtra:any={}) {
  const productId=new Types.ObjectId(),agentId=new Types.ObjectId();
  const batch:any={_id:new Types.ObjectId(),productId,condition:'resellable',unitCost:85000,quantityRemaining:2,
    reservations:[],ownerKind:'company',holderKind:'supplier',holderId:String(new Types.ObjectId()),originalOrderId:String(new Types.ObjectId()),...batchExtra};
  const order:any={_id:new Types.ObjectId(),productId,agentId,productSource:'inventory',quantity:1,inventoryBatchId:batch._id,...orderExtra};
  const batches:any={findById:()=>({lean:async()=>batch}),findOneAndUpdate:jest.fn(async()=>batch),exists:jest.fn(async()=>true),
    insertMany:jest.fn(async(rows:any[])=>rows.map(row=>({...row,_id:new Types.ObjectId()})))};
  const summary:any={updateOne:jest.fn()},tx:any={updateOne:jest.fn(),insertMany:jest.fn()};
  const service=new InventoryService(summary,tx,batches);
  return {service,batch,order,batches,summary,tx};
}
describe('Exact-lot ownership and acquisition cost (mock persistence)',()=>{
  it('copies the old lot cost and actual holder without buying goods again',async()=>{
    const h=setup();await h.service.prepareOrderSource(h.order);
    expect(h.order.inventoryUnitCostSnapshot).toBe(85000);expect(h.order.originalOrderId).toBe(h.batch.originalOrderId);
    expect(h.order.senderKind).toBe('supplier');expect(h.order.senderId).toBe(h.batch.holderId);
  });
  it('rejects using dealer-owned stock for a company sale',async()=>{
    const h=setup({ownerKind:'dealer'});await expect(h.service.prepareOrderSource(h.order)).rejects.toThrow('chủ sở hữu');expect(h.batches.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects using another dealer’s goods',async()=>{
    const h=setup({ownerKind:'dealer',ownerId:String(new Types.ObjectId())},{productSource:'dealer_custody'});
    await expect(h.service.prepareOrderSource(h.order)).rejects.toThrow('chủ sở hữu');
  });
  it('allows own dealer stock held at the company',async()=>{
    const h=setup({ownerKind:'dealer',holderKind:'company',holderId:undefined},{productSource:'dealer_custody'});h.batch.ownerId=String(h.order.agentId);
    await h.service.prepareOrderSource(h.order);expect(h.order.senderKind).toBe('company');expect(h.order.inventoryUnitCostSnapshot).toBe(85000);
  });
  it.each([{condition:'scrap'},{productId:new Types.ObjectId()}])('rejects unusable or mismatched stock %o',async extra=>{
    const h=setup(extra);await expect(h.service.prepareOrderSource(h.order)).rejects.toThrow('không hợp lệ');expect(h.batches.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects unavailable inventory when the atomic reservation fails',async()=>{
    const h=setup();h.batches.findOneAndUpdate.mockResolvedValue(null);await expect(h.service.prepareOrderSource(h.order)).rejects.toThrow('không đủ');
  });
  it('retry of an already dispatched reservation writes only an idempotent transaction',async()=>{
    const h=setup({}, {productionStatus:'Đã trả kết quả',trackingNumber:'VN'});h.batches.findOneAndUpdate.mockResolvedValue(null);
    await h.service.commitOrderStock(h.order);expect(h.tx.updateOne).toHaveBeenCalledWith({businessKey:`order-stock:${h.order._id}`},expect.objectContaining({$setOnInsert:expect.objectContaining({quantity:-1})}),{upsert:true});
  });
  it('dealer custody receipts never increase the company-only inventory summary',async()=>{
    const h=setup();await h.service.recordReturnFromRMA([{productId:String(h.order.productId),quantity:1,recoveryUnitCost:85000}],undefined,undefined,
      {ownerKind:'dealer',ownerId:String(h.order.agentId),holderKind:'company',orderId:String(h.order._id),receiptId:String(new Types.ObjectId())});
    expect(h.summary.updateOne).not.toHaveBeenCalled();expect(h.batches.insertMany.mock.calls[0][0][0]).toEqual(expect.objectContaining({ownerKind:'dealer',holderKind:'company',unitCost:85000}));
  });
});
