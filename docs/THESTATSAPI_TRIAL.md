# TheStatsAPI trial enrichment

TheStatsAPI is a temporary historical teacher for KickPulse. The production
forecast pipeline remains independent and continues with Football-Data.co.uk
after the trial ends.

## What is retained

- Provider competition, season, team and match IDs
- Raw endpoint payloads for audit and future feature engineering
- Normalized match xG and non-penalty xG
- Shots, shots on target, big chances and penalty-area touches
- Final-third entries, possession and goalkeeper goals prevented
- Opening and last-seen 1X2 prices when available
- Optional player stats, lineups, shotmaps, timelines and referee payloads

Confirm that your provider agreement permits the intended retention and model
training use before running a large backfill.

## Setup

Apply the migrations in order, ending with:

```text
supabase/migrations/202608310001_sustainable_learning.sql
```

Add these server-only values to `.env.local`:

```bash
THESTATSAPI_KEY=your-key
THESTATSAPI_BASE_URL=https://api.thestatsapi.com/api
THESTATSAPI_REQUESTS_PER_MINUTE=220
```

Never prefix the provider key with `NEXT_PUBLIC_`.

## Safe import sequence

Start with 25 matches. This validates authentication, team linking and the
database schema without spending the full allowance:

```bash
npm run ai:enrich:sample -- --seasons=2024 --leagues=E0
```

Then import match statistics and odds for the five supported leagues:

```bash
npm run ai:enrich -- --seasons=2022,2023,2024,2025 --leagues=E0,SP1,I1,D1,F1 --resources=stats,odds
```

Re-running the same command skips endpoint payloads already stored. Use
`--refresh` only when you intentionally want to spend calls fetching them
again. Add archival endpoints only after the high-value import succeeds:

```bash
npm run ai:enrich -- --seasons=2022,2023,2024,2025 --resources=player-stats,lineups,shotmap,timeline,referee
```

The importer reports API requests, retries, linked matches and unmatched rows.
Unmatched provider records remain stored but are excluded from training until
their team/match mapping is corrected.

## Train the hybrid candidate

```bash
npm run ai:train:features -- --promotion=auto
```

The hybrid performance signal uses 65% xG/npxG and 35% actual goals when xG is
available. When future matches have no xG, it automatically uses goals only.
This means the artifact continues updating from the free result feed.

Automatic promotion requires lower held-out log loss without a material Brier
score regression. A rejected candidate remains stored for review and the
existing active model remains untouched.

## After the trial

Remove `THESTATSAPI_KEY`. Do not schedule the enrichment importer. Run:

```bash
npm run ai:learn:daily
npm run ai:learn:weekly
```

The included GitHub Actions workflows run at 06:00 EAT daily and 06:30 EAT on
Monday. Add `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as
encrypted GitHub repository secrets.
