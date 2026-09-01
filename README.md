# KickPulse Football AI Hub

KickPulse is a production-style football intelligence starter built with:

- Next.js App Router using JavaScript and JSX only
- Tailwind CSS
- Framer Motion
- Lucide React and React Icons
- Supabase PostgreSQL, Realtime and Edge Functions
- API-Football v3
- A calibrated JavaScript Elo + Poisson prediction pipeline
- A separately trained UEFA Champions League specialist with automatic model routing
- Temporary TheStatsAPI historical enrichment and preferred UCL feed with a free fallback

It stores API-Football responses in Supabase before serving them to the Next.js
application. One backend request can therefore supply every connected user.

The AI workspace is a separate, quota-free historical pipeline. It imports
completed matches from Football-Data.co.uk, evaluates the model chronologically,
stores a versioned artifact in Supabase, and serves explainable probabilities
through a server-only Next.js inference route.

The interface works immediately in demo mode. Connect Supabase when you are
ready to use real football data.

## Included product areas

- AI-first performance overview with correct, incorrect and pending forecasts
- Monthly prediction activity chart and per-league live accuracy
- Confidence-group diagnostics and recent settled results
- Full automatic-forecast reports opened directly from match cards
- Private IndexedDB bet tracker with stake, odds, profit/loss, ROI and JSON export
- Separate automatic forecast, manual simulator and tracker routes
- Live score center using the official free LiveXscores widget embedded by Football-Data
- Upcoming fixtures and recent results
- League standings and form guide
- Team and venue directory
- API-Football team crests with resilient initials fallback
- Top scorers, assists and disciplinary leaderboards
- Predictions, injuries and head-to-head insights
- Interactive calibrated match simulator with expected goals and score probabilities
- Automatic current-fixture forecasts and a settled-result scorecard
- Competition-aware domestic/UCL model switching with separately measured performance
- Per-league accuracy, log loss, Brier score and market benchmarking
- Versioned model training, held-out metrics and prediction audit records
- Pre-match and live odds
- Interactive cache endpoint explorer
- Protected synchronization control panel
- Dark and light themes
- Mobile navigation and accessible reduced-motion behavior

The main navigation is intentionally focused on `/`, `/predictions`, `/live`,
`/simulator`, `/tracker` and `/admin`. The API-Football pages remain available
by direct URL for later reuse, but fixtures, standings, teams,
players, insights, odds and the endpoint explorer are hidden from navigation.

## Live scores and prediction settlement

`/live` uses the free embed documented at
https://www.livexscores.com/free-livescore, which is the same provider embedded
by https://livescore.football-data.co.uk/. It offers All matches, In play, Not
started and Finished views and does not consume API-Football quota.

The widget is display-only. LiveXscores advertises structured data as a paid
feed, so KickPulse does not scrape or reverse-engineer the widget. Domestic
predictions are settled from Football-Data's season CSVs; UCL predictions use
the preferred TheStatsAPI feed with Football-Data.org fallback:

~~~bash
npm run ai:fixtures:settle
~~~

This separation keeps the original pre-match probabilities immutable and makes
the model's correct/incorrect scorecard auditable.

## Endpoint coverage

The allowlisted endpoint catalog covers the complete API-Football v3 surface
discussed for this project:

~~~
/status
/timezone
/countries
/leagues
/leagues/seasons
/teams
/teams/statistics
/teams/seasons
/teams/countries
/venues
/standings
/fixtures
/fixtures/rounds
/fixtures/headtohead
/fixtures/statistics
/fixtures/events
/fixtures/lineups
/fixtures/players
/injuries
/predictions
/coachs
/players
/players/seasons
/players/profiles
/players/squads
/players/teams
/players/topscorers
/players/topassists
/players/topyellowcards
/players/topredcards
/transfers
/trophies
/sidelined
/odds
/odds/live
/odds/live/bets
/odds/mapping
/odds/bookmakers
/odds/bets
~~~

