begin;

alter table public.design_requests
  add column if not exists workflow_stage text not null default 'concept',
  add column if not exists revision_number integer not null default 1,
  add column if not exists version_history jsonb not null default '[]'::jsonb;

alter table public.design_requests
  drop constraint if exists design_requests_workflow_stage_check;

alter table public.design_requests
  add constraint design_requests_workflow_stage_check
  check (workflow_stage in ('concept', 'revision', 'render'));

alter table public.design_requests
  drop constraint if exists design_requests_version_history_array;

alter table public.design_requests
  add constraint design_requests_version_history_array
  check (jsonb_typeof(version_history) = 'array');

create index if not exists design_requests_followup_idx
  on public.design_requests (request_code, workflow_stage, revision_number);

commit;
