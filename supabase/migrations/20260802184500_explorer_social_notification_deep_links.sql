create or replace function guestbook_private.social_notification_trigger()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_actor_name text;
  v_actor_id uuid;
  v_owner uuid;
  v_deep_link text;
  v_message text;
  v_review_target_type text;
  v_review_target_id uuid;
  v_has_video boolean:=false;
begin
  if tg_table_name='explorer_follows' then v_actor_id:=new.follower_id;
  else v_actor_id:=new.user_id;
  end if;

  select coalesce(nullif(btrim(full_name),''),'An Explorer') into v_actor_name
  from public.profiles where id=v_actor_id;

  if tg_table_name='explorer_follows' then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    values(new.following_id,new.follower_id,'social_follow','New follower',v_actor_name||' started following you.','profile',new.follower_id,'/profile/'||new.follower_id,jsonb_build_object('category','social','social_type','follow'),'social-follow-'||new.id);

  elsif tg_table_name='explorer_moments' then
    insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
    select f.follower_id,new.user_id,'social_moment','New Moment',v_actor_name||' shared a new Moment.','moment',new.id,'/moments/'||new.id,jsonb_build_object('category','social','social_type','moment'),'social-moment-'||new.id||'-'||f.follower_id
    from public.explorer_follows f
    where f.following_id=new.user_id and f.follower_id<>new.user_id;

  elsif tg_table_name='social_likes' then
    v_owner:=guestbook_private.social_content_owner(new.target_type,new.target_id);
    if v_owner is not null and v_owner<>new.user_id then
      if new.target_type='moment' then
        v_deep_link:='/moments/'||new.target_id;
      else
        select target_type,target_id into v_review_target_type,v_review_target_id
        from public.explorer_reviews where id=new.target_id;
        select exists(select 1 from public.review_media where review_id=new.target_id and media_type='video' and moderation_status='published') into v_has_video;
        if v_has_video then
          v_deep_link:='/social-comments/'||new.target_id;
        elsif v_review_target_type='business' then v_deep_link:='/business/'||v_review_target_id;
        elsif v_review_target_type='property' then v_deep_link:='/property/'||v_review_target_id;
        elsif v_review_target_type='activity_club' then v_deep_link:='/activity-clubs/'||v_review_target_id;
        elsif v_review_target_type='event' then v_deep_link:='/events/'||v_review_target_id;
        else v_deep_link:='/profile/'||v_owner;
        end if;
      end if;

      v_message:=v_actor_name||' liked your '||case when new.target_type='moment' then 'Moment.' else 'review.' end;
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      values(v_owner,new.user_id,'social_like','New like',v_message,new.target_type,new.target_id,v_deep_link,jsonb_build_object('category','social','social_type','like','content_type',new.target_type),'social-like-'||new.id);
    end if;

  elsif tg_table_name='social_comments' then
    v_owner:=guestbook_private.social_content_owner(new.target_type,new.target_id);
    if v_owner is not null and v_owner<>new.user_id then
      v_deep_link:=case when new.target_type='moment' then '/moments/'||new.target_id else '/social-comments/'||new.target_id end;
      insert into public.notifications(recipient_user_id,actor_user_id,type,title,message,entity_type,entity_id,deep_link,data,dedupe_key)
      values(v_owner,new.user_id,'social_comment','New comment',v_actor_name||' commented on your '||case when new.target_type='moment' then 'Moment.' else 'video review.' end,new.target_type,new.target_id,v_deep_link,jsonb_build_object('category','social','social_type','comment','content_type',new.target_type),'social-comment-'||new.id);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function guestbook_private.social_notification_trigger() from public,anon,authenticated;

create or replace function guestbook_private.cleanup_social_interactions()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_table_name='explorer_moments' then
    delete from public.social_likes where target_type='moment' and target_id=old.id;
    delete from public.social_comments where target_type='moment' and target_id=old.id;
    delete from public.social_reports where target_type='moment' and target_id=old.id;
    delete from public.notifications where entity_type='moment' and entity_id=old.id and type like 'social_%';
  elsif tg_table_name='explorer_reviews' then
    delete from public.social_likes where target_type='review' and target_id=old.id;
    delete from public.social_comments where target_type='video_review' and target_id=old.id;
    delete from public.notifications where entity_id=old.id and entity_type in ('review','video_review') and type like 'social_%';
  elsif tg_table_name='social_comments' then
    delete from public.social_reports where target_type='comment' and target_id=old.id;
  end if;
  return old;
end;
$$;

revoke all on function guestbook_private.cleanup_social_interactions() from public,anon,authenticated;
