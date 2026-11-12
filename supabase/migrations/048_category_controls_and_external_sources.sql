-- Explicit category visibility and private external-catalogue provenance.
alter table public.categories add column storefront_hidden boolean not null default false;

create or replace function public.storefront_categories() returns setof public.categories
language sql stable security definer set search_path=public as $$
 with recursive hidden(id,depth) as (
  select c.id,1 from categories c where c.storefront_hidden or c.archived_at is not null or c.id='legacy-category-review' or lower(c.name) like 'imported products%category review%'
  union all select c.id,h.depth+1 from categories c join hidden h on c.parent_id=h.id where h.depth<3
 ), eligible as (
  select c.* from categories c where not exists(select 1 from hidden h where h.id=c.id)
 ), descendants(root,id,depth) as (
  select c.id,c.id,1 from eligible c
  union all select d.root,c.id,d.depth+1 from descendants d join eligible c on c.parent_id=d.id where d.depth<3
 )
 select c.* from eligible c where exists(
  select 1 from descendants d join products p on p.category_id=d.id join merchants m on m.id=p.merchant_id
  where d.root=c.id and p.active and p.archived_at is null and m.status='approved'
 ) order by c.sort_order,c.name,c.id
$$;

create table public.catalogue_external_sources(
 source_host text not null,source_product_id text not null,product_id text not null references public.products(id),
 source_url text not null,source_checksum text not null,source_data jsonb not null,imported_at timestamptz not null default now(),
 primary key(source_host,source_product_id)
);
alter table public.catalogue_external_sources enable row level security;
revoke all on public.catalogue_external_sources from public,anon,authenticated;
