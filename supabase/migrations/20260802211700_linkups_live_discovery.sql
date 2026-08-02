create or replace function public.refresh_live_system()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_completed integer; v_expired integer; v_reminders integer;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
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

create or replace function public.live_distance_km(p_lat1 double precision,p_lon1 double precision,p_lat2 double precision,p_lon2 double precision)
returns numeric language sql immutable as $$
  select case when p_lat1 is null or p_lon1 is null or p_lat2 is null or p_lon2 is null then null
    else round((6371 * 2 * asin(sqrt(power(sin(radians(p_lat2-p_lat1)/2),2)+cos(radians(p_lat1))*cos(radians(p_lat2))*power(sin(radians(p_lon2-p_lon1)/2),2))))::numeric,1) end;
$$;

create or replace function public.get_live_discovery(
  p_area text default null,p_latitude double precision default null,p_longitude double precision default null,
  p_radius_km numeric default 25,p_window_hours integer default 24
) returns table(
  item_type text,item_id uuid,title text,subtitle text,area text,starts_at timestamptz,ends_at timestamptz,
  latitude double precision,longitude double precision,distance_km numeric,status text,image_url text,deep_link text,action_label text
)
language plpgsql stable security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not public.linkup_user_is_explorer(v_user) then raise exception 'Explorer account required.'; end if;
  return query
  with items(item_type,item_id,title,subtitle,area,starts_at,ends_at,latitude,longitude,distance_km,status,image_url,deep_link,action_label) as (
    select 'linkup'::text,l.id,l.title,(l.category||' · '||l.attendee_count||'/'||l.max_attendees||' joined')::text,l.area,l.starts_at,l.ends_at,l.latitude,l.longitude,
      public.live_distance_km(p_latitude,p_longitude,l.latitude,l.longitude),l.status,null::text,('/linkups/'||l.id)::text,'View Link-up'::text
    from public.linkups l where public.can_view_linkup(l.id,v_user)
      and l.starts_at<=now()+make_interval(hours=>greatest(1,least(p_window_hours,168))) and l.ends_at>now()
    union all
    select 'checkin',c.id,(coalesce(p.full_name,'Explorer')||' is here')::text,
      (c.activity||case when c.message='' then '' else ' · '||c.message end)::text,c.area,c.created_at,c.expires_at,c.latitude,c.longitude,
      public.live_distance_km(p_latitude,p_longitude,c.latitude,c.longitude),c.status,p.profile_photo,('/profile/'||c.user_id)::text,'View Explorer'::text
    from public.live_checkins c join public.profiles p on p.id=c.user_id
    where c.status='active' and c.expires_at>now() and c.user_id<>v_user and not public.linkup_users_blocked(c.user_id,v_user)
      and (c.visibility='public' or exists(select 1 from public.explorer_follows f where f.follower_id=v_user and f.following_id=c.user_id))
    union all
    select 'event',e.id,e.name,(e.category||' · '||e.location)::text,e.location,e.starts_at,e.ends_at,e.latitude,e.longitude,
      public.live_distance_km(p_latitude,p_longitude,e.latitude,e.longitude),e.status,e.image_url,('/events/'||e.id)::text,'View Event'::text
    from public.events e where e.status='published'
      and e.starts_at<=now()+make_interval(hours=>greatest(1,least(p_window_hours,168)))
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

revoke all on function public.refresh_live_system(),public.get_live_discovery(text,double precision,double precision,numeric,integer) from public,anon;
grant execute on function public.refresh_live_system(),public.get_live_discovery(text,double precision,double precision,numeric,integer) to authenticated;
