begin;

alter table public.design_requests
  add column if not exists access_token_hash text,
  add column if not exists result_files jsonb not null default '[]'::jsonb,
  add column if not exists design_result jsonb,
  add column if not exists processing_attempts integer not null default 0,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists delivery_started_at timestamptz,
  add column if not exists delivery_error_code text,
  add column if not exists delivered_at timestamptz;

alter table public.design_requests
  drop constraint if exists design_requests_status_check;

alter table public.design_requests
  add constraint design_requests_status_check
  check (status in (
    'received',
    'ai_pending',
    'designing',
    'review',
    'approved',
    'quoted',
    'closed',
    'failed'
  ));

alter table public.design_requests
  drop constraint if exists design_requests_result_files_array;

alter table public.design_requests
  add constraint design_requests_result_files_array
  check (jsonb_typeof(result_files) = 'array');

alter table public.design_requests
  drop constraint if exists design_requests_delivery_status_check;

alter table public.design_requests
  add constraint design_requests_delivery_status_check
  check (delivery_status in ('pending', 'sending', 'delivered', 'failed'));

create index if not exists design_requests_ai_queue_idx
  on public.design_requests (status, created_at asc)
  where status = 'ai_pending';

create index if not exists design_requests_access_token_idx
  on public.design_requests (request_code, access_token_hash)
  where access_token_hash is not null;

create index if not exists design_requests_delivery_idx
  on public.design_requests (delivery_status, completed_at asc)
  where status in ('review', 'approved', 'quoted', 'closed')
    and delivered_at is null;

commit;