The frontend API explorer can read any public cached endpoint. The Edge Function
is the only code allowed to call API-Football.

## Requirements

- Node.js 22 or newer
- npm
- A Supabase project
- An API-Football account and API key for the cached API dashboard
- Optional: Supabase CLI for local development and deployments

## 1. Install and run in demo mode

~~~bash
npm install
cp .env.example .env.local
npm run dev
~~~

Open http://localhost:3000.

If the Supabase variables are missing or a cache key has not been synchronized,
the UI uses realistic local demo data. This lets you finalize the design before
using any API quota.

## 2. Create the Supabase database

You can use the Supabase CLI:

~~~bash
supabase link --project-ref YOUR_PROJECT_REFERENCE
supabase db push
~~~

Or copy these migrations into the Supabase SQL Editor in this order:

~~~text
supabase/migrations/202608290001_kickpulse_schema.sql
supabase/migrations/202608300001_football_ai.sql
supabase/migrations/202608300002_prediction_tracking.sql
supabase/migrations/202608310001_sustainable_learning.sql
supabase/migrations/202609010001_ucl_specialist.sql
supabase/migrations/202609010002_thestatsapi_ucl.sql
supabase/migrations/202609010003_team_assets.sql
~~~

Then run supabase/seed.sql.

The migration creates:

- Generic raw response cache
- Scheduled sync jobs and execution logs
- Normalized countries, leagues, seasons, teams and venues
- Normalized fixtures, standings, players, leaderboards and injuries
- Row Level Security policies
- Public live-fixture and API-health views
- Supabase Realtime publication for fixture changes
- Historical AI matches, team aliases and import logs
- Leakage-safe features, versioned model artifacts and prediction audits
- Current fixture tracking, market snapshots and settled forecast outcomes

Public users receive read-only access. Inserts, updates and sync logs remain
server-controlled.

## 3. Configure Next.js

Copy .env.example to .env.local, then fill:

~~~bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_SYNC_FUNCTION_URL=https://YOUR_PROJECT.supabase.co/functions/v1/api-football-sync
SUPABASE_SYNC_SECRET=YOUR_LONG_RANDOM_SYNC_SECRET
ADMIN_SYNC_KEY=YOUR_DIFFERENT_LONG_RANDOM_ADMIN_KEY
NEXT_PUBLIC_DEFAULT_LEAGUE_ID=39
NEXT_PUBLIC_DEFAULT_SEASON=2024
FOOTBALL_DATA_BASE_URL=https://www.football-data.co.uk/mmz4281
FOOTBALL_DATA_FIXTURES_URL=https://www.football-data.co.uk/fixtures.csv
FOOTBALL_DATA_ORG_API_KEY=YOUR_SERVER_ONLY_FREE_KEY
FOOTBALL_DATA_ORG_BASE_URL=https://api.football-data.org/v4
OPENFOOTBALL_UCL_BASE_URL=https://raw.githubusercontent.com/openfootball/champions-league/master
THESTATSAPI_KEY=YOUR_SERVER_ONLY_TRIAL_KEY
THESTATSAPI_BASE_URL=https://api.thestatsapi.com/api
THESTATSAPI_REQUESTS_PER_MINUTE=220
THESTATSAPI_MAX_REQUESTS_PER_RUN=45000
AI_AUDIT_PREDICTIONS=false
~~~

Security rules:

- Never prefix the API-Football key with NEXT_PUBLIC_.
- Never expose SUPABASE_SERVICE_ROLE_KEY.
- Use different values for SUPABASE_SYNC_SECRET and ADMIN_SYNC_KEY.
- Use at least 32 random bytes for each secret.
- Keep the model artifact server-side; the public UI receives only safe metadata.
- Leave AI prediction auditing off until the public route has authentication or durable rate limiting.

## 4. Deploy the Supabase Edge Function

Set function secrets:

