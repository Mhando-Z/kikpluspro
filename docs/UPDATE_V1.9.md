# Upgrade to canonical team assets v1.9

Version 1.9 imports the API-Football team catalog into Supabase and permanently
links presentation assets to KickPulse canonical AI-team identities.

## What changed

- Five season-free `/teams?country=...` calls cover England, Spain, Italy,
  Germany and France, including promoted teams.
- One `/teams?league=2&season=2024` call adds the free-plan Champions League
  catalog.
- Every stored logo is canonicalized to
  `https://media.api-sports.io/football/teams/{team_id}.png`.
- Canonical AI-team keys are resolved before name matching.
- Admin health shows linked coverage and unresolved team identities.
- Cached catalogs can be reconciled again without making an API-Football call.

Logos remain presentation-only data. No model re-import or retraining is needed.

## Upgrade steps

1. Stop the Next.js development server.
2. Extract this ZIP over the existing project folder. Keep `.env.local` and
   `node_modules`; they are not included in the ZIP.
3. Run this file in Supabase SQL Editor:

```text
supabase/migrations/202609010003_team_assets.sql
```

`Success. No rows returned` is the expected SQL Editor result.

4. Replace the Supabase `api-football-sync` Edge Function editor contents with:

```text
supabase/functions/api-football-sync/index.js
```

Deploy it. Existing Edge Function secrets remain unchanged.

5. Verify and restart Next.js:

```bash
npm run check
npm run dev
```

6. Open `/admin`, enter `ADMIN_SYNC_KEY`, then click **Sync team assets**.

The first run normally uses six API calls. It imports the catalog, writes stable
team IDs and logo URLs to Supabase, and reconciles them to `ai_teams`.

## Reading the result

- `Catalog teams`: API-Football team rows cached in Supabase.
- `AI teams linked`: canonical model teams with an exact stored asset link.
- `Coverage`: linked AI teams divided by all AI teams.
- `Unresolved`: names that were not matched confidently and therefore still
  use their provider crest or initials fallback.

Use **Reconcile cached assets** after adding aliases or importing more AI teams.
This action does not call API-Football.

Do not schedule this daily. Run it after new clubs enter a supported competition
or roughly once per month.
