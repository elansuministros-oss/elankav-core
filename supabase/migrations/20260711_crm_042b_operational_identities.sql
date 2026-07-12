-- CRM-042B — Proveedores globales y clientes por plataforma

create table if not exists public.crm_supplier_profiles (
  identity_id uuid primary key references public.crm_identities(id) on delete cascade,
  supplier_type text not null check (supplier_type in ('materials','services','mixed')),
  categories text[] not null default '{}',
  contact_name text,
  phone text,
  email text,
  country text,
  city text,
  commercial_terms text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_client_relationships (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.crm_identities(id) on delete cascade,
  platform text not null,
  responsible_commercial_id uuid not null references public.crm_identities(id) on delete restrict,
  status text not null default 'active',
  source text not null default 'manual',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(identity_id, platform)
);

create table if not exists public.crm_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  platform text,
  actor_type text not null,
  actor_identity_id uuid references public.crm_identities(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_supplier_profiles_type
  on public.crm_supplier_profiles(supplier_type, status);

create index if not exists idx_crm_supplier_profiles_phone
  on public.crm_supplier_profiles(phone);

create index if not exists idx_crm_supplier_profiles_email
  on public.crm_supplier_profiles(email);

create index if not exists idx_crm_client_relationships_platform
  on public.crm_client_relationships(platform, status);

create index if not exists idx_crm_client_relationships_responsible
  on public.crm_client_relationships(responsible_commercial_id, platform, status);

create index if not exists idx_crm_audit_events_entity
  on public.crm_audit_events(entity_type, entity_id, created_at desc);

alter table public.crm_supplier_profiles enable row level security;
alter table public.crm_client_relationships enable row level security;
alter table public.crm_audit_events enable row level security;

revoke all on table public.crm_supplier_profiles from anon, authenticated;
revoke all on table public.crm_client_relationships from anon, authenticated;
revoke all on table public.crm_audit_events from anon, authenticated;

grant all on table public.crm_supplier_profiles to service_role;
grant all on table public.crm_client_relationships to service_role;
grant all on table public.crm_audit_events to service_role;
