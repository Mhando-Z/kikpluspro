insert into public.sync_jobs (job_key, endpoint_id, endpoint, params, interval_seconds, priority, is_active, next_run_at)
values
  ('countries:all', 'countries', '/countries', '{}'::jsonb, 604800, 10, true, now()),
  ('leagues:current', 'leagues', '/leagues', '{"current":"true"}'::jsonb, 86400, 20, true, now()),
  ('fixtures:live:core', 'fixtures', '/fixtures', '{"live":"39-140-135-78-61-2"}'::jsonb, 60, 100, false, now()),
  ('fixtures:pl:recent', 'fixtures', '/fixtures', '{"league":"39","season":"2024","last":"30"}'::jsonb, 21600, 60, true, now()),
  ('standings:pl:2024', 'standings', '/standings', '{"league":"39","season":"2024"}'::jsonb, 3600, 70, true, now()),
  ('topassists:pl:2024', 'top-assists', '/players/topassists', '{"league":"39","season":"2024"}'::jsonb, 21600, 50, true, now()),
  ('topscorers:pl:2024', 'top-scorers', '/players/topscorers', '{"league":"39","season":"2024"}'::jsonb, 21600, 50, true, now()),
  ('injuries:pl:2024', 'injuries', '/injuries', '{"league":"39","season":"2024"}'::jsonb, 14400, 40, true, now()),
  ('odds:pl:2024', 'odds', '/odds', '{"league":"39","season":"2024","page":"1"}'::jsonb, 10800, 30, true, now())
on conflict (job_key) do update
set endpoint_id = excluded.endpoint_id,
    endpoint = excluded.endpoint,
    params = excluded.params,
    interval_seconds = excluded.interval_seconds,
    priority = excluded.priority,
    is_active = excluded.is_active;
