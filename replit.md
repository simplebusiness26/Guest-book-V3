# Guestbook

A travel discovery platform connecting Airbnb guests with local towns.

## Stack

- **Frontend:** React Native + Expo (Expo Router, file-based routing)
- **Backend:** Supabase (auth, database, storage)
- **Database:** PostgreSQL (schema in `database/schema.sql`)

## How to run

The app runs as a web preview using Expo's Metro bundler:

```
BROWSER=none npx expo start --web --port 5000
```

The `Start application` workflow handles this automatically.

## Project structure

```
app/           Expo Router screens (file-based routes)
  auth/        Login, signup, verify
  business/    Business owner dashboard
  property/    Property owner dashboard
  admin/       Admin claims review
components/    Shared UI components
hooks/         Custom React hooks (useColors)
services/      Supabase client (supabase.js)
utils/         Helpers (QR code, location)
database/      SQL schema
```

## Supabase

Credentials are hardcoded in `services/supabase.js`. The `.env` file
(`SUPABASE_URL`, `SUPABASE_KEY`) is present but unused by the app code.

## User preferences

- Keep existing project structure and stack.
