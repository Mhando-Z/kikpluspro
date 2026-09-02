# Domestic league expansion v1.10.0

KickPulse now supports three additional fixture and training codes:

| Code | Competition | TheStatsAPI ID | Special handling |
| --- | --- | --- | --- |
| `E1` | EFL Championship | `comp_8321` | Regular league stage |
| `B1` | Belgian Pro League | `comp_8531` | All stages discovered; only linked rows enriched |
| `SC0` | Scottish Premiership | `comp_6387` | All stages discovered; only linked rows enriched |

No new Supabase migration is required. Existing league fields are text columns.

## 1. Check provider coverage

Run this while `THESTATSAPI_KEY` is still configured:

```bash
npm run ai:leagues:coverage
```

This makes three inexpensive requests and reports latest-season coverage for
fixtures, team statistics, xG and odds. Do not assume that a competition-level
marketing page means every resource covers every historical season.

## 2. Import free canonical history

The season value is the starting year, so `2025` means 2025/26.

```bash
npm run ai:leagues:import:dry -- --seasons=2018,2019,2020,2021,2022,2023,2024,2025
npm run ai:leagues:import -- --seasons=2018,2019,2020,2021,2022,2023,2024,2025
```

The dry run must report non-zero completed matches for all three leagues. The
import is idempotent and stores the canonical rows that TheStatsAPI enrichment
must link against.

## 3. Sample and enrich

```bash
npm run ai:leagues:enrich:sample
npm run ai:leagues:enrich -- --seasons=2018,2019,2020,2021,2022,2023,2024,2025
```

The sample runs 25 linked matches per league. The full importer caches payloads
and can be resumed safely. It stores all discovered provider/team metadata but
does not call paid per-match endpoints for unlinked matches.

If the coverage report shows no odds or xG for a league-season, omit that
resource rather than repeatedly requesting unavailable data. Base results and
Football-Data odds remain sufficient for the hybrid model's fallback path.

## 4. Train the isolated expansion model

```bash
npm run ai:train:expansion:candidate -- --validation-season=2024 --test-season=2025
```

Review overall and per-league validation/test accuracy, log loss, Brier score,
goal MAE and the market benchmark. This artifact contains only `E1`, `B1` and
`SC0`; their data cannot change Big Five parameters or calibration.

After the candidate passes review, activate its returned version:

```bash
npm run ai:model:activate -- --model-key=domestic-expansion --version=1
npm run ai:fixtures:sync
```

Replace `1` if the candidate output reports another version. Alternatively,
`npm run ai:train:expansion` trains and automatically activates the first
expansion model when no active version exists. Until activation, fixture sync
retains expansion fixtures but skips their forecasts.

The legacy key `elo-poisson-global` is now reserved for the Big Five only. If an
eight-league candidate was activated before this release, restore the reviewed
Big Five version explicitly before syncing:

```bash
npm run ai:model:activate -- --model-key=elo-poisson-global --version=4
```

Version 4 predates competition-scope metadata, so the activation command
verifies its learned artifact leagues before switching it back on.

## 5. Reconcile club logos

Open `/admin`, enter `ADMIN_SYNC_KEY`, and run **Sync team assets**. The standard
asset job now includes Belgium and Scotland; England was already present. Team
crest failures remain visual fallbacks and never block model inference.

## Trial-independent operation

After the provider trial, remove `THESTATSAPI_KEY`. The imported enrichment
stays in Supabase. Historical/current domestic results and fixtures continue to
come from Football-Data.co.uk, and normal operation remains:

```bash
npm run ai:learn:daily
npm run ai:learn:weekly
```

The weekly command independently gates Big Five and expansion retraining. A
failure or regression in one family cannot replace the other family's active
artifact.
