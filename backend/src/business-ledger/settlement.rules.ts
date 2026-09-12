export function settlementPlan(rows:any[], allocations:{orderId:string;amount:number}[], mode:'payment'|'offset', accountId?:string){
  if(!allocations.length||allocations.length>500)throw new Error('Chọn từ 1 đến 500 khoản phân bổ.');
  const seen=new Set<string>();let net=0;
  const plans=allocations.map(a=>{
    if(seen.has(a.orderId))throw new Error('Trùng đơn trong phân bổ.');seen.add(a.orderId);
    const row=rows.find(r=>r.orderId===a.orderId);
    if(!row||row.reviewReasons.length||!row.context)throw new Error('Đơn thiếu dữ liệu hoặc còn chờ đối soát.');
    if(!Number.isSafeInteger(a.amount)||!a.amount||Math.sign(a.amount)!==Math.sign(row.balance)||Math.abs(a.amount)>Math.abs(row.balance))throw new Error('Phân bổ vượt số dư hoặc sai chiều công nợ.');
    net+=a.amount;if(!Number.isSafeInteger(net))throw new Error('Tổng phân bổ vượt giới hạn.');
    return{row,amount:a.amount};
  });
  if(mode==='offset'){
    if(net!==0||plans.length<2)throw new Error('Đối trừ phải có tổng phải thu bằng tổng phải trả.');
    if(accountId)throw new Error('Đối trừ không tạo thu chi tiền.');
  }else if(!accountId||!net||plans.some(p=>Math.sign(p.amount)!==Math.sign(net)))throw new Error('Thanh toán cần tài khoản và các khoản cùng chiều; đối trừ lập riêng.');
  return{plans,net};
}