~~~bash
supabase secrets set API_FOOTBALL_KEY=YOUR_API_KEY
supabase secrets set SUPABASE_SYNC_SECRET=YOUR_LONG_RANDOM_SYNC_SECRET
~~~

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are normally available inside a
hosted Supabase Edge Function. Set them manually only if your environment does
not supply them.

Deploy:

~~~bash
supabase functions deploy api-football-sync --no-verify-jwt
~~~

JWT verification is disabled because Supabase Cron cannot log in as a user. The
function still rejects every request that does not include the correct
x-sync-secret.

## 5. Import historical AI data

First validate availability without writing to Supabase:

~~~bash
npm run ai:import:dry -- --seasons=2024,2025 --leagues=E0,SP1
~~~

Then import a useful chronological window. The season argument is its starting
year, so `2025` means the 2025/26 campaign:

~~~bash
npm run ai:import -- --from=2010 --to=2025
~~~

The importer supports `E0`, `SP1`, `I1`, `D1` and `F1`. It upserts completed
matches, so a rerun updates the same source rows instead of duplicating them.
Current public CSVs are downloaded directly from Football-Data.co.uk; the
GitHub repository reviewed for this project is useful as a mirror and schema
reference but can lag the direct source.

Respect the data source's current terms before commercial redistribution.

## 6. Train and activate the baseline

~~~bash
npm run ai:train
~~~

The trainer uses seasons in chronological order: older seasons for training,
the penultimate season for probability calibration, and the latest season for
walk-forward testing. It reports calibrated and uncalibrated accuracy, log
loss, Brier score, goal error, per-league results and a market benchmark where
closing odds exist. A completed run stores a new model version and promotes it
only when the chronological probability-quality gate passes.

Before the temporary provider trial ends, follow
[docs/THESTATSAPI_TRIAL.md](docs/THESTATSAPI_TRIAL.md). The enrichment importer
stores raw payloads and links match xG/statistics to the existing historical
rows. The deployed hybrid model falls back to goal-derived performance after
the trial and therefore does not need a permanent API subscription.

To persist every pre-match feature snapshot for later XGBoost or LightGBM work:

~~~bash
npm run ai:train:features
~~~

Open `/simulator` after training. See [docs/AI_MODEL.md](docs/AI_MODEL.md) for
the implementation and leakage rules. See [docs/MODEL_CARD.md](docs/MODEL_CARD.md)
for the measured 7,082-match benchmark, per-league results and limitations.

## 7. Track current fixtures and results

The domestic fixture feed comes from the same public Football-Data.co.uk source
as the training data. UCL fixtures use the preferred provider/fallback strategy
described below. Neither path consumes API-Football calls. Validate the window,
then sync fixtures and generate predictions:

~~~bash
npm run ai:fixtures:dry
npm run ai:fixtures:sync
~~~

The sync uses the active model artifact and then applies every completed match
stored after its training cutoff. This keeps current Elo and form history moving
without changing the immutable trained model version. Newly promoted teams use
the model's cold-start priors and are visibly marked as low confidence.

After matches finish, import the published results and score the stored
pre-match forecasts:

~~~bash
npm run ai:fixtures:settle
~~~

For a regular update, settle old fixtures first and then sync the new window:

~~~bash
npm run ai:fixtures:update
~~~

Football-Data.co.uk normally refreshes the upcoming feed on Friday afternoons
for weekend games and Tuesday for midweek games. Open `/predictions` to see the
automatic forecasts and tracked live scorecard. Click any forecast card for a
full report. The interactive simulator is available separately at `/simulator`.

### Champions League specialist

KickPulse deliberately does not mix Champions League forecasts into the
domestic model family. Historical main-competition results come from the CC0
OpenFootball archive. During the trial, TheStatsAPI is the preferred UCL
enrichment and current fixture/result/crest provider. Football-Data.org remains
the automatic free fallback, so inference has no paid production dependency.

