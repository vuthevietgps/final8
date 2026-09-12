import { profitAssessment } from './profit-assessment';
const complete = { financialModelVersion:2, retailProfitState:'recognized', costAllocatedAt:new Date(),
  receivedReturnQuantity:1, shipments:[{status:'returned',quantity:1,deliveredQuantity:0,feesConfirmed:true}] };
describe('Order profit completeness',()=>{
  it('does not call an unknown retail selling price a calculated profit',()=>{
    expect(profitAssessment({...complete,retailProfitState:'missing_sale_price'}).state).toBe('incomplete');
  });
  it('requires actual receipt and inspection after a carrier return',()=>{
    const result=profitAssessment({...complete,receivedReturnQuantity:0});
    expect(result.state).toBe('provisional');
    expect(result.reasons.join()).toContain('kiểm tra');
  });
  it('allows recognized dealer revenue but provisional freight',()=>{
    const result=profitAssessment({...complete,agentId:'agent',dealerProfitState:'recognized',shipments:[{status:'dispatched',feesConfirmed:false}]});
    expect(result.state).toBe('provisional');
    expect(result.reasons.join()).toContain('phí');
  });
  it('reports complete current inputs separately from ledger settlement',()=>{
    expect(profitAssessment(complete).state).toBe('calculated');
    expect(profitAssessment({...complete,financialModelVersion:undefined}).state).toBe('provisional');
  });
});
