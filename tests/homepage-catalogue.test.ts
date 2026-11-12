import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const {client}=vi.hoisted(()=>({client:{from:vi.fn(),rpc:vi.fn()}}));
vi.mock('@supabase/ssr',()=>({createServerClient:()=>client}));
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:'catalogue.example.com'}),cookies:async()=>({getAll:()=>[],set:()=>{}})}));
import {catalogue,homepageCatalogue} from '../src/lib/server';
import {homepageProductAllowed} from '../src/lib/homepage-products';
type Row={id:string;active:boolean;category_id:string;created_at:string;featured:boolean};
let rows:Row[],failSelected:boolean;
const imports=['3671','3673','3674','3678','3682','5875','5933','5934','5935','5937'].map(id=>'eedgefoods-'+id);
beforeEach(()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-test-key');vi.clearAllMocks();failSelected=false;
 rows=[...Array.from({length:15},(_,i)=>({id:'old-'+String(i).padStart(2,'0'),active:true,category_id:'old',created_at:'2026-11-01',featured:true})),...imports.map(id=>({id,active:true,category_id:'food',created_at:'2026-11-12',featured:['eedgefoods-3671','eedgefoods-3673'].includes(id)}))];
 client.rpc.mockResolvedValue({data:[{id:'food',name:'Food',image:'/icon.svg'}],error:null});
 client.from.mockImplementation(()=>{
  const filters:((p:Row)=>boolean)[]=[];let start=0,end=Infinity,selected=false;
  const builder={select:()=>builder,eq:(key:keyof Row,value:unknown)=>{filters.push(p=>p[key]===value);return builder;},not:(key:keyof Row,operator:string,value:string)=>{if(operator!=='like')throw Error('Unexpected operator');filters.push(p=>!String(p[key]).startsWith(value.slice(0,-1)));return builder;},like:(key:keyof Row,value:string)=>{selected=true;filters.push(p=>String(p[key]).startsWith(value.slice(0,-1)));return builder;},in:(key:keyof Row,values:string[])=>{selected=key==='id';filters.push(p=>values.includes(String(p[key])));return builder;},gte:()=>builder,lte:()=>builder,order:()=>builder,range:(a:number,b:number)=>{start=a;end=b;return builder;},then:(resolve:(result:unknown)=>void)=>{const found=rows.filter(p=>filters.every(f=>f(p))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||a.id.localeCompare(b.id));return Promise.resolve(selected&&failSelected?{data:null,error:{code:'42501'}}:{data:found.slice(start,end+1),count:found.length,error:null}).then(resolve);}};
  return builder;
 });
});
afterEach(()=>vi.unstubAllEnvs());
it('preserves all twelve previous homepage slots before adding only Soup MAXI and Fish MAXI',async()=>{
 const data=await homepageCatalogue();expect(data.products.map(p=>p.id)).toEqual([...Array.from({length:12},(_,i)=>'old-'+String(i).padStart(2,'0')),'eedgefoods-3671','eedgefoods-3673']);expect(data.count).toBe(14);
 const collection=await catalogue('','food');expect(collection.count).toBe(10);expect(collection.products.map(p=>p.id).sort()).toEqual([...imports].sort());
 expect(rows.filter(homepageProductAllowed).filter(p=>p.id.startsWith('eedgefoods-')).map(p=>p.id)).toEqual(['eedgefoods-3671','eedgefoods-3673']);
});
it('does not force an unpublished selected product onto the homepage',async()=>{
 rows.find(p=>p.id==='eedgefoods-3671')!.active=false;const data=await homepageCatalogue();expect(data.count).toBe(13);expect(data.products.some(p=>p.id==='eedgefoods-3671')).toBe(false);
});
it('reports a failed selection query instead of silently removing existing homepage products',async()=>{
 failSelected=true;await expect(homepageCatalogue()).rejects.toThrow('Homepage catalogue unavailable');
});

it('keeps imported products in the shop when an administrator removes their homepage feature',async()=>{rows.find(p=>p.id==='eedgefoods-3673')!.featured=false;expect((await homepageCatalogue()).products.some(p=>p.id==='eedgefoods-3673')).toBe(false);expect((await catalogue('','food')).products.some(p=>p.id==='eedgefoods-3673')).toBe(true);});
