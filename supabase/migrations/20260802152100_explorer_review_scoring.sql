-- Unified review import, scoring ledger and legacy compatibility layer.

with legacy as (
  select
    r.id,r.user_id,
    case when r.business_id is not null then 'business' else 'property' end as target_type,
    coalesce(r.business_id,r.property_id) as target_id,
    coalesce(b.name,p.name,'Unknown place') as target_name,
    coalesce(b.image,b.photos[1],p.photos[1]) as target_image_url,
    greatest(1,least(5,coalesce(r.rating,5))) as rating,
    coalesce(r.review_title,'') as title,
    coalesce(r.comment,'') as comment,
    coalesce(r.verified_qr,false) as verified_qr,
    case when coalesce(r.moderation_status,'published') in ('published','pending','rejected','removed')
      then coalesce(r.moderation_status,'published') else 'published' end as status,
    'reviews'::text as legacy_source,
    r.created_at::timestamptz as created_at
  from public.reviews r
  left join public.businesses b on b.id=r.business_id
  left join public.properties p on p.id=r.property_id
  where r.user_id is not null and coalesce(r.business_id,r.property_id) is not null

  union all

  select
    r.id,r.user_id,'activity_club'::text,r.club_id,
    coalesce(c.name,'Activity club'),c.image_url,
    greatest(1,least(5,coalesce(r.rating,5))),
    coalesce(r.review_title,''),coalesce(r.comment,''),coalesce(r.verified_qr,false),
    case when coalesce(r.moderation_status,'published') in ('published','pending','rejected','removed')
      then coalesce(r.moderation_status,'published') else 'published' end,
    'activity_club_reviews'::text,r.created_at
  from public.activity_club_reviews r
  join public.activity_clubs c on c.id=r.club_id
  where r.user_id is not null
), ranked as (
  select legacy.*,
    row_number() over(
      partition by user_id,target_type,target_id,date_trunc('month',created_at)
      order by created_at,id
    ) as monthly_position
  from legacy
)
insert into public.explorer_reviews(
  id,user_id,target_type,target_id,target_name,target_image_url,rating,title,comment,
  verified_qr,status,points_eligible,legacy_source,legacy_review_id,created_at,updated_at
)
select
  id,user_id,target_type,target_id,target_name,target_image_url,rating,title,comment,
  verified_qr,status,(monthly_position=1),legacy_source,id,created_at,created_at
from ranked
on conflict(id) do nothing;

insert into public.review_media(review_id,user_id,media_type,media_url,sort_order,moderation_status,created_at)
select r.id,r.user_id,'image',photo.url,(photo.ordinality-1)::integer,'published',r.created_at::timestamptz
from public.reviews r
join public.explorer_reviews er on er.id=r.id
cross join lateral unnest(coalesce(r.photos,'{}'::text[])) with ordinality as photo(url,ordinality)
where nullif(trim(photo.url),'') is not null;

insert into public.review_media(review_id,user_id,media_type,media_url,thumbnail_url,duration_seconds,sort_order,moderation_status,created_at)
select r.id,r.user_id,'video',r.video_url,r.video_thumbnail_url,30,99,'published',r.created_at::timestamptz
from public.reviews r
join public.explorer_reviews er on er.id=r.id
where nullif(trim(r.video_url),'') is not null
on conflict do nothing;

insert into public.review_media(review_id,user_id,media_type,media_url,sort_order,moderation_status,created_at)
select r.id,r.user_id,'image',photo.url,(photo.ordinality-1)::integer,'published',r.created_at
from public.activity_club_reviews r
join public.explorer_reviews er on er.id=r.id
cross join lateral unnest(coalesce(r.photos,'{}'::text[])) with ordinality as photo(url,ordinality)
where nullif(trim(photo.url),'') is not null;

insert into public.review_media(review_id,user_id,media_type,media_url,thumbnail_url,duration_seconds,sort_order,moderation_status,created_at)
select r.id,r.user_id,'video',r.video_url,r.video_thumbnail_url,30,99,'published',r.created_at
from public.activity_club_reviews r
join public.explorer_reviews er on er.id=r.id
where nullif(trim(r.video_url),'') is not null
on conflict do nothing;

