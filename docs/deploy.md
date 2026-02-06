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

## Vercel Setup

1. Log in to Vercel:
   - `vercel login`
2. Create/link the project:
   - `vercel`
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy:
   - `vercel --prod`

## Local Development

Create a `.env` file with:

```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Run the app:

```
npm run dev:app
```
