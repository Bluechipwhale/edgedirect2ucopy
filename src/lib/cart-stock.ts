import type {Product} from './types';
type StockLine={key:string;quantity:number;product:Pick<Product,'id'|'name'|'stock'|'reserved'>};
export function cartLineLimit(cart:readonly StockLine[],product:StockLine['product'],key:string){
 const otherUnits=cart.filter(line=>line.product.id===product.id&&line.key!==key).reduce((sum,line)=>sum+line.quantity,0);
 return Math.max(0,Math.min(50,product.stock-product.reserved-otherUnits));
}
export function cartStockIssues(cart:readonly StockLine[]){
 const totals=new Map<string,{productId:string;name:string;quantity:number;available:number}>();
 for(const line of cart){const prior=totals.get(line.product.id),available=Math.max(0,line.product.stock-line.product.reserved);totals.set(line.product.id,{productId:line.product.id,name:line.product.name,quantity:(prior?.quantity||0)+line.quantity,available:Math.min(prior?.available??available,available)});}
 return [...totals.values()].filter(row=>row.quantity>row.available);
}
