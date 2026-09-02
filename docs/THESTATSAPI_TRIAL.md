# TheStatsAPI trial enrichment

TheStatsAPI is a temporary historical teacher and the preferred current UCL
feed while the trial key is present. KickPulse permanently stores useful
payloads in Supabase, but production inference remains independent of a paid
subscription.

## Retained data

- Provider competition, season, team and match identifiers plus team crests
- Raw endpoint payloads for audit and future feature engineering
- Match xG and non-penalty xG
- Shots, shots on target, big chances and penalty-area touches
- Final-third entries, possession and goalkeeper goals prevented
- Corners, fouls, yellow cards and red cards
- Opening and last-seen 1X2 prices when available
- Optional player stats, lineups, shotmaps, timelines and referee payloads

Confirm that your agreement permits the intended retention and model-training
use before running a large backfill.

## Setup

Apply the sustainable-learning migration. For Champions League use, also apply
both UCL migrations, ending with:

```text
supabase/migrations/202609010002_thestatsapi_ucl.sql
```

Add server-only configuration to `.env.local`:

```bash
THESTATSAPI_KEY=your-key
THESTATSAPI_BASE_URL=https://api.thestatsapi.com/api
THESTATSAPI_REQUESTS_PER_MINUTE=220
THESTATSAPI_MAX_REQUESTS_PER_RUN=45000
```

Never prefix the provider key with `NEXT_PUBLIC_`. The request rate leaves
headroom below the stated 300/minute limit; the run budget leaves headroom below
the stated 50,000-call allowance and counts retry attempts.

## Safe domestic import

```bash
npm run ai:enrich:sample -- --seasons=2024 --leagues=E0
npm run ai:enrich -- --seasons=2022,2023,2024,2025 --leagues=E0,SP1,I1,D1,F1 --resources=stats,odds
```

For the first domestic expansion:

```bash
npm run ai:leagues:coverage
npm run ai:leagues:import:dry -- --seasons=2018,2019,2020,2021,2022,2023,2024,2025
npm run ai:leagues:import -- --seasons=2018,2019,2020,2021,2022,2023,2024,2025
npm run ai:leagues:enrich:sample
npm run ai:leagues:enrich -- --seasons=2018,2019,2020,2021,2022,2023,2024,2025
```

The coverage command costs one request per selected competition and reports
season-level fixture, team-stat, xG and odds percentages before a backfill.

## Safe Champions League import

Import OpenFootball history first so provider matches can link to stable
training rows, then sample and expand:

```bash
npm run ai:ucl:import -- --from=2011 --to=2025
npm run ai:ucl:enrich:sample -- --seasons=2024
npm run ai:ucl:enrich -- --seasons=2022,2023,2024,2025
```

Use a second command to expand backward after reviewing the linked-match count.
The importer stores unlinked provider records for later alias correction but
excludes them from training until linked.

## Idempotency and quota behavior

Re-running the same command skips endpoint payloads already stored. Linking can
be repaired without refetching cached stats. Use `--refresh` only when you
intentionally want to call the provider again. If a network failure or run cap
stops the import, rerun the same command; completed payloads remain safe.

For every competition, the importer discovers the whole provider season and
then spends paid per-match calls only on rows linked to the canonical training
archive. Unlinked rows remain stored as provider metadata for alias diagnosis.
Therefore a 25-match sample means 25 linked training matches rather than the
provider's first 25 rows.

Archive lower-priority rich endpoints only after stats and odds succeed:

```bash
npm run ai:ucl:archive -- --seasons=2022,2023,2024,2025
```

## Training

```bash
npm run ai:train:big-five:candidate -- --validation-season=2024 --test-season=2025
npm run ai:train:expansion:candidate -- --validation-season=2024 --test-season=2025
npm run ai:ucl:train
```

The hybrid signal uses historical xG/npxG when available and falls back to
goals for matches without it. Post-match measurements are applied only after
that match's prediction. Market odds are used for benchmarking, not as an
outcome label or a live dependency. A candidate replaces an active model only
when the chronological probability-quality gate approves it. Big Five and
expansion training are isolated, so provider data from E1, B1 or SC0 cannot
change Big Five calibration or ratings.

## After the trial

Remove `THESTATSAPI_KEY` and do not schedule enrichment. UCL fixture sync and
settlement automatically fall back to Football-Data.org, while domestic updates
continue with Football-Data.co.uk:

```bash
npm run ai:learn:daily
npm run ai:learn:weekly
```

The archived features remain usable by every later retraining run. No model
prediction requires a live TheStatsAPI call.
