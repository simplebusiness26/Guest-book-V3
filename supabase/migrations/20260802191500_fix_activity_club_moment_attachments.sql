create or replace function guestbook_private.validate_social_target()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor uuid;
  v_exists boolean:=false;
  v_owner uuid;
begin
  if tg_table_name='explorer_follows' then
    v_actor:=new.follower_id;
  elsif tg_table_name in ('explorer_moments','social_likes','social_comments') then
    v_actor:=new.user_id;
  elsif tg_table_name='social_reports' then
    v_actor:=new.reporter_id;
  else
    raise exception 'Unsupported social validation table: %',tg_table_name;
  end if;

  if not guestbook_private.is_explorer(v_actor) then
    raise exception 'Only Explorer accounts can use social features';
  end if;

  if tg_table_name='explorer_follows' then
    if new.follower_id=new.following_id then raise exception 'You cannot follow yourself'; end if;
    if not guestbook_private.is_explorer(new.following_id) then raise exception 'You can only follow Explorer accounts'; end if;
  elsif tg_table_name='explorer_moments' then
    if (new.target_type is null) <> (new.target_id is null) then raise exception 'Attached place type and id must be provided together'; end if;
    if new.target_type is not null then
      if new.target_type='business' then select exists(select 1 from public.businesses where id=new.target_id) into v_exists;
      elsif new.target_type='property' then select exists(select 1 from public.properties where id=new.target_id) into v_exists;
      elsif new.target_type='activity_club' then select exists(select 1 from public.activity_clubs where id=new.target_id and status in ('open','full')) into v_exists;
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

revoke all on function guestbook_private.validate_social_target() from public,anon,authenticated;
