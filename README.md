
Guestbook is a travel discovery platform connecting Airbnb guests with local towns.

## Features

- Airbnb discovery
- Local business discovery
- Interactive maps
- Reviews
- QR code guest reviews
- Local recommendations

## Tech Stack

Frontend:
- React Native
- Expo

Backend:
- Supabase

Database:
- PostgreSQL

## Local Setup

1. Install the exact dependencies:

   ```bash
   npm ci
   ```

2. Copy `.env.example` to `.env`.
3. Add the Supabase project values:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=
   EXPO_PUBLIC_SUPABASE_ANON_KEY=
   ```

4. Start the app:

   ```bash
   npm start
   ```

Never commit `.env`. It is intentionally excluded by `.gitignore`.

## Verification

- Expo Doctor: 20/20 checks passed
- Clean dependency install: passed
- Production web export: passed

## Development Status

Guest-book V3 - Building MVP
