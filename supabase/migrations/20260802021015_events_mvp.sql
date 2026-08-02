-- Secure Events MVP schema, capability gating and public discovery access.
create extension if not exists pgcrypto;

alter table public.manager_capabilities
  add column if not exists events_started_at timestamptz,
  add column if not exists events_ends_at timestamptz;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  category text not null default 'Community' check (char_length(trim(category)) between 1 and 60),
  description text not null default '' check (char_length(description) <= 3000),
  location text not null default '' check (char_length(location) <= 160),
  address text not null check (char_length(trim(address)) between 2 and 500),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  starts_at timestamptz not null,
  ends_at timestamptz,
  image_url text,
  price numeric(10,2) not null default 0 check (price >= 0),
  capacity integer check (capacity is null or capacity > 0),
  booking_url text not null default '',
  status text not null default 'published'
    check (status in ('draft','published','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create index if not exists events_public_start_idx
  on public.events(status,starts_at);

create index if not exists events_manager_start_idx
  on public.events(manager_id,starts_at desc);

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_events_updated_at();

revoke all on table public.events from anon,authenticated;
grant select on table public.events to anon,authenticated;
grant insert,update,delete on table public.events to authenticated;
grant all on table public.events to service_role;

alter table public.events enable row level security;

drop policy if exists "Published events are public and managers see their own" on public.events;
create policy "Published events are public and managers see their own"
on public.events for select
using (
  status = 'published'
  or manager_id = (select auth.uid())
);

drop policy if exists "Activated managers can create events" on public.events;
create policy "Activated managers can create events"
on public.events for insert to authenticated
with check (
  manager_id = (select auth.uid())
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_type = 'manager'
  )
  and exists (
    select 1
    from public.manager_capabilities mc
    where mc.user_id = (select auth.uid())
      and mc.events_status in ('trial','active')
      and (mc.events_ends_at is null or mc.events_ends_at > now())
  )
);

drop policy if exists "Activated managers can update their events" on public.events;
create policy "Activated managers can update their events"
on public.events for update to authenticated
using (
  manager_id = (select auth.uid())
  and exists (
    select 1
    from public.manager_capabilities mc
    where mc.user_id = (select auth.uid())
      and mc.events_status in ('trial','active')
      and (mc.events_ends_at is null or mc.events_ends_at > now())
  )
)
with check (
  manager_id = (select auth.uid())
  and exists (
    select 1
    from public.manager_capabilities mc
    where mc.user_id = (select auth.uid())
      and mc.events_status in ('trial','active')
      and (mc.events_ends_at is null or mc.events_ends_at > now())
  )
);

drop policy if exists "Managers can delete their events" on public.events;
create policy "Managers can delete their events"
on public.events for delete to authenticated
using (manager_id = (select auth.uid()));
