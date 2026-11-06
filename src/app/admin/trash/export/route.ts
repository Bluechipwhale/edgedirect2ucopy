import {requireRole,localMode,supabase} from '@/lib/server';
import {csv} from '@/lib/business';
import {failure} from '@/lib/http';
export async function GET(){try{
 await requireRole(['admin']);
 const r=await localMode()?{data:[],error:null}:await(await supabase()).rpc('admin_deleted_records');
 if(r.error)throw new Error('Deleted-record export unavailable');
 const rows=r.data as {kind:string;id:string;name:string;archived_at:string}[];
 return new Response(csv([['Type','ID','Name','Deleted at'],...rows.map(r=>[r.kind,r.id,r.name,r.archived_at])]),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="deleted-records.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return failure(e);}}
