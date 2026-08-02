-- Explorer profile, media review and points foundation.
-- Applied to the Guestbook Supabase project on 2026-08-02.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists area text,
  add column if not exists show_area boolean not null default false,
  add column if not exists leaderboard_opt_in boolean not null default true;

alter table public.reviews
  add column if not exists review_title text not null default '',
  add column if not exists video_url text,
  add column if not exists video_thumbnail_url text,
  add column if not exists verified_qr boolean not null default false,
  add column if not exists points_awarded integer not null default 0,
  add column if not exists moderation_status text not null default 'published';

alter table public.activity_club_reviews
  add column if not exists review_title text not null default '',
  add column if not exists photos text[] not null default '{}',
  add column if not exists video_url text,
  add column if not exists video_thumbnail_url text,
  add column if not exists verified_qr boolean not null default false,
  add column if not exists points_awarded integer not null default 0,
  add column if not exists moderation_status text not null default 'published';

create table if not exists public.event_reviews (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_name text not null default 'Explorer',
  rating integer not null check (rating between 1 and 5),
  review_title text not null default '',
  comment text not null default '',
  photos text[] not null default '{}',
  video_url text,
  video_thumbnail_url text,
  verified_qr boolean not null default false,
  points_awarded integer not null default 0,
  moderation_status text not null default 'published' check (moderation_status in ('published','pending','rejected','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.explorer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('business','property','activity_club','event')),
  target_id uuid not null,
  target_name text not null default '',
  target_image_url text,
  rating integer not null check (rating between 1 and 5),
  title text not null default '',
  comment text not null default '',
  verified_qr boolean not null default false,
  status text not null default 'published' check (status in ('published','pending','rejected','removed')),
  points_eligible boolean not null default true,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  legacy_source text,
  legacy_review_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists explorer_reviews_legacy_unique
  on public.explorer_reviews(legacy_source,legacy_review_id)
  where legacy_source is not null and legacy_review_id is not null;
create index if not exists explorer_reviews_user_created_idx on public.explorer_reviews(user_id,created_at desc);
create index if not exists explorer_reviews_target_idx on public.explorer_reviews(target_type,target_id,created_at desc);
create index if not exists explorer_reviews_leaderboard_idx on public.explorer_reviews(status,points_eligible,created_at desc);

create table if not exists public.review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.explorer_reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_type text not null check (media_type in ('image','video')),
  media_url text not null,
  thumbnail_url text,
  duration_seconds numeric,
  sort_order integer not null default 0,
  moderation_status text not null default 'published' check (moderation_status in ('published','pending','rejected','removed')),
  created_at timestamptz not null default now(),
  check (duration_seconds is null or duration_seconds >= 0),
  check (media_type <> 'video' or duration_seconds is null or duration_seconds <= 30)
);

create index if not exists review_media_review_idx on public.review_media(review_id,sort_order);
create unique index if not exists review_media_one_video_idx
  on public.review_media(review_id)
  where media_type='video' and moderation_status not in ('rejected','removed');

create table if not exists public.review_point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  review_id uuid not null references public.explorer_reviews(id) on delete cascade,
  event_key text not null check (event_key in ('content','qr')),
  reason text not null check (reason in ('text_review','image_review','video_review','verified_qr')),
  points integer not null check (points in (1,3,6)),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(review_id,event_key)
);

create index if not exists review_point_events_user_created_idx on public.review_point_events(user_id,created_at desc) where active;

create table if not exists public.explorer_favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('business','property','activity_club','event')),
  target_id uuid not null,
  target_name text not null,
  target_image_url text,
  sort_order integer not null default 0,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  unique(user_id,target_type,target_id)
);

create index if not exists explorer_favourites_user_idx on public.explorer_favourites(user_id,sort_order,created_at desc);

create table if not exists public.listing_qr_codes (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('business','property','activity_club','event')),
  target_id uuid not null,
  code text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(target_type,target_id)
);

create table if not exists public.qr_review_verifications (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.explorer_reviews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  qr_code_id uuid not null references public.listing_qr_codes(id) on delete cascade,
  verified_at timestamptz not null default now()
);
