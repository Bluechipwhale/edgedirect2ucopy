import {expect,it} from 'vitest';
import {cartLineLimit,cartStockIssues} from '../src/lib/cart-stock';
const product={id:'shared-sku',name:'Stock fixture',stock:8,reserved:3};
const lines=[{key:'light',product,quantity:3},{key:'dark',product,quantity:2}];
it('shares available stock between options of the same product',()=>{
 expect(cartLineLimit(lines,product,'new-option')).toBe(0);
 expect(cartLineLimit(lines,product,'light')).toBe(3);
 expect(cartLineLimit(lines,product,'dark')).toBe(2);
 expect(cartStockIssues(lines)).toEqual([]);
});
it('keeps unrelated products independent and preserves the per-option quantity limit',()=>{
 expect(cartLineLimit(lines,{...product,id:'other',stock:100,reserved:0},'other-option')).toBe(50);
 expect(cartLineLimit(lines,{...product,stock:4},'light')).toBe(0);
});
it('detects invalid older bags and falls back to the lower cached availability',()=>{
 const older=[...lines,{key:'extra',product:{...product,stock:10},quantity:1}];
 expect(cartStockIssues(older)).toEqual([{productId:'shared-sku',name:'Stock fixture',quantity:6,available:5}]);
 expect(cartStockIssues([])).toEqual([]);
});
