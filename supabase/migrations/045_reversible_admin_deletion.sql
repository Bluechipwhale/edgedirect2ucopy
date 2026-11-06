-- Reversible directory deletion. Never deletes Auth identities, orders or ledgers.
create table public.admin_record_trash(
 kind text not null,id text not null,label text not null,previous jsonb not null,
 deleted_at timestamptz not null default now(),deleted_by uuid not null references profiles(id),
 primary key(kind,id),check(kind in ('brands','categories','legacy_customers','customers','outlets','banners','coupons','notifications','gallery','pages'))
);
alter table public.admin_record_trash enable row level security;
revoke all on public.admin_record_trash from public,anon,authenticated;
alter table public.categories add column archived_at timestamptz;
alter table public.brands add column archived_at timestamptz;
alter table public.legacy_customers add column archived_at timestamptz;

create function public.admin_deleted_records(p_kind text default '') returns jsonb
language plpgsql stable security definer set search_path=public as $$begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'name',label,'archived_at',deleted_at) order by deleted_at desc,kind,id) from admin_record_trash where p_kind='' or kind=p_kind),'[]'::jsonb);
end $$;

create function public.admin_set_record_deleted(p_kind text,p_id text,p_deleted boolean) returns void
language plpgsql security definer set search_path=public as $$
declare entry admin_record_trash;label text;previous jsonb;row_data jsonb;company uuid;store_row record;begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_kind is null or p_kind not in ('brands','categories','legacy_customers','customers','outlets','banners','coupons','notifications','gallery','pages') or p_id is null or length(p_id) not between 1 and 100 or p_deleted is null then raise exception 'Unsupported deletion';end if;
 -- Shared locks serialize catalogue references, repeat clicks and overlapping outlet archives.
 perform pg_advisory_xact_lock(hashtext('edge-admin-directory-delete'));
 select * into entry from admin_record_trash where kind=p_kind and id=p_id for update;
 if p_deleted and found then return;end if;
 if not p_deleted and not found then raise exception 'Record is not deleted';end if;
 if not p_deleted then
  previous:=entry.previous;
  delete from admin_record_trash where kind=p_kind and id=p_id;
  case p_kind
   when 'brands' then update brands set archived_at=null,active=(previous->>'active')::boolean where id=p_id;
   when 'categories' then
    if exists(select 1 from categories c join categories parent on parent.id=c.parent_id where c.id=p_id and parent.archived_at is not null) then raise exception 'Restore the parent category first';end if;
    update categories set archived_at=null where id=p_id;
   when 'legacy_customers' then
    update legacy_customers set archived_at=null where source_id=p_id;
    for store_row in select * from jsonb_to_recordset(previous->'stores') as x(company_id uuid,id uuid,active boolean) loop
     update field_stores set active=store_row.active where company_id=store_row.company_id and id=store_row.id;
    end loop;
   when 'outlets' then update field_stores set active=(previous->>'active')::boolean where company_id=(previous->>'company')::uuid and id=p_id::uuid;
   when 'coupons' then update coupons set active=(previous->>'active')::boolean where id=p_id;
   when 'gallery' then update gallery_media set active=(previous->>'active')::boolean where id=p_id;
   when 'pages' then update content_pages set active=(previous->>'active')::boolean where id=p_id;
   when 'banners','notifications' then update website_content set data=jsonb_set(data,'{enabled}',previous->'enabled') where id=p_id and kind=p_kind;
   else null;
  end case;
  perform audit('admin.record.restored',jsonb_build_object('kind',p_kind,'id',p_id));return;
 end if;
 case p_kind
  when 'brands' then
   select name,jsonb_build_object('active',active) into label,previous from brands where id=p_id for update;
   if label is null then raise exception 'Brand not found';end if;
   update brands set active=false,archived_at=now() where id=p_id;
  when 'categories' then
   select name into label from categories where id=p_id for update;
   if label is null then raise exception 'Category not found';end if;
   if exists(select 1 from products where category_id=p_id) or exists(select 1 from categories where parent_id=p_id and archived_at is null) then raise exception 'Category still has products or child categories. Move them to another category before deleting.';end if;
   previous:='{}';update categories set archived_at=now() where id=p_id;
  when 'legacy_customers' then
   select trim(first_name||' '||last_name) into label from legacy_customers where source_id=p_id for update;
   if label is null then raise exception 'Customer not found';end if;
   perform 1 from field_stores where legacy_customer_id=p_id for update;
   if exists(select 1 from field_stores s join field_assignments a on a.company_id=s.company_id and a.store_id=s.id join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id where s.legacy_customer_id=p_id and v.completed_at is null) then raise exception 'Finish the customer visit before deleting';end if;
   if exists(select 1 from field_stores s join admin_record_trash t on t.kind='outlets' and t.id=s.id::text where s.legacy_customer_id=p_id) then raise exception 'Restore the separately deleted outlet first';end if;
   select jsonb_build_object('stores',coalesce(jsonb_agg(jsonb_build_object('company_id',company_id,'id',id,'active',active)),'[]'::jsonb)) into previous from field_stores where legacy_customer_id=p_id;
   update legacy_customers set archived_at=now() where source_id=p_id;update field_stores set active=false where legacy_customer_id=p_id;
  when 'outlets' then
   select c.id into company from platform_companies c where c.slug='e-edge-direct-2u';
   select s.name,jsonb_build_object('active',s.active,'company',s.company_id) into label,previous from field_stores s where s.company_id=company and s.id=p_id::uuid for update;
   if label is null then raise exception 'Outlet not found';end if;
   if exists(select 1 from field_stores s join legacy_customers c on c.source_id=s.legacy_customer_id where s.company_id=company and s.id=p_id::uuid and c.archived_at is not null) then raise exception 'Restore the customer contact first';end if;
   if exists(select 1 from field_assignments a join field_visits v on v.company_id=a.company_id and v.assignment_id=a.id where a.company_id=company and a.store_id=p_id::uuid and v.completed_at is null) then raise exception 'Finish the outlet visit before deleting';end if;
   update field_stores set active=false where company_id=company and id=p_id::uuid;
  when 'customers' then
   select name into label from profiles where id=p_id::uuid and role='customer' for update;
   if label is null then raise exception 'Customer account not found';end if;previous:='{}';
  when 'coupons' then
   select code,jsonb_build_object('active',active) into label,previous from coupons where id=p_id for update;
   if label is null then raise exception 'Coupon not found';end if;update coupons set active=false where id=p_id;
  when 'gallery' then
   select title,jsonb_build_object('active',active) into label,previous from gallery_media where id=p_id for update;
   if label is null then raise exception 'Photo not found';end if;update gallery_media set active=false where id=p_id;
  when 'pages' then
   select title,jsonb_build_object('active',active) into label,previous from content_pages where id=p_id for update;
   if label is null then raise exception 'Page not found';end if;update content_pages set active=false where id=p_id;
  when 'banners','notifications' then
   select data into row_data from website_content where id=p_id and kind=p_kind for update;
   if row_data is null then raise exception 'Record not found';end if;
   label:=coalesce(row_data->>'title',p_id);previous:=jsonb_build_object('enabled',coalesce(row_data->'enabled','false'::jsonb));
   update website_content set data=jsonb_set(data,'{enabled}','false') where id=p_id and kind=p_kind;
 end case;
 insert into admin_record_trash(kind,id,label,previous,deleted_by) values(p_kind,p_id,label,previous,auth.uid());
 perform audit('admin.record.deleted',jsonb_build_object('kind',p_kind,'id',p_id));
