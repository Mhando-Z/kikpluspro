-- Run after deploying api-football-sync and adding secrets to Supabase Vault.
-- Replace the placeholder values only once, then keep the resulting secret IDs private.
select vault.create_secret('https://YOUR_PROJECT.supabase.co', 'kickpulse_project_url');
select vault.create_secret('YOUR_LONG_SYNC_SECRET', 'kickpulse_sync_secret');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'kickpulse-due-sync',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'kickpulse_project_url')
      || '/functions/v1/api-football-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kickpulse_sync_secret')
    ),
    body := '{"mode":"due","limit":10}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

