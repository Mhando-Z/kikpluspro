-- KickPulse v1.12: sustainable current fixture/result providers.
-- Keeps TheStatsAPI payloads as historical training data but removes it from
-- every future synchronization decision.

insert into public.ai_data_sources (
  source_key, name, base_url, license_name, license_url, metadata
)
values
  (
    'football-data-org',
    'Football-Data.org API',
    'https://api.football-data.org/v4',
    'Provider terms apply',
    'https://www.football-data.org/terms',
    '{"use":"primary-current-fixtures-and-results","requires_server_key":true,"priority":1}'::jsonb
  ),
  (
    'openligadb',
    'OpenLigaDB API',
    'https://api.openligadb.de',
    'Open Database License (ODbL)',
    'https://www.openligadb.de/',
    '{"use":"verified-current-fixture-result-fallback","requires_key":false,"priority":2}'::jsonb
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

update public.ai_data_sources
set metadata = metadata || '{"operational_sync_enabled":false,"use":"historical-model-import-only"}'::jsonb,
    updated_at = now()
where source_key in ('football-data-fixtures', 'football-data-uk');
