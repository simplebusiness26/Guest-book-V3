create or replace function public.get_explorer_follow_counts(p_user_id uuid)
returns table(follower_count bigint,following_count bigint,moment_count bigint)
language sql
stable
security invoker
set search_path=public,pg_temp
as $$
  select
    (select count(*) from public.explorer_follows where following_id=p_user_id),
    (select count(*) from public.explorer_follows where follower_id=p_user_id),
    (select count(*) from public.explorer_moments where user_id=p_user_id and status='published');
$$;

revoke all on function public.get_explorer_follow_counts(uuid) from public,anon;
grant execute on function public.get_explorer_follow_counts(uuid) to authenticated;

create or replace function public.get_explorer_social_feed(p_limit integer default 20,p_offset integer default 0)
returns table(
  item_id uuid,item_type text,actor_id uuid,actor_name text,actor_photo text,created_at timestamptz,
  caption text,rating integer,verified_qr boolean,target_type text,target_id uuid,target_name text,target_image_url text,
  media_type text,media_url text,thumbnail_url text,duration_seconds numeric,like_count bigint,comment_count bigint,viewer_liked boolean
)
language sql
stable
security invoker
set search_path=public,pg_temp
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
    select er.id,'review'::text,er.user_id,p.full_name,p.profile_photo,er.created_at,
      coalesce(nullif(er.title,''),er.comment),er.rating,er.verified_qr,er.target_type,er.target_id,er.target_name,er.target_image_url,
      rm.media_type,rm.media_url,rm.thumbnail_url,rm.duration_seconds,
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
    select ef.id,'favourite'::text,ef.user_id,p.full_name,p.profile_photo,ef.created_at,
      'Saved '||ef.target_name||' as a favourite place.'::text,null::integer,false,ef.target_type,ef.target_id,ef.target_name,ef.target_image_url,
      case when ef.target_image_url is not null then 'image' else null end,ef.target_image_url,null::text,null::numeric,
      0::bigint,0::bigint,false
    from public.explorer_favourites ef join people pe on pe.user_id=ef.user_id join public.profiles p on p.id=ef.user_id
    where ef.is_public=true
  )
  select * from (
    select * from moments union all select * from reviews union all select * from favourites
  ) feed
  order by created_at desc
  limit greatest(1,least(coalesce(p_limit,20),50)) offset greatest(coalesce(p_offset,0),0);
$$;

revoke all on function public.get_explorer_social_feed(integer,integer) from public,anon;
grant execute on function public.get_explorer_social_feed(integer,integer) to authenticated;
