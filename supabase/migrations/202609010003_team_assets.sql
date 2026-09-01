insert into public.ai_data_sources (
  source_key,
  name,
  base_url,
  license_name,
  license_url,
  metadata
)
values (
  'api-football',
  'API-Football',
  'https://v3.football.api-sports.io',
  'API-Football terms apply',
  'https://www.api-football.com/terms',
  '{"use":"team identity and descriptive logo assets","persistent_dependency":false}'::jsonb
)
on conflict (source_key) do update
set name = excluded.name,
    base_url = excluded.base_url,
    license_name = excluded.license_name,
    license_url = excluded.license_url,
    metadata = excluded.metadata,
    updated_at = now();

alter table public.ai_teams
  add column if not exists api_football_team_id bigint,
  add column if not exists logo_url text,
  add column if not exists logo_source text,
  add column if not exists logo_match_score numeric(5,4),
  add column if not exists logo_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_teams_api_football_team_id_fkey'
      and conrelid = 'public.ai_teams'::regclass
  ) then
    alter table public.ai_teams
      add constraint ai_teams_api_football_team_id_fkey
      foreign key (api_football_team_id)
      references public.teams(api_id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_teams_logo_match_score_check'
      and conrelid = 'public.ai_teams'::regclass
  ) then
    alter table public.ai_teams
      add constraint ai_teams_logo_match_score_check
      check (logo_match_score is null or logo_match_score between 0 and 1);
  end if;
end;
$$;

create unique index if not exists ai_teams_api_football_team_id_idx
  on public.ai_teams(api_football_team_id)
  where api_football_team_id is not null;

create index if not exists ai_teams_logo_missing_idx
  on public.ai_teams(country_code, display_name)
  where logo_url is null;

comment on column public.ai_teams.api_football_team_id is
  'Stable API-Football team identifier used only for team identity and descriptive assets.';
comment on column public.ai_teams.logo_url is
  'Canonical team logo URL resolved server-side. Logos are presentation data, never model features.';
comment on column public.ai_teams.logo_match_score is
  'Name-and-country reconciliation confidence from 0 to 1.';