After applying both UCL migrations, run the quota-light sample before the full
archive and training sequence:

~~~bash
npm run ai:ucl:import:dry -- --from=2011 --to=2025
npm run ai:ucl:import -- --from=2011 --to=2025
npm run ai:ucl:enrich:sample -- --seasons=2024
npm run ai:ucl:enrich -- --seasons=2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025
npm run ai:ucl:train
npm run ai:fixtures:sync
~~~

The UCL trainer uses domestic results to seed shared club strength, but its
calibration and held-out scorecard contain only Champions League matches. The
fixture sync routes `CL` to `uefa-champions-league` and the five domestic codes
to `elo-poisson-global`. If the UCL model is missing, Champions League fixtures
are skipped rather than silently predicted by the wrong family.

TheStatsAPI payloads are stored idempotently in Supabase. Odds are retained for
evaluation and never used as match outcomes. Post-match xG/statistics can only
affect later fixtures. Remove `THESTATSAPI_KEY` when the trial ends; fixture
sync and settlement then fall back to Football-Data.org automatically.

See [docs/UCL_SPECIALIST.md](docs/UCL_SPECIALIST.md) for the full data,
training, routing and operating guide.

The overview at `/` calculates live post-deployment performance from stored
automatic predictions. It separates correct, incorrect and pending forecasts,
then groups accuracy by league and confidence. Run `ai:fixtures:update` after
results are published so the overview can score completed predictions.

## 8. Track personal bet decisions

From any automatic forecast, open the full report and record a 1X2 selection,
stake, decimal odds and optional note. KickPulse stores this journal in native
browser IndexedDB; it does not write personal bets to Supabase and it never
places a wager.

Open `/tracker` to:

- Check saved fixture IDs against settled Supabase results
- View won, lost, void and pending records
- Calculate hit rate, settled profit/loss and ROI
- Filter the journal and export a JSON backup

The tracker is specific to the current browser profile. Clearing site data or
moving to another device removes access to the local records unless the user
has exported a backup.

## 9. Synchronize team crests

KickPulse renders the team logos returned by API-Football and uses the
provider's documented team-ID media URL as a fallback. The frontend never sends
an API key and loading a cached logo does not make another statistics request.

Apply `supabase/migrations/202609010003_team_assets.sql`, redeploy the included
Edge Function, then open `/admin`, enter `ADMIN_SYNC_KEY`, and click
**Sync team assets**. The shortcut runs five season-free country catalog calls:

~~~text
England
Spain
Italy
Germany
France
~~~

It also makes one `/teams?league=2&season=2024` request to cover the Champions
League catalog available to the free API-Football plan. The normal full run is
therefore six API requests. Country catalogs include promoted and lower-division
clubs without depending on a current-season subscription.

After importing the catalog, the server reconciles each API-Football ID to the
canonical `ai_teams` identity by country and normalized name. Exact canonical
links are used first on every forecast; fuzzy name resolution remains a safe
fallback. `/admin` shows catalog size, linked coverage and the first unresolved
teams. Use **Reconcile cached assets** to repeat matching without spending API
quota. An unavailable crest falls back to the club initials.

Team crests now appear on the dashboard, fixtures, standings, player lists,
club directory, API-Football prediction panels and the separate AI forecast
workspace. Use the images for team identification and descriptive presentation
in line with the provider's current terms.

This sync is intentionally manual. Team identity data changes slowly, so run it
after adding a competition, seeing an unresolved team, or at most monthly. It is
separate from model training and the logo fields never enter prediction features.

The v1.9.1 worker deduplicates normalized rows by their database conflict key
before each upsert. This is required for country and cup catalogs where multiple
teams can share one venue. Without it, PostgreSQL rejects the entire response
with `ON CONFLICT DO UPDATE command cannot affect row a second time`.

## 10. Schedule API-Football synchronization

Open supabase/snippets/schedule-sync.sql, replace the project URL and sync secret
placeholders, then run the script in the Supabase SQL Editor.

