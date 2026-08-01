create extension if not exists pgcrypto;

create table if not exists public.activity_clubs (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Community',
  description text not null default '',
  location text not null,
  address text not null default '',
  image_url text,
  price numeric(10,2) not null default 0 check (price >= 0),
  status text not null default 'open' check (status in ('draft','open','full','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  title text not null default 'Club session',
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer not null check (capacity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','left','blocked')),
  joined_at timestamptz not null default now(),
  unique (club_id,user_id)
);

create table if not exists public.activity_session_rsvps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.activity_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going','cancelled')),
  created_at timestamptz not null default now(),
  unique (session_id,user_id)
);

create table if not exists public.activity_announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.activity_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists activity_clubs_manager_idx on public.activity_clubs(manager_id);
create index if not exists activity_sessions_club_start_idx on public.activity_sessions(club_id,starts_at);
create index if not exists activity_memberships_club_idx on public.activity_memberships(club_id,status);
create index if not exists activity_memberships_user_idx on public.activity_memberships(user_id,status);
create index if not exists activity_rsvps_session_idx on public.activity_session_rsvps(session_id,status);
create index if not exists activity_messages_club_created_idx on public.activity_messages(club_id,created_at);

create or replace view public.activity_club_stats as
select
  c.id as club_id,
  count(m.id) filter (where m.status = 'active')::integer as member_count
from public.activity_clubs c
left join public.activity_memberships m on m.club_id = c.id
group by c.id;

create or replace view public.activity_session_stats as
select
  s.id as session_id,
  count(r.id) filter (where r.status = 'going')::integer as booking_count,
  greatest(s.capacity - count(r.id) filter (where r.status = 'going'),0)::integer as spaces_remaining
from public.activity_sessions s
left join public.activity_session_rsvps r on r.session_id = s.id
group by s.id,s.capacity;

grant select on public.activity_club_stats to anon, authenticated;
grant select on public.activity_session_stats to anon, authenticated;

alter table public.activity_clubs enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.activity_memberships enable row level security;
alter table public.activity_session_rsvps enable row level security;
alter table public.activity_announcements enable row level security;
alter table public.activity_messages enable row level security;

create policy "Public can view published activity clubs"
on public.activity_clubs for select
using (status <> 'draft' or manager_id = auth.uid());

create policy "Managers can create their own activity clubs"
on public.activity_clubs for insert to authenticated
with check (manager_id = auth.uid());

create policy "Managers can update their own activity clubs"
on public.activity_clubs for update to authenticated
using (manager_id = auth.uid())
with check (manager_id = auth.uid());

create policy "Managers can delete their own activity clubs"
on public.activity_clubs for delete to authenticated
using (manager_id = auth.uid());

create policy "Public can view activity sessions"
on public.activity_sessions for select
using (true);

create policy "Club managers can create sessions"
on public.activity_sessions for insert to authenticated
with check (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

create policy "Club managers can update sessions"
on public.activity_sessions for update to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

create policy "Club managers can delete sessions"
on public.activity_sessions for delete to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

create policy "Members and club managers can view memberships"
on public.activity_memberships for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

create policy "Users can join activity clubs"
on public.activity_memberships for insert to authenticated
with check (user_id = auth.uid());

create policy "Users can update their membership"
on public.activity_memberships for update to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

create policy "Users can leave activity clubs"
on public.activity_memberships for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

create policy "Users can view their RSVPs and managers can view club RSVPs"
on public.activity_session_rsvps for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.activity_sessions s
    join public.activity_clubs c on c.id = s.club_id
    where s.id = session_id and c.manager_id = auth.uid()
  )
);

create policy "Users can RSVP themselves"
on public.activity_session_rsvps for insert to authenticated
with check (user_id = auth.uid());

create policy "Users can update their own RSVP"
on public.activity_session_rsvps for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own RSVP"
on public.activity_session_rsvps for delete to authenticated
using (user_id = auth.uid());

create policy "Public can view activity announcements"
on public.activity_announcements for select
using (true);

create policy "Club managers can post announcements"
on public.activity_announcements for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.activity_clubs c
    where c.id = club_id and c.manager_id = auth.uid()
  )
);

create policy "Club managers can manage announcements"
on public.activity_announcements for delete to authenticated
using (exists (
  select 1 from public.activity_clubs c
  where c.id = club_id and c.manager_id = auth.uid()
));

create policy "Members can view club messages"
on public.activity_messages for select to authenticated
using (
  exists (
    select 1 from public.activity_memberships m
    where m.club_id = activity_messages.club_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
  or exists (
    select 1 from public.activity_clubs c
    where c.id = activity_messages.club_id and c.manager_id = auth.uid()
  )
);

create policy "Members can post club messages"
on public.activity_messages for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    exists (
      select 1 from public.activity_memberships m
      where m.club_id = activity_messages.club_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
    or exists (
      select 1 from public.activity_clubs c
      where c.id = activity_messages.club_id and c.manager_id = auth.uid()
    )
  )
);

create policy "Authors and club managers can delete messages"
on public.activity_messages for delete to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.activity_clubs c
    where c.id = activity_messages.club_id and c.manager_id = auth.uid()
  )
);