create or replace function public.set_guestbook_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists explorer_reviews_set_updated_at on public.explorer_reviews;
create trigger explorer_reviews_set_updated_at
before update on public.explorer_reviews
for each row execute function public.set_guestbook_updated_at();

drop trigger if exists event_reviews_set_updated_at on public.event_reviews;
create trigger event_reviews_set_updated_at
before update on public.event_reviews
for each row execute function public.set_guestbook_updated_at();

create or replace function public.set_review_points_eligibility()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.created_at is null then new.created_at=now(); end if;
  if exists(
    select 1 from public.explorer_reviews existing
    where existing.user_id=new.user_id
      and existing.target_type=new.target_type
      and existing.target_id=new.target_id
      and existing.status='published'
      and existing.points_eligible
      and date_trunc('month',existing.created_at)=date_trunc('month',new.created_at)
      and existing.id<>new.id
  ) then
    new.points_eligible=false;
  end if;
  return new;
end;
$$;

create or replace function public.validate_explorer_review_target()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  account_kind text;
  membership_status text;
  event_start timestamptz;
  event_status text;
begin
  select account_type into account_kind from public.profiles where id=new.user_id;
  if account_kind is distinct from 'explorer' then
    raise exception 'Only Explorer accounts can publish reviews.';
  end if;

  if new.target_type='business' then
    if not exists(select 1 from public.businesses where id=new.target_id) then raise exception 'Business not found.'; end if;
  elsif new.target_type='property' then
    if not exists(select 1 from public.properties where id=new.target_id) then raise exception 'Property not found.'; end if;
  elsif new.target_type='activity_club' then
    if not exists(select 1 from public.activity_clubs where id=new.target_id) then raise exception 'Activity Club not found.'; end if;
    select status into membership_status from public.activity_memberships
      where club_id=new.target_id and user_id=new.user_id;
    if membership_status is null or membership_status not in ('approved','left','removed') then
      raise exception 'Only approved or former members can review this Activity Club.';
    end if;
  elsif new.target_type='event' then
    select starts_at,status into event_start,event_status from public.events where id=new.target_id;
    if event_start is null then raise exception 'Event not found.'; end if;
    if event_status<>'published' then raise exception 'This event is not available for reviews.'; end if;
    if event_start>now() then raise exception 'Event reviews unlock when the event starts.'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_review_media_limits()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare existing_count integer;
begin
  if new.media_type='video' and (new.duration_seconds is null or new.duration_seconds<=0 or new.duration_seconds>30) then
    raise exception 'Video reviews must be 30 seconds or shorter.';
  end if;
  if new.media_type='image' and new.moderation_status not in ('rejected','removed') then
    select count(*) into existing_count from public.review_media
    where review_id=new.review_id and media_type='image'
      and moderation_status not in ('rejected','removed') and id<>new.id;
    if existing_count>=3 then raise exception 'A review can contain a maximum of 3 images.'; end if;
  end if;
  return new;
end;
$$;

create or replace function public.set_review_video_poster()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.media_type='video' and nullif(trim(coalesce(new.thumbnail_url,'')),'') is null then
    select coalesce(
      (select image_media.media_url from public.review_media image_media
       where image_media.review_id=new.review_id and image_media.media_type='image'
         and image_media.moderation_status='published'
       order by image_media.sort_order,image_media.created_at limit 1),
      review_row.target_image_url
    ) into new.thumbnail_url
    from public.explorer_reviews review_row where review_row.id=new.review_id;
  end if;
  return new;
end;
$$;

