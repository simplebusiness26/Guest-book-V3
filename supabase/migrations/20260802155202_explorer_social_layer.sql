-- Explorer social layer: follows, feed, Moments, likes, comments, reports and notifications.
-- This file represents the final corrected state after timeout-limited trigger tests.

create schema if not exists guestbook_private;

create table if not exists public.explorer_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint explorer_follows_no_self check (follower_id <> following_id),
  constraint explorer_follows_unique unique (follower_id,following_id)
);

create table if not exists public.explorer_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text not null default '',
  media_type text not null,
  media_url text not null,
  thumbnail_url text,
  duration_seconds numeric,
  target_type text,
  target_id uuid,
  target_name text,
  target_image_url text,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint explorer_moments_caption_length check (char_length(caption)<=500),
  constraint explorer_moments_media_type check (media_type in ('image','video')),
  constraint explorer_moments_duration check (
    (media_type='image' and duration_seconds is null)
    or (media_type='video' and duration_seconds>0 and duration_seconds<=30)
  ),
  constraint explorer_moments_status check (status in ('published','removed')),
  constraint explorer_moments_target_pair check (
    (target_type is null and target_id is null)
    or (target_type is not null and target_id is not null)
  ),
  constraint explorer_moments_target_type check (
    target_type is null or target_type in ('business','property','activity_club','event')
  )
);

create table if not exists public.social_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint social_likes_target_type check (target_type in ('review','moment')),
  constraint social_likes_unique unique (user_id,target_type,target_id)
);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  constraint social_comments_target_type check (target_type in ('moment','video_review')),
  constraint social_comments_body_length check (char_length(btrim(body)) between 1 and 500),
  constraint social_comments_status check (status in ('published','removed'))
);

create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text not null default '',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint social_reports_target_type check (target_type in ('moment','comment')),
  constraint social_reports_reason check (reason in ('spam','harassment','inappropriate','false_information','other')),
  constraint social_reports_details_length check (char_length(details)<=500),
  constraint social_reports_status check (status in ('open','reviewed','actioned','dismissed')),
  constraint social_reports_unique unique (reporter_id,target_type,target_id)
);

create index if not exists explorer_follows_follower_created_idx on public.explorer_follows(follower_id,created_at desc);
create index if not exists explorer_follows_following_created_idx on public.explorer_follows(following_id,created_at desc);
create index if not exists explorer_moments_created_idx on public.explorer_moments(created_at desc) where status='published';
create index if not exists explorer_moments_user_created_idx on public.explorer_moments(user_id,created_at desc) where status='published';
create index if not exists social_likes_target_idx on public.social_likes(target_type,target_id,created_at desc);
create index if not exists social_comments_target_idx on public.social_comments(target_type,target_id,created_at) where status='published';
create index if not exists social_comments_user_idx on public.social_comments(user_id,created_at desc);
create index if not exists social_reports_status_idx on public.social_reports(status,created_at desc);

alter table public.explorer_follows enable row level security;
alter table public.explorer_moments enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_reports enable row level security;

create or replace function guestbook_private.is_explorer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id and p.account_type='explorer');
$$;

