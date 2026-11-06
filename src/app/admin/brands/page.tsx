import Link from 'next/link';
import {redirect} from 'next/navigation';
import {actor,localMode,supabase,records} from '@/lib/server';
import {ResourceManager} from '@/components/resource-manager';
export default async function Brands({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const user=await actor(false);if(!user)redirect('/login?next=/admin/brands');
 if(user.role!=='admin')return <main><h1>Administrator access required</h1></main>;
 const params=await searchParams,q=(params.q||'').trim().slice(0,120),page=Math.max(1,Math.min(100000,Math.floor(Number(params.page)||1)));
 let result:{count:number;rows:{id:string;name:string;[key:string]:unknown}[]}={count:0,rows:[]};
 if(await localMode()){const rows=await records('brands');result={count:rows.length,rows:rows.map(r=>({id:r.id,name:String(r.data.name),...r.data}))};}
 else{const {data,error}=await(await supabase()).rpc('admin_brand_registry',{p_query:q,p_page:page});if(error)throw Error('Brand registry unavailable');result=data;}
 const href=(p:number)=>'/admin/brands?'+new URLSearchParams({q,page:String(p)});
 return <main><form action="/admin/brands" className="table-toolbar"><input name="q" aria-label="Search all brands" defaultValue={q} placeholder="Search all brands"/><button className="small-button">Search</button><Link href="/brands">View storefront brands</Link></form><ResourceManager exportUrl={'/admin/brands/export?'+new URLSearchParams({q})} canArchive kind="brands" title="Brand registry" description="Edit logos, display names and descriptions. Hide a directory entry without removing its products. Catalogue names used by products stay stable; use Display name for cosmetic changes." rows={result.rows.map(r=>({id:r.id,data:{...r}}))}/><div className="pagination">{page>1&&<Link href={href(page-1)}>Previous</Link>}<span>{result.count} brands · Page {page}</span>{page*50<result.count&&<Link href={href(page+1)}>Next</Link>}</div></main>;
}
