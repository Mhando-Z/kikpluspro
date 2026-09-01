-- KickPulse v1.7: UEFA Champions League specialist model support.
-- Safe to run after the existing AI and prediction-tracking migrations.

alter table public.ai_matches
  add column if not exists competition_stage text,
  add column if not exists format_era text,
  add column if not exists leg smallint check (leg is null or leg in (1, 2)),
  add column if not exists neutral_venue boolean not null default false,
  add column if not exists provider_match_id text;

alter table public.ai_fixtures
  add column if not exists competition_stage text,
  add column if not exists format_era text,
  add column if not exists leg smallint check (leg is null or leg in (1, 2)),
  add column if not exists neutral_venue boolean not null default false,
  add column if not exists provider_fixture_id text;

create index if not exists ai_matches_competition_stage_idx
  on public.ai_matches(league_code, competition_stage, match_date);

create unique index if not exists ai_fixtures_provider_id_idx
  on public.ai_fixtures(source_key, provider_fixture_id)
  where provider_fixture_id is not null;

insert into public.ai_data_sources (
  source_key, name, base_url, license_name, license_url, metadata
)
values
  (
    'openfootball-ucl',
    'OpenFootball Champions League',
    'https://github.com/openfootball/champions-league',
    'CC0 1.0 Universal',
    'https://creativecommons.org/publicdomain/zero/1.0/',
    '{"use":"historical-ucl-model-training","includes_qualifiers_by_default":false}'::jsonb
  ),
  (
    'football-data-org',
    'Football-Data.org API',
    'https://api.football-data.org/v4',
    'Provider terms apply',
    'https://www.football-data.org/terms',
    '{"competition":"CL","use":"current-ucl-fixtures-results-and-crests"}'::jsonb
  )
on conflict (source_key) do update
set name = excluded.name,
    base_url = excluded.base_url,
    license_name = excluded.license_name,
    license_url = excluded.license_url,
    metadata = excluded.metadata,
    updated_at = now();
