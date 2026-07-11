-- CRM-001A — ELANKAV CRM Core
-- Fuente oficial: Supabase

create extension if not exists pgcrypto;

create table if not exists crm_identities (
  id uuid primary key default gen_random_uuid(),
  canonical_id text not null unique,
  display_name text,
  entity_type text not null default 'unknown',
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_identity_aliases (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references crm_identities(id) on delete cascade,
  channel text not null,
  external_id text not null,
  alias_type text not null default 'channel_id',
  is_primary boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(channel, external_id)
);

create table if not exists crm_roles (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references crm_identities(id) on delete cascade,
  role text not null,
  platform text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(identity_id, role, platform)
);

create table if not exists crm_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_type text not null default 'company',
  tax_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists crm_identity_organizations (
  identity_id uuid not null references crm_identities(id) on delete cascade,
  organization_id uuid not null references crm_organizations(id) on delete cascade,
  relationship_type text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key(identity_id, organization_id, relationship_type)
);

create table if not exists crm_conversations (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references crm_identities(id) on delete restrict,
  channel text not null,
  platform text,
  external_conversation_id text not null,
  stage text not null default 'new',
  status text not null default 'open',
  assigned_to uuid references crm_identities(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(channel, external_conversation_id)
);

create table if not exists crm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references crm_conversations(id) on delete cascade,
  external_message_id text,
  direction text not null check (direction in ('inbound','outbound','system')),
  sender_identity_id uuid references crm_identities(id) on delete set null,
  body text not null,
  message_type text not null default 'text',
  status text not null default 'received',
  raw_payload jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(conversation_id, external_message_id)
);

create index if not exists idx_crm_alias_external on crm_identity_aliases(channel, external_id);
create index if not exists idx_crm_conversations_identity on crm_conversations(identity_id, status);
create index if not exists idx_crm_messages_conversation_created on crm_messages(conversation_id, created_at);
create index if not exists idx_crm_roles_identity on crm_roles(identity_id, active);
