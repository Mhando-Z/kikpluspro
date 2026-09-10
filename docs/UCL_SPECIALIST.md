# UEFA Champions League specialist

## Why it is separate

Champions League matches differ from domestic leagues in opponent mix, travel,
tournament stage, two-legged knockouts, neutral finals and the 2024/25 format
change. KickPulse therefore stores this model under `uefa-champions-league` and
never silently uses the domestic model for a `CL` fixture.

| Fixture code | Model family | Missing-model behavior |
| --- | --- | --- |
| `E0`, `SP1`, `I1`, `D1`, `F1` | Big Five model | Only these fixtures are skipped if the family is absent |
| `E1`, `B1`, `SC0` | Domestic expansion model | Only these fixtures are skipped if the family is absent |
| `CL` | UEFA Champions League specialist | Fixture is skipped with a training instruction |

Supabase permits one active version per model key, so all three families can operate
at the same time and keep separate performance records.

## Source strategy

| Purpose | Active source | Fallback/archive |
| --- | --- | --- |
| Historical UCL results and stage context | OpenFootball CC0 archive | Retained permanently in Supabase |
| Historical xG, stats, odds and rich match payloads | Existing Supabase archive | No future provider calls |
| Current UCL fixtures, results and crests | Football-Data.org free `CL` endpoint | Verified OpenLigaDB UCL season |
| Shared domestic club strength | Football-Data.co.uk domestic history | Existing Supabase match archive |

TheStatsAPI is retired. Its already collected payloads remain historical
training evidence, but no current command authenticates to or calls it. A
provider-neutral fixture key prevents duplicate fixtures when the current feed
changes. Settlement also checks the natural match identity before adding a
result to training, so one game cannot be learned twice.

Review each provider's current retention and model-training terms before a
large import. Provider credentials and the model artifact remain server-only.

## One-time setup

Apply both migrations after the base AI migrations:

```text
supabase/migrations/202609010001_ucl_specialist.sql
supabase/migrations/202609010002_thestatsapi_ucl.sql
supabase/migrations/202609100001_current_fixture_providers.sql
supabase/migrations/202609100002_football_data_uk_primary.sql
```

Add these server-only values to `.env.local`:

```bash
FOOTBALL_DATA_FIXTURES_URL=https://www.football-data.co.uk/fixtures.csv
FOOTBALL_DATA_BASE_URL=https://www.football-data.co.uk/mmz4281
FOOTBALL_DATA_ORG_API_KEY=YOUR_SERVER_ONLY_FREE_KEY
FOOTBALL_DATA_ORG_BASE_URL=https://api.football-data.org/v4
OPENLIGADB_BASE_URL=https://api.openligadb.de
```

## Import the historical backbone

First import the CC0 result backbone. Season values are starting years, so
`2025` means 2025/26.

```bash
npm run ai:ucl:import:dry -- --from=2011 --to=2025
npm run ai:ucl:import -- --from=2011 --to=2025
```

Previously archived normalized rows include xG/npxG, shots, shots on target, big chances,
penalty-area touches, final-third entries, possession, corners, fouls, cards
and 1X2 prices where supplied. They are read from Supabase only. New results
continue with goal-derived features when xG is unavailable.

## Train and promote

```bash
npm run ai:ucl:train
```

The trainer uses linked historical xG/statistics in the existing leakage-safe
rolling performance signal. A match's post-match measurements update state only
after its forecast, so they can influence later matches but never their own
target. Odds remain an evaluation benchmark, not a prediction shortcut.

The penultimate UCL season fits probability calibration and the latest season
is the untouched walk-forward test. Domestic history seeds shared club strength,
but UCL validation and test metrics contain only UCL matches. The command prints
xG/stats/odds coverage and stores immutable candidate v2. By default it promotes
only when held-out log loss improves without a material Brier-score regression.
Use `--promotion=always` only for an intentional manual override.

## Normal operation

No separate frontend workflow is needed:

```bash
npm run ai:fixtures:dry -- --days=14
npm run ai:fixtures:sync -- --days=14
npm run ai:fixtures:settle
```

Domestic sync and settlement use Football-Data.co.uk first. UCL uses
Football-Data.org first and the verified OpenLigaDB UCL season as fallback.
Every fixture is routed by competition code and records the
exact model family/version used.
For knockout matches decided after 90 minutes, Football-Data.org settlement uses
the regulation-time score rather than extra time or shootouts as the 1X2 target.

## Sustainable operation

TheStatsAPI is retired and must not be configured or scheduled. Keep its
archived Supabase rows and trained artifact. Normal update commands use
Football-Data.co.uk, Football-Data.org and OpenLigaDB only:

```bash
npm run ai:learn:daily
npm run ai:learn:weekly
```

New free results keep Elo and rolling form current. Periodic retraining can
combine those new results with the permanently archived historical xG without
making another paid provider call.