create or replace function public.recalculate_explorer_review_points(p_review_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  review_row public.explorer_reviews%rowtype;
  content_points integer:=0;
  content_reason text:='text_review';
  total_points integer:=0;
begin
  select * into review_row from public.explorer_reviews where id=p_review_id;
  if not found then return; end if;

  if review_row.status<>'published' or not review_row.points_eligible then
    update public.review_point_events set active=false,revoked_at=coalesce(revoked_at,now())
      where review_id=p_review_id and active;
    update public.explorer_reviews set points_awarded=0 where id=p_review_id and points_awarded<>0;
    return;
  end if;

  if exists(select 1 from public.review_media where review_id=p_review_id and media_type='video' and moderation_status='published') then
    content_points:=6; content_reason:='video_review';
  elsif exists(select 1 from public.review_media where review_id=p_review_id and media_type='image' and moderation_status='published') then
    content_points:=3; content_reason:='image_review';
  elsif nullif(trim(review_row.comment),'') is not null or nullif(trim(review_row.title),'') is not null then
    content_points:=1; content_reason:='text_review';
  end if;

  if content_points>0 then
    insert into public.review_point_events(user_id,review_id,event_key,reason,points,active,created_at,revoked_at)
    values(review_row.user_id,p_review_id,'content',content_reason,content_points,true,review_row.created_at,null)
    on conflict(review_id,event_key) do update set
      user_id=excluded.user_id,reason=excluded.reason,points=excluded.points,
      active=true,created_at=excluded.created_at,revoked_at=null;
  else
    update public.review_point_events set active=false,revoked_at=coalesce(revoked_at,now())
      where review_id=p_review_id and event_key='content' and active;
  end if;

  if review_row.verified_qr then
    insert into public.review_point_events(user_id,review_id,event_key,reason,points,active,created_at,revoked_at)
    values(review_row.user_id,p_review_id,'qr','verified_qr',3,true,review_row.created_at,null)
    on conflict(review_id,event_key) do update set
      user_id=excluded.user_id,reason='verified_qr',points=3,
      active=true,created_at=excluded.created_at,revoked_at=null;
  else
    update public.review_point_events set active=false,revoked_at=coalesce(revoked_at,now())
      where review_id=p_review_id and event_key='qr' and active;
  end if;

  select coalesce(sum(points),0)::integer into total_points
  from public.review_point_events where review_id=p_review_id and active;

  update public.explorer_reviews set points_awarded=total_points
    where id=p_review_id and points_awarded is distinct from total_points;
end;
$$;

create or replace function public.sync_explorer_review_to_legacy()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  display_name text;
  photo_urls text[];
  video_value text;
  video_thumb text;
begin
  if tg_op='DELETE' then
    if old.target_type in ('business','property') then delete from public.reviews where id=old.id;
    elsif old.target_type='activity_club' then delete from public.activity_club_reviews where id=old.id;
    elsif old.target_type='event' then delete from public.event_reviews where id=old.id;
    end if;
    return old;
  end if;

  select coalesce(full_name,'Explorer') into display_name from public.profiles where id=new.user_id;
  select
    coalesce(array_agg(media_url order by sort_order) filter(where media_type='image' and moderation_status='published'),'{}'::text[]),
    max(media_url) filter(where media_type='video' and moderation_status='published'),
    max(thumbnail_url) filter(where media_type='video' and moderation_status='published')
  into photo_urls,video_value,video_thumb
  from public.review_media where review_id=new.id;

  if new.target_type in ('business','property') then
    insert into public.reviews(
      id,user_id,business_id,property_id,rating,comment,photos,name,created_at,
      review_title,video_url,video_thumbnail_url,verified_qr,points_awarded,moderation_status
    ) values(
      new.id,new.user_id,case when new.target_type='business' then new.target_id end,
      case when new.target_type='property' then new.target_id end,new.rating,new.comment,
      photo_urls,display_name,new.created_at::timestamp,new.title,video_value,video_thumb,
      new.verified_qr,new.points_awarded,new.status
    )
    on conflict(id) do update set
      user_id=excluded.user_id,business_id=excluded.business_id,property_id=excluded.property_id,
      rating=excluded.rating,comment=excluded.comment,photos=excluded.photos,name=excluded.name,
      review_title=excluded.review_title,video_url=excluded.video_url,
      video_thumbnail_url=excluded.video_thumbnail_url,verified_qr=excluded.verified_qr,
      points_awarded=excluded.points_awarded,moderation_status=excluded.moderation_status;
  elsif new.target_type='activity_club' then
    insert into public.activity_club_reviews(
      id,club_id,user_id,reviewer_name,rating,comment,created_at,updated_at,
      review_title,photos,video_url,video_thumbnail_url,verified_qr,points_awarded,moderation_status
    ) values(
      new.id,new.target_id,new.user_id,display_name,new.rating,new.comment,new.created_at,new.updated_at,
      new.title,photo_urls,video_value,video_thumb,new.verified_qr,new.points_awarded,new.status
    )
    on conflict(id) do update set
      club_id=excluded.club_id,user_id=excluded.user_id,reviewer_name=excluded.reviewer_name,
      rating=excluded.rating,comment=excluded.comment,updated_at=excluded.updated_at,
      review_title=excluded.review_title,photos=excluded.photos,video_url=excluded.video_url,
      video_thumbnail_url=excluded.video_thumbnail_url,verified_qr=excluded.verified_qr,
      points_awarded=excluded.points_awarded,moderation_status=excluded.moderation_status;
  elsif new.target_type='event' then
    insert into public.event_reviews(
      id,event_id,user_id,reviewer_name,rating,review_title,comment,photos,video_url,
      video_thumbnail_url,verified_qr,points_awarded,moderation_status,created_at,updated_at
    ) values(
      new.id,new.target_id,new.user_id,display_name,new.rating,new.title,new.comment,photo_urls,
      video_value,video_thumb,new.verified_qr,new.points_awarded,new.status,new.created_at,new.updated_at
    )
    on conflict(id) do update set
      event_id=excluded.event_id,user_id=excluded.user_id,reviewer_name=excluded.reviewer_name,
      rating=excluded.rating,review_title=excluded.review_title,comment=excluded.comment,
      photos=excluded.photos,video_url=excluded.video_url,video_thumbnail_url=excluded.video_thumbnail_url,
      verified_qr=excluded.verified_qr,points_awarded=excluded.points_awarded,
      moderation_status=excluded.moderation_status,updated_at=excluded.updated_at;
  end if;
  return new;
end;
$$;

create or replace function public.review_points_after_review_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin perform public.recalculate_explorer_review_points(new.id); return new; end;
$$;

create or replace function public.review_points_after_media_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare affected_id uuid;
begin
  affected_id=case when tg_op='DELETE' then old.review_id else new.review_id end;
  perform public.recalculate_explorer_review_points(affected_id);
  update public.explorer_reviews set updated_at=now() where id=affected_id;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists explorer_reviews_points_eligibility on public.explorer_reviews;
create trigger explorer_reviews_points_eligibility before insert on public.explorer_reviews
for each row execute function public.set_review_points_eligibility();

drop trigger if exists explorer_reviews_validate_target on public.explorer_reviews;
create trigger explorer_reviews_validate_target before insert or update of user_id,target_type,target_id on public.explorer_reviews
for each row execute function public.validate_explorer_review_target();

drop trigger if exists review_media_validate_limits on public.review_media;
create trigger review_media_validate_limits before insert or update on public.review_media
for each row execute function public.validate_review_media_limits();

drop trigger if exists review_media_set_video_poster on public.review_media;
create trigger review_media_set_video_poster before insert or update of media_type,thumbnail_url,review_id on public.review_media
for each row execute function public.set_review_video_poster();

drop trigger if exists a_explorer_reviews_recalculate_points on public.explorer_reviews;
create trigger a_explorer_reviews_recalculate_points
after insert or update of status,verified_qr,points_eligible,title,comment on public.explorer_reviews
for each row execute function public.review_points_after_review_change();

drop trigger if exists review_media_recalculate_points on public.review_media;
create trigger review_media_recalculate_points after insert or update or delete on public.review_media
for each row execute function public.review_points_after_media_change();

drop trigger if exists b_explorer_reviews_sync_legacy on public.explorer_reviews;
create trigger b_explorer_reviews_sync_legacy after insert or update or delete on public.explorer_reviews
for each row execute function public.sync_explorer_review_to_legacy();

do $$
declare row_record record;
begin
  for row_record in select id from public.explorer_reviews loop
    perform public.recalculate_explorer_review_points(row_record.id);
  end loop;
end;
$$;

revoke all on function public.recalculate_explorer_review_points(uuid) from public,anon,authenticated;
revoke all on function public.review_points_after_media_change() from public,anon,authenticated;
revoke all on function public.review_points_after_review_change() from public,anon,authenticated;
revoke all on function public.set_review_points_eligibility() from public,anon,authenticated;
revoke all on function public.set_review_video_poster() from public,anon,authenticated;
revoke all on function public.sync_explorer_review_to_legacy() from public,anon,authenticated;
revoke all on function public.validate_explorer_review_target() from public,anon,authenticated;
revoke all on function public.validate_review_media_limits() from public,anon,authenticated;
