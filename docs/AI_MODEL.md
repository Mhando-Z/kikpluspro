# KickPulse AI model guide

## Purpose

The production model estimates match-result and score probabilities without depending on a paid current-season API. It uses public completed-match CSVs from Football-Data.co.uk, optionally enriches historical rows during a temporary TheStatsAPI trial, stores them in Supabase, and trains entirely in JavaScript.

This is a probabilistic analytical product. It does not guarantee an outcome and must not be described as certain betting advice.

## Architecture

1. `scripts/football-ai/import-football-data.mjs` downloads selected league-season CSVs directly from the source and upserts normalized matches into Supabase.
2. `scripts/football-ai/train-baseline.mjs` loads matches in chronological order, splits them by season, evaluates the model, and activates a versioned artifact.
3. `scripts/football-ai/import-thestatsapi.mjs` temporarily archives advanced historical payloads and links normalized xG/statistics to matching Football-Data rows.
4. `app/api/ai/model/route.js` exposes safe model metadata and supported teams.
5. `app/api/ai/predict/route.js` loads the active server-side artifact and calculates a forecast. Optional auditing records the input features and output.
6. `scripts/football-ai/refresh-current-results.mjs` imports every completed current-season match so learning does not depend on whether a fixture was previously tracked.
7. `scripts/football-ai/sync-upcoming.mjs` imports the public current-fixture feed, reconstructs post-training form, and stores one automatic forecast per active-model fixture.
8. `scripts/football-ai/settle-predictions.mjs` imports published final scores, settles stored forecasts, and makes the new matches available to later prediction runs.
9. `app/api/ai/fixtures/route.js` exposes upcoming forecasts and calculated live performance without exposing the model artifact.
10. `app/api/ai/performance/route.js` aggregates every active-model prediction into correct, incorrect, pending, per-league, confidence and monthly metrics.
11. `app/api/ai/results/route.js` safely resolves saved fixture IDs so the browser-only tracker can settle local records.
12. `app/predictions/page.jsx` renders automatic forecasts and full report dialogs; `app/simulator/page.jsx` contains the manual prediction lab.
13. `app/tracker/page.jsx` keeps user-entered decisions in IndexedDB rather than Supabase.
14. `scripts/football-ai/import-ucl-history.mjs` imports CC0 Champions League history and normalizes European club identities.
15. `scripts/football-ai/train-ucl.mjs` creates a separately versioned UCL specialist, incorporates linked historical xG/statistics, and evaluates it only on chronological UCL matches.
16. `lib/thestatsapi/ucl-fixtures.js` supplies current UCL fixtures/results/crests during the trial; Football-Data.org is the automatic fallback.
17. `scripts/football-ai/sync-upcoming.mjs` selects the active model by competition code: `CL` uses the UCL family and domestic codes use the Big Five family.

API-Football remains the visual identity source. The AI routes read cached rows
from the normalized `teams` table and resolve Football-Data names to an
API-Football team ID within the same country. This keeps logo requests separate
from match features and does not change model inputs, training or evaluation.

The service-role key and complete model artifact stay on the server. They must never use a `NEXT_PUBLIC_` variable.

## Data coverage

The importer supports these top-flight league codes:

| Code | League | Country |
| --- | --- | --- |
| `E0` | Premier League | England |
| `SP1` | La Liga | Spain |
| `I1` | Serie A | Italy |
| `D1` | Bundesliga | Germany |
| `F1` | Ligue 1 | France |
| `CL` | UEFA Champions League | Europe |

Rows include the final result, goals, shots, shots on target, disciplinary statistics, optional xG, and selected market odds when the source supplies them. Result fields are never used as inputs for their own match.

## Calibrated model

The version 3 candidate combines:

- Dynamic team Elo ratings with a home advantage and post-match updates.
- Home/away attacking and defensive goal rates with Bayesian shrinkage toward league averages.
- Five-match goal form.
- A hybrid performance signal that blends historical npxG/xG with goals and automatically falls back to goals when future xG is unavailable.
- A Poisson score matrix from 0–0 through 8–8.

The score matrix produces:

- Home win, draw, and away win probabilities.
- Over 2.5 goals.
- Both teams to score.
- Expected goals and five most likely scores.

The stored feature snapshot also contains form points, recent shots, recent xG, ratings, known-match counts, rest days, and league rates. These prepare the schema for a later gradient-boosted model.

