create table if not exists public.ai_data_sources (
  source_key text primary key,
  name text not null,
  base_url text,
  license_name text,
  license_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_import_runs (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.ai_data_sources(source_key),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  requested_leagues text[] not null default '{}',
  requested_seasons integer[] not null default '{}',
  files_processed integer not null default 0,
  rows_received integer not null default 0,
  rows_written integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ai_teams (
  canonical_key text primary key,
  display_name text not null,
  country_code text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_team_aliases (
  provider text not null,
  country_code text not null,
  provider_name text not null,
  canonical_key text not null references public.ai_teams(canonical_key) on update cascade,
  created_at timestamptz not null default now(),
  primary key (provider, country_code, provider_name)
);

create table if not exists public.ai_matches (
  id uuid primary key default gen_random_uuid(),
  source_match_key text not null unique,
  source_key text not null references public.ai_data_sources(source_key),
  league_code text not null,
  league_name text not null,
  country_code text not null,
  season_start integer not null check (season_start between 1900 and 2200),
  match_date date not null,
  kickoff_time time,
  home_team_key text not null references public.ai_teams(canonical_key),
  away_team_key text not null references public.ai_teams(canonical_key),
  home_team_name text not null,
  away_team_name text not null,
  home_goals smallint not null check (home_goals >= 0),
  away_goals smallint not null check (away_goals >= 0),
  result char(1) not null check (result in ('H', 'D', 'A')),
  half_home_goals smallint,
  half_away_goals smallint,
  half_result char(1),
  referee text,
  home_xg numeric(6,3),
  away_xg numeric(6,3),
  home_shots smallint,
  away_shots smallint,
  home_shots_on_target smallint,
  away_shots_on_target smallint,
  home_fouls smallint,
  away_fouls smallint,
  home_corners smallint,
  away_corners smallint,
  home_yellow smallint,
  away_yellow smallint,
  home_red smallint,
  away_red smallint,
  opening_home_odds numeric(8,3),
  opening_draw_odds numeric(8,3),
  opening_away_odds numeric(8,3),
  closing_home_odds numeric(8,3),
  closing_draw_odds numeric(8,3),
  closing_away_odds numeric(8,3),
  over_25_odds numeric(8,3),
  under_25_odds numeric(8,3),
  source_row_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (home_team_key <> away_team_key)
);

create index if not exists ai_matches_chronology_idx
  on public.ai_matches(league_code, match_date, id);
create index if not exists ai_matches_home_team_idx
  on public.ai_matches(home_team_key, match_date desc);
create index if not exists ai_matches_away_team_idx
  on public.ai_matches(away_team_key, match_date desc);
create index if not exists ai_matches_season_idx
  on public.ai_matches(season_start, league_code);

create table if not exists public.ai_match_features (
  match_id uuid primary key references public.ai_matches(id) on delete cascade,
  feature_version text not null,
  features jsonb not null,
  target_result char(1) not null check (target_result in ('H', 'D', 'A')),
  target_home_goals smallint not null,
  target_away_goals smallint not null,
  generated_at timestamptz not null default now()
);

create index if not exists ai_match_features_version_idx
  on public.ai_match_features(feature_version, generated_at desc);

create table if not exists public.ai_model_versions (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  version integer not null check (version > 0),
  algorithm text not null,
  feature_version text not null,
  status text not null default 'ready' check (status in ('training', 'ready', 'failed', 'retired')),
  is_active boolean not null default false,
  trained_from date,
  trained_to date,
  training_rows integer not null default 0,
  validation_rows integer not null default 0,
  test_rows integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  artifact jsonb not null,
  notes text,
  trained_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (model_key, version)
);

create unique index if not exists ai_one_active_model_idx
  on public.ai_model_versions(model_key)
  where is_active = true;

create or replace function public.activate_ai_model(target_model_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_model_key text;
begin
  select model_key into target_model_key
  from public.ai_model_versions
  where id = target_model_id and status = 'ready';

  if target_model_key is null then
    raise exception 'Ready AI model version not found';
  end if;

  update public.ai_model_versions
  set is_active = false
  where model_key = target_model_key and id <> target_model_id;

  update public.ai_model_versions
  set is_active = true
  where id = target_model_id;
end;
$$;

revoke all on function public.activate_ai_model(uuid) from public, anon, authenticated;
grant execute on function public.activate_ai_model(uuid) to service_role;

create table if not exists public.ai_predictions (
  id uuid primary key default gen_random_uuid(),
  prediction_key text not null unique,
  model_version_id uuid not null references public.ai_model_versions(id),
  league_code text not null,
  home_team_key text not null references public.ai_teams(canonical_key),
  away_team_key text not null references public.ai_teams(canonical_key),
  kickoff_at timestamptz,
  expected_home_goals numeric(7,4) not null,
  expected_away_goals numeric(7,4) not null,
  home_win_probability numeric(7,6) not null,
  draw_probability numeric(7,6) not null,
  away_win_probability numeric(7,6) not null,
  over_25_probability numeric(7,6) not null,
  both_teams_score_probability numeric(7,6) not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  top_scorelines jsonb not null default '[]'::jsonb,
  features jsonb not null default '{}'::jsonb,
  explanations jsonb not null default '[]'::jsonb,
  actual_result char(1),
  actual_home_goals smallint,
  actual_away_goals smallint,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ai_predictions_feed_idx
  on public.ai_predictions(created_at desc);

insert into public.ai_data_sources (
  source_key,
  name,
  base_url,
  license_name,
  license_url,
  metadata
)
values (
  'football-data-uk',
  'Football-Data.co.uk',
  'https://www.football-data.co.uk/mmz4281',
  'Source terms apply; repository mirror declares ODC-PDDL-1.0',
  'https://github.com/datasets/football-datasets',
  '{"repository":"https://github.com/datasets/football-datasets","use":"research-and-model-development"}'::jsonb
)
on conflict (source_key) do update
set name = excluded.name,
    base_url = excluded.base_url,
    license_name = excluded.license_name,
    license_url = excluded.license_url,
    metadata = excluded.metadata,
    updated_at = now();

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ai_data_sources', 'ai_teams', 'ai_matches'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', target_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target_table
    );
  end loop;
end;
$$;

alter table public.ai_data_sources enable row level security;
alter table public.ai_import_runs enable row level security;
alter table public.ai_teams enable row level security;
alter table public.ai_team_aliases enable row level security;
alter table public.ai_matches enable row level security;
alter table public.ai_match_features enable row level security;
alter table public.ai_model_versions enable row level security;
alter table public.ai_predictions enable row level security;

drop policy if exists "Public reads AI teams" on public.ai_teams;
create policy "Public reads AI teams"
  on public.ai_teams for select to anon, authenticated using (true);

drop policy if exists "Public reads active AI model metadata" on public.ai_model_versions;

drop policy if exists "Public reads AI predictions" on public.ai_predictions;

revoke all on public.ai_model_versions from anon, authenticated;
revoke all on public.ai_predictions from anon, authenticated;

grant select on public.ai_teams
  to anon, authenticated;
