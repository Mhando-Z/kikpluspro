-- KickPulse v1.8: permanent TheStatsAPI UCL archive and provider switching.
-- Run after 202608310001_sustainable_learning.sql and 202609010001_ucl_specialist.sql.

alter table public.ai_provider_matches
  add column if not exists competition_stage text,
  add column if not exists format_era text,
  add column if not exists neutral_venue boolean not null default false;

alter table public.ai_match_enrichments
  add column if not exists home_corners smallint,
  add column if not exists away_corners smallint,
  add column if not exists home_fouls smallint,
  add column if not exists away_fouls smallint,
  add column if not exists home_yellow smallint,
  add column if not exists away_yellow smallint,
  add column if not exists home_red smallint,
  add column if not exists away_red smallint;

alter table public.ai_fixtures
  add column if not exists canonical_fixture_key text;

update public.ai_fixtures
set canonical_fixture_key = concat_ws(
  '|', league_code, match_date::text, home_team_key, away_team_key
)
where canonical_fixture_key is null;

create unique index if not exists ai_fixtures_canonical_key_idx
  on public.ai_fixtures(canonical_fixture_key);

update public.ai_data_sources
set metadata = metadata || '{"ucl_archive":true,"preferred_during_trial":true,"persistent_dependency":false}'::jsonb,
    updated_at = now()
where source_key = 'thestatsapi';
