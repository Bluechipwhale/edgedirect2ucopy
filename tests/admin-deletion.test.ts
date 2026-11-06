import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';

const admin='50000000-0000-4000-8000-000000000001';
const customer='50000000-0000-4000-8000-000000000002';
const unconfirmed='50000000-0000-4000-8000-000000000003';
let db:PGlite;
async function as<T>(id:string,work:()=>Promise<T>):Promise<T>{
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await db.exec('set role authenticated');
  try{return await work();}finally{await db.exec('reset role');}
}

beforeAll(async()=>{
  db=new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;alter default privileges in schema public grant all on tables to authenticated;");
  for(const name of readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(readFileSync(`supabase/migrations/${name}`,'utf8'));
  await db.query('insert into auth.users values($1,$2,now()),($3,$4,now()),($5,$6,null)',[admin,'admin@example.com',customer,'customer@example.com',unconfirmed,'unconfirmed@example.com']);
  await db.query("update profiles set role='admin' where id=$1",[admin]);
  await db.query("insert into legacy_customers(source_id,first_name,last_name,email,phone,address,details,source_checksum) values('101','Old','Customer','customer@example.com','08000000000','{\"street\":\"1 Road\",\"city\":\"Lagos\",\"state\":\"Lagos\"}','{\"legacy_verified\":true}',repeat('a',64)),('102','Not','Confirmed','unconfirmed@example.com','','{}','{\"legacy_verified\":false}',repeat('b',64))");
});
afterAll(async()=>db?.close());


it('denies anonymous and non-admin deletion and trash reads',async()=>{
 await db.exec('set role anon');await expect(db.query("select admin_set_record_deleted('brands','no',true)")).rejects.toThrow('permission denied');await db.exec('reset role');
 await as(customer,async()=>{await expect(db.query("select admin_deleted_records()")).rejects.toThrow('Forbidden');await expect(db.query("select admin_set_record_deleted('customers',$1,true)",[customer])).rejects.toThrow('Forbidden');});
});
it('deletes a brand reversibly without changing its catalogue products',async()=>{
 await db.exec("insert into brands(id,name) values('qa-brand','QA Brand');insert into categories(id,name,image) values('qa-category','QA Category','');insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,image,description) values('qa-product','qa-product','QA Product','qa-category','QA Brand','edge','Edge',10000,'https://example.com/image.jpg','QA product');");
 const before=(await db.query("select to_jsonb(p) row from products p where id='qa-product'")).rows;
 await as(admin,async()=>{await db.query("select admin_set_record_deleted('brands','qa-brand',true)");await db.query("select admin_set_record_deleted('brands','qa-brand',true)");await expect(db.query("select save_brand_registry('qa-brand',$1)",[{name:'QA Brand',active:true}])).rejects.toThrow('Restore');expect((await db.query<{r:{id:string}[]}>("select admin_deleted_records('brands') r")).rows[0].r).toHaveLength(1);await db.query("select admin_set_record_deleted('brands','qa-brand',false)");});
 expect((await db.query("select to_jsonb(p) row from products p where id='qa-product'")).rows).toEqual(before);expect((await db.query<{active:boolean}>("select active from brands where id='qa-brand'")).rows[0].active).toBe(true);
});
it('refuses categories with products or children and rejects references to deleted categories',async()=>{
 await as(admin,()=>expect(db.query("select admin_set_record_deleted('categories','qa-category',true)")).rejects.toThrow('still has products'));
 await db.exec("insert into categories(id,name,image) values('qa-parent','Parent','');insert into categories(id,name,image,parent_id) values('qa-child','Child','','qa-parent');");
 await as(admin,async()=>{await expect(db.query("select admin_set_record_deleted('categories','qa-parent',true)")).rejects.toThrow('child categories');await db.query("select admin_set_record_deleted('categories','qa-child',true)");});
 await expect(db.query("update products set category_id='qa-child' where id='qa-product'")).rejects.toThrow('Restore the category');
 await as(admin,()=>db.query("select admin_set_record_deleted('categories','qa-parent',true)"));
 await as(admin,()=>expect(db.query("select admin_set_record_deleted('categories','qa-child',false)")).rejects.toThrow('parent category first'));
 await as(admin,async()=>{await db.query("select admin_set_record_deleted('categories','qa-parent',false)");await db.query("select admin_set_record_deleted('categories','qa-child',false)");});
});
it('removes and restores a customer contact while preserving its source data and Auth identity',async()=>{
 const before=(await db.query("select to_jsonb(c)-'archived_at' row from legacy_customers c where source_id='101'")).rows;
 await as(admin,async()=>{await db.query("select admin_set_record_deleted('legacy_customers','101',true)");expect((await db.query<{r:{count:number}}>("select admin_customer_directory('',1,false) r")).rows[0].r.count).toBe(1);expect((await db.query<{r:{count:number}}>("select admin_customer_directory('',1,true) r")).rows[0].r.count).toBe(1);await db.query("select admin_set_record_deleted('legacy_customers','101',false)");await db.query("select admin_set_record_deleted('customers',$1,true)",[customer]);await db.query("select admin_set_record_deleted('customers',$1,false)",[customer]);});
 expect((await db.query("select to_jsonb(c)-'archived_at' row from legacy_customers c where source_id='101'")).rows).toEqual(before);expect((await db.query('select id from auth.users where id=$1',[customer])).rows).toHaveLength(1);
});
it('disables a coupon, prevents editing it while deleted, and restores its previous state',async()=>{
 await db.exec("insert into coupons(id,code,percent,active) values('qa-coupon','QA5',5,false)");
 await as(admin,async()=>{await db.query("select admin_set_record_deleted('coupons','qa-coupon',true)");await expect(db.query("select save_record('coupons','qa-coupon',$1)",[{code:'QA5',percent:5,active:true}])).rejects.toThrow('Restore');await db.query("select admin_set_record_deleted('coupons','qa-coupon',false)");await expect(db.query("select admin_set_record_deleted('payments','anything',true)")).rejects.toThrow('Unsupported');});
 expect((await db.query<{active:boolean}>("select active from coupons where id='qa-coupon'")).rows[0].active).toBe(false);
});

it('blocks deleting an outlet with an open visit, removes it from clock-in, and restores its activity',async()=>{
 const company='10000000-0000-4000-8000-000000000001',store='60000000-0000-4000-8000-000000000001',assignment='60000000-0000-4000-8000-000000000002';
 await db.query("insert into platform_companies(id,slug,name,allow_web_checkin) values($1,'e-edge-direct-2u','Fixture company',true) on conflict(id) do update set allow_web_checkin=true",[company]);
 await db.query("insert into platform_modules(company_id,module,enabled) values($1,'field_operations',true) on conflict(company_id,module) do update set enabled=true",[company]);
 await db.query("insert into platform_memberships(company_id,user_id,role) values($1,$2,'field_agent') on conflict(company_id,user_id) do update set role='field_agent',active=true",[company,customer]);
 await db.query("insert into field_stores(company_id,id,name,address,latitude,longitude,legacy_customer_id) values($1,$2,'Fixture outlet','Fixture address only',7.320975,3.833871,'101')",[company,store]);
 await db.query("insert into field_assignments(company_id,id,store_id,agent_id,visit_date) values($1,$2,$3,$4,(now() at time zone 'Africa/Lagos')::date)",[company,assignment,store,customer]);
 await as(customer,()=>db.query('select field_checkin($1,$2,7.320975,3.833871,5,now())',[company,assignment]));
 await as(admin,async()=>{await expect(db.query("select admin_set_record_deleted('outlets',$1,true)",[store])).rejects.toThrow('Finish the outlet visit');await expect(db.query("select admin_set_record_deleted('legacy_customers','101',true)")).rejects.toThrow('Finish the customer visit');});
 await db.query('update field_visits set completed_at=now() where company_id=$1',[company]);
 await as(admin,()=>db.query("select admin_set_record_deleted('legacy_customers','101',true)"));
 expect((await db.query<{active:boolean}>('select active from field_stores where company_id=$1 and id=$2',[company,store])).rows[0].active).toBe(false);
 await as(customer,()=>expect(db.query('select field_checkin($1,$2,7.320975,3.833871,5,now())',[company,assignment])).rejects.toThrow('Store unavailable'));
 await as(admin,()=>db.query("select admin_set_record_deleted('legacy_customers','101',false)"));
 expect((await db.query<{active:boolean}>('select active from field_stores where company_id=$1 and id=$2',[company,store])).rows[0].active).toBe(true);
 expect((await db.query('select id from field_visits where company_id=$1',[company])).rows).toHaveLength(1);
});
