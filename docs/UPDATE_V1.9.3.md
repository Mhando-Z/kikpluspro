# Active UCL team-logo repair v1.9.3

Version 1.9.3 focuses on the 16 unresolved teams used by current fixtures.

## Changes

- Adds guarded country hints for UCL rows stored under the generic `europe`
  country code.
- Adds observed aliases including Feyenoord Rotterdam and LASK.
- Lets duplicate historical canonical identities inherit a resolved logo while
  keeping `api_football_team_id` unique.
- Separates **logo coverage** from **API ID links** in the admin report.
- Adds a five-call targeted catalog import for Greece, Portugal, Austria,
  Azerbaijan and Norway.
- Normalizes `rus`, `blr` and `mda` country abbreviations.

Logos remain presentation data and are never used as model features.

## Upgrade and run

1. Replace the application files while preserving `.env.local`.
2. Restart Next.js.
3. Open `/admin` and enter `ADMIN_SYNC_KEY`.
4. Click **Sync missing UCL teams** once. It makes five API-Football calls and
   automatically reconciles the expanded catalog.
5. Click the health refresh icon to inspect logo coverage.

No SQL migration, Edge Function redeployment or AI retraining is required.

After the targeted import succeeds, use this presentation-focused query:

```sql
select
  count(*) as total_ai_teams,
  count(*) filter (where logo_url is not null) as logos_resolved,
  count(*) filter (where api_football_team_id is not null) as api_ids_linked,
  count(*) filter (where logo_url is null) as teams_needing_logo
from public.ai_teams;
```
