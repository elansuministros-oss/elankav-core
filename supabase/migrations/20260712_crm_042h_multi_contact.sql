-- CRM-042H — Contactos múltiples para identidades CRM

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references public.crm_identities(id) on delete cascade,
  contact_name text,
  role_or_area text,
  whatsapp text not null,
  phone text,
  email text,
  country text,
  city text,
  address text,
  notes text,
  is_primary boolean not null default false,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_contacts_whatsapp_required check (length(regexp_replace(whatsapp, '\D', '', 'g')) >= 8)
);

create unique index if not exists uq_crm_contacts_identity_whatsapp
  on public.crm_contacts(identity_id, regexp_replace(whatsapp, '\D', '', 'g'))
  where status = 'active';

create index if not exists idx_crm_contacts_identity
  on public.crm_contacts(identity_id, status, is_primary desc, created_at);

create index if not exists idx_crm_contacts_whatsapp
  on public.crm_contacts(regexp_replace(whatsapp, '\D', '', 'g'));

alter table public.crm_contacts enable row level security;
revoke all on table public.crm_contacts from anon, authenticated;
grant all on table public.crm_contacts to service_role;
