# Explorer Social Layer — Development Checkpoint

Branch: `feature/events-mvp`

## Completed

- Applied Supabase migration `explorer_social_layer`.
- Added protected social tables with RLS:
  - `explorer_follows`
  - `explorer_moments`
  - `social_likes`
  - `social_comments`
  - `social_reports`
- Added a protected `social-media` storage bucket.
- Added follow counts and social feed database functions.
- Added server-side validation, rate limiting and social notification triggers.
- Added notifications for follows, Moments, likes and comments.
- Added ownership-aware comment deletion and reporting controls.

## Original compatibility test failure

The open-ended trigger compatibility test was stopped. Its first isolated replacement test exposed this database error:

`record "new" has no field "user_id"`

Cause: one shared trigger function used `coalesce(NEW.user_id, NEW.follower_id, NEW.reporter_id)`. PostgreSQL trigger records cannot safely access a column that does not exist on the current table.

## Fixes applied

1. `fix_social_trigger_record_compatibility`
   - Selects the actor column by `TG_TABLE_NAME`.
   - Fixes rate-limit, validation and notification trigger compatibility.

2. `fix_social_video_comment_target`
   - Aligns the comment validator with the table value `video_review`.
   - Keeps comments restricted to published reviews containing a published video.

## Time-limited regression evidence

Every replacement test used `statement_timeout = '5s'` and a transaction ending in `ROLLBACK`.

- Follow insert: passed.
- Follow notification: passed.
- Moment insert: passed.
- New-Moment follower notification: passed.
- Moment feed visibility: passed.
- Review like: passed.
- Like notification: passed.
- Video-review comment: passed.
- Comment notification: passed.
- Comment report: passed.
- No test rows remained after rollback.

## Remaining work

- Save the complete final social schema as a repository migration.
- Build follow/unfollow UI and follower/following lists.
- Build Explorer feed UI.
- Build Moment creation, detail, deletion and reporting screens.
- Build like and comment controls.
- Upgrade Explorer profiles with follow counts, follow button, Moments and activity.
- Categorise social notifications in the notification centre.
- Run Expo build, database integrity tests, RLS tests, storage tests and mobile user-flow tests.
- Keep the branch unmerged until Craig approves it.
