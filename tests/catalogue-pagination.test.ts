import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const {client,query}=vi.hoisted(()=>({client:{from:vi.fn()},query:vi.fn()}));
vi.mock('@supabase/ssr',()=>({createServerClient:()=>client}));
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:'catalogue.example.com'}),cookies:async()=>({getAll:()=>[],set:()=>{}})}));
import {catalogue} from '../src/lib/server';
let filters:unknown[][],ranges:number[][];
beforeEach(()=>{
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY','public-test-key');
  vi.clearAllMocks();filters=[];ranges=[];
  client.from.mockImplementation((table:string)=>{
    if(table==='categories'){const categories={select:()=>categories,is:(...v:unknown[])=>{filters.push(v);return categories;},order:()=>categories,then:(resolve:(v:unknown)=>void)=>Promise.resolve({data:[]}).then(resolve)};return categories;}
    const builder={select:()=>builder,eq:(...v:unknown[])=>{filters.push(v);return builder;},gte:()=>builder,lte:()=>builder,gt:()=>builder,ilike:()=>builder,order:()=>builder,range:(a:number,b:number)=>{ranges.push([a,b]);return builder;},then:(resolve:(v:unknown)=>void)=>Promise.resolve(query(ranges.at(-1))).then(resolve)};
    return builder;
  });
});
afterEach(()=>vi.unstubAllEnvs());
it('returns an empty page and the real count after PostgREST rejects an excessive offset',async()=>{
  query.mockImplementation(([offset]:number[])=>offset?{data:null,count:null,error:{code:'PGRST103'}}:{data:[{id:'first'}],count:137,error:null});
  const result=await catalogue('','','',10000,'edge',0,100000,'PZ Cussons',true);
  expect(result).toEqual({products:[],count:137,categories:[]});expect(ranges).toEqual([[119988,119999],[0,0]]);
  expect(filters).toContainEqual(['merchant_id','edge']);expect(filters).toContainEqual(['brand','PZ Cussons']);expect(filters).toContainEqual(['active',true]);
});
it('does not hide database or permission failures as an empty catalogue',async()=>{
  query.mockResolvedValue({data:null,count:null,error:{code:'42501'}});
  await expect(catalogue()).rejects.toThrow('Catalogue unavailable');expect(ranges).toEqual([[0,11]]);
});
