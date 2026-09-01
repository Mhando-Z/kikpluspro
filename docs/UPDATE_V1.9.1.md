# Team catalog upsert fix v1.9.1

API-Football can return the same venue more than once when several teams share
that venue. PostgreSQL does not allow one `INSERT ... ON CONFLICT DO UPDATE`
statement to update the same key twice, so the original v1.9.0 country catalog
jobs failed during venue normalization.

Version 1.9.1 deduplicates every normalized batch using its declared conflict
columns before writing it to Supabase. It also records the upstream HTTP status
and received-row count when normalization fails, making future diagnostics more
accurate.

## Apply the fix

No new SQL migration is required if
`202609010003_team_assets.sql` was already applied.

1. Open Supabase Dashboard → Edge Functions → `api-football-sync`.
2. Replace the function code with:

```text
supabase/functions/api-football-sync/index.js
```

3. Deploy the function.
4. Open KickPulse `/admin` and click **Sync team assets** once.
5. After it completes, click **Reconcile cached assets**.

Successful country jobs should show a positive `records_received` value and no
venue normalization error. Existing team records are updated rather than
duplicated.
