import { Types } from 'mongoose';
import { OrderCalculationService } from './order-calculation.service';

// Persistence is mocked; these cases exercise the actual snapshot service.
function setup() {
  let supplier:any={_id:new Types.ObjectId(),price:120000,shippingFee:20000,returnFee:30000,currency:'VND'};
  let dealer:any={_id:new Types.ObjectId(),unitPrice:250000,shippingFee:25000,returnFee:35000,validFrom:new Date('2026-09-01')};
  let product:any={importPrice:110000,packagingCost:5000,resalePolicy:'resellable'};
  const supplierModel={findOne:jest.fn(()=>({sort:()=>({lean:async()=>supplier})}))};
  const dealerModel={findOne:jest.fn(()=>({sort:()=>({lean:async()=>dealer})}))};
  const productModel={findById:jest.fn(()=>({lean:async()=>product}))};
  const calc:any=new OrderCalculationService({} as any,productModel as any,dealerModel as any,supplierModel as any,{} as any,{} as any);
  const order:any={productId:new Types.ObjectId(),supplierId:new Types.ObjectId(),agentId:new Types.ObjectId(),
    productSource:'supplier',orderDate:new Date('2026-09-04T03:00:00Z')};
  const snapshot=async()=>{await calc.calculateSupplierQuote(order);await calc.calculateAgentQuote(order);await calc.calculateShippingAndReturnFees(order);};
  return {order,snapshot,calc,supplierModel,dealerModel,change:()=>{
    supplier={...supplier,price:999000,shippingFee:90000,returnFee:80000};
    dealer={...dealer,unitPrice:999000,shippingFee:90000,returnFee:80000};product={...product,packagingCost:99000,resalePolicy:'not_resellable'};
  },zero:()=>{supplier={...supplier,price:0,shippingFee:0,returnFee:0};dealer={...dealer,unitPrice:0,shippingFee:0,returnFee:0};},
  missing:()=>{supplier=null;},approve:()=>{supplier={_id:new Types.ObjectId(),price:130000,currency:'VND'};}};
}
describe('Price snapshot regression',()=>{
  it('keeps the product category identity used when the order was created', async () => {
    const productId = new Types.ObjectId();
    const originalCategoryId = new Types.ObjectId();
    let category: any = { _id: originalCategoryId, name: 'Nhóm A', code: 'A' };
    const productModel = { findById: jest.fn(() => ({
      populate: () => ({ lean: async () => ({ _id: productId, categoryId: category }) }),
    })) };
    const calc: any = new OrderCalculationService(
      {} as any, productModel as any, {} as any, {} as any, {} as any, {} as any,
    );
    const order: any = { productId };

    await calc.calculateProductType(order);
    category = { _id: new Types.ObjectId(), name: 'Nhóm B', code: 'B' };
    await calc.calculateProductType(order);

    expect(String(order.productCategoryIdSnapshot)).toBe(String(originalCategoryId));
    expect(order.productCategoryNameSnapshot).toBe('Nhóm A');
    expect(order.productCategoryCodeSnapshot).toBe('A');
    expect(order.productType).toBe('Nhóm A');
  });
  it('keeps both prices, freight and product policy after price lists are edited',async()=>{
    const h=setup();await h.snapshot();const original={...h.order};h.change();await h.snapshot();
    expect(h.order).toEqual(original);expect(h.supplierModel.findOne).toHaveBeenCalledTimes(1);expect(h.dealerModel.findOne).toHaveBeenCalledTimes(1);
  });
  it('preserves legitimate zero prices and zero freight',async()=>{
    const h=setup();h.zero();await h.snapshot();h.change();await h.snapshot();
    expect([h.order.supplierAppliedPrice,h.order.agentAppliedPrice,h.order.shippingFee,h.order.returnFee,h.order.dealerShippingFeeSnapshot]).toEqual([0,0,0,0,0]);
  });
  it('does not silently turn a product fallback into an approved supplier price',async()=>{
    const h=setup();h.missing();await h.snapshot();expect(h.order.supplierQuoteId).toBeUndefined();
    expect(h.order.supplierPriceSource).toBe('product_fallback');h.approve();await h.snapshot();
    expect(h.order.supplierAppliedPrice).toBe(130000);expect(h.order.supplierQuoteId).toBeDefined();
  });
  it('uses the acquisition snapshot for existing stock, without fetching a new supplier quote',async()=>{
    const h=setup();h.order.productSource='inventory';h.order.inventoryUnitCostSnapshot=85000;await h.snapshot();
    expect(h.order.supplierQuote).toBe(85000);expect(h.order.supplierPriceSource).toBe('inventory');expect(h.supplierModel.findOne).not.toHaveBeenCalled();
  });
  it('requests an approved, active dealer quote effective at the order date',async()=>{
    const h=setup();await h.snapshot();expect(h.dealerModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      status:'Đã duyệt',validFrom:{$lte:h.order.orderDate},validUntil:{$gte:h.order.orderDate},isActive:{$ne:false},
    }));
  });
});
