insert into public.ai_data_sources (
  source_key,
  name,
  base_url,
  license_name,
  license_url,
  metadata
)
values (
  'thestatsapi',
  'TheStatsAPI',
  'https://api.thestatsapi.com/api',
  'Provider subscription terms apply',
  'https://www.thestatsapi.com/',
  '{"use":"temporary historical enrichment","persistent_dependency":false}'::jsonb
)
on conflict (source_key) do update
set name = excluded.name,
    base_url = excluded.base_url,
    license_name = excluded.license_name,
    license_url = excluded.license_url,
    metadata = excluded.metadata,
    updated_at = now();

create table if not exists public.ai_provider_teams (
  provider text not null references public.ai_data_sources(source_key),
  provider_team_id text not null,
  provider_name text not null,
  country_code text not null,
  canonical_key text references public.ai_teams(canonical_key) on update cascade on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, provider_team_id)
);

create index if not exists ai_provider_teams_canonical_idx
  on public.ai_provider_teams(canonical_key)
  where canonical_key is not null;

create table if not exists public.ai_provider_matches (
  provider_match_id text primary key,
  provider text not null default 'thestatsapi' references public.ai_data_sources(source_key),
  ai_match_id uuid references public.ai_matches(id) on delete set null,
  competition_id text not null,
  season_id text not null,
  league_code text not null,
  season_start integer not null check (season_start between 1900 and 2200),
  match_date date not null,
  kickoff_at timestamptz,
  status text,
  provider_home_team_id text not null,
  provider_away_team_id text not null,
  home_team_name text not null,
  away_team_name text not null,
  home_team_key text references public.ai_teams(canonical_key) on update cascade on delete set null,
  away_team_key text references public.ai_teams(canonical_key) on update cascade on delete set null,
  home_goals smallint,
  away_goals smallint,
  odds_available boolean not null default false,
  xg_available boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_provider_matches_lookup_idx
  on public.ai_provider_matches(league_code, season_start, match_date);
create index if not exists ai_provider_matches_ai_match_idx
  on public.ai_provider_matches(ai_match_id)
  where ai_match_id is not null;

create table if not exists public.ai_provider_payloads (
  provider_match_id text not null references public.ai_provider_matches(provider_match_id) on delete cascade,
  endpoint_key text not null,
  payload jsonb not null,
  retrieved_at timestamptz not null default now(),
  primary key (provider_match_id, endpoint_key)
);

create index if not exists ai_provider_payloads_endpoint_idx
  on public.ai_provider_payloads(endpoint_key, retrieved_at desc);

create table if not exists public.ai_match_enrichments (
  provider_match_id text primary key references public.ai_provider_matches(provider_match_id) on delete cascade,
  ai_match_id uuid references public.ai_matches(id) on delete set null,
  home_xg numeric(7,4),
  away_xg numeric(7,4),
  home_npxg numeric(7,4),
  away_npxg numeric(7,4),
  home_shots smallint,
  away_shots smallint,
  home_shots_on_target smallint,
  away_shots_on_target smallint,
  home_big_chances smallint,
  away_big_chances smallint,
  home_box_touches smallint,
  away_box_touches smallint,
  home_final_third_entries smallint,
  away_final_third_entries smallint,
  home_possession numeric(6,2),
  away_possession numeric(6,2),
  home_goals_prevented numeric(7,4),
  away_goals_prevented numeric(7,4),
  opening_home_odds numeric(8,3),
  opening_draw_odds numeric(8,3),
  opening_away_odds numeric(8,3),
  closing_home_odds numeric(8,3),
  closing_draw_odds numeric(8,3),
  closing_away_odds numeric(8,3),
  coverage jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_match_enrichments_ai_match_idx
  on public.ai_match_enrichments(ai_match_id)
  where ai_match_id is not null;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'ai_provider_teams', 'ai_provider_matches', 'ai_match_enrichments'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', target_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target_table
    );
  end loop;
end;
$$;

alter table public.ai_provider_teams enable row level security;
alter table public.ai_provider_matches enable row level security;
alter table public.ai_provider_payloads enable row level security;
alter table public.ai_match_enrichments enable row level security;

revoke all on public.ai_provider_teams from anon, authenticated;
revoke all on public.ai_provider_matches from anon, authenticated;
revoke all on public.ai_provider_payloads from anon, authenticated;
revoke all on public.ai_match_enrichments from anon, authenticated;