end $$;

-- Archived catalogue entries cannot be reused by a concurrent save or bulk import.
create function public.guard_deleted_directory() returns trigger language plpgsql security definer set search_path=public as $$begin
 if tg_table_name='products' then
  if tg_op='UPDATE' and new.category_id is not distinct from old.category_id and new.brand is not distinct from old.brand then return new;end if;
  perform 1 from categories where id=new.category_id for share;
  if exists(select 1 from categories where id=new.category_id and archived_at is not null) and (tg_op='INSERT' or new.category_id is distinct from old.category_id) then raise exception 'Restore the category before assigning products';end if;
  perform 1 from brands where name=new.brand for share;
  if exists(select 1 from brands where name=new.brand and archived_at is not null) and (tg_op='INSERT' or new.brand is distinct from old.brand) then raise exception 'Restore the brand before assigning products';end if;
 elsif tg_table_name='categories' then
  perform 1 from categories where id=new.parent_id for share;
  if new.parent_id is not null and exists(select 1 from categories where id=new.parent_id and archived_at is not null) then raise exception 'Restore the parent category first';end if;
  if tg_op='UPDATE' and old.archived_at is not null and new.archived_at is not null and new is distinct from old then raise exception 'Restore this category before editing';end if;
 elsif tg_table_name='brands' then
  if new.archived_at is not null and new.active then raise exception 'Restore this brand before publishing';end if;
  if tg_op='UPDATE' and old.archived_at is not null and new.archived_at is not null and new is distinct from old then raise exception 'Restore this brand before editing';end if;
 elsif tg_table_name in ('gallery_media','content_pages','coupons') then
  if exists(select 1 from admin_record_trash where kind=case tg_table_name when 'gallery_media' then 'gallery' when 'content_pages' then 'pages' else 'coupons' end and id=new.id) then raise exception 'Restore this record before editing';end if;
 elsif tg_table_name='website_content' then
  if exists(select 1 from admin_record_trash where kind=new.kind and id=new.id) then raise exception 'Restore this record before editing';end if;
 end if;return new;
