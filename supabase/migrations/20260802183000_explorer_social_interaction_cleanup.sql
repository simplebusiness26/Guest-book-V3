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
  elsif tg_table_name='explorer_reviews' then
    delete from public.social_likes where target_type='review' and target_id=old.id;
    delete from public.social_comments where target_type='video_review' and target_id=old.id;
  elsif tg_table_name='social_comments' then
    delete from public.social_reports where target_type='comment' and target_id=old.id;
  end if;
  return old;
end;
$$;

revoke all on function guestbook_private.cleanup_social_interactions() from public,anon,authenticated;

drop trigger if exists explorer_moments_social_cleanup on public.explorer_moments;
create trigger explorer_moments_social_cleanup
after delete on public.explorer_moments
for each row execute function guestbook_private.cleanup_social_interactions();

drop trigger if exists explorer_reviews_social_cleanup on public.explorer_reviews;
create trigger explorer_reviews_social_cleanup
after delete on public.explorer_reviews
for each row execute function guestbook_private.cleanup_social_interactions();

drop trigger if exists social_comments_report_cleanup on public.social_comments;
create trigger social_comments_report_cleanup
after delete on public.social_comments
for each row execute function guestbook_private.cleanup_social_interactions();

create or replace function guestbook_private.cleanup_removed_social_content()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if old.status='published' and new.status='removed' then
    if tg_table_name='explorer_moments' then
      delete from public.social_likes where target_type='moment' and target_id=new.id;
      delete from public.social_comments where target_type='moment' and target_id=new.id;
      delete from public.social_reports where target_type='moment' and target_id=new.id;
    elsif tg_table_name='explorer_reviews' then
      delete from public.social_likes where target_type='review' and target_id=new.id;
      delete from public.social_comments where target_type='video_review' and target_id=new.id;
    elsif tg_table_name='social_comments' then
      delete from public.social_reports where target_type='comment' and target_id=new.id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function guestbook_private.cleanup_removed_social_content() from public,anon,authenticated;

drop trigger if exists explorer_moments_removed_social_cleanup on public.explorer_moments;
create trigger explorer_moments_removed_social_cleanup
after update of status on public.explorer_moments
for each row execute function guestbook_private.cleanup_removed_social_content();

drop trigger if exists explorer_reviews_removed_social_cleanup on public.explorer_reviews;
create trigger explorer_reviews_removed_social_cleanup
after update of status on public.explorer_reviews
for each row execute function guestbook_private.cleanup_removed_social_content();

drop trigger if exists social_comments_removed_report_cleanup on public.social_comments;
create trigger social_comments_removed_report_cleanup
after update of status on public.social_comments
for each row execute function guestbook_private.cleanup_removed_social_content();
