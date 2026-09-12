import { allocateVnd } from '../common/allocate-vnd';

/** Acquisition value includes the tax/freight/discount entered on the purchase document. */
export function purchaseUnitCosts(po: any): number[] {
  const items = po.items || [];
  const values = items.map((i: any) => Number(i.quantity) * Number(i.unitPrice));
  const weights = values.some(v => v > 0) ? values : items.map((i:any) => Number(i.quantity));
  const allocated = allocateVnd(Math.round(po.grandTotal), weights);
  return items.map((i:any,index:number) => allocated[index] / Number(i.quantity));
}
export function receivedPurchaseValue(po:any):number {
  const costs = purchaseUnitCosts(po);
  return Math.round(po.items.reduce((n:number,i:any,index:number) => n + Number(i.quantityReceived || 0) * costs[index],0));
}
