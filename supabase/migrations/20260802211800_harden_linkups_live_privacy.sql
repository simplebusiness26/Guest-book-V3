create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;

create or replace function private.linkup_user_is_explorer(p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id and p.account_type='explorer');
$$;

create or replace function private.linkup_users_blocked(p_a uuid,p_b uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from public.user_blocks b where (b.blocker_id=p_a and b.blocked_id=p_b) or (b.blocker_id=p_b and b.blocked_id=p_a));
$$;

create or replace function private.is_active_linkup_member(p_linkup_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.user_id=p_user_id and a.status='joined');
$$;

create or replace function private.is_linkup_creator(p_linkup_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path=public,private as $$
  select exists(select 1 from public.linkups l where l.id=p_linkup_id and l.creator_id=p_user_id);
$$;

create or replace function private.can_view_linkup(p_linkup_id uuid,p_user_id uuid)
returns boolean language plpgsql stable security definer set search_path=public,private as $$
declare v_linkup public.linkups%rowtype;
begin
  if p_user_id is null then return false; end if;
  select * into v_linkup from public.linkups where id=p_linkup_id;
  if not found then return false; end if;
  if private.linkup_users_blocked(v_linkup.creator_id,p_user_id) then return false; end if;
  if v_linkup.creator_id=p_user_id or private.is_active_linkup_member(p_linkup_id,p_user_id) then return true; end if;
  if v_linkup.status not in ('upcoming','full') or v_linkup.ends_at<=now() then return false; end if;
  if v_linkup.visibility='public' then return true; end if;
  return exists(select 1 from public.explorer_follows f where f.follower_id=p_user_id and f.following_id=v_linkup.creator_id);
end;
$$;

grant execute on function private.linkup_user_is_explorer(uuid),private.linkup_users_blocked(uuid,uuid),private.is_active_linkup_member(uuid,uuid),private.is_linkup_creator(uuid,uuid),private.can_view_linkup(uuid,uuid) to authenticated;
revoke all on function public.linkup_user_is_explorer(uuid),public.linkup_users_blocked(uuid,uuid),public.is_active_linkup_member(uuid,uuid),public.is_linkup_creator(uuid,uuid),public.can_view_linkup(uuid,uuid) from public,anon,authenticated;

drop policy if exists linkups_select_visible on public.linkups;
create policy linkups_select_visible on public.linkups for select to authenticated using(private.can_view_linkup(id,(select auth.uid())));
drop policy if exists linkup_private_select_members on public.linkup_private_details;
create policy linkup_private_select_members on public.linkup_private_details for select to authenticated using(
  private.is_linkup_creator(linkup_id,(select auth.uid())) or (
    private.is_active_linkup_member(linkup_id,(select auth.uid()))
    and not private.linkup_users_blocked((select creator_id from public.linkups where id=linkup_id),(select auth.uid()))
  )
);
drop policy if exists linkup_attendees_select_visible on public.linkup_attendees;
create policy linkup_attendees_select_visible on public.linkup_attendees for select to authenticated using(
  private.can_view_linkup(linkup_id,(select auth.uid())) and not private.linkup_users_blocked(user_id,(select auth.uid()))
);
drop policy if exists linkup_messages_select_members on public.linkup_messages;
create policy linkup_messages_select_members on public.linkup_messages for select to authenticated using(
  private.is_active_linkup_member(linkup_id,(select auth.uid()))
  and not private.linkup_users_blocked(user_id,(select auth.uid()))
  and not private.linkup_users_blocked((select creator_id from public.linkups where id=linkup_id),(select auth.uid()))
);
drop policy if exists live_checkins_select_visible on public.live_checkins;
create policy live_checkins_select_visible on public.live_checkins for select to authenticated using(
  user_id=(select auth.uid()) or (
    status='active' and expires_at>now()
    and not private.linkup_users_blocked(user_id,(select auth.uid()))
    and (visibility='public' or exists(select 1 from public.explorer_follows f where f.follower_id=(select auth.uid()) and f.following_id=user_id))
  )
);

create or replace function public.live_distance_km(p_lat1 double precision,p_lon1 double precision,p_lat2 double precision,p_lon2 double precision)
returns numeric language sql immutable set search_path=public as $$
  select case when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else round((6371 * 2 * asin(sqrt(power(sin(radians(p_lat2-p_lat1)/2),2)+cos(radians(p_lat1))*cos(radians(p_lat2))*power(sin(radians(p_lon2-p_lon1)/2),2))))::numeric,1) end;
$$;

create or replace function public.start_live_checkin(
  p_place_type text,p_target_id uuid,p_place_name text,p_area text,p_latitude double precision,p_longitude double precision,
  p_activity text,p_message text,p_visibility text,p_minutes integer default 120
) returns uuid language plpgsql security definer set search_path=public,private as $$
declare
  v_user uuid:=auth.uid(); v_id uuid;
  v_name text:=btrim(coalesce(p_place_name,'')); v_area text:=btrim(coalesce(p_area,''));
  v_latitude double precision:=p_latitude; v_longitude double precision:=p_longitude;
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then raise exception 'Only Explorer accounts can check in.'; end if;
  if p_place_type not in ('park','public_place','business','activity_club','event') then raise exception 'Invalid public place type.'; end if;
  if p_visibility not in ('public','followers') then raise exception 'Invalid visibility.'; end if;
  if p_minutes not between 15 and 240 then raise exception 'Check-ins can last between 15 minutes and four hours.'; end if;
  if char_length(btrim(coalesce(p_activity,''))) not between 2 and 80 then raise exception 'Activity must contain between 2 and 80 characters.'; end if;
  if char_length(v_area) not between 2 and 80 then raise exception 'Add a valid public area.'; end if;

  if p_place_type='business' then
    select b.name,coalesce(b.latitude,p_latitude),coalesce(b.longitude,p_longitude) into v_name,v_latitude,v_longitude
    from public.businesses b where b.id=p_target_id;
    if not found then raise exception 'Business not found.'; end if;
  elsif p_place_type='activity_club' then
    select c.name,coalesce(c.latitude,p_latitude),coalesce(c.longitude,p_longitude) into v_name,v_latitude,v_longitude
    from public.activity_clubs c where c.id=p_target_id and c.status in ('open','full');
    if not found then raise exception 'Activity Club not found.'; end if;
  elsif p_place_type='event' then
    select e.name,coalesce(e.latitude,p_latitude),coalesce(e.longitude,p_longitude) into v_name,v_latitude,v_longitude
    from public.events e where e.id=p_target_id and e.status='published';
    if not found then raise exception 'Event not found.'; end if;
  else
    if p_target_id is not null then raise exception 'Manual public places cannot use a listing identifier.'; end if;
    if char_length(v_name) not between 2 and 120 then raise exception 'Add a valid public place name.'; end if;
  end if;

  if v_latitude is not null and (v_latitude < -90 or v_latitude > 90) then raise exception 'Invalid latitude.'; end if;
  if v_longitude is not null and (v_longitude < -180 or v_longitude > 180) then raise exception 'Invalid longitude.'; end if;
  update public.live_checkins set status='expired',ended_at=now() where user_id=v_user and status='active' and expires_at<=now();
  if exists(select 1 from public.live_checkins where user_id=v_user and status='active') then raise exception 'End your current check-in before starting another.'; end if;

  insert into public.live_checkins(user_id,place_type,target_id,place_name,area,latitude,longitude,activity,message,visibility,status,expires_at)
  values(v_user,p_place_type,p_target_id,v_name,v_area,
    case when v_latitude is null then null else round(v_latitude::numeric,2)::double precision end,
    case when v_longitude is null then null else round(v_longitude::numeric,2)::double precision end,
    btrim(p_activity),left(coalesce(btrim(p_message),''),240),p_visibility,'active',now()+make_interval(mins=>p_minutes))
  returning id into v_id;
  return v_id;
end;
$$;

update public.live_checkins
set latitude=case when latitude is null then null else round(latitude::numeric,2)::double precision end,
    longitude=case when longitude is null then null else round(longitude::numeric,2)::double precision end;

create or replace function public.block_explorer(p_user_id uuid)
returns void language plpgsql security definer set search_path=public,private as $$
declare v_user uuid:=auth.uid(); v_linkup_id uuid; v_count integer;
begin
  if v_user is null or p_user_id is null or v_user=p_user_id then raise exception 'Invalid user.'; end if;
  if not private.linkup_user_is_explorer(v_user) or not private.linkup_user_is_explorer(p_user_id) then raise exception 'Only Explorer accounts can be blocked here.'; end if;
  insert into public.user_blocks(blocker_id,blocked_id) values(v_user,p_user_id) on conflict(blocker_id,blocked_id) do nothing;
  delete from public.explorer_follows where (follower_id=v_user and following_id=p_user_id) or (follower_id=p_user_id and following_id=v_user);

  for v_linkup_id in
    select distinct a.linkup_id from public.linkup_attendees a join public.linkups l on l.id=a.linkup_id
    where a.status='joined' and ((a.user_id=v_user and l.creator_id=p_user_id) or (a.user_id=p_user_id and l.creator_id=v_user))
  loop
    update public.linkup_attendees a set status=case when a.user_id=v_user then 'left' else 'removed' end,updated_at=now()
    from public.linkups l where a.linkup_id=v_linkup_id and l.id=a.linkup_id and a.status='joined'
      and ((a.user_id=v_user and l.creator_id=p_user_id) or (a.user_id=p_user_id and l.creator_id=v_user));
    select count(*)::integer into v_count from public.linkup_attendees where linkup_id=v_linkup_id and status='joined';
    update public.linkups set attendee_count=greatest(v_count,1),
      status=case when status in ('cancelled','completed') then status when v_count>=max_attendees then 'full' else 'upcoming' end
    where id=v_linkup_id;
  end loop;
end;
$$;

create or replace function public.report_live_safety(p_target_type text,p_target_id uuid,p_reason text,p_details text default '')
returns uuid language plpgsql security definer set search_path=public,private as $$
declare v_user uuid:=auth.uid(); v_id uuid; v_owner uuid;
begin
  if v_user is null then raise exception 'Sign in to submit a report.'; end if;
  if p_target_type not in ('linkup','linkup_message','checkin','user') then raise exception 'Invalid report target.'; end if;
  if p_reason not in ('spam','harassment','unsafe','inappropriate','false_information','other') then raise exception 'Invalid report reason.'; end if;
  if (select count(*) from public.live_safety_reports where reporter_id=v_user and created_at>now()-interval '24 hours')>=20 then raise exception 'You have reached the daily report limit.'; end if;

  if p_target_type='linkup' then select creator_id into v_owner from public.linkups where id=p_target_id;
  elsif p_target_type='linkup_message' then select user_id into v_owner from public.linkup_messages where id=p_target_id and status='active';
  elsif p_target_type='checkin' then select user_id into v_owner from public.live_checkins where id=p_target_id;
  else select id into v_owner from public.profiles where id=p_target_id and account_type='explorer';
  end if;

  if v_owner is null then raise exception 'Report target not found.'; end if;
  if v_owner=v_user then raise exception 'You cannot report your own content or profile.'; end if;
  insert into public.live_safety_reports(reporter_id,target_type,target_id,reason,details)
  values(v_user,p_target_type,p_target_id,p_reason,left(coalesce(btrim(p_details),''),1000))
  on conflict(reporter_id,target_type,target_id) do update set reason=excluded.reason,details=excluded.details,status='open',created_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.refresh_live_system()
returns jsonb language plpgsql security definer set search_path=public,private as $$
declare v_completed integer; v_expired integer; v_reminders integer; v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if not private.linkup_user_is_explorer(v_user) then
    return jsonb_build_object('completed',0,'expired_checkins',0,'reminders',0);
  end if;
  update public.linkups set status='completed' where status in ('upcoming','full') and ends_at<=now();
  get diagnostics v_completed=row_count;
  update public.live_checkins set status='expired',ended_at=now() where status='active' and expires_at<=now();
  get diagnostics v_expired=row_count;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  select a.user_id,l.creator_id,'linkup_reminder','Link-up starting soon',l.title,'linkup',l.id,'/linkups/'||l.id,
    jsonb_build_object('linkup_id',l.id),'linkup-reminder-'||l.id||'-'||a.user_id
  from public.linkups l join public.linkup_attendees a on a.linkup_id=l.id and a.status='joined'
  where l.status in ('upcoming','full') and l.starts_at>now() and l.starts_at<=now()+interval '2 hours'
    and not exists(select 1 from public.notifications n where n.dedupe_key='linkup-reminder-'||l.id||'-'||a.user_id);
  get diagnostics v_reminders=row_count;
  return jsonb_build_object('completed',v_completed,'expired_checkins',v_expired,'reminders',v_reminders);
end;
$$;

create or replace function public.get_live_discovery(
  p_area text default null,p_latitude double precision default null,p_longitude double precision default null,
  p_radius_km numeric default 25,p_window_hours integer default 24
) returns table(
  item_type text,item_id uuid,title text,subtitle text,area text,starts_at timestamptz,ends_at timestamptz,
  latitude double precision,longitude double precision,distance_km numeric,status text,image_url text,deep_link text,action_label text
)
language plpgsql stable security invoker set search_path=public,private as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then raise exception 'Explorer account required.'; end if;
  return query
  with items(item_type,item_id,title,subtitle,area,starts_at,ends_at,latitude,longitude,distance_km,status,image_url,deep_link,action_label) as (
    select 'linkup'::text,l.id,l.title,(l.category||' · '||l.attendee_count||'/'||l.max_attendees||' joined')::text,l.area,l.starts_at,l.ends_at,l.latitude,l.longitude,
      public.live_distance_km(p_latitude,p_longitude,l.latitude,l.longitude),l.status,null::text,('/linkups/'||l.id)::text,'View Link-up'::text
    from public.linkups l where private.can_view_linkup(l.id,v_user)
      and l.starts_at<=now()+make_interval(hours=>greatest(1,least(p_window_hours,168))) and l.ends_at>now()
    union all
    select 'checkin',c.id,(coalesce(p.full_name,'Explorer')||' is here')::text,
      (c.activity||case when c.message='' then '' else ' · '||c.message end)::text,c.area,c.created_at,c.expires_at,c.latitude,c.longitude,
      public.live_distance_km(p_latitude,p_longitude,c.latitude,c.longitude),c.status,p.profile_photo,('/profile/'||c.user_id)::text,'View Explorer'::text
    from public.live_checkins c join public.profiles p on p.id=c.user_id
    where c.status='active' and c.expires_at>now() and c.user_id<>v_user and not private.linkup_users_blocked(c.user_id,v_user)
      and (c.visibility='public' or exists(select 1 from public.explorer_follows f where f.follower_id=v_user and f.following_id=c.user_id))
    union all
    select 'event',e.id,e.name,(e.category||' · '||e.location)::text,e.location,e.starts_at,e.ends_at,e.latitude,e.longitude,
      public.live_distance_km(p_latitude,p_longitude,e.latitude,e.longitude),e.status,e.image_url,('/events/'||e.id)::text,'View Event'::text
    from public.events e where e.status='published' and e.starts_at<=now()+make_interval(hours=>greatest(1,least(p_window_hours,168)))
      and coalesce(e.ends_at,e.starts_at+interval '3 hours')>now()
    union all
    select 'activity',s.id,(c.name||': '||s.title)::text,'Activity happening now or soon'::text,c.location,s.starts_at,s.ends_at,c.latitude,c.longitude,
      public.live_distance_km(p_latitude,p_longitude,c.latitude,c.longitude),c.status,c.image_url,('/activity-clubs/'||c.id)::text,'View Club'::text
    from public.activity_sessions s join public.activity_clubs c on c.id=s.club_id
    where c.status in ('open','full') and s.starts_at<=now()+make_interval(hours=>least(greatest(p_window_hours,1),24)) and s.ends_at>now()
    union all
    select 'place',b.id,b.name,(coalesce(b.category,'Local place')||' · '||coalesce(b.rating,0)||'★')::text,coalesce(b.address,''),
      null::timestamptz,null::timestamptz,b.latitude,b.longitude,
      public.live_distance_km(p_latitude,p_longitude,b.latitude,b.longitude),'popular',coalesce(b.image,b.photos[1]),('/business/'||b.id)::text,'View Place'::text
    from public.businesses b where coalesce(b.review_count,0)>0
  )
  select i.item_type,i.item_id,i.title,i.subtitle,i.area,i.starts_at,i.ends_at,i.latitude,i.longitude,i.distance_km,i.status,i.image_url,i.deep_link,i.action_label
  from items i
  where (p_area is null or btrim(p_area)='' or lower(i.area) like '%'||lower(btrim(p_area))||'%')
    and (p_latitude is null or p_longitude is null or i.distance_km is null or i.distance_km<=greatest(1,least(p_radius_km,100)))
  order by case i.item_type when 'linkup' then 1 when 'checkin' then 2 when 'event' then 3 when 'activity' then 4 else 5 end,
    i.starts_at nulls last,i.distance_km nulls last
  limit 100;
end;
$$;

revoke all on function public.get_live_discovery(text,double precision,double precision,numeric,integer) from public,anon;
grant execute on function public.get_live_discovery(text,double precision,double precision,numeric,integer) to authenticated;
