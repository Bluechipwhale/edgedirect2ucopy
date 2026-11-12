import {z} from 'zod';
import {requireRole,requirePermission,localMode,supabase,managementCategories,records,adminProductCatalogue,orders} from '@/lib/server';
import {resourceFields} from '@/lib/resources';
import {csv} from '@/lib/business';
import {failure} from '@/lib/http';
import {exportContent} from '@/lib/content-export';
import {GET as exportBrands} from '@/app/admin/brands/export/route';
export async function GET(req:Request){try{
 const params=new URL(req.url).searchParams;const a=params.get('kind')==='products'?await requirePermission('catalogue.read'):await requireRole(['admin']);
 const input=z.object({kind:z.string().max(60),q:z.string().max(120).default(''),state:z.enum(['all','active','draft','archived']).default('all'),owner:z.string().max(100).default('')}).parse(Object.fromEntries(params));
 if(!Object.hasOwn(resourceFields,input.kind)&&!['audit','stock_movements','merchant_ledger','orders','deliveries','refunds','profiles'].includes(input.kind))throw new Error('Unsupported export');
 if(input.kind==='brands')return exportBrands(req);
 if(input.kind==='gallery'||input.kind==='pages')return exportContent(req,input.kind);
 let rows:Record<string,unknown>[]=[];
 if(input.kind==='products'){
  const first=await adminProductCatalogue(a,1,input.q,input.state,input.owner);rows=first.products as unknown as Record<string,unknown>[];
  for(let page=2;rows.length<first.count;page++){if(req.signal.aborted)throw new Error('Export cancelled');const next=await adminProductCatalogue(a,page,input.q,input.state,input.owner);if(next.count!==first.count||!next.products.length)throw new Error('Catalogue changed during export. Please retry.');rows.push(...next.products as unknown as Record<string,unknown>[]);}
 }else if(input.kind==='categories')rows=await managementCategories() as unknown as Record<string,unknown>[];
 else if(input.kind==='orders'&&await localMode())rows=await orders(a) as unknown as Record<string,unknown>[];
 else if(input.kind==='profiles'&&!await localMode()){
  const db=await supabase();let total:number|null=null;
  for(let offset=0;total===null||offset<total;offset+=1000){const result=await db.from('profiles').select('id,name,role,merchant_id,created_at',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(offset,offset+999).abortSignal(req.signal);if(result.error)throw new Error('Account export is unavailable');if(total!==null&&result.count!==total)throw new Error('Accounts changed during export. Please retry.');total=result.count||0;rows.push(...result.data||[]);if(!result.data?.length&&offset<total)throw new Error('Incomplete accounts export. Please retry.');}
 }
 else if(input.kind==='orders'&&!await localMode()){
  const db=await supabase();let total:number|null=null;
  for(let offset=0;total===null||offset<total;offset+=500){const result=await db.from('orders').select('*,order_items(*)',{count:'exact'}).order('created_at',{ascending:false}).order('id').range(offset,offset+499).abortSignal(req.signal);if(result.error)throw new Error('Orders export is unavailable');if(total!==null&&result.count!==total)throw new Error('Orders changed during export. Please retry.');total=result.count||0;rows.push(...result.data||[]);if(!result.data?.length&&offset<total)throw new Error('Incomplete orders export. Please retry.');}
 }
 else if(await localMode())rows=(await records(input.kind)).map(row=>({id:row.id,created_at:row.created_at,...row.data}));
 else{
  const db=await supabase();let total:number|null=null;
  for(let offset=0;total===null||offset<total;offset+=1000){const result=await db.from('operational_records').select('id,created_at,data',{count:'exact'}).eq('kind',input.kind).order('created_at',{ascending:false}).order('id').range(offset,offset+999).abortSignal(req.signal);if(result.error)throw new Error('Export is unavailable');if(total!==null&&result.count!==total)throw new Error('Records changed during export. Please retry.');total=result.count||0;rows.push(...(result.data||[]).map(row=>({id:row.id,created_at:row.created_at,...row.data})));if(!result.data?.length&&offset<total)throw new Error('Incomplete export. Please retry.');}
 }
 if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('Records changed during export. Please retry.');
 const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 const values=rows.map(row=>keys.map(key=>{const value=row[key];return value===null||value===undefined?null:typeof value==='number'?value:typeof value==='object'?JSON.stringify(value):String(value);}));
 return new Response(csv([keys,...values]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="${input.kind}.csv"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return failure(error);}}
