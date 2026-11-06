import {requireRole,localMode,supabase,records} from '@/lib/server';
import {customerCsvCell} from '@/lib/customer-csv';
export async function GET(request:Request){
 try{
  await requireRole(['admin']);const q=(new URL(request.url).searchParams.get('q')||'').trim().slice(0,120);
  let rows:Record<string,unknown>[]=[];
  if(await localMode())rows=(await records('brands')).map(r=>({id:r.id,...r.data}));
  else{const db=await supabase();let count:number|null=null;
   for(let page=1;count===null||rows.length<count;page++){
    const {data,error}=await db.rpc('admin_brand_registry',{p_query:q,p_page:page});if(error||!data||(count!==null&&data.count!==count))throw Error('Registry changed');
    count=data.count;const next=data.rows as Record<string,unknown>[];if(!next.length&&rows.length<count!)throw Error('Incomplete export');rows.push(...next);
   }
  }
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Registry changed');
  const headers=['id','name','display_name','logo_url','description','active','product_count','archived_at'];
  const csv=[headers.map(customerCsvCell).join(','),...rows.map(r=>headers.map(k=>customerCsvCell(r[k])).join(','))].join('\r\n');
  return new Response('\ufeff'+csv+'\r\n',{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="brand-registry.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return new Response('Brand export unavailable; sign in as an administrator and retry',{status:403,headers:{'Cache-Control':'private, no-store'}});}
}
