# Guestbook Agent Rules

GitHub is the source of truth. Replit is used to run and preview approved branches.

## Mandatory workflow

1. Start from the latest `main` branch.
2. Create a branch using one of these prefixes:
   - `feature/`
   - `fix/`
   - `ui/`
   - `database/`
   - `test/`
   - `setup/`
3. Work on one clearly defined task only.
4. Do not push directly to `main`.
5. Open a pull request and complete the pull-request checklist.
6. Wait for automated checks and review before merging.
7. Preview the approved branch in Replit before release.

## Safety rules

- Never commit passwords, private keys, service-role keys or access tokens.
- Never place a Supabase service-role key in the Expo app.
- Do not remove existing functionality unless the task explicitly requires it.
- Do not change database structure without a versioned SQL migration.
- UI agents must not alter authentication or RLS policies.
- Developer agents must not merge their own pull requests.
- Testing agents report `PASS`, `PASS WITH WARNINGS`, or `FAIL` with evidence.

## User feedback rules

- Every successful create, update, approval, rejection, removal or deletion must show a clear confirmation banner.
- Every failed data-changing action must show a clear error banner.
- Confirmation feedback must remain visible after navigation when an action redirects to another screen.
- Destructive actions must show an explicit confirmation dialog before the change and a result banner afterward.
- Use the shared `FeedbackContext` instead of creating inconsistent one-off success messages.
- Validation messages may still use local alerts when no data change has occurred.

## Required review areas

- Build and dependency checks
- Authentication and account-type permissions
- Listing ownership checks
- Supabase query safety
- Navigation and loading/error states
- Visible success/error feedback for all data changes
- Mobile and web preview behaviour
