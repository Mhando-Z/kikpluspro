create table if not exists public.ai_fixtures (
  id uuid primary key default gen_random_uuid(),
  source_fixture_key text not null unique,
  source_key text not null references public.ai_data_sources(source_key),
  league_code text not null,
  league_name text not null,
  country_code text not null,
  season_start integer not null check (season_start between 1900 and 2200),
  match_date date not null,
  kickoff_time time not null,
  source_timezone text not null default 'Europe/London',
  kickoff_at timestamptz not null,
  home_team_key text not null references public.ai_teams(canonical_key),
  away_team_key text not null references public.ai_teams(canonical_key),
  home_team_name text not null,
  away_team_name text not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'finished', 'postponed', 'cancelled')),
  home_goals smallint,
  away_goals smallint,
  result char(1) check (result in ('H', 'D', 'A')),
  market_home_odds numeric(8,3),
  market_draw_odds numeric(8,3),
  market_away_odds numeric(8,3),
  over_25_odds numeric(8,3),
  under_25_odds numeric(8,3),
  source_last_modified timestamptz,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_key <> away_team_key)
);

create index if not exists ai_fixtures_schedule_idx
  on public.ai_fixtures(status, kickoff_at);
create index if not exists ai_fixtures_league_idx
  on public.ai_fixtures(league_code, kickoff_at);

alter table public.ai_predictions
  add column if not exists fixture_id uuid references public.ai_fixtures(id) on delete set null;

create unique index if not exists ai_one_prediction_per_model_fixture_idx
  on public.ai_predictions(model_version_id, fixture_id)
  where fixture_id is not null;

insert into public.ai_data_sources (
  source_key,
  name,
  base_url,
  license_name,
  license_url,
  metadata
)
values (
  'football-data-fixtures',
  'Football-Data.co.uk latest fixtures',
  'https://www.football-data.co.uk/fixtures.csv',
  'Source terms apply',
  'https://www.football-data.co.uk/matches.php',
  '{"update_schedule":"weekends Friday; midweek Tuesday","use":"upcoming-fixture-tracking"}'::jsonb
)
on conflict (source_key) do update
set name = excluded.name,
    base_url = excluded.base_url,
    license_name = excluded.license_name,
    license_url = excluded.license_url,
    metadata = excluded.metadata,
    updated_at = now();

drop trigger if exists set_updated_at on public.ai_fixtures;
create trigger set_updated_at
  before update on public.ai_fixtures
  for each row execute function public.set_updated_at();

alter table public.ai_fixtures enable row level security;
revoke all on public.ai_fixtures from anon, authenticated;
revoke all on public.ai_predictions from anon, authenticated;