The scheduler claims due jobs with database row locks. This prevents overlapping
workers from calling the same endpoint twice.

The included seed schedules:

- Countries weekly
- Current leagues daily
- A batched live-fixtures job, disabled by default to protect the free quota
- Recent 2024 Premier League results every 6 hours
- Standings hourly
- Top scorers and top assists every 6 hours
- Injuries every 4 hours
- Pre-match odds every 3 hours

Adjust sync_jobs.interval_seconds to match your API plan. Remember:

~~~text
Every minute = 1,440 calls per day
Every five minutes = 288 calls per day
~~~

Enable the live job only after confirming your plan can sustain its polling
frequency. A one-minute live job alone can consume 1,440 calls per day.

The included API-Football examples default to the 2024/25 season because the
free plan currently rejects newer seasons. The AI importer is independent and
can ingest later completed seasons when their public CSV exists.

## 11. Add or change an API-Football sync job

Example:

~~~sql
insert into public.sync_jobs (
  job_key,
  endpoint_id,
  endpoint,
  params,
  interval_seconds,
  priority
)
values (
  'topassists:laliga:2024',
  'top-assists',
  '/players/topassists',
  '{"league":"140","season":"2024"}',
  21600,
  50
)
on conflict (job_key) do update
set params = excluded.params,
    interval_seconds = excluded.interval_seconds,
    is_active = true;
~~~

You may also open /admin, enter ADMIN_SYNC_KEY, select an endpoint and run a
protected manual sync.

## Cache behavior

Every cache record is keyed by:

~~~text
SHA-256(endpoint path + sorted parameters)
~~~

The worker:

1. Validates the endpoint against a fixed allowlist.
2. Removes unsupported parameters.
3. Reuses a fresh cache entry unless force is requested.
4. Calls API-Football server-side.
5. Records rate-limit headers and execution timing.
6. Stores the raw JSON response.
7. Normalizes high-value records.
8. Retains the last non-empty response if the upstream API unexpectedly returns
   an empty payload.
9. Applies exponential backoff after failures.

## Project structure

~~~text
app/
  api/ai/                    Model, performance, fixture and result routes
  predictions/               Automatic explainable forecasts
  simulator/                 Manual matchup laboratory
  tracker/                   Private IndexedDB decision journal
  live/ fixtures/ ...        Product pages
components/
  football/                  Forecast, analytics, tracker and football UI
  layout/                    Responsive application shell
lib/
  football-ai/               Elo, Poisson, performance, fixtures and repository
  bets/ client/              Settlement math and IndexedDB persistence
  api-football/              Endpoint catalog, cache, team assets and demo data
  supabase/                  Browser and server clients
scripts/
  football-ai/               Import, training, fixture sync and settlement
supabase/
  functions/                 Rate-aware API-Football worker
  migrations/                Database schema and RLS
  snippets/                  Cron setup
~~~

## Production checklist

- Update the seeded season before each new campaign.
- Retrain only after an import finishes and preserve chronological splits.
- Compare calibration and log loss before promoting a more complex model.
- Add scheduled jobs only for leagues your product actually displays.
- Check /leagues coverage before enabling injuries, predictions or odds.
- Monitor sync_runs and API rate-limit headers.
- Keep pre-match and live bet IDs in separate namespaces.
- Use the API provider's caching and redistribution terms appropriate to your
  subscription.
- Configure deployment environment variables separately from .env.local.
- Rotate the admin and sync secrets if they are ever exposed.

## Commands

~~~bash
npm run dev       # Development server
npm run lint      # ESLint
npm test          # JavaScript model and parser tests
npm run build     # Production build
npm run check     # Lint, tests and production build
npm run ai:import -- --from=2010 --to=2025
npm run ai:train
npm run ai:fixtures:dry
npm run ai:fixtures:sync
npm run ai:fixtures:settle
~~~
