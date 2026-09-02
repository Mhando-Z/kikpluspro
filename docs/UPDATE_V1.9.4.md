# La Liga active-logo aliases v1.9.4

Version 1.9.4 adds two exact, country-guarded team-name aliases:

- `Celta` → `Celta Vigo`
- `La Coruna` → `Deportivo La Coruna`

Both API-Football teams are already present in the cached Spanish catalog.
This update requires no API calls, SQL migration, Edge Function deployment or
AI retraining.

## Upgrade and run

1. Replace the application files while preserving `.env.local`.
2. Restart Next.js.
3. Open `/admin`, enter `ADMIN_SYNC_KEY`, and click **Reconcile cached assets**.

Do not click either catalog-sync button for this repair.

## Verify active fixtures

```sql
with active_team_keys as (
  select home_team_key as canonical_key
  from public.ai_fixtures
  where kickoff_at >= now() - interval '1 day'
    and status in ('scheduled', 'postponed')

  union

  select away_team_key
  from public.ai_fixtures
  where kickoff_at >= now() - interval '1 day'
    and status in ('scheduled', 'postponed')
)
select t.canonical_key, t.display_name, t.country_code
from active_team_keys a
join public.ai_teams t using (canonical_key)
where t.logo_url is null
order by t.country_code, t.display_name;
```
