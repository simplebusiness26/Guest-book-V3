create or replace function public.create_linkup(
  p_title text,p_description text,p_category text,p_starts_at timestamptz,p_ends_at timestamptz,
  p_area text,p_location_name text,p_meeting_point_details text,p_latitude double precision,
  p_longitude double precision,p_max_attendees integer,p_visibility text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null or not public.linkup_user_is_explorer(v_user) then raise exception 'Only Explorer accounts can create Link-ups.'; end if;
  if p_starts_at < now()+interval '15 minutes' or p_starts_at > now()+interval '180 days' then raise exception 'Link-up must start between 15 minutes and 180 days from now.'; end if;
  if p_ends_at<=p_starts_at or p_ends_at>p_starts_at+interval '24 hours' then raise exception 'Link-up duration must be between 1 minute and 24 hours.'; end if;
  if p_visibility not in ('public','followers') then raise exception 'Invalid Link-up visibility.'; end if;
  if p_max_attendees not between 2 and 50 then raise exception 'Attendee limit must be between 2 and 50.'; end if;
  if (select count(*) from public.linkups where creator_id=v_user and created_at>now()-interval '24 hours')>=5 then raise exception 'You can create up to five Link-ups in 24 hours.'; end if;
  if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then raise exception 'Invalid latitude.'; end if;
  if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then raise exception 'Invalid longitude.'; end if;

  insert into public.linkups(creator_id,title,description,category,starts_at,ends_at,area,location_name,latitude,longitude,max_attendees,attendee_count,visibility,status)
  values(v_user,btrim(p_title),btrim(p_description),btrim(p_category),p_starts_at,p_ends_at,btrim(p_area),btrim(p_location_name),
    case when p_latitude is null then null else round(p_latitude::numeric,3)::double precision end,
    case when p_longitude is null then null else round(p_longitude::numeric,3)::double precision end,
    p_max_attendees,1,p_visibility,'upcoming') returning id into v_id;

  insert into public.linkup_private_details(linkup_id,meeting_point_details) values(v_id,left(coalesce(btrim(p_meeting_point_details),''),500));
  insert into public.linkup_attendees(linkup_id,user_id,role,status) values(v_id,v_user,'creator','joined');

  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  select f.follower_id,v_user,'linkup_follower_created','New Link-up from someone you follow',btrim(p_title),'linkup',v_id,'/linkups/'||v_id,
         jsonb_build_object('linkup_id',v_id),'linkup-created-'||v_id||'-'||f.follower_id
  from public.explorer_follows f
  where f.following_id=v_user and not public.linkup_users_blocked(f.follower_id,v_user)
    and not exists(select 1 from public.notifications n where n.dedupe_key='linkup-created-'||v_id||'-'||f.follower_id);
  return v_id;
end;
$$;

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
    max_attendees=p_max_attendees,visibility=p_visibility,
    status=case when attendee_count>=p_max_attendees then 'full' else 'upcoming' end
  where id=p_linkup_id;
  update public.linkup_private_details set meeting_point_details=left(coalesce(btrim(p_meeting_point_details),''),500) where linkup_id=p_linkup_id;

  if v_changed then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    select a.user_id,v_user,'linkup_updated','Link-up details changed',btrim(p_title),'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
      jsonb_build_object('linkup_id',p_linkup_id),'linkup-updated-'||p_linkup_id||'-'||a.user_id||'-'||extract(epoch from now())::bigint
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
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-joined-'||p_linkup_id||'-'||v_user||'-'||extract(epoch from now())::bigint);
  if v_new_count>=v_linkup.max_attendees then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    select a.user_id,v_user,'linkup_full','Your Link-up is now full',v_linkup.title,'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
      jsonb_build_object('linkup_id',p_linkup_id),'linkup-full-'||p_linkup_id||'-'||a.user_id
    from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.status='joined'
      and not exists(select 1 from public.notifications n where n.dedupe_key='linkup-full-'||p_linkup_id||'-'||a.user_id);
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
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-left-'||p_linkup_id||'-'||v_user||'-'||extract(epoch from now())::bigint);
end;
$$;

create or replace function public.cancel_linkup(p_linkup_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_linkup public.linkups%rowtype;
begin
  select * into v_linkup from public.linkups where id=p_linkup_id for update;
  if not found or v_linkup.creator_id<>v_user then raise exception 'Only the organiser can cancel this Link-up.'; end if;
  if v_linkup.status='cancelled' then return; end if;
  update public.linkups set status='cancelled' where id=p_linkup_id;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  select a.user_id,v_user,'linkup_cancelled','Link-up cancelled',v_linkup.title,'linkup',p_linkup_id,'/linkups/'||p_linkup_id,
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-cancelled-'||p_linkup_id||'-'||a.user_id
  from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.status='joined' and a.user_id<>v_user
    and not exists(select 1 from public.notifications n where n.dedupe_key='linkup-cancelled-'||p_linkup_id||'-'||a.user_id);
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
    jsonb_build_object('linkup_id',p_linkup_id),'linkup-removed-'||p_linkup_id||'-'||p_user_id||'-'||extract(epoch from now())::bigint);
end;
$$;

create or replace function public.post_linkup_message(p_linkup_id uuid,p_body text,p_is_announcement boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_linkup public.linkups%rowtype; v_id uuid;
begin
  select * into v_linkup from public.linkups where id=p_linkup_id;
  if not found then raise exception 'Link-up not found.'; end if;
  if not public.is_active_linkup_member(p_linkup_id,v_user) then raise exception 'Join this Link-up to use its board.'; end if;
  if v_linkup.status in ('cancelled','completed') or v_linkup.ends_at<=now() then raise exception 'This board is read-only.'; end if;
  if p_is_announcement and v_linkup.creator_id<>v_user then raise exception 'Only the organiser can post announcements.'; end if;
  if char_length(btrim(coalesce(p_body,''))) not between 1 and 1000 then raise exception 'Message must contain between 1 and 1000 characters.'; end if;
  if (select count(*) from public.linkup_messages where user_id=v_user and created_at>now()-interval '1 minute')>=10 then raise exception 'Please slow down before posting again.'; end if;
  insert into public.linkup_messages(linkup_id,user_id,body,is_announcement) values(p_linkup_id,v_user,btrim(p_body),coalesce(p_is_announcement,false)) returning id into v_id;
  insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
  select a.user_id,v_user,case when p_is_announcement then 'linkup_announcement' else 'linkup_message' end,
    case when p_is_announcement then 'New Link-up announcement' else 'New Link-up message' end,left(btrim(p_body),120),'linkup',p_linkup_id,'/linkups/board/'||p_linkup_id,
    jsonb_build_object('linkup_id',p_linkup_id,'message_id',v_id),'linkup-message-'||v_id||'-'||a.user_id
  from public.linkup_attendees a where a.linkup_id=p_linkup_id and a.status='joined' and a.user_id<>v_user and not public.linkup_users_blocked(a.user_id,v_user);
  return v_id;
end;
$$;

create or replace function public.delete_linkup_message(p_message_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_message public.linkup_messages%rowtype;
begin
  select * into v_message from public.linkup_messages where id=p_message_id for update;
  if not found then return; end if;
  if v_message.user_id<>v_user and not public.is_linkup_creator(v_message.linkup_id,v_user) then raise exception 'You cannot remove this message.'; end if;
  update public.linkup_messages set status='deleted',deleted_at=now() where id=p_message_id;
end;
$$;

create or replace function public.start_live_checkin(
  p_place_type text,p_target_id uuid,p_place_name text,p_area text,p_latitude double precision,p_longitude double precision,
  p_activity text,p_message text,p_visibility text,p_minutes integer default 120
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null or not public.linkup_user_is_explorer(v_user) then raise exception 'Only Explorer accounts can check in.'; end if;
  if p_place_type not in ('park','public_place','business','activity_club','event') then raise exception 'Invalid public place type.'; end if;
  if p_visibility not in ('public','followers') then raise exception 'Invalid visibility.'; end if;
  if p_minutes not between 15 and 240 then raise exception 'Check-ins can last between 15 minutes and four hours.'; end if;
  update public.live_checkins set status='expired',ended_at=now() where user_id=v_user and status='active' and expires_at<=now();
  if exists(select 1 from public.live_checkins where user_id=v_user and status='active') then raise exception 'End your current check-in before starting another.'; end if;
  insert into public.live_checkins(user_id,place_type,target_id,place_name,area,latitude,longitude,activity,message,visibility,status,expires_at)
  values(v_user,p_place_type,p_target_id,btrim(p_place_name),btrim(p_area),
    case when p_latitude is null then null else round(p_latitude::numeric,3)::double precision end,
    case when p_longitude is null then null else round(p_longitude::numeric,3)::double precision end,
    btrim(p_activity),left(coalesce(btrim(p_message),''),240),p_visibility,'active',now()+make_interval(mins=>p_minutes)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.end_live_checkin(p_checkin_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin update public.live_checkins set status='ended',ended_at=now() where id=p_checkin_id and user_id=auth.uid() and status='active'; end;
$$;

create or replace function public.block_explorer(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or p_user_id is null or v_user=p_user_id then raise exception 'Invalid user.'; end if;
  insert into public.user_blocks(blocker_id,blocked_id) values(v_user,p_user_id) on conflict(blocker_id,blocked_id) do nothing;
  delete from public.explorer_follows where (follower_id=v_user and following_id=p_user_id) or (follower_id=p_user_id and following_id=v_user);
end;
$$;

create or replace function public.unblock_explorer(p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin delete from public.user_blocks where blocker_id=auth.uid() and blocked_id=p_user_id; end;
$$;

create or replace function public.report_live_safety(p_target_type text,p_target_id uuid,p_reason text,p_details text default '')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Sign in to submit a report.'; end if;
  if p_target_type not in ('linkup','linkup_message','checkin','user') then raise exception 'Invalid report target.'; end if;
  if p_reason not in ('spam','harassment','unsafe','inappropriate','false_information','other') then raise exception 'Invalid report reason.'; end if;
  insert into public.live_safety_reports(reporter_id,target_type,target_id,reason,details)
  values(v_user,p_target_type,p_target_id,p_reason,left(coalesce(btrim(p_details),''),1000))
  on conflict(reporter_id,target_type,target_id) do update set reason=excluded.reason,details=excluded.details,status='open',created_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_linkup(text,text,text,timestamptz,timestamptz,text,text,text,double precision,double precision,integer,text),
  public.update_linkup(uuid,text,text,text,timestamptz,timestamptz,text,text,text,double precision,double precision,integer,text),
  public.join_linkup(uuid),public.leave_linkup(uuid),public.cancel_linkup(uuid),public.remove_linkup_attendee(uuid,uuid),
  public.post_linkup_message(uuid,text,boolean),public.delete_linkup_message(uuid),
  public.start_live_checkin(text,uuid,text,text,double precision,double precision,text,text,text,integer),public.end_live_checkin(uuid),
  public.block_explorer(uuid),public.unblock_explorer(uuid),public.report_live_safety(text,uuid,text,text) from public,anon;

grant execute on function public.create_linkup(text,text,text,timestamptz,timestamptz,text,text,text,double precision,double precision,integer,text),
  public.update_linkup(uuid,text,text,text,timestamptz,timestamptz,text,text,text,double precision,double precision,integer,text),
  public.join_linkup(uuid),public.leave_linkup(uuid),public.cancel_linkup(uuid),public.remove_linkup_attendee(uuid,uuid),
  public.post_linkup_message(uuid,text,boolean),public.delete_linkup_message(uuid),
  public.start_live_checkin(text,uuid,text,text,double precision,double precision,text,text,text,integer),public.end_live_checkin(uuid),
  public.block_explorer(uuid),public.unblock_explorer(uuid),public.report_live_safety(text,uuid,text,text) to authenticated;
