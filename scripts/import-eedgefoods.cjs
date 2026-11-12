// Reviewed, owner-authorized catalogue import. This script is never bundled into the app.
const fs=require('node:fs'),crypto=require('node:crypto');
const digest=value=>crypto.createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
function text(value){return String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#(?:8217|039);/g,"'").replace(/&(?:lsquo|rsquo);/g,"'").replace(/\s+/g,' ').trim();}
function sourceUrl(value){const url=new URL(value);if(url.origin!=='https://eedgefoods.com'||!url.pathname.startsWith('/product/'))throw Error('Unexpected source product URL');return url.href;}
function normalize(source){
 if(!Array.isArray(source)||!source.length||new Set(source.map(r=>String(r.id))).size!==source.length)throw Error('Invalid or duplicate source IDs');
 const groups=new Map();
 for(const row of source){
  if(!Number.isSafeInteger(row.id)||row.id<=0||row.type!=='simple'||row.attributes?.length||row.variations?.length)throw Error('Review source product type or variants');
  if(row.prices?.currency_code!=='NGN'||row.prices.currency_minor_unit!==2||!/^\d+$/.test(row.prices.price))throw Error('Unverified NGN minor-unit price');
  const price=Number(row.prices.price);if(!Number.isSafeInteger(price)||price<1||price>1_000_000_000)throw Error('Invalid source price');
  const name=text(row.name);if(!name||name.length>500||!row.images?.length)throw Error('Missing source name or photos');
  sourceUrl(row.permalink);
  const key=JSON.stringify([name.toLowerCase(),price]);const group=groups.get(key)||[];group.push(row);groups.set(key,group);
 }
 return [...groups.values()].map(rows=>{
  rows.sort((a,b)=>a.id-b.id);const row=rows[0];if(rows.length>1&&!/^fish in a box \(maxi\)$/i.test(text(row.name)))throw Error('Unapproved duplicate consolidation');
  return{id:'eedgefoods-'+row.id,slug:'eedgefoods-'+row.slug,name:text(row.name),price_kobo:Number(row.prices.price),description:(text(row.short_description)||text(row.description)||text(row.name)).slice(0,500),source_rows:rows,source_images:[...new Set(rows.flatMap(r=>r.images.map(i=>i.src)))]};
 }).sort((a,b)=>a.id.localeCompare(b.id));
}
async function main(){
 require('@next/env').loadEnvConfig(process.cwd());
 const argument=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
 const directory=argument('directory')||'.data/eedgefoods-20261112';
 const source=JSON.parse(fs.readFileSync(directory+'/source-products-page-1.json','utf8')),rows=normalize(source),assets=JSON.parse(fs.readFileSync(directory+'/assets.json','utf8'));
 const stock=Number(argument('opening-stock')),expected=Number(argument('expect'));
 if(!Number.isSafeInteger(stock)||stock<0||stock>100000||rows.length!==expected||source.length!==12)throw Error('Explicit reviewed opening stock and complete product count required');
 const photo=url=>{const asset=assets.find(r=>r.url===url);if(!asset)throw Error('Source image has not been verified');return asset.image;};
 for(const row of rows){
  const supplied=assets.find(a=>a.key===(/^fish in a box \(maxi\)$/i.test(row.name)?'owner-fish':/^soup in a box \(maxi\)$/i.test(row.name)?'owner-soup':''));
  row.image=supplied?.image||photo(row.source_images[0]);row.images=[...new Set([row.image,...row.source_images.map(photo)])];if(row.images.length>10)throw Error('Too many gallery photos');
 }
 console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'plan',source_listings:source.length,unique_products:rows.length,opening_stock_per_product:stock,total_opening_stock:rows.length*stock,duplicates_combined:source.length-rows.length}));
 if(!process.argv.includes('--apply'))return;
 if(!argument('admin-email'))throw Error('Confirmed owner email is required');
 const {Client}=require('pg');const db=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:12000,ssl:{rejectUnauthorized:true,ca:fs.readFileSync(process.env.DATABASE_CA_PATH,'utf8')}});
 const category='legacy-category-3',personal='fmcg-personal-care-and-hygiene',hidden='fmcg-food-and-beverages';
 const reviewed=JSON.parse(fs.readFileSync(directory+'/database-before.json','utf8')).products.filter(p=>p.category_id===category);
 const snapshots=async()=>{const out={};for(const table of ['orders','order_items','payments','refunds','stock_reservations','field_stores','field_visits','business_van_stock','business_product_principals','profiles','business_access'])out[table]=(await db.query(`select count(*)::int count,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) hash from ${table} t`)).rows[0];return out;};
 try{
  await db.connect();await db.query('begin isolation level repeatable read');await db.query("select pg_advisory_xact_lock(hashtext('eedgefoods-catalogue-import'))");
  const owner=(await db.query("select p.id from profiles p join auth.users u on u.id=p.id where p.role='admin' and lower(u.email)=lower($1) and u.email_confirmed_at is not null",[argument('admin-email')])).rows[0];if(!owner)throw Error('Confirmed owner administrator required');
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[owner.id]);
  if(!(await db.query("select id from merchants where id='edge' and status='approved'")).rowCount)throw Error('Approved flagship merchant required');
  const beforeProducts=(await db.query('select * from products order by id')).rows,protectedBefore=await snapshots(),beforeCategories=(await db.query('select * from categories order by id for update')).rows;
  for(const id of [category,personal,hidden])if(!beforeCategories.some(c=>c.id===id&&!c.archived_at))throw Error('Reviewed category unavailable');
  const brand=(await db.query("select id,name from brands where lower(name)=lower('E.edge Foods')")).rows[0];if(!brand)await db.query("insert into brands(id,name) values('eedgefoods','E.edge Foods')");
  const inserted=[];
  for(const row of rows){
   const ids=row.source_rows.map(r=>String(r.id));
   const existing=(await db.query("select * from catalogue_external_sources where source_host='eedgefoods.com' and source_product_id=any($1::text[]) for update",[ids])).rows;
   if(existing.length){if(existing.length!==ids.length||existing.some(e=>e.product_id!==row.id||e.source_checksum!==digest(row.source_rows.find(r=>String(r.id)===e.source_product_id))))throw Error('Source mappings changed; review required');continue;}
   if((await db.query('select id from products where id=$1 or slug=$2',[row.id,row.slug])).rowCount)throw Error('Untracked destination product already exists');
   await db.query("insert into products(id,slug,name,category_id,brand,merchant_id,merchant_name,price_kobo,stock,reserved,image,images,description,options,featured,active) values($1,$2,$3,$4,'E.edge Foods','edge','E-Edge Direct 2U',$5,0,0,$6,$7::jsonb,$8,'{}',false,true)",[row.id,row.slug,row.name,category,row.price_kobo,row.image,JSON.stringify(row.images),row.description]);
   if(stock)await db.query('select adjust_stock($1,$2,$3)',[row.id,stock,'Opening stock confirmed by owner; Eedgefoods catalogue import']);
   for(const original of row.source_rows)await db.query("insert into catalogue_external_sources(source_host,source_product_id,product_id,source_url,source_checksum,source_data) values('eedgefoods.com',$1,$2,$3,$4,$5::jsonb)",[String(original.id),row.id,sourceUrl(original.permalink),digest(original),JSON.stringify(original)]);
   inserted.push(row.id);
  }
  const moved=[];
  for(const original of reviewed){const current=beforeProducts.find(p=>p.id===original.id);if(!current||current.name!==original.name)throw Error('Reviewed legacy product changed');if(current.category_id===personal)continue;if(current.category_id!==category)throw Error('Legacy product category changed');await db.query('update products set category_id=$1 where id=$2',[personal,current.id]);moved.push(current.id);}
  const fish=assets.find(a=>a.key==='owner-fish');await db.query('update categories set image=$1 where id=$2',[fish.image,category]);await db.query('update categories set storefront_hidden=true where id=$1',[hidden]);
  const settings=(await db.query("select id,config from website_settings where id in ('draft','published') for update")).rows;
  for(const setting of settings){let changed=false;const navigation=(setting.config.navigation||[]).map(link=>{if(link.href==='/categories/'+hidden){changed=true;return{...link,label:'Food & Nutrition',href:'/categories/'+category};}return link;});if(changed)await db.query("update website_settings set config=jsonb_set(config,'{navigation}',$1::jsonb) where id=$2",[JSON.stringify(navigation),setting.id]);}
  const afterProducts=(await db.query('select * from products order by id')).rows;
  for(const id of inserted){const row=rows.find(r=>r.id===id),current=afterProducts.find(p=>p.id===id);if(!current||current.stock!==stock||current.reserved!==0||Number(current.price_kobo)!==row.price_kobo||current.category_id!==category||!current.active)throw Error('New product stock or price mismatch');const ledger=(await db.query('select quantity from stock_movements where product_id=$1',[id])).rows;if(stock&&(ledger.length!==1||ledger[0].quantity!==stock)||!stock&&ledger.length)throw Error('Opening stock ledger mismatch');}
  for(const prior of beforeProducts){const current=afterProducts.find(p=>p.id===prior.id);if(!current||JSON.stringify({...current,category_id:prior.category_id})!==JSON.stringify(prior)||current.category_id!==(moved.includes(prior.id)?personal:prior.category_id))throw Error('Unexpected change to an existing product');}
  if(afterProducts.length!==beforeProducts.length+inserted.length)throw Error('Unexpected product count');
  const protectedAfter=await snapshots();if(JSON.stringify(protectedBefore)!==JSON.stringify(protectedAfter))throw Error('Protected business data changed');
  const afterCategories=(await db.query('select * from categories order by id')).rows;
  for(const old of beforeCategories){const row=afterCategories.find(c=>c.id===old.id),expectedImage=old.id===category?fish.image:old.image,expectedHidden=old.id===hidden?true:old.storefront_hidden;if(!row||JSON.stringify({...row,image:old.image,storefront_hidden:old.storefront_hidden})!==JSON.stringify(old)||row.image!==expectedImage||row.storefront_hidden!==expectedHidden)throw Error('Unexpected category change');}
  await db.query('select audit($1,$2::jsonb)',['catalogue.eedgefoods.import',JSON.stringify({source_host:'eedgefoods.com',source_listings:source.length,inserted,moved_to_personal_care:moved,opening_stock_per_product:stock,hidden_category:hidden,photo:fish.image})]);
  const receipt={completed_at:new Date().toISOString(),source_listings:source.length,unique_products:rows.length,inserted,moved_to_personal_care:moved,opening_stock_per_product:stock,opening_stock_added:inserted.length*stock,protected_before:protectedBefore,protected_after:protectedAfter,before_categories:beforeCategories,after_categories:afterCategories,settings_before:settings,source_mapping:rows.map(r=>({id:r.id,name:r.name,price_kobo:r.price_kobo,source_urls:r.source_rows.map(p=>p.permalink)}))};
  fs.writeFileSync(directory+(fs.existsSync(directory+'/import-receipt.json')?'/import-receipt-last.json':'/import-receipt.json'),JSON.stringify(receipt,null,2));await db.query('commit');console.log(JSON.stringify({committed:true,created:inserted.length,moved:moved.length,stock_added:inserted.length*stock,source_listings:source.length,source_mappings:source.length,hidden_category:hidden,protected_business_data_unchanged:true}));
 }catch(e){await db.query('rollback').catch(()=>{});throw e;}finally{await db.end();}
}
module.exports={normalize,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