Version 2 applies multiclass temperature scaling to the home/draw/away probabilities. The global temperature and league-specific temperatures are fitted only on the validation season. League temperatures are shrunk toward the global value to reduce overfitting when a competition has fewer matches. The later test season remains untouched until final evaluation.

## Leakage protection

For every historical match the pipeline performs these steps in order:

1. Read the model state produced only by earlier matches.
2. Build and optionally store the pre-match feature row.
3. Generate an evaluation forecast when the match belongs to validation or test data.
4. Update team and league state using the completed match.

Do not replace this with a random row split. Random splitting allows future team form to leak backward into earlier fixtures.

## Evaluation

The default trainer uses:

- All seasons before the penultimate season for fitting.
- The penultimate season for chronological validation.
- The latest season for chronological walk-forward testing.

Reported metrics are accuracy, multiclass log loss, multiclass Brier score, goal mean absolute error, and market log loss when closing 1X2 prices exist. The report includes calibrated and uncalibrated test results plus the same metrics for each league. Log loss and Brier score are more informative than accuracy for probability quality; lower is better.

## Operational commands

```bash
npm run ai:import:dry -- --seasons=2024,2025 --leagues=E0,SP1
npm run ai:import -- --from=2010 --to=2025
npm run ai:train
npm run ai:train:features
npm run ai:ucl:import -- --from=2011 --to=2025
npm run ai:ucl:enrich:sample -- --seasons=2024
npm run ai:ucl:enrich -- --seasons=2022,2023,2024,2025
npm run ai:ucl:train
npm run ai:fixtures:dry
npm run ai:fixtures:sync
npm run ai:fixtures:settle
npm run ai:fixtures:update
```

Use `--validation-season=2024 --test-season=2025` with either training command to choose explicit splits. The season value means the starting year: `2025` is the 2025/26 campaign.

Re-running either importer is safe because source identifiers are deterministic and TheStatsAPI payloads are skipped once archived. Each training run creates a new immutable version. Automatic promotion occurs only when held-out log loss improves without a material Brier-score regression.

Set `AI_AUDIT_PREDICTIONS=true` only when you intentionally want to store public simulator requests. It defaults to `false`; add authentication or durable rate limiting before enabling it on a public deployment.

## Current-fixture lifecycle

`ai:fixtures:sync` reads `fixtures.csv`, keeps only the five supported leagues,
converts source times from Europe/London to UTC, upserts teams and fixtures, and
creates deterministic prediction audit rows. Re-running it updates the same
fixture and prediction records.

When `THESTATSAPI_KEY` is configured, the same command prefers its Champions
League feed. On provider failure or after the trial key is removed, it uses the
Football-Data.org `CL` endpoint. A provider-neutral fixture key prevents the
same match being duplicated when the source changes. Each fixture is routed by
`league_code` to its own active `model_key`; a missing specialist causes a
visible skip, never a domestic-model fallback. UCL stage, format era, leg and
neutral-venue context are retained in fixtures and prediction snapshots.

The active training artifact is immutable. Before inference, the sync script
clones that artifact and applies completed `ai_matches` later than its
`trained_to` date. This derived state gives future forecasts current Elo and
form without corrupting the benchmarked model version.

`ai:fixtures:settle` checks domestic fixtures against the current season result
CSV and UCL fixtures against the preferred/fallback provider. A natural match
key prevents a UCL result already imported from OpenFootball or another feed
from being added twice. It attaches the actual result to every pre-match
prediction; only those settled records enter accuracy, log loss and Brier score.

Use an external scheduler such as GitHub Actions, a server cron job or a hosting
platform scheduler if you want unattended updates. Keep the Supabase service
role key in that scheduler's encrypted server-side secrets.

The performance overview distinguishes training-time held-out metrics from
post-deployment live metrics. Only predictions written before kickoff and later
settled with an actual result are counted as live correct or incorrect picks.
Pending fixtures never enter the accuracy denominator.

Personal tracking is intentionally isolated from model evaluation. A user's
stake, bookmaker odds and notes remain in that browser's IndexedDB and do not
alter training, calibration or the shared Supabase model scorecard.

If an API-Football crest is unavailable, the UI intentionally displays club
initials. A missing visual asset must never prevent prediction inference or
fixture settlement.

## Recommended next model

Keep this baseline as the production benchmark. When enough clean data is available, add a separate offline gradient-boosted classifier and goal regressors using the stored pre-match features. Promote a candidate only when chronological log loss and calibration improve, not merely when headline accuracy rises.
