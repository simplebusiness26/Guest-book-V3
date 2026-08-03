create or replace function public.update_linkup(
  p_linkup_id uuid,p_title text,p_description text,p_category text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_area text,p_location_name text,p_meeting_point_details text,p_latitude double precision,
  p_longitude double precision,p_max_attendees integer,p_visibility text
) returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_old public.linkups%rowtype; v_changed boolean;
begin
  select * into v_old from public.linkups where id=p_linkup_id for update;
  if not found or v_old.creator_id<>v_user then raise exception 'Only the organiser can edit this Link-up.'; end if;
  if v_old.status in ('cancelled','completed') or v_old.ends_at<=now() then raise exception 'This Link-up can no longer be edited.'; end if;
  if p_starts_at<now()+interval '15 minutes' or p_starts_at>now()+interval '180 days' then raise exception 'Link-up must start between 15 minutes and 180 days from now.'; end if;
  if p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '24 hours' then raise exception 'Link-up duration must be no longer than 24 hours.'; end if;
  if p_max_attendees<v_old.attendee_count or p_max_attendees not between 2 and 50 then raise exception 'The limit cannot be below current attendance.'; end if;
  if p_visibility not in ('public','followers') then raise exception 'Invalid visibility.'; end if;
  v_changed:=v_old.starts_at is distinct from p_starts_at or v_old.ends_at is distinct from p_ends_at
    or v_old.area is distinct from btrim(p_area) or v_old.location_name is distinct from btrim(p_location_name);
  update public.linkups set title=btrim(p_title),description=btrim(p_description),category=btrim(p_category),starts_at=p_starts_at,
    ends_at=p_ends_at,area=btrim(p_area),location_name=btrim(p_location_name),
    latitude=case when p_latitude is null then null else round(p_latitude::numeric,3)::double precision end,
    longitude=case when p_longitude is null then null else round(p_longitude::numeric,3)::double precision end,
    max_attendees=p_max_attendees,visibility=p_visibility,status=case when attendee_count>=p_max_attendees then 'full' else 'upcoming' end
  where id=p_linkup_id;
  update public.linkup_private_details set meeting_point_details=left(coalesce(btrim(p_meeting_point_details),''),500) where linkup_id=p_linkup_id;
  if v_changed then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    select a.user_id,v_user,'linkup_updated','Link-up details changed',btrim(p_title),'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
      jsonb_build_object('linkup_id',p_linkup_id),'linkup-updated-'||p_linkup_id||'-'||a.user_id||'-'||gen_random_uuid()
    from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.status='joined' and a.user_id<>v_user;
  end if;
end;
$$;

create or replace function public.join_linkup(p_linkup_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_linkup public.linkups%rowtype; v_new_count integer; v_was_joined boolean;
begin
  if v_user is null or not public.linkup_user_is_explorer(v_user) then raise exception 'Only Explorer accounts can join Link-ups.'; end if;
  select * into v_linkup from public.linkups where id=p_linkup_id for update;
  if not found then raise exception 'Link-up not found.'; end if;
  if v_linkup.creator_id=v_user then return; end if;
  if not public.can_view_linkup(p_linkup_id,v_user) then raise exception 'This Link-up is unavailable.'; end if;
  if v_linkup.status in ('cancelled','completed') or v_linkup.starts_at<=now() then raise exception 'This Link-up can no longer be joined.'; end if;
  if public.linkup_users_blocked(v_linkup.creator_id,v_user) then raise exception 'This Link-up is unavailable.'; end if;
  select exists(select 1 from public.linkup_attendees where linkup_id=p_linkup_id and user_id=v_user and status='joined') into v_was_joined;
  if v_was_joined then return; end if;
  select count(*)::integer into v_new_count from public.linkup_attendees where linkup_id=p_linkup_id and status='joined';
  if v_new_count>=v_linkup.max_attendees then raise exception 'This Link-up is full.'; end if;
  insert into public.linkup_attendees(linkup_id,user_id,role,status,joined_at)
  values(p_linkup_id,v_user,'member','joined',now())
  on conflict(linkup_id,user_id) do update set status='joined',role='member',joined_at=now(),updated_at=now();
  v_new_count:=v_new_count+1;
  update public.linkups set attendee_count=v_new_count,status=case when v_new_count>=max_attendees then 'full' else 'upcoming' end where id=p_linkup_id;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  values(v_linkup.creator_id,v_user,'linkup_joined','Someone joined your Link-up',v_linkup.title,'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-joined-'||p_linkup_id||'-'||v_user||'-'||gen_random_uuid());
  if v_new_count>=v_linkup.max_attendees then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    select a.user_id,v_user,'linkup_full','Your Link-up is now full',v_linkup.title,'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
      jsonb_build_object('linkup_id',p_linkup_id),'linkup-full-'||p_linkup_id||'-'||a.user_id||'-'||gen_random_uuid()
    from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.status='joined';
  end if;
end;
$$;

create or replace function public.leave_linkup(p_linkup_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_linkup public.linkups%rowtype; v_count integer;
begin
  select * into v_linkup from public.linkups where id=p_linkup_id for update;
  if not found then raise exception 'Link-up not found.'; end if;
  if v_linkup.creator_id=v_user then raise exception 'The organiser must cancel the Link-up instead.'; end if;
  update public.linkup_attendees set status='left',updated_at=now() where linkup_id=p_linkup_id and user_id=v_user and status='joined';
  if not found then return; end if;
  select count(*)::integer into v_count from public.linkup_attendees where linkup_id=p_linkup_id and status='joined';
  update public.linkups set attendee_count=greatest(v_count,1),status=case when status in ('cancelled','completed') then status when v_count>=max_attendees then 'full' else 'upcoming' end where id=p_linkup_id;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  values(v_linkup.creator_id,v_user,'linkup_left','Someone left your Link-up',v_linkup.title,'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-left-'||p_linkup_id||'-'||v_user||'-'||gen_random_uuid());
end;
$$;

create or replace function public.remove_linkup_attendee(p_linkup_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_linkup public.linkups%rowtype; v_count integer;
begin
  select * into v_linkup from public.linkups where id=p_linkup_id for update;
  if not found or v_linkup.creator_id<>v_user then raise exception 'Only the organiser can remove attendees.'; end if;
  if p_user_id=v_user then raise exception 'The organiser cannot remove themselves.'; end if;
  update public.linkup_attendees set status='removed',updated_at=now() where linkup_id=p_linkup_id and user_id=p_user_id and status='joined';
  if not found then return; end if;
  select count(*)::integer into v_count from public.linkup_attendees where linkup_id=p_linkup_id and status='joined';
  update public.linkups set attendee_count=greatest(v_count,1),status=case when status in ('cancelled','completed') then status when v_count>=max_attendees then 'full' else 'upcoming' end where id=p_linkup_id;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  values(p_user_id,v_user,'linkup_removed','You were removed from a Link-up',v_linkup.title,'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-removed-'||p_linkup_id||'-'||p_user_id||'-'||gen_random_uuid());
end;
$$;
