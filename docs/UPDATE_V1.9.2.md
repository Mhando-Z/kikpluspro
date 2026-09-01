# Team asset reconciliation fix v1.9.2

The API-Football catalog import already succeeded. Version 1.9.2 fixes the
next, local reconciliation step.

## What was fixed

- Existing `ai_teams.api_football_team_id` links are reserved before an
  unlinked historical alias can claim the same API-Football team ID.
- Duplicate aliases remain unresolved instead of causing the unique-index
  failure that stopped the whole reconciliation run.
- Real database constraint errors are no longer replaced with the misleading
  `Apply 202609010003_team_assets.sql` message. That setup message now appears
  only when the required columns are genuinely missing.

## Upgrade steps

1. Replace the application source with v1.9.2 while keeping `.env.local`.
2. Restart the Next.js development server. For production, rebuild and restart
   the application.
3. Open `/admin`, enter `ADMIN_SYNC_KEY`, and click **Reconcile cached assets**.

Do not click **Sync team assets** again: the 5,577 cached catalog teams are
already stored in Supabase. This fix needs no SQL migration, Edge Function
redeployment, API-Football calls, or model retraining.

## Verification query

```sql
select
  count(*) as total_ai_teams,
  count(*) filter (
    where api_football_team_id is not null and logo_url is not null
  ) as linked_teams,
  count(*) filter (
    where api_football_team_id is null or logo_url is null
  ) as unresolved_teams
from public.ai_teams;
```
