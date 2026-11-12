import {categoryScope} from './category-tree';
import type {Category,Product} from './types';
export function customerCategories(rows:(Category&{archived_at?:string|null})[],products:Product[],approvedOwners:Set<string>){
 const hidden=new Set<string>();
 for(const row of rows)if(row.storefront_hidden||row.archived_at||row.id==='legacy-category-review'||/^imported products.*category review/i.test(row.name))categoryScope(rows,row.id).forEach(id=>hidden.add(id));
 const eligible=rows.filter(row=>!hidden.has(row.id));
 const populated=new Set(products.filter(p=>p.active&&!p.archived_at&&approvedOwners.has(p.merchant_id)).map(p=>p.category_id));
 return eligible.filter(row=>categoryScope(eligible,row.id).some(id=>populated.has(id))).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
export function customerCategoryLinks<T extends {href:string}>(links:T[],visible:Set<string>,origin:string){
 return links.filter(link=>{try{const url=new URL(link.href,origin);if(url.origin!==new URL(origin).origin)return true;const match=url.pathname.match(/^\/categories\/([^/]+)\/?$/);if(match)return visible.has(decodeURIComponent(match[1]));const category=url.pathname==='/products'?url.searchParams.get('category'):null;return !category||visible.has(category);}catch{return false;}});
}
