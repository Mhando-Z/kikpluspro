create extension if not exists pgcrypto;

create table if not exists public.api_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  endpoint_id text not null,
  endpoint text not null,
  params jsonb not null default '{}'::jsonb,
  payload jsonb not null,
  result_count integer not null default 0,
  http_status integer not null default 200,
  is_public boolean not null default true,
  is_stale boolean not null default false,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  rate_limit_remaining integer,
  rate_limit_daily_remaining integer,
  response_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_cache_endpoint_idx on public.api_cache(endpoint_id, fetched_at desc);
create index if not exists api_cache_expires_idx on public.api_cache(expires_at);
create index if not exists api_cache_params_gin_idx on public.api_cache using gin(params);

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  endpoint_id text not null,
  endpoint text not null,
  params jsonb not null default '{}'::jsonb,
  interval_seconds integer not null check (interval_seconds >= 15),
  priority integer not null default 50,
  is_active boolean not null default true,
  next_run_at timestamptz not null default now(),
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  attempts integer not null default 0,
  consecutive_failures integer not null default 0,
  locked_at timestamptz,
  lock_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sync_jobs_due_idx
  on public.sync_jobs(is_active, next_run_at, priority desc)
  where is_active = true;

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.sync_jobs(id) on delete set null,
  endpoint_id text not null,
  endpoint text not null,
  params jsonb not null default '{}'::jsonb,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  source text not null default 'api-football',
  records_received integer not null default 0,
  records_written integer not null default 0,
  http_status integer,
  rate_limit_remaining integer,
  rate_limit_daily_remaining integer,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer
);

create index if not exists sync_runs_recent_idx on public.sync_runs(started_at desc);

create table if not exists public.countries (
  name text primary key,
  code text,
  flag_url text,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leagues (
  api_id bigint primary key,
  name text not null,
  type text,
  logo_url text,
  country_name text,
  country_code text,
  country_flag_url text,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_seasons (
  league_api_id bigint not null references public.leagues(api_id) on delete cascade,
  season integer not null,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  coverage jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (league_api_id, season)
);

create table if not exists public.venues (
  api_id bigint primary key,
  name text,
  address text,
  city text,
  country text,
  capacity integer,
  surface text,
  image_url text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  api_id bigint primary key,
  name text not null,
  code text,
  country text,
  founded integer,
  is_national boolean not null default false,
  logo_url text,
  venue_api_id bigint references public.venues(api_id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fixtures (
  api_id bigint primary key,
  league_api_id bigint,
  season integer,
  round text,
  home_team_api_id bigint,
  away_team_api_id bigint,
  kickoff_at timestamptz,
  timezone text,
  venue_api_id bigint,
  referee text,
  status_long text,
  status_short text,
  elapsed integer,
  home_goals integer,
  away_goals integer,
  score jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixtures_kickoff_idx on public.fixtures(kickoff_at desc);
create index if not exists fixtures_live_idx on public.fixtures(status_short) where status_short in ('1H','HT','2H','ET','P','BT','LIVE');
create index if not exists fixtures_league_season_idx on public.fixtures(league_api_id, season, kickoff_at);

create table if not exists public.standings (
  league_api_id bigint not null,
  season integer not null,
  team_api_id bigint not null,
  group_name text not null default '',
  rank integer not null,
  points integer,
  goals_diff integer,
  form text,
  description text,
  all_record jsonb not null default '{}'::jsonb,
  home_record jsonb not null default '{}'::jsonb,
  away_record jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_api_id, season, team_api_id, group_name)
);

create table if not exists public.players (
  api_id bigint primary key,
  name text not null,
  firstname text,
  lastname text,
  age integer,
  nationality text,
  height text,
  weight text,
  photo_url text,
  is_injured boolean not null default false,
  birth jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_leaderboards (
  leaderboard_type text not null check (leaderboard_type in ('top_scorers','top_assists','top_yellow_cards','top_red_cards')),
  league_api_id bigint not null,
  season integer not null,
  player_api_id bigint not null,
  team_api_id bigint,
  rank integer not null,
  value integer,
  statistics jsonb not null default '{}'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (leaderboard_type, league_api_id, season, player_api_id)
);

create index if not exists player_leaderboards_rank_idx
  on public.player_leaderboards(leaderboard_type, league_api_id, season, rank);

create table if not exists public.injuries (
  player_api_id bigint not null,
  fixture_api_id bigint not null,
  team_api_id bigint,
  league_api_id bigint,
  season integer,
  injury_type text,
  reason text,
  fixture_date timestamptz,
  payload jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_api_id, fixture_api_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'api_cache','sync_jobs','countries','leagues','league_seasons','venues',
    'teams','fixtures','standings','players','player_leaderboards','injuries'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', target_table);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      target_table
    );
  end loop;
end;
$$;

create or replace function public.claim_due_sync_jobs(p_limit integer default 6)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select id
    from public.sync_jobs
    where is_active = true
      and next_run_at <= now()
      and (locked_at is null or locked_at < now() - interval '10 minutes')
    order by priority desc, next_run_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 20))
  )
  update public.sync_jobs as job
  set locked_at = now(),
      lock_token = gen_random_uuid(),
      last_started_at = now(),
      attempts = attempts + 1
  from due
  where job.id = due.id
  returning job.*;
end;
$$;

revoke all on function public.claim_due_sync_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_sync_jobs(integer) to service_role;

create or replace view public.live_fixtures as
select *
from public.fixtures
where status_short in ('1H','HT','2H','ET','P','BT','LIVE');

create or replace view public.api_health as
select
  endpoint_id,
  max(fetched_at) as last_fetched_at,
  max(expires_at) as expires_at,
  bool_or(is_stale) as has_stale_data,
  max(rate_limit_remaining) as rate_limit_remaining
from public.api_cache
where is_public = true
group by endpoint_id;

alter table public.api_cache enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.sync_runs enable row level security;
alter table public.countries enable row level security;
alter table public.leagues enable row level security;
alter table public.league_seasons enable row level security;
alter table public.venues enable row level security;
alter table public.teams enable row level security;
alter table public.fixtures enable row level security;
alter table public.standings enable row level security;
alter table public.players enable row level security;
alter table public.player_leaderboards enable row level security;
alter table public.injuries enable row level security;

create policy "Public reads public API cache" on public.api_cache for select to anon, authenticated using (is_public = true);
create policy "Public reads countries" on public.countries for select to anon, authenticated using (true);
create policy "Public reads leagues" on public.leagues for select to anon, authenticated using (true);
create policy "Public reads league seasons" on public.league_seasons for select to anon, authenticated using (true);
create policy "Public reads venues" on public.venues for select to anon, authenticated using (true);
create policy "Public reads teams" on public.teams for select to anon, authenticated using (true);
create policy "Public reads fixtures" on public.fixtures for select to anon, authenticated using (true);
create policy "Public reads standings" on public.standings for select to anon, authenticated using (true);
create policy "Public reads players" on public.players for select to anon, authenticated using (true);
create policy "Public reads leaderboards" on public.player_leaderboards for select to anon, authenticated using (true);
create policy "Public reads injuries" on public.injuries for select to anon, authenticated using (true);

grant select on public.api_cache, public.countries, public.leagues, public.league_seasons,
  public.venues, public.teams, public.fixtures, public.standings, public.players,
  public.player_leaderboards, public.injuries, public.live_fixtures, public.api_health
  to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fixtures'
  ) then
    alter publication supabase_realtime add table public.fixtures;
  end if;
end;
$$;
