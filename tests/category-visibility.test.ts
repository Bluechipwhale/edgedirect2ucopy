import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {customerCategories,customerCategoryLinks} from '../src/lib/category-visibility';
import type {Category,Product} from '../src/lib/types';

const admin='50000000-0000-4000-8000-000000000001',customer='50000000-0000-4000-8000-000000000002';
let db:PGlite;
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;alter default privileges in schema public grant all on tables to authenticated;");
 for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
 await db.query('insert into auth.users values($1,$2,now()),($3,$4,now())',[admin,'admin@example.com',customer,'customer@example.com']);
 await db.query("update profiles set role='admin' where id=$1",[admin]);
 await db.exec("insert into organizations values('pending','Pending','merchant');insert into merchants(id,name,status) values('pending','Pending','pending');");
 for(const [id,parent] of [['root',null],['child','root'],['leaf','child'],['empty',null],['draft',null],['archived-product',null],['unapproved',null],['legacy-category-review',null],['review-child','legacy-category-review'],['archived-category',null],['archived-child','archived-category']])await db.query('insert into categories(id,name,image,parent_id) values($1,$1,\'/icon.svg\',$2)',[id,parent]);
 for(const category of ['leaf','draft','archived-product','unapproved','legacy-category-review','review-child','archived-category','archived-child'])await db.query("insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,image,description,active,archived_at) values($1,$1,$1,$2,'QA',$3,'QA',10000,'/icon.svg','Fixture',$4,$5)",['p-'+category,category,category==='unapproved'?'pending':'edge',!['draft','archived-product'].includes(category),category==='archived-product'?new Date():null]);
 await db.exec("update categories set archived_at=now() where id='archived-category'");
});
afterAll(async()=>db?.close());
async function visible(role='anon',id=''){
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);
 try{return (await db.query<{id:string}>('select id from storefront_categories() order by id')).rows.map(r=>r.id);}finally{await db.exec('reset role');}
}
it('only exposes populated branches, including out-of-stock published products, with identical customer RLS',async()=>{
 expect(await visible()).toEqual(['child','leaf','root']);expect(await visible('authenticated',customer)).toEqual(['child','leaf','root']);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[customer]);await db.exec('set role authenticated');
 try{expect((await db.query<{id:string}>('select id from categories order by id')).rows.map(r=>r.id)).toEqual(['child','leaf','root']);}finally{await db.exec('reset role');}
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');
 try{expect((await db.query('select * from categories')).rows).toHaveLength(17);expect(await db.query("select * from categories where id='legacy-category-review'")).toMatchObject({rows:[{id:'legacy-category-review'}]});}finally{await db.exec('reset role');}
});
it('hides explicitly disabled category branches without changing their products or management access',async()=>{
 const products=(await db.query('select * from products order by id')).rows;
 await db.exec("update categories set storefront_hidden=true where id='root'");expect(await visible()).toEqual([]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);await db.exec('set role authenticated');
 try{expect((await db.query("select * from categories where id='root'")).rows).toHaveLength(1);}finally{await db.exec('reset role');}
 expect((await db.query('select * from products order by id')).rows).toEqual(products);
 await db.exec("update categories set storefront_hidden=false where id='root'");expect(await visible()).toEqual(['child','leaf','root']);
 await db.exec('set role anon');try{await expect(db.query('select * from catalogue_external_sources')).rejects.toThrow('permission denied');}finally{await db.exec('reset role');}
});
it('updates visibility automatically after publication changes without altering category records',async()=>{
 const before=(await db.query('select * from categories order by id')).rows;
 await db.exec("update products set active=true where category_id='draft'");expect(await visible()).toEqual(['child','draft','leaf','root']);
 await db.exec("update products set active=false where category_id in ('draft','leaf')");expect(await visible()).toEqual([]);
 expect((await db.query('select * from categories order by id')).rows).toEqual(before);
});
it('keeps the local category directory and navigation consistent with the public rule',()=>{
 const categories=[{id:'parent',name:'Parent'},{id:'child',name:'Child',parent_id:'parent'},{id:'empty',name:'Empty'},{id:'legacy-category-review',name:'Imported products — category review'}].map(r=>({...r,image:'/icon.svg'})) as Category[];
 const products=[{category_id:'child',active:true,merchant_id:'edge',stock:0},{category_id:'empty',active:false,merchant_id:'edge'},{category_id:'legacy-category-review',active:true,merchant_id:'edge'}] as Product[];
 const visible=customerCategories(categories,products,new Set(['edge']));expect(visible.map(r=>r.id).sort()).toEqual(['child','parent']);
 expect(customerCategories(categories.map(r=>r.id==='parent'?{...r,storefront_hidden:true}:r),products,new Set(['edge']))).toEqual([]);
 const links=['/categories/empty','/categories/child','/products?category=legacy-category-review','/products','/contact','https://external.example/categories/empty'].map(href=>({href}));
 expect(customerCategoryLinks(links,new Set(visible.map(r=>r.id)),'https://edgedirect2u.com').map(r=>r.href)).toEqual(['/categories/child','/products','/contact','https://external.example/categories/empty']);
});