create or replace function guestbook_private.social_content_owner(p_target_type text,p_target_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path='public','pg_temp'
as $$
declare v_owner uuid;
begin
  if p_target_type='moment' then
    select user_id into v_owner from public.explorer_moments where id=p_target_id;
  elsif p_target_type in ('review','video_review') then
    select user_id into v_owner from public.explorer_reviews where id=p_target_id;
  elsif p_target_type='comment' then
    select user_id into v_owner from public.social_comments where id=p_target_id;
  end if;
  return v_owner;
end;
$$;

create or replace function guestbook_private.enforce_social_rate_limit()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_user uuid;
  v_count integer;
begin
  if tg_table_name='explorer_follows' then
    v_user:=new.follower_id;
    select count(*) into v_count from public.explorer_follows where follower_id=v_user and created_at>now()-interval '1 hour';
    if v_count>=60 then raise exception 'Follow limit reached. Please try again later.'; end if;
  elsif tg_table_name='explorer_moments' then
    v_user:=new.user_id;
    select count(*) into v_count from public.explorer_moments where user_id=v_user and created_at>now()-interval '1 hour';
    if v_count>=10 then raise exception 'Moment limit reached. Please try again later.'; end if;
  elsif tg_table_name='social_comments' then
    v_user:=new.user_id;
    select count(*) into v_count from public.social_comments where user_id=v_user and created_at>now()-interval '1 hour';
    if v_count>=40 then raise exception 'Comment limit reached. Please try again later.'; end if;
  elsif tg_table_name='social_likes' then
    v_user:=new.user_id;
    select count(*) into v_count from public.social_likes where user_id=v_user and created_at>now()-interval '1 hour';
    if v_count>=120 then raise exception 'Like limit reached. Please try again later.'; end if;
  elsif tg_table_name='social_reports' then
    v_user:=new.reporter_id;
    select count(*) into v_count from public.social_reports where reporter_id=v_user and created_at>now()-interval '1 day';
    if v_count>=20 then raise exception 'Report limit reached. Please try again later.'; end if;
  end if;
  return new;
end;
$$;

create or replace function guestbook_private.validate_social_target()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_actor uuid;
  v_exists boolean:=false;
  v_owner uuid;
begin
  if tg_table_name='explorer_follows' then v_actor:=new.follower_id;
  elsif tg_table_name in ('explorer_moments','social_likes','social_comments') then v_actor:=new.user_id;
  elsif tg_table_name='social_reports' then v_actor:=new.reporter_id;
  else raise exception 'Unsupported social validation table: %',tg_table_name;
  end if;

  if not guestbook_private.is_explorer(v_actor) then raise exception 'Only Explorer accounts can use social features'; end if;

  if tg_table_name='explorer_follows' then
    if new.follower_id=new.following_id then raise exception 'You cannot follow yourself'; end if;
    if not guestbook_private.is_explorer(new.following_id) then raise exception 'You can only follow Explorer accounts'; end if;
  elsif tg_table_name='explorer_moments' then
    if (new.target_type is null)<>(new.target_id is null) then raise exception 'Attached place type and id must be provided together'; end if;
    if new.target_type is not null then
      if new.target_type='business' then select exists(select 1 from public.businesses where id=new.target_id) into v_exists;
      elsif new.target_type='property' then select exists(select 1 from public.properties where id=new.target_id) into v_exists;
      elsif new.target_type='activity_club' then select exists(select 1 from public.activity_clubs where id=new.target_id and status='published') into v_exists;
      elsif new.target_type='event' then select exists(select 1 from public.events where id=new.target_id and status='published') into v_exists;
      else raise exception 'Unsupported attached place type';
      end if;
      if not coalesce(v_exists,false) then raise exception 'The attached place is unavailable'; end if;
    end if;
  elsif tg_table_name='social_likes' then
    if new.target_type='moment' then select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='review' then select exists(select 1 from public.explorer_reviews where id=new.target_id and status='published') into v_exists;
    else raise exception 'Unsupported like target';
    end if;
    if not coalesce(v_exists,false) then raise exception 'This content is unavailable'; end if;
  elsif tg_table_name='social_comments' then
    if new.target_type='moment' then select exists(select 1 from public.explorer_moments where id=new.target_id and status='published') into v_exists;
    elsif new.target_type='video_review' then
      select exists(
        select 1 from public.explorer_reviews er
        where er.id=new.target_id and er.status='published'
          and exists(select 1 from public.review_media rm where rm.review_id=er.id and rm.media_type='video' and rm.moderation_status='published')
      ) into v_exists;
    else raise exception 'Unsupported comment target';
    end if;
    if not coalesce(v_exists,false) then raise exception 'Comments are unavailable for this content'; end if;
  elsif tg_table_name='social_reports' then
    if new.target_type='moment' then select user_id into v_owner from public.explorer_moments where id=new.target_id and status='published';
    elsif new.target_type='comment' then select user_id into v_owner from public.social_comments where id=new.target_id and status='published';
    else raise exception 'Unsupported report target';
    end if;
    if v_owner is null then raise exception 'This content is unavailable'; end if;
    if v_owner=new.reporter_id then raise exception 'You cannot report your own content'; end if;
  end if;
  return new;
end;
$$;

create or replace function guestbook_private.social_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path='public','pg_temp'
as $$
declare
  v_actor_name text;
  v_actor_id uuid;
  v_owner uuid;
  v_deep_link text;
  v_message text;
begin
  if tg_table_name='explorer_follows' then v_actor_id:=new.follower_id; else v_actor_id:=new.user_id; end if;
  select coalesce(nullif(btrim(full_name),''),'An Explorer') into v_actor_name from public.profiles where id=v_actor_id;

  if tg_table_name='explorer_follows' then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    values(new.following_id,new.follower_id,'social_follow','New follower',v_actor_name||' started following you.','profile',new.follower_id,'/profile/'||new.follower_id,jsonb_build_object('category','social','social_type','follow'),'social-follow-'||new.id);
  elsif tg_table_name='explorer_moments' then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    select f.follower_id,new.user_id,'social_moment','New Moment',v_actor_name||' shared a new Moment.','moment',new.id,'/moments/'||new.id,jsonb_build_object('category','social','social_type','moment'),'social-moment-'||new.id||'-'||f.follower_id
    from public.explorer_follows f where f.following_id=new.user_id and f.follower_id<>new.user_id;
  elsif tg_table_name='social_likes' then
    v_owner:=guestbook_private.social_content_owner(new.target_type,new.target_id);
    if v_owner is not null and v_owner<>new.user_id then
      v_deep_link:=case when new.target_type='moment' then '/moments/'||new.target_id else '/profile/'||v_owner end;
      v_message:=v_actor_name||' liked your '||case when new.target_type='moment' then 'Moment.' else 'review.' end;
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      values(v_owner,new.user_id,'social_like','New like',v_message,new.target_type,new.target_id,v_deep_link,jsonb_build_object('category','social','social_type','like','content_type',new.target_type),'social-like-'||new.id);
    end if;
  elsif tg_table_name='social_comments' then
    v_owner:=guestbook_private.social_content_owner(new.target_type,new.target_id);
    if v_owner is not null and v_owner<>new.user_id then
      v_deep_link:=case when new.target_type='moment' then '/moments/'||new.target_id else '/profile/'||v_owner end;
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      values(v_owner,new.user_id,'social_comment','New comment',v_actor_name||' commented on your '||case when new.target_type='moment' then 'Moment.' else 'video review.' end,new.target_type,new.target_id,v_deep_link,jsonb_build_object('category','social','social_type','comment','content_type',new.target_type),'social-comment-'||new.id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.get_explorer_follow_counts(p_user_id uuid)
returns table(follower_count bigint,following_count bigint,moment_count bigint)
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  select
    (select count(*) from public.explorer_follows where following_id=p_user_id),
    (select count(*) from public.explorer_follows where follower_id=p_user_id),
    (select count(*) from public.explorer_moments where user_id=p_user_id and status='published');
$$;

create or replace function public.get_explorer_social_feed(p_limit integer default 20,p_offset integer default 0)
returns table(
  item_id uuid,item_type text,actor_id uuid,actor_name text,actor_photo text,created_at timestamptz,
  caption text,rating integer,verified_qr boolean,target_type text,target_id uuid,target_name text,target_image_url text,
  media_type text,media_url text,thumbnail_url text,duration_seconds numeric,like_count bigint,comment_count bigint,viewer_liked boolean
)
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
  with viewer as (select auth.uid() as id),
  people as (
    select following_id as user_id from public.explorer_follows,viewer where follower_id=viewer.id
    union select id from viewer where id is not null
  ),
  moments as (
    select m.id,'moment'::text,m.user_id,p.full_name,p.profile_photo,m.created_at,m.caption,null::integer,false,
      m.target_type,m.target_id,m.target_name,m.target_image_url,m.media_type,m.media_url,m.thumbnail_url,m.duration_seconds,
      (select count(*) from public.social_likes l where l.target_type='moment' and l.target_id=m.id),
      (select count(*) from public.social_comments c where c.target_type='moment' and c.target_id=m.id and c.status='published'),
      exists(select 1 from public.social_likes l,viewer where l.target_type='moment' and l.target_id=m.id and l.user_id=viewer.id)
    from public.explorer_moments m join people pe on pe.user_id=m.user_id join public.profiles p on p.id=m.user_id
    where m.status='published'
  ),
  reviews as (
    select er.id,'review'::text,er.user_id,p.full_name,p.profile_photo,er.created_at,coalesce(nullif(er.title,''),er.comment),er.rating,er.verified_qr,
      er.target_type,er.target_id,er.target_name,er.target_image_url,rm.media_type,rm.media_url,rm.thumbnail_url,rm.duration_seconds,
      (select count(*) from public.social_likes l where l.target_type='review' and l.target_id=er.id),
      (select count(*) from public.social_comments c where c.target_type='video_review' and c.target_id=er.id and c.status='published'),
      exists(select 1 from public.social_likes l,viewer where l.target_type='review' and l.target_id=er.id and l.user_id=viewer.id)
    from public.explorer_reviews er join people pe on pe.user_id=er.user_id join public.profiles p on p.id=er.user_id
    left join lateral (
      select media_type,media_url,thumbnail_url,duration_seconds from public.review_media
      where review_id=er.id and moderation_status='published'
      order by case when media_type='video' then 0 else 1 end,sort_order asc limit 1
    ) rm on true
    where er.status='published'
  ),
  favourites as (
    select ef.id,'favourite'::text,ef.user_id,p.full_name,p.profile_photo,ef.created_at,'Saved '||ef.target_name||' as a favourite place.'::text,
      null::integer,false,ef.target_type,ef.target_id,ef.target_name,ef.target_image_url,
      case when ef.target_image_url is not null then 'image' else null end,ef.target_image_url,null::text,null::numeric,0::bigint,0::bigint,false
    from public.explorer_favourites ef join people pe on pe.user_id=ef.user_id join public.profiles p on p.id=ef.user_id
    where ef.is_public=true
  )
  select * from (select * from moments union all select * from reviews union all select * from favourites) feed
  order by created_at desc
  limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;

drop trigger if exists explorer_follows_validate on public.explorer_follows;
drop trigger if exists explorer_follows_rate on public.explorer_follows;
drop trigger if exists explorer_follows_notify on public.explorer_follows;
create trigger explorer_follows_validate before insert on public.explorer_follows for each row execute function guestbook_private.validate_social_target();
create trigger explorer_follows_rate before insert on public.explorer_follows for each row execute function guestbook_private.enforce_social_rate_limit();
create trigger explorer_follows_notify after insert on public.explorer_follows for each row execute function guestbook_private.social_notification_trigger();

drop trigger if exists explorer_moments_validate on public.explorer_moments;
drop trigger if exists explorer_moments_rate on public.explorer_moments;
drop trigger if exists explorer_moments_notify on public.explorer_moments;
create trigger explorer_moments_validate before insert on public.explorer_moments for each row execute function guestbook_private.validate_social_target();
create trigger explorer_moments_rate before insert on public.explorer_moments for each row execute function guestbook_private.enforce_social_rate_limit();
create trigger explorer_moments_notify after insert on public.explorer_moments for each row execute function guestbook_private.social_notification_trigger();

drop trigger if exists social_likes_validate on public.social_likes;
drop trigger if exists social_likes_rate on public.social_likes;
drop trigger if exists social_likes_notify on public.social_likes;
create trigger social_likes_validate before insert on public.social_likes for each row execute function guestbook_private.validate_social_target();
create trigger social_likes_rate before insert on public.social_likes for each row execute function guestbook_private.enforce_social_rate_limit();
create trigger social_likes_notify after insert on public.social_likes for each row execute function guestbook_private.social_notification_trigger();

drop trigger if exists social_comments_validate on public.social_comments;
drop trigger if exists social_comments_rate on public.social_comments;
drop trigger if exists social_comments_notify on public.social_comments;
create trigger social_comments_validate before insert on public.social_comments for each row execute function guestbook_private.validate_social_target();
create trigger social_comments_rate before insert on public.social_comments for each row execute function guestbook_private.enforce_social_rate_limit();
create trigger social_comments_notify after insert on public.social_comments for each row execute function guestbook_private.social_notification_trigger();

drop trigger if exists social_reports_validate on public.social_reports;
drop trigger if exists social_reports_rate on public.social_reports;
create trigger social_reports_validate before insert on public.social_reports for each row execute function guestbook_private.validate_social_target();
create trigger social_reports_rate before insert on public.social_reports for each row execute function guestbook_private.enforce_social_rate_limit();

drop policy if exists explorer_follows_read_authenticated on public.explorer_follows;
drop policy if exists explorer_follows_insert_own on public.explorer_follows;
drop policy if exists explorer_follows_delete_own on public.explorer_follows;
create policy explorer_follows_read_authenticated on public.explorer_follows for select to authenticated using (true);
create policy explorer_follows_insert_own on public.explorer_follows for insert to authenticated with check (follower_id=(select auth.uid()));
create policy explorer_follows_delete_own on public.explorer_follows for delete to authenticated using (follower_id=(select auth.uid()));

drop policy if exists explorer_moments_public_read on public.explorer_moments;
drop policy if exists explorer_moments_insert_own on public.explorer_moments;
drop policy if exists explorer_moments_delete_own on public.explorer_moments;
create policy explorer_moments_public_read on public.explorer_moments for select to public using (status='published' or user_id=(select auth.uid()));
create policy explorer_moments_insert_own on public.explorer_moments for insert to authenticated with check (user_id=(select auth.uid()));
create policy explorer_moments_delete_own on public.explorer_moments for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists social_likes_public_read on public.social_likes;
drop policy if exists social_likes_insert_own on public.social_likes;
drop policy if exists social_likes_delete_own on public.social_likes;
create policy social_likes_public_read on public.social_likes for select to public using (true);
create policy social_likes_insert_own on public.social_likes for insert to authenticated with check (user_id=(select auth.uid()));
create policy social_likes_delete_own on public.social_likes for delete to authenticated using (user_id=(select auth.uid()));

drop policy if exists social_comments_public_read on public.social_comments;
drop policy if exists social_comments_insert_own on public.social_comments;
drop policy if exists social_comments_delete_own_or_owner on public.social_comments;
create policy social_comments_public_read on public.social_comments for select to public using (status='published');
create policy social_comments_insert_own on public.social_comments for insert to authenticated with check (user_id=(select auth.uid()));
create policy social_comments_delete_own_or_owner on public.social_comments for delete to authenticated using (
  user_id=(select auth.uid()) or guestbook_private.social_content_owner(target_type,target_id)=(select auth.uid())
);

drop policy if exists social_reports_insert_own on public.social_reports;
drop policy if exists social_reports_read_own_or_admin on public.social_reports;
drop policy if exists social_reports_admin_update on public.social_reports;
create policy social_reports_insert_own on public.social_reports for insert to authenticated with check (reporter_id=(select auth.uid()));
create policy social_reports_read_own_or_admin on public.social_reports for select to authenticated using (
  reporter_id=(select auth.uid()) or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin=true)
);
create policy social_reports_admin_update on public.social_reports for update to authenticated using (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin=true)
) with check (
  exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_admin=true)
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('social-media','social-media',true,52428800,array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists social_media_insert_own on storage.objects;
drop policy if exists social_media_update_own on storage.objects;
drop policy if exists social_media_delete_own on storage.objects;
create policy social_media_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy social_media_update_own on storage.objects for update to authenticated using (
  bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text
) with check (
  bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text
);
create policy social_media_delete_own on storage.objects for delete to authenticated using (
  bucket_id='social-media' and (storage.foldername(name))[1]=(select auth.uid())::text
);

grant select on public.explorer_follows,public.explorer_moments,public.social_likes,public.social_comments to anon,authenticated;
grant insert,delete on public.explorer_follows,public.explorer_moments,public.social_likes,public.social_comments to authenticated;
grant select,insert,update on public.social_reports to authenticated;
grant execute on function public.get_explorer_follow_counts(uuid) to anon,authenticated;
grant execute on function public.get_explorer_social_feed(integer,integer) to authenticated;

revoke all on function guestbook_private.is_explorer(uuid) from public,anon,authenticated;
revoke all on function guestbook_private.social_content_owner(text,uuid) from public,anon,authenticated;
revoke all on function guestbook_private.enforce_social_rate_limit() from public,anon,authenticated;
revoke all on function guestbook_private.validate_social_target() from public,anon,authenticated;
revoke all on function guestbook_private.social_notification_trigger() from public,anon,authenticated;