end $$;
do $$declare t text;begin foreach t in array array['products','categories','brands','gallery_media','content_pages','coupons','website_content'] loop
 execute format('create trigger guard_directory_trash before insert or update on %I for each row execute function guard_deleted_directory()',t);
end loop;end $$;
revoke all on function guard_deleted_directory() from public,anon,authenticated;
revoke all on function admin_deleted_records(text),admin_set_record_deleted(text,text,boolean) from public,anon;
grant execute on function admin_deleted_records(text),admin_set_record_deleted(text,text,boolean) to authenticated;

create function public.admin_customer_directory(p_query text default '',p_page integer default 1,p_deleted boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare q text:=left(trim(coalesce(p_query,'')),120);n integer;items jsonb;stats jsonb;begin
 if auth.uid() is null or app_role()<>'admin' then raise exception 'Forbidden';end if;
 if p_page is null or p_page<1 or p_page>100000 or p_deleted is null then raise exception 'Invalid page';end if;
 stats:=admin_legacy_customers('',1);
 select count(*) into n from legacy_customers c where (c.archived_at is not null)=p_deleted and (q='' or strpos(lower(c.source_id||' '||c.first_name||' '||c.last_name||' '||coalesce(c.email,'')||' '||c.phone),lower(q))>0);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.source_id),'[]'::jsonb) into items from (
 select c.source_id,c.first_name,c.last_name,c.email,c.phone,c.address,c.route,c.legacy_order_count,c.blocked,c.details,c.linked_user_id,c.imported_at,c.archived_at from legacy_customers c
 where (c.archived_at is not null)=p_deleted and (q='' or strpos(lower(c.source_id||' '||c.first_name||' '||c.last_name||' '||coalesce(c.email,'')||' '||c.phone),lower(q))>0)
 order by c.source_id limit 50 offset (p_page-1)*50) x;
 return stats||jsonb_build_object('count',n,'rows',items);
end $$;
revoke all on function admin_customer_directory(text,integer,boolean) from public,anon;
grant execute on function admin_customer_directory(text,integer,boolean) to authenticated;
