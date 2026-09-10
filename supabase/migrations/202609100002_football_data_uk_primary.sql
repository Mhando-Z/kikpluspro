-- KickPulse v1.13: resilient current fixture and result routing.
-- Football-Data.co.uk is the primary domestic source. Football-Data.org and
-- OpenLigaDB remain fallbacks, while UCL keeps its specialist routing.

insert into public.ai_data_sources (
  source_key, name, base_url, license_name, license_url, metadata
)
values
  (
    'football-data-fixtures',
    'Football-Data.co.uk latest fixtures',
    'https://www.football-data.co.uk/fixtures.csv',
    'Source terms apply',
    'https://www.football-data.co.uk/matches.php',
    '{"operational_sync_enabled":true,"use":"primary-current-domestic-fixtures-and-odds","priority":1,"update_schedule":"weekends Friday; midweek Tuesday"}'::jsonb
  ),
  (
    'football-data-uk',
    'Football-Data.co.uk current results',
    'https://www.football-data.co.uk/mmz4281',
    'Source terms apply',
    'https://www.football-data.co.uk/data.php',
    '{"operational_sync_enabled":true,"use":"primary-current-domestic-results","priority":1}'::jsonb
  ),
  (
    'football-data-org',
    'Football-Data.org API',
    'https://api.football-data.org/v4',
    'Provider terms apply',
    'https://www.football-data.org/terms',
    '{"operational_sync_enabled":true,"use":"ucl-primary-and-domestic-fallback","domestic_priority":2,"ucl_priority":1,"requires_server_key":true}'::jsonb
  ),
  (
    'openligadb',
    'OpenLigaDB API',
    'https://api.openligadb.de',
    'Open Database License (ODbL)',
    'https://www.openligadb.de/',
    '{"operational_sync_enabled":true,"use":"verified-current-fallback","domestic_priority":3,"ucl_priority":2,"requires_key":false}'::jsonb
  )
on conflict (source_key) do update
set name = excluded.name,
    base_url = excluded.base_url,
    license_name = excluded.license_name,
    license_url = excluded.license_url,
    metadata = public.ai_data_sources.metadata || excluded.metadata,
    updated_at = now();

update public.ai_data_sources
set metadata = metadata || '{"archived":true,"operational_sync_enabled":false,"use":"historical-training-enrichment-only"}'::jsonb,
    updated_at = now()
where source_key = 'thestatsapi';

create index if not exists ai_predictions_model_kickoff_idx
  on public.ai_predictions(model_version_id, kickoff_at);

create index if not exists ai_fixtures_kickoff_idx
  on public.ai_fixtures(kickoff_at);
