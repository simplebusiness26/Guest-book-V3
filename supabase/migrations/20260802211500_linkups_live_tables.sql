create table if not exists public.linkups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  category text not null check (char_length(btrim(category)) between 2 and 40),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  area text not null check (char_length(btrim(area)) between 2 and 80),
  location_name text not null check (char_length(btrim(location_name)) between 2 and 120),
  latitude double precision,
  longitude double precision,
  max_attendees integer not null check (max_attendees between 2 and 50),
  attendee_count integer not null default 1 check (attendee_count between 1 and 50),
  visibility text not null default 'public' check (visibility in ('public','followers')),
  status text not null default 'upcoming' check (status in ('upcoming','full','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  check (attendee_count <= max_attendees)
);

create table if not exists public.linkup_private_details (
  linkup_id uuid primary key references public.linkups(id) on delete cascade,
  meeting_point_details text not null default '' check (char_length(meeting_point_details) <= 500),
  updated_at timestamptz not null default now()
);

create table if not exists public.linkup_attendees (
  id uuid primary key default gen_random_uuid(),
  linkup_id uuid not null references public.linkups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('creator','member')),
  status text not null default 'joined' check (status in ('joined','left','removed')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(linkup_id,user_id)
);

create table if not exists public.linkup_messages (
  id uuid primary key default gen_random_uuid(),
  linkup_id uuid not null references public.linkups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  is_announcement boolean not null default false,
  status text not null default 'active' check (status in ('active','deleted')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.live_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_type text not null check (place_type in ('park','public_place','business','activity_club','event')),
  target_id uuid,
  place_name text not null check (char_length(btrim(place_name)) between 2 and 120),
  area text not null check (char_length(btrim(area)) between 2 and 80),
  latitude double precision,
  longitude double precision,
  activity text not null check (char_length(btrim(activity)) between 2 and 80),
  message text not null default '' check (char_length(message) <= 240),
  visibility text not null default 'public' check (visibility in ('public','followers')),
  status text not null default 'active' check (status in ('active','ended','expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (blocker_id <> blocked_id),
  unique(blocker_id,blocked_id)
);

create table if not exists public.live_safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('linkup','linkup_message','checkin','user')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','harassment','unsafe','inappropriate','false_information','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique(reporter_id,target_type,target_id)
);

create unique index if not exists live_checkins_one_active_per_user on public.live_checkins(user_id) where status='active';
create index if not exists linkups_starts_at_idx on public.linkups(starts_at);
create index if not exists linkups_area_status_idx on public.linkups(lower(area),status,starts_at);
create index if not exists linkups_creator_idx on public.linkups(creator_id,starts_at);
create index if not exists linkup_attendees_linkup_status_idx on public.linkup_attendees(linkup_id,status);
create index if not exists linkup_attendees_user_status_idx on public.linkup_attendees(user_id,status);
create index if not exists linkup_messages_linkup_created_idx on public.linkup_messages(linkup_id,created_at);
create index if not exists live_checkins_area_expiry_idx on public.live_checkins(lower(area),status,expires_at);
create index if not exists user_blocks_blocked_idx on public.user_blocks(blocked_id,blocker_id);
create index if not exists live_safety_reports_status_idx on public.live_safety_reports(status,created_at);

create or replace function public.linkup_user_is_explorer(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id and p.account_type='explorer');
$$;

create or replace function public.linkup_users_blocked(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_blocks b where (b.blocker_id=p_a and b.blocked_id=p_b) or (b.blocker_id=p_b and b.blocked_id=p_a));
$$;

create or replace function public.is_active_linkup_member(p_linkup_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.user_id=p_user_id and a.status='joined');
$$;

create or replace function public.is_linkup_creator(p_linkup_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.linkups l where l.id=p_linkup_id and l.creator_id=p_user_id);
$$;

create or replace function public.can_view_linkup(p_linkup_id uuid,p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare v_linkup public.linkups%rowtype;
begin
  if p_user_id is null then return false; end if;
  select * into v_linkup from public.linkups where id=p_linkup_id;
  if not found then return false; end if;
  if public.linkup_users_blocked(v_linkup.creator_id,p_user_id) then return false; end if;
  if v_linkup.creator_id=p_user_id or public.is_active_linkup_member(p_linkup_id,p_user_id) then return true; end if;
  if v_linkup.status not in ('upcoming','full') or v_linkup.ends_at<=now() then return false; end if;
  if v_linkup.visibility='public' then return true; end if;
  return exists(select 1 from public.explorer_follows f where f.follower_id=p_user_id and f.following_id=v_linkup.creator_id);
end;
$$;

create or replace function public.touch_live_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end;
$$;

drop trigger if exists linkups_touch_updated_at on public.linkups;
create trigger linkups_touch_updated_at before update on public.linkups for each row execute function public.touch_live_updated_at();
drop trigger if exists linkup_private_touch_updated_at on public.linkup_private_details;
create trigger linkup_private_touch_updated_at before update on public.linkup_private_details for each row execute function public.touch_live_updated_at();
drop trigger if exists linkup_attendees_touch_updated_at on public.linkup_attendees;
create trigger linkup_attendees_touch_updated_at before update on public.linkup_attendees for each row execute function public.touch_live_updated_at();

alter table public.linkups enable row level security;
alter table public.linkup_private_details enable row level security;
alter table public.linkup_attendees enable row level security;
alter table public.linkup_messages enable row level security;
alter table public.live_checkins enable row level security;
alter table public.user_blocks enable row level security;
alter table public.live_safety_reports enable row level security;

drop policy if exists linkups_select_visible on public.linkups;
create policy linkups_select_visible on public.linkups for select to authenticated using(public.can_view_linkup(id,(select auth.uid())));
drop policy if exists linkup_private_select_members on public.linkup_private_details;
create policy linkup_private_select_members on public.linkup_private_details for select to authenticated using(public.is_active_linkup_member(linkup_id,(select auth.uid())) or public.is_linkup_creator(linkup_id,(select auth.uid())));
drop policy if exists linkup_attendees_select_visible on public.linkup_attendees;
create policy linkup_attendees_select_visible on public.linkup_attendees for select to authenticated using(public.can_view_linkup(linkup_id,(select auth.uid())));
drop policy if exists linkup_messages_select_members on public.linkup_messages;
create policy linkup_messages_select_members on public.linkup_messages for select to authenticated using(public.is_active_linkup_member(linkup_id,(select auth.uid())));
drop policy if exists live_checkins_select_visible on public.live_checkins;
create policy live_checkins_select_visible on public.live_checkins for select to authenticated using(
  user_id=(select auth.uid()) or (
    status='active' and expires_at>now() and not public.linkup_users_blocked(user_id,(select auth.uid()))
    and (visibility='public' or exists(select 1 from public.explorer_follows f where f.follower_id=(select auth.uid()) and f.following_id=user_id))
  )
);
drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks for select to authenticated using(blocker_id=(select auth.uid()));
drop policy if exists reports_select_own_or_admin on public.live_safety_reports;
create policy reports_select_own_or_admin on public.live_safety_reports for select to authenticated using(reporter_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin=true));

revoke all on public.linkups,public.linkup_private_details,public.linkup_attendees,public.linkup_messages,public.live_checkins,public.user_blocks,public.live_safety_reports from anon;
revoke insert,update,delete on public.linkups,public.linkup_private_details,public.linkup_attendees,public.linkup_messages,public.live_checkins,public.user_blocks,public.live_safety_reports from authenticated;
grant select on public.linkups,public.linkup_private_details,public.linkup_attendees,public.linkup_messages,public.live_checkins,public.user_blocks,public.live_safety_reports to authenticated;

revoke all on function public.linkup_user_is_explorer(uuid),public.linkup_users_blocked(uuid,uuid),public.is_active_linkup_member(uuid,uuid),public.is_linkup_creator(uuid,uuid),public.can_view_linkup(uuid,uuid) from public,anon;
grant execute on function public.linkup_user_is_explorer(uuid),public.linkup_users_blocked(uuid,uuid),public.is_active_linkup_member(uuid,uuid),public.is_linkup_creator(uuid,uuid),public.can_view_linkup(uuid,uuid) to authenticated;
