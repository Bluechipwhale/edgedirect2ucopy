import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies, headers } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { localStore } from './local-store';
import { defaultTheme, themeSchema, type Theme } from './theme';
import type { Actor, Category, Product, RecordRow, Order } from './types';
import {cataloguePage,cataloguePrice} from './catalogue-query';
import {categoryScope} from './category-tree';
import {commercePermissions,type CommercePermission,type CommerceContext} from './commerce-permissions';

export function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export async function supabase() {
  if (!configured()) throw new Error('Supabase is not configured');
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => jar.getAll(), setAll: list => { try { list.forEach(c => jar.set(c.name, c.value, c.options)); } catch { /* Server rendering cannot update cookies. Route handlers refresh them. */ } } } });
}
export function service() { if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !configured()) throw new Error('Supabase service credentials are not configured'); return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }); }
export async function localMode() {
  const host = (await headers()).get('host') || '';
  return !configured() && process.env.NODE_ENV !== 'production' && process.env.LOCAL_DEMO !== 'false' && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
}
export async function actor(required = true): Promise<Actor | null> {
  if (await localMode()) return { id: 'local-workspace', role: 'admin', local: true };
  if (configured()) {
    const db = await supabase(); const { data: { user } } = await db.auth.getUser();
    if (user) { const { data } = await db.from('profiles').select('role, merchant_id').eq('id', user.id).single(); return { id: user.id, role: data?.role || 'customer', merchantId: data?.merchant_id || undefined }; }
  }
  if (required) throw new Error('Authentication required'); return null;
}
export async function requireRole(roles: string[]) { const a = (await actor())!; if (!roles.includes(a.role)) throw new Error('Forbidden'); return a; }
export async function commerceContext():Promise<CommerceContext>{if(await localMode())return {name:'Local administrator',permissions:Object.keys(commercePermissions) as CommercePermission[]};const r=await(await supabase()).rpc('commerce_context');if(r.error)throw Error('Staff permissions are temporarily unavailable');return r.data as CommerceContext;}
export async function canPermission(p:CommercePermission){return (await commerceContext()).permissions.includes(p);}
export async function requirePermission(p:CommercePermission){const a=(await actor())!;if(!await canPermission(p))throw Error('Forbidden');return a;}
export async function publishedTheme(): Promise<Theme> {
  if (await localMode()) return themeSchema.parse(localStore().get('settings', 'published'));
  if (!configured()) return defaultTheme;
  try { const db = await supabase(); const { data } = await db.from('website_settings').select('config').eq('id', 'published').single(); const parsed = themeSchema.safeParse(data?.config); return parsed.success ? parsed.data : defaultTheme; } catch { return defaultTheme; }
}
export async function catalogue(query = '', category = '', sort = '', page = 1, merchant = '', min = 0, max = Number.MAX_SAFE_INTEGER, brand = '', available = false): Promise<{ products: Product[]; count: number; categories: Category[] }> {
  page=cataloguePage(page);min=cataloguePrice(min,0);max=cataloguePrice(max,Number.MAX_SAFE_INTEGER);
  if (await localMode()) {
    const scope=categoryScope(localStore().list<Category>('categories'),category);
    const p = localStore().list<Product>('products').filter(p => p.active && (!query || `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())) && (!category || scope.includes(p.category_id)) && (!merchant || p.merchant_id === merchant) && p.price_kobo >= min && p.price_kobo <= max && (!brand || p.brand === brand) && (!available || p.stock > p.reserved));
    p.sort((a,b)=>(sort==='price-asc'?a.price_kobo-b.price_kobo:sort==='price-desc'?b.price_kobo-a.price_kobo:b.created_at.localeCompare(a.created_at))||a.id.localeCompare(b.id));
    return { products: p.slice((page-1)*12, page*12), count: p.length, categories: localStore().list<Category>('categories').sort((a,b)=>(a.sort_order||0)-(b.sort_order||0)||a.name.localeCompare(b.name)) };
  }
  if (!configured()) return { products: [], count: 0, categories: [] };
  const db = await supabase();
  const scopedCategories=category?await db.from('categories').select('*').is('archived_at',null).order('sort_order').order('name'):null;
  if(scopedCategories?.error)throw new Error('Catalogue unavailable');
  let req = db.from('storefront_products').select('*', { count: 'exact' }).eq('active', true);
  if (query) req = req.ilike('name', `%${query.replace(/[%_]/g, '')}%`); if (category) req = req.in('category_id',categoryScope(scopedCategories?.data||[],category)); if (merchant) req = req.eq('merchant_id', merchant); if (brand) req = req.eq('brand', brand); req = req.gte('price_kobo', min).lte('price_kobo', max); if (available) req = req.gt('available_stock', 0);
  req = req.order(sort.startsWith('price') ? 'price_kobo' : 'created_at', { ascending: sort === 'price-asc' }).order('id',{ascending:true}).range((page-1)*12, page*12-1);
  const [result, categories] = await Promise.all([req, scopedCategories||db.from('categories').select('*').is('archived_at',null).order('sort_order').order('name')]);
  let {data,count,error}=result;const cats=categories.data;
  // PostgREST returns 416 for a page beyond the filtered result set. Read the
  // same filtered query's first row to recover its count, without losing scope.
  if(error?.code==='PGRST103'){
    const first=await req.range(0,0);error=first.error;count=first.count;data=[];
  }
  if (error) throw new Error('Catalogue unavailable');
  return { products: (data || []) as Product[], count: count || 0, categories: (cats || []) as Category[] };
}
export async function product(slug: string) { if (await localMode()) return localStore().list<Product>('products').find(p => p.slug === slug && p.active); if (!configured()) return undefined; const { data } = await (await supabase()).from('storefront_products').select('*').eq('slug', slug).eq('active', true).single(); return data as Product | undefined; }
export async function records(kind: string,publicView=false): Promise<RecordRow[]> {
  if (await localMode()) {const rows=localStore().list<RecordRow>(kind);if(kind==='deliveries')return rows.map(r=>({...r,data:{...r.data,events:localStore().list<RecordRow>('delivery_events').filter(e=>e.data.delivery_id===r.id).reverse().map(e=>({...e.data,created_at:e.created_at}))}}));if(kind==='merchants'&&publicView)return rows.filter(r=>r.data.status==='approved').map(r=>({id:r.id,kind:r.kind,created_at:r.created_at,data:{name:r.data.name,description:r.data.description,status:r.data.status}}));return publicView?filterRecords(kind,rows):rows;}
  if (!configured()) return [];
  if(kind==='merchants'&&publicView){const {data,error}=await(await supabase()).rpc('public_merchants');if(error)throw new Error(error.message);return data||[];}
  if(kind==='deliveries'){const {data,error}=await(await supabase()).rpc('my_deliveries');if(error)throw new Error(error.message);return data||[];}
  const { data, error } = await (await supabase()).from('operational_records').select('*').eq('kind', kind).order('created_at', { ascending: false }).limit(100); if (error) throw new Error('Records unavailable'); return publicView?filterRecords(kind,(data || []) as RecordRow[]):(data || []) as RecordRow[];
}
function filterRecords(kind:string,rows:RecordRow[]){if(kind!=='banners')return rows;const now=Date.now();return rows.filter(r=>(!r.data.starts_at||Date.parse(String(r.data.starts_at))<=now)&&(!r.data.ends_at||Date.parse(String(r.data.ends_at))>=now));}
export async function orders(a: Actor): Promise<Order[]> { if (await localMode()) return localStore().scopedOrders(a); const { data, error } = await (await supabase()).rpc('my_orders'); if (error) throw new Error(error.message); return data || []; }
export async function checkoutActor(): Promise<Actor> {
  if (await localMode()) return (await actor())!;
  if (!configured()) throw new Error('Authentication required');
  const { data: { user }, error } = await (await supabase()).auth.getUser();
  if (error || !user || user.is_anonymous) throw new Error('Authentication required');
  return { id: user.id, role: 'customer' };
}
export function newId() { return randomUUID(); }
export async function managementProducts(a:Actor,page=1){
  if(!['admin','operations','merchant'].includes(a.role))throw new Error('Forbidden');
  if(await localMode()){const all=localStore().list<Product>('products').filter(p=>a.role!=='merchant'||p.merchant_id===a.merchantId);return {products:all.slice((page-1)*25,page*25),count:all.length};}
  let query=(await supabase()).from('products').select('*',{count:'exact'});if(a.role==='merchant')query=query.eq('merchant_id',a.merchantId!);
  const {data,count,error}=await query.order('created_at',{ascending:false}).range((page-1)*25,page*25-1);if(error)throw new Error(error.message);return {products:(data||[]) as Product[],count:count||0};
}
export type ProductSearchState='all'|'active'|'draft'|'archived';
export async function adminProductCatalogue(a:Actor,page=1,query='',state:ProductSearchState='all',owner=''){
  if(a.role!=='admin')await requirePermission('catalogue.read');
  const q=query.trim().slice(0,120).toLowerCase();
  if(await localMode()){
    const all=localStore().list<Product>('products').filter(p=>
      (!q||`${p.name} ${p.brand} ${p.slug} ${p.id} ${p.merchant_name}`.toLowerCase().includes(q))&&
      (!owner||p.merchant_id===owner)&&
      (state==='all'||state==='archived'&&!!p.archived_at||state==='active'&&p.active&&!p.archived_at||state==='draft'&&!p.active&&!p.archived_at));
    all.sort((left,right)=>right.created_at.localeCompare(left.created_at)||right.id.localeCompare(left.id));
    return {products:all.slice((page-1)*25,page*25),count:all.length};
  }
  const {data,error}=await(await supabase()).rpc('admin_product_catalogue',{p_query:q,p_state:state,p_owner:owner,p_page:page});
  if(error)throw new Error(error.message);
  return {products:(data?.products||[]) as Product[],count:Number(data?.count)||0};
}
export async function metrics(){
  await requireRole(['admin','operations']);
  if(await localMode()){const store=localStore(),all=store.list<Order>('orders');return {revenue:all.filter(o=>o.payment_status==='paid').reduce((sum,o)=>sum+o.total_kobo,0),orders:all.length,products:store.list<Product>('products').filter(p=>p.active).length,merchants:store.list<RecordRow>('merchants').filter(m=>m.data.status==='approved').length};}
  const {data,error}=await(await supabase()).rpc('dashboard_metrics');if(error)throw new Error(error.message);return data as {revenue:number;orders:number;products:number;merchants:number};
}
export async function publicReviews(productId:string):Promise<{id:string;rating:number;comment:string;created_at:string}[]>{
  if(await localMode())return localStore().list<RecordRow>('reviews').filter(r=>r.data.product_id===productId&&r.data.status==='published').map(r=>({id:r.id,rating:Number(r.data.rating),comment:String(r.data.comment),created_at:r.created_at}));
  if(!configured())return [];const {data}=await(await supabase()).rpc('public_reviews',{p_product:productId});return data||[];
}

