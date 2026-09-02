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

| Purpose | Preferred source | Long-term fallback |
| --- | --- | --- |
| Historical UCL results and stage context | OpenFootball CC0 archive | Retained permanently in Supabase |
| Historical xG, stats, odds and rich match payloads | TheStatsAPI during the trial | Retained archive; no future calls required |
| Current UCL fixtures, results and crests | TheStatsAPI while a key is configured | Football-Data.org free `CL` endpoint |
| Shared domestic club strength | Football-Data.co.uk domestic history | Existing Supabase match archive |

TheStatsAPI is a temporary teacher and preferred current feed, not a permanent
runtime dependency. Every raw enrichment payload is archived under its provider
match ID. A provider-neutral fixture key prevents duplicate fixtures when the
current feed changes. Settlement also checks the natural match identity before
adding a result to training, so one game cannot be learned twice.

Review each provider's current retention and model-training terms before a
large import. Provider credentials and the model artifact remain server-only.

## One-time setup

Apply both migrations after the base AI migrations:

```text
supabase/migrations/202609010001_ucl_specialist.sql
supabase/migrations/202609010002_thestatsapi_ucl.sql
```

Add these server-only values to `.env.local`:

```bash
THESTATSAPI_KEY=YOUR_TRIAL_KEY
THESTATSAPI_BASE_URL=https://api.thestatsapi.com/api
THESTATSAPI_REQUESTS_PER_MINUTE=220
THESTATSAPI_MAX_REQUESTS_PER_RUN=45000
FOOTBALL_DATA_ORG_API_KEY=YOUR_FREE_FALLBACK_KEY
FOOTBALL_DATA_ORG_BASE_URL=https://api.football-data.org/v4
```

If automatic name discovery cannot find the competition for your account,
inspect the competition response and set `THESTATSAPI_UCL_COMPETITION_ID`.

## Import and enrich

First import the CC0 result backbone. Season values are starting years, so
`2025` means 2025/26.

```bash
npm run ai:ucl:import:dry -- --from=2011 --to=2025
npm run ai:ucl:import -- --from=2011 --to=2025
```

Validate authentication, competition discovery and match linking with 25
matches before spending the trial allowance:

```bash
npm run ai:ucl:enrich:sample -- --seasons=2024
```

Then archive the high-value normalized features. Start with recent seasons and
expand backward while monitoring the CLI request counter and link rate:

```bash
npm run ai:ucl:enrich -- --seasons=2022,2023,2024,2025
npm run ai:ucl:enrich -- --seasons=2015,2016,2017,2018,2019,2020,2021
```

The normalized rows include xG/npxG, shots, shots on target, big chances,
penalty-area touches, final-third entries, possession, corners, fouls, cards
and 1X2 prices where supplied. Rich endpoints can be archived for later model
research after the high-value import succeeds:

```bash
npm run ai:ucl:archive -- --seasons=2022,2023,2024,2025
```

Re-running an import skips cached endpoint payloads. Use `--refresh` only when
you intentionally want to spend calls again. The client caps each run below the
stated allowance and counts retries against that cap.

The UCL sample selects linked main-competition matches before applying its
limit. Provider qualifiers and other unlinked rows are stored for diagnostics
but never call paid stats or odds endpoints.

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

Sync and settlement try TheStatsAPI first, then Football-Data.org. Every fixture
is routed by competition code and records the exact model family/version used.
For knockout matches decided after 90 minutes, Football-Data.org settlement uses
the regulation-time score rather than extra time or shootouts as the 1X2 target.

## After the trial

Remove `THESTATSAPI_KEY` and do not schedule either enrichment command. Keep the
archived Supabase rows, trained artifact and free Football-Data.org key. The
normal update commands continue unchanged and automatically use the fallback:

```bash
npm run ai:learn:daily
npm run ai:learn:weekly
```

New free results keep Elo and rolling form current. Periodic retraining can
combine those new results with the permanently archived historical xG without
making another paid provider call.
