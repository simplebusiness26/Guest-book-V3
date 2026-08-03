drop function if exists public.quick_create_linkup(text);

create or replace function public.create_linkup(
  p_title text,
  p_description text,
  p_category text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_area text,
  p_location_name text,
  p_meeting_point_details text,
  p_latitude double precision,
  p_longitude double precision,
  p_max_attendees integer,
  p_visibility text
) returns uuid
language plpgsql
security definer
set search_path=public,private
as $$
declare
  v_user uuid:=auth.uid();
  v_id uuid;
  v_title text:=btrim(coalesce(p_title,''));
  v_description text;
  v_category text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_profile_area text;
  v_area text;
  v_location_name text;
  v_max_attendees integer;
  v_visibility text;
begin
  if v_user is null or not private.linkup_user_is_explorer(v_user) then
    raise exception 'Only Explorer accounts can create Link-ups.';
  end if;

  if char_length(v_title) not between 3 and 100 then
    raise exception 'Add a title with between 3 and 100 characters.';
  end if;

  select nullif(btrim(p.area),'')
  into v_profile_area
  from public.profiles p
  where p.id=v_user;

  v_description:=case
    when char_length(btrim(coalesce(p_description,''))) between 10 and 2000
      then btrim(p_description)
    else 'Details will be added by the organiser.'
  end;

  v_category:=case
    when char_length(btrim(coalesce(p_category,''))) between 2 and 40
      then btrim(p_category)
    when lower(v_title) like '%football%' then 'Football'
    when lower(v_title) like '%walk%' then 'Walking'
    when lower(v_title) like '%run%' then 'Running'
    when lower(v_title) like '%coffee%' then 'Coffee'
    when lower(v_title) similar to '%(food|lunch|dinner)%' then 'Food'
    when lower(v_title) similar to '%(game|quiz)%' then 'Games'
    else 'Social'
  end;

  v_starts_at:=coalesce(p_starts_at,now()+interval '1 day');
  if v_starts_at < now()+interval '15 minutes' or v_starts_at > now()+interval '180 days' then
    raise exception 'Link-up must start between 15 minutes and 180 days from now.';
  end if;

  v_ends_at:=coalesce(p_ends_at,v_starts_at+interval '2 hours');
  if v_ends_at<=v_starts_at or v_ends_at>v_starts_at+interval '24 hours' then
    raise exception 'Link-up duration must be between 1 minute and 24 hours.';
  end if;

  v_area:=case
    when char_length(btrim(coalesce(p_area,''))) between 2 and 80 then btrim(p_area)
    else coalesce(v_profile_area,'Local area')
  end;

  v_location_name:=case
    when char_length(btrim(coalesce(p_location_name,''))) between 2 and 120 then btrim(p_location_name)
    else 'Public meeting place to be confirmed'
  end;

  v_max_attendees:=case
    when p_max_attendees between 2 and 50 then p_max_attendees
    else 8
  end;

  v_visibility:=case
    when p_visibility in ('public','followers') then p_visibility
    else 'public'
  end;

  if (select count(*) from public.linkups where creator_id=v_user and created_at>now()-interval '24 hours')>=5 then
    raise exception 'You can create up to five Link-ups in 24 hours.';
  end if;

  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then
    raise exception 'Invalid latitude.';
  end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then
    raise exception 'Invalid longitude.';
  end if;

  insert into public.linkups(
    creator_id,title,description,category,starts_at,ends_at,area,location_name,
    latitude,longitude,max_attendees,attendee_count,visibility,status
  ) values(
    v_user,v_title,v_description,v_category,v_starts_at,v_ends_at,v_area,v_location_name,
    case when p_latitude is null then null else round(p_latitude::numeric,3)::double precision end,
    case when p_longitude is null then null else round(p_longitude::numeric,3)::double precision end,
    v_max_attendees,1,v_visibility,'upcoming'
  ) returning id into v_id;

  insert into public.linkup_private_details(linkup_id,meeting_point_details)
  values(v_id,left(coalesce(btrim(p_meeting_point_details),''),500));

  insert into public.linkup_attendees(linkup_id,user_id,role,status)
  values(v_id,v_user,'creator','joined');

  insert into public.notifications(
    recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,
    deep_link,data,dedupe_key
  )
  select
    f.follower_id,v_user,'linkup_follower_created',
    'New Link-up from someone you follow',v_title,'linkup',v_id,
    '/linkups/'||v_id,jsonb_build_object('linkup_id',v_id),
    'linkup-created-'||v_id||'-'||f.follower_id
  from public.explorer_follows f
  where f.following_id=v_user
    and not private.linkup_users_blocked(f.follower_id,v_user)
    and not exists(
      select 1 from public.notifications n
      where n.dedupe_key='linkup-created-'||v_id||'-'||f.follower_id
    );

  return v_id;
end;
$$;

revoke all on function public.create_linkup(
  text,text,text,timestamptz,timestamptz,text,text,text,
  double precision,double precision,integer,text
) from public,anon;
grant execute on function public.create_linkup(
  text,text,text,timestamptz,timestamptz,text,text,text,
  double precision,double precision,integer,text
) to authenticated;
