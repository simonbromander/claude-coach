# Deploy (Supabase + Vercel)

This app uses Supabase for plan storage and Vercel for hosting.

## Requirements

- Node.js 18+
- Supabase CLI (`supabase`)
- Vercel CLI (`vercel`)

## Supabase Setup

1. Log in to Supabase:
   - `supabase login`
2. Create a project:
   - `supabase projects create claude-coach`
3. Link the local repo to the project:
   - `supabase link --project-ref <project-ref>`
4. Push the schema:
   - `supabase db push`

Grab the **Project URL** and **Service Role Key** from the Supabase dashboard.

## Strava Setup

Create a Strava app and set the callback **domain** to your app host (for Vercel: `claude-coach.vercel.app`). Strava requires the callback field to be just a domain (no path). The app uses `PUBLIC_APP_URL/api/strava/callback` internally.

## Vercel Setup

1. Log in to Vercel:
   - `vercel login`
2. Create/link the project:
   - `vercel`
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PUBLIC_APP_URL`
   - `BUILDER_ACCESS_SECRET`
   - `ANTHROPIC_API_KEY`
   - `ANTHROPIC_MODEL`
   - `ANTHROPIC_TIMEOUT_MS` (default 55000)
   - `ANTHROPIC_MAX_TOKENS` (default 8000)
   - `ANTHROPIC_REPAIR_MAX_TOKENS` (default 4000)
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
   - `STRAVA_ACCESS_TOKEN` (optional seed)
   - `STRAVA_REFRESH_TOKEN` (optional seed)
   - `STRAVA_SYNC_DAYS` (default 730)
   - `STRAVA_MAX_ACTIVITIES` (default 1500)
4. Deploy:
   - `vercel --prod`

## Local Development

Create a `.env` file with:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
PUBLIC_APP_URL=http://localhost:5173
BUILDER_ACCESS_SECRET=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-opus-4-20250514
ANTHROPIC_TIMEOUT_MS=55000
ANTHROPIC_MAX_TOKENS=8000
ANTHROPIC_REPAIR_MAX_TOKENS=4000
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
STRAVA_ACCESS_TOKEN=...
STRAVA_REFRESH_TOKEN=...
STRAVA_SYNC_DAYS=730
STRAVA_MAX_ACTIVITIES=1500
```

Run the app:

```
npm run dev:app
```
