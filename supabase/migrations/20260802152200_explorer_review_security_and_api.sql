-- Public profile statistics, leaderboards, verified QR APIs and RLS.

create or replace view public.explorer_profile_stats
with (security_invoker=true)
as
select
  p.id as user_id,
  p.full_name,
  p.profile_photo,
  case when p.show_area then nullif(trim(p.area),'') end as display_area,
  p.show_area,
  p.leaderboard_opt_in,
  count(er.id) filter(where er.status='published')::integer as review_count,
  coalesce(round(avg(er.rating) filter(where er.status='published')::numeric,2),0) as average_rating_given,
  count(er.id) filter(where er.status='published' and er.verified_qr)::integer as verified_review_count,
  count(er.id) filter(where er.status='published' and exists(
    select 1 from public.review_media m
    where m.review_id=er.id and m.media_type='video' and m.moderation_status='published'
  ))::integer as video_review_count,
  count(er.id) filter(where er.status='published' and exists(
    select 1 from public.review_media m
    where m.review_id=er.id and m.media_type='image' and m.moderation_status='published'
  ))::integer as image_review_count,
  coalesce(sum(er.points_awarded) filter(where er.status='published'),0)::integer as total_points
from public.profiles p
left join public.explorer_reviews er on er.user_id=p.id
group by p.id,p.full_name,p.profile_photo,p.show_area,p.area,p.leaderboard_opt_in;

create or replace function public.get_explorer_leaderboard(
  p_period text default 'weekly',
  p_scope text default 'national',
  p_area text default null,
  p_limit integer default 50
)
returns table(
  rank bigint,user_id uuid,full_name text,profile_photo text,area text,
  points bigint,review_count bigint,verified_reviews bigint,video_reviews bigint
)
language sql
stable
security invoker
set search_path=public
as $$
with settings as (
  select case when lower(p_period)='monthly'
    then date_trunc('month',now()) else date_trunc('week',now()) end as starts_at
), totals as (
  select
    p.id as user_id,coalesce(p.full_name,'Explorer') as full_name,p.profile_photo,
    case when p.show_area then nullif(trim(p.area),'') end as area,
    sum(er.points_awarded)::bigint as points,
    count(er.id)::bigint as review_count,
    count(er.id) filter(where er.verified_qr)::bigint as verified_reviews,
    count(er.id) filter(where exists(
      select 1 from public.review_media rm
      where rm.review_id=er.id and rm.media_type='video' and rm.moderation_status='published'
    ))::bigint as video_reviews
  from public.explorer_reviews er
  join public.profiles p on p.id=er.user_id
  cross join settings s
  where er.status='published' and er.points_awarded>0 and er.created_at>=s.starts_at
    and p.leaderboard_opt_in and coalesce(p.email,'') not ilike '%@test.com'
    and (
      lower(p_scope)<>'local'
      or (p.show_area and nullif(trim(p.area),'') is not null
        and lower(trim(p.area))=lower(trim(coalesce(p_area,''))))
    )
  group by p.id,p.full_name,p.profile_photo,p.show_area,p.area
), ranked as (
  select dense_rank() over(order by points desc,verified_reviews desc,video_reviews desc,user_id) as rank,*
  from totals
)
select rank,user_id,full_name,profile_photo,area,points,review_count,verified_reviews,video_reviews
from ranked order by rank,user_id
limit greatest(1,least(coalesce(p_limit,50),100));
$$;

