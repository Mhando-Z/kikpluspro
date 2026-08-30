# KickPulse v1.4 update

Version 1.4 refocuses the product on explainable AI forecasts and measured
post-deployment performance.

## Upgrade

1. Extract the new project over the existing folder.
2. Preserve the existing `.env.local` and `node_modules` folder.
3. Run:

~~~bash
npm install
npm run check
npm run dev
~~~

No Supabase migration, historical reimport or model retraining is required.

## New product routes

- `/` — active-model performance overview
- `/predictions` — automatic fixture forecasts and full reports
- `/simulator` — manual matchup simulation
- `/tracker` — browser-private IndexedDB bet journal
- `/admin` — data and crest synchronization

The older football-data pages are still available through their direct URLs,
but they are hidden from the main navigation.

## Keeping performance current

Generate the upcoming predictions with:

~~~bash
npm run ai:fixtures:sync
~~~

After matches finish and the source publishes results, run:

~~~bash
npm run ai:fixtures:update
~~~

The update command settles past forecasts first, then generates the next
fixture window. Correct, incorrect and accuracy figures cannot change until a
stored prediction receives a final result.

## Local tracker

Open an automatic prediction card, review the report, then enter the 1X2
selection, stake and decimal odds. The record is stored only in the current
browser's IndexedDB. Use the tracker export button before clearing browser data
or changing devices.
