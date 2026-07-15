create table if not exists public.elan_ai_conversaciones (
  id bigserial primary key,
  conversation_id text not null unique,
  whatsapp text not null,
  contexto jsonb not null default '[]'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists elan_ai_conversaciones_whatsapp_idx
  on public.elan_ai_conversaciones (whatsapp);
