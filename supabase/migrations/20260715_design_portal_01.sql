begin;

create table if not exists public.design_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique,
  source text not null default 'web',
  external_user_id text,
  conversation_ref text,
  customer_name text not null,
  business_name text not null,
  whatsapp text not null,
  request_type text not null
    check (request_type in ('rotulo', 'fachada', 'logo', 'otro')),
  installation_environment text
    check (installation_environment is null or installation_environment in ('interior', 'exterior')),
  width_cm numeric,
  height_cm numeric,
  has_logo boolean not null default false,
  needs_logo_design boolean not null default false,
  design_notes text not null default '',
  files jsonb not null default '[]'::jsonb,
  status text not null default 'received'
    check (status in ('received', 'ai_pending', 'designing', 'review', 'approved', 'quoted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_requests_files_array
    check (jsonb_typeof(files) = 'array')
);

create index if not exists design_requests_whatsapp_idx
  on public.design_requests (whatsapp, created_at desc);

create index if not exists design_requests_status_idx
  on public.design_requests (status, created_at desc);

alter table public.design_requests enable row level security;
revoke all on table public.design_requests from anon, authenticated;
grant all on table public.design_requests to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'design-request-assets',
  'design-request-assets',
  false,
  8388608,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.design_gallery_items (
  id uuid primary key default gen_random_uuid(),
  design_request_id uuid references public.design_requests(id) on delete set null,
  title text not null,
  category text not null default 'Otros',
  description text not null default '',
  image_url text not null,
  thumbnail_url text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  sort_order integer not null default 100,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_gallery_public_idx
  on public.design_gallery_items (status, sort_order, published_at desc);

alter table public.design_gallery_items enable row level security;
revoke all on table public.design_gallery_items from anon, authenticated;
grant select on table public.design_gallery_items to anon, authenticated;
grant all on table public.design_gallery_items to service_role;

drop policy if exists design_gallery_public_read
  on public.design_gallery_items;

create policy design_gallery_public_read
  on public.design_gallery_items
  for select
  to anon, authenticated
  using (status = 'published');

commit;