create or replace function public.listing_is_managed_by_user(
  p_user_id uuid,p_target_type text,p_target_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path=public
as $$
select case p_target_type
  when 'business' then exists(select 1 from public.businesses where id=p_target_id and owner_id=p_user_id)
  when 'property' then exists(select 1 from public.properties where id=p_target_id and owner_id=p_user_id)
  when 'activity_club' then exists(select 1 from public.activity_clubs where id=p_target_id and manager_id=p_user_id)
  when 'event' then exists(select 1 from public.events where id=p_target_id and manager_id=p_user_id)
  else false
end;
$$;

create or replace function public.ensure_listing_qr_code(p_target_type text,p_target_id uuid)
returns table(code text,target_type text,target_id uuid)
language plpgsql
security invoker
set search_path=public
as $$
declare
  normalized_type text;
  generated_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  normalized_type=case when p_target_type='activity' then 'activity_club' else p_target_type end;
  if not public.listing_is_managed_by_user(auth.uid(),normalized_type,p_target_id) then
    raise exception 'You do not manage this listing.';
  end if;

  select q.code into generated_code from public.listing_qr_codes q
  where q.target_type=normalized_type and q.target_id=p_target_id;

  if generated_code is null then
    generated_code=replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into public.listing_qr_codes(manager_id,target_type,target_id,code,active)
    values(auth.uid(),normalized_type,p_target_id,generated_code,true)
    on conflict on constraint listing_qr_codes_target_type_target_id_key do update
      set manager_id=auth.uid(),active=true
    returning listing_qr_codes.code into generated_code;
  else
    update public.listing_qr_codes q set manager_id=auth.uid(),active=true
      where q.target_type=normalized_type and q.target_id=p_target_id;
  end if;

  return query select generated_code,normalized_type,p_target_id;
end;
$$;

create or replace function public.resolve_listing_qr_code(p_code text)
returns table(target_type text,target_id uuid)
language sql
stable
security definer
set search_path=public
as $$
select q.target_type,q.target_id
from public.listing_qr_codes q
where q.code=p_code and q.active
limit 1;
$$;

create or replace function public.verify_explorer_review_qr(p_review_id uuid,p_code text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  review_row public.explorer_reviews%rowtype;
  code_row public.listing_qr_codes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into review_row from public.explorer_reviews
  where id=p_review_id and user_id=auth.uid();
  if not found then raise exception 'Review not found.'; end if;

  select * into code_row from public.listing_qr_codes where code=p_code and active;
  if not found then raise exception 'This QR code is not valid.'; end if;
  if code_row.target_type<>review_row.target_type or code_row.target_id<>review_row.target_id then
    raise exception 'This QR code belongs to a different listing.';
  end if;

  insert into public.qr_review_verifications(review_id,user_id,qr_code_id)
  values(review_row.id,review_row.user_id,code_row.id)
  on conflict(review_id) do nothing;

  update public.explorer_reviews set verified_qr=true where id=review_row.id;
  return jsonb_build_object('verified',true,'review_id',review_row.id,'points_bonus',3);
end;
$$;

alter table public.explorer_reviews enable row level security;
alter table public.review_media enable row level security;
alter table public.review_point_events enable row level security;
alter table public.explorer_favourites enable row level security;
alter table public.listing_qr_codes enable row level security;
alter table public.qr_review_verifications enable row level security;
alter table public.event_reviews enable row level security;

drop policy if exists explorer_reviews_public_read on public.explorer_reviews;
create policy explorer_reviews_public_read on public.explorer_reviews
for select using(status='published' or user_id=(select auth.uid()));
drop policy if exists explorer_reviews_insert_own on public.explorer_reviews;
create policy explorer_reviews_insert_own on public.explorer_reviews
for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists explorer_reviews_update_own on public.explorer_reviews;
create policy explorer_reviews_update_own on public.explorer_reviews
for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists explorer_reviews_delete_own on public.explorer_reviews;
create policy explorer_reviews_delete_own on public.explorer_reviews
for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists review_media_public_read on public.review_media;
create policy review_media_public_read on public.review_media
for select using(exists(
  select 1 from public.explorer_reviews er
  where er.id=review_id and (er.status='published' or er.user_id=(select auth.uid()))
));
drop policy if exists review_media_insert_own on public.review_media;
create policy review_media_insert_own on public.review_media
for insert to authenticated with check(
  user_id=(select auth.uid()) and exists(
    select 1 from public.explorer_reviews er
    where er.id=review_id and er.user_id=(select auth.uid())
  )
);
drop policy if exists review_media_update_own on public.review_media;
create policy review_media_update_own on public.review_media
for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists review_media_delete_own on public.review_media;
create policy review_media_delete_own on public.review_media
for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists review_point_events_read_own on public.review_point_events;
create policy review_point_events_read_own on public.review_point_events
for select to authenticated using(user_id=(select auth.uid()));

drop policy if exists explorer_favourites_public_read on public.explorer_favourites;
create policy explorer_favourites_public_read on public.explorer_favourites
for select using(is_public or user_id=(select auth.uid()));
drop policy if exists explorer_favourites_insert_own on public.explorer_favourites;
create policy explorer_favourites_insert_own on public.explorer_favourites
for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists explorer_favourites_update_own on public.explorer_favourites;
create policy explorer_favourites_update_own on public.explorer_favourites
for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists explorer_favourites_delete_own on public.explorer_favourites;
create policy explorer_favourites_delete_own on public.explorer_favourites
for delete to authenticated using(user_id=(select auth.uid()));

drop policy if exists event_reviews_public_read on public.event_reviews;
create policy event_reviews_public_read on public.event_reviews
for select using(moderation_status='published' or user_id=(select auth.uid()));

drop policy if exists listing_qr_codes_manager_read on public.listing_qr_codes;
create policy listing_qr_codes_manager_read on public.listing_qr_codes
for select to authenticated
using(public.listing_is_managed_by_user((select auth.uid()),target_type,target_id));
drop policy if exists listing_qr_codes_manager_insert on public.listing_qr_codes;
create policy listing_qr_codes_manager_insert on public.listing_qr_codes
for insert to authenticated with check(
  manager_id=(select auth.uid())
  and public.listing_is_managed_by_user((select auth.uid()),target_type,target_id)
);
drop policy if exists listing_qr_codes_manager_update on public.listing_qr_codes;
create policy listing_qr_codes_manager_update on public.listing_qr_codes
for update to authenticated
using(public.listing_is_managed_by_user((select auth.uid()),target_type,target_id))
with check(
  manager_id=(select auth.uid())
  and public.listing_is_managed_by_user((select auth.uid()),target_type,target_id)
);
drop policy if exists listing_qr_codes_manager_delete on public.listing_qr_codes;
create policy listing_qr_codes_manager_delete on public.listing_qr_codes
for delete to authenticated
using(public.listing_is_managed_by_user((select auth.uid()),target_type,target_id));

drop policy if exists qr_review_verifications_read_own on public.qr_review_verifications;
create policy qr_review_verifications_read_own on public.qr_review_verifications
for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists qr_review_verifications_insert_own on public.qr_review_verifications;
create policy qr_review_verifications_insert_own on public.qr_review_verifications
for insert to authenticated with check(
  user_id=(select auth.uid()) and exists(
    select 1 from public.explorer_reviews er
    join public.listing_qr_codes qr
      on qr.id=qr_code_id and qr.target_type=er.target_type
     and qr.target_id=er.target_id and qr.active
    where er.id=review_id and er.user_id=(select auth.uid())
  )
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'review-media','review-media',true,52428800,
  array['image/jpeg','image/png','image/webp','video/mp4','video/quicktime','video/webm']
)
on conflict(id) do update set
  public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists review_media_storage_insert_own on storage.objects;
create policy review_media_storage_insert_own on storage.objects
for insert to authenticated with check(
  bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists review_media_storage_update_own on storage.objects;
create policy review_media_storage_update_own on storage.objects
for update to authenticated
using(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists review_media_storage_delete_own on storage.objects;
create policy review_media_storage_delete_own on storage.objects
for delete to authenticated
using(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

grant select on public.explorer_reviews,public.review_media,public.explorer_profile_stats,
  public.explorer_favourites,public.event_reviews to anon,authenticated;
grant insert,update,delete on public.explorer_reviews,public.review_media,public.explorer_favourites to authenticated;
grant select on public.review_point_events,public.qr_review_verifications to authenticated;
grant select,insert,update,delete on public.listing_qr_codes to authenticated;

revoke all on function public.get_explorer_leaderboard(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.get_explorer_leaderboard(text,text,text,integer) to authenticated;
revoke all on function public.listing_is_managed_by_user(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.listing_is_managed_by_user(uuid,text,uuid) to authenticated;
revoke all on function public.ensure_listing_qr_code(text,uuid) from public,anon,authenticated;
grant execute on function public.ensure_listing_qr_code(text,uuid) to authenticated;
revoke all on function public.resolve_listing_qr_code(text) from public,anon,authenticated;
grant execute on function public.resolve_listing_qr_code(text) to anon,authenticated;
revoke all on function public.verify_explorer_review_qr(uuid,text) from public,anon,authenticated;
grant execute on function public.verify_explorer_review_qr(uuid,text) to authenticated;
