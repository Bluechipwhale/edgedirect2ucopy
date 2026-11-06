import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor,requireRole,requirePermission,localMode,supabase,records,orders } from '@/lib/server';
import { localStore } from '@/lib/local-store';
import { resourceSchemas,productSchema } from '@/lib/resources';
import { guard,failure } from '@/lib/http';
import type { Product,Category,RecordRow } from '@/lib/types';
export async function POST(req:Request){try{guard(req);const a=(await actor())!;const input=z.object({kind:z.string().max(60),id:z.string().max(100).optional(),data:z.record(z.string(),z.unknown())}).parse(await req.json());const schema=input.kind==='products'?productSchema:resourceSchemas[input.kind];if(!schema)throw new Error('Unknown resource');const data=schema.parse(input.data) as Record<string,unknown>;
  if(['addresses','returns','reviews'].includes(input.kind)){if(input.kind==='returns'||input.kind==='reviews'){const o=(await orders(a)).find(o=>o.id===data.order_id);if(!o||o.payment_status!=='paid')throw new Error('Only verified paid orders are eligible');if(a.role!=='admin')data.status=input.kind==='returns'?'requested':'pending';if(input.kind==='reviews'&&!o.items.some(i=>i.product_id===data.product_id))throw new Error('Product was not purchased in this order');}}
  else if(a.role==='merchant' && input.kind==='products'){data.merchant_id=a.merchantId;const m=(await records('merchants')).find(m=>m.id===a.merchantId);if(m?.data.status!=='approved')throw new Error('Merchant approval required');data.merchant_name=m.data.name;}
  else if(input.kind==='products')await requirePermission('catalogue.edit');else if(['gallery','pages'].includes(input.kind))await requirePermission('content.manage');else await requireRole(['admin']);
  const id=input.id||crypto.randomUUID();
  if(await localMode()){const store=localStore();if(input.kind==='products'){const existing=store.get<Product>('products',id);if(existing?.archived_at)throw new Error('Restore product before editing');if(a.role==='merchant'&&existing&&existing.merchant_id!==a.merchantId)throw new Error('Forbidden');store.put('products',id,{...data,id,stock:existing?.stock||0,reserved:existing?.reserved||0,created_at:existing?.created_at||new Date().toISOString()});}else if(input.kind==='categories'){store.put('categories',id,{...data,id} as Category);}else{const existing=store.get<RecordRow>(input.kind,id);if(existing&&a.role!=='admin'&&existing.owner_id!==a.id)throw new Error('Forbidden');store.record(input.kind,data,id,a);}store.audit(a,`${input.kind}.saved`,{id});}
  else {const db=await supabase();if(['gallery','pages'].includes(input.kind)){const {error}=await db.from(input.kind==='gallery'?'gallery_media':'content_pages').upsert({...data,id});if(error)throw new Error(error.message);}else if(input.kind==='brands'){const {error}=await db.rpc('save_brand_registry',{p_id:id,p_data:data});if(error)throw new Error(error.message);}else if(input.kind==='products'){const {error}=await db.rpc('save_product',{p_id:id,p_data:data});if(error)throw new Error(error.message);}else if(input.kind==='categories'){const {error}=await db.from('categories').upsert({...data,id,parent_id:data.parent_id||null});if(error)throw new Error(error.message);}else{const {error}=await db.rpc('save_record',{p_kind:input.kind,p_id:id,p_data:data});if(error)throw new Error(error.message);}}
  return NextResponse.json({ok:true,id});}catch(e){return failure(e);}}

export async function PATCH(req:Request){try{
  guard(req);
  const input=z.object({kind:z.enum(['products','brands','categories','legacy_customers','customers','outlets','banners','coupons','notifications','gallery','pages']),id:z.string().min(1).max(100),archive:z.boolean()}).parse(await req.json());
  const a=input.kind==='products'?await requirePermission('catalogue.edit'):await requireRole(['admin']);
  if(await localMode()){if(input.kind!=='products')throw new Error('Directory deletion requires the production database');localStore().archiveProduct(a,input.id,input.archive);}
  else {const db=await supabase();const {error}=input.kind==='products'?await db.rpc('set_product_archived',{p_id:input.id,p_archive:input.archive}):await db.rpc('admin_set_record_deleted',{p_kind:input.kind,p_id:input.id,p_deleted:input.archive});if(error)throw new Error(error.message);}
  return NextResponse.json({ok:true,id:input.id,archived:input.archive},{headers:{'Cache-Control':'no-store'}});
}catch(e){return failure(e);}}

