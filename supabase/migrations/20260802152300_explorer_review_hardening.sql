-- Moderation/deletion sync, media constraints and supporting indexes.

alter table public.review_media
  drop constraint if exists review_media_video_duration_required;

alter table public.review_media
  add constraint review_media_video_duration_required
  check (media_type <> 'video' or (
    duration_seconds is not null and duration_seconds > 0 and duration_seconds <= 30
  ));

update public.review_media video
set thumbnail_url=coalesce(
  (
    select image_media.media_url
    from public.review_media image_media
    where image_media.review_id=video.review_id
      and image_media.media_type='image'
      and image_media.moderation_status='published'
    order by image_media.sort_order,image_media.created_at
    limit 1
  ),
  review_row.target_image_url
)
from public.explorer_reviews review_row
where video.review_id=review_row.id
  and video.media_type='video'
  and nullif(trim(coalesce(video.thumbnail_url,'')),'') is null;

create or replace function public.sync_legacy_review_removal_to_explorer()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if pg_trigger_depth()=1 then
    delete from public.explorer_reviews where id=old.id;
  end if;
  return old;
end;
$$;

create or replace function public.sync_legacy_review_status_to_explorer()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if pg_trigger_depth()=1 then
    update public.explorer_reviews
    set status=case
      when new.moderation_status in ('published','pending','rejected','removed')
        then new.moderation_status
      else 'published'
    end
    where id=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_delete_unified on public.reviews;
create trigger reviews_delete_unified
after delete on public.reviews
for each row execute function public.sync_legacy_review_removal_to_explorer();

drop trigger if exists activity_reviews_delete_unified on public.activity_club_reviews;
create trigger activity_reviews_delete_unified
after delete on public.activity_club_reviews
for each row execute function public.sync_legacy_review_removal_to_explorer();

drop trigger if exists event_reviews_delete_unified on public.event_reviews;
create trigger event_reviews_delete_unified
after delete on public.event_reviews
for each row execute function public.sync_legacy_review_removal_to_explorer();

drop trigger if exists reviews_status_unified on public.reviews;
create trigger reviews_status_unified
after update of moderation_status on public.reviews
for each row execute function public.sync_legacy_review_status_to_explorer();

drop trigger if exists activity_reviews_status_unified on public.activity_club_reviews;
create trigger activity_reviews_status_unified
after update of moderation_status on public.activity_club_reviews
for each row execute function public.sync_legacy_review_status_to_explorer();

drop trigger if exists event_reviews_status_unified on public.event_reviews;
create trigger event_reviews_status_unified
after update of moderation_status on public.event_reviews
for each row execute function public.sync_legacy_review_status_to_explorer();

revoke all on function public.sync_legacy_review_removal_to_explorer() from public,anon,authenticated;
revoke all on function public.sync_legacy_review_status_to_explorer() from public,anon,authenticated;

create index if not exists event_reviews_event_created_idx on public.event_reviews(event_id,created_at desc);
create index if not exists event_reviews_user_created_idx on public.event_reviews(user_id,created_at desc);
create index if not exists listing_qr_codes_manager_idx on public.listing_qr_codes(manager_id);
create index if not exists qr_review_verifications_qr_idx on public.qr_review_verifications(qr_code_id);
create index if not exists qr_review_verifications_user_idx on public.qr_review_verifications(user_id,verified_at desc);
create index if not exists review_media_user_created_idx on public.review_media(user_id,created_at desc);

create index if not exists activity_announcements_author_idx on public.activity_announcements(author_id);
create index if not exists activity_session_rsvps_user_idx on public.activity_session_rsvps(user_id);
create index if not exists businesses_location_idx on public.businesses(location_id);
create index if not exists claims_business_idx on public.claims(business_id);
create index if not exists claims_property_idx on public.claims(property_id);
create index if not exists claims_user_idx on public.claims(user_id);
create index if not exists favourites_business_idx on public.favourites(business_id);
create index if not exists favourites_property_idx on public.favourites(property_id);
create index if not exists favourites_user_idx on public.favourites(user_id);
create index if not exists manager_subscriptions_manager_idx on public.manager_subscriptions(manager_id);
create index if not exists notifications_actor_idx on public.notifications(actor_user_id);
create index if not exists properties_location_idx on public.properties(location_id);
create index if not exists qr_codes_property_idx on public.qr_codes(property_id);
create index if not exists reviews_business_idx on public.reviews(business_id);
create index if not exists reviews_property_idx on public.reviews(property_id);
create index if not exists reviews_user_idx on public.reviews(user_id);

drop policy if exists review_media_storage_public_read on storage.objects;
