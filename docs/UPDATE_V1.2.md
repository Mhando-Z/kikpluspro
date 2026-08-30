# Upgrade to automatic fixture tracking v1.2

This update keeps your 7,082 imported matches and active calibrated model. It
adds a current-fixture table, automatic forecasts, result settlement, live
performance metrics and a responsive prediction feed.

## Apply the update

1. Stop the development server.
2. Extract the updated ZIP over the existing `kickpulse-football-ai-hub` folder
   and allow Windows to replace matching source files.
3. Keep the existing `.env.local` and `node_modules`; neither is included in
   the ZIP.
4. In the Supabase SQL Editor, run only this new migration:

```text
supabase/migrations/202608300002_prediction_tracking.sql
```

Do not rerun the older migrations. You do not need to reimport the 7,082
historical matches or retrain model v3.

5. Verify the project:

```bash
npm run check
```

6. Validate the public upcoming-fixture feed without writing to Supabase:

```bash
npm run ai:fixtures:dry
```

7. Store the fixtures and generate automatic forecasts with active model v3:

```bash
npm run ai:fixtures:sync
```

8. Start Next.js and open the prediction workspace:

```bash
npm run dev
```

Open `http://localhost:3000/predictions`. The automatic fixture feed appears
above the existing interactive simulator.

## After matches finish

Run settlement after Football-Data.co.uk publishes final results:

```bash
npm run ai:fixtures:settle
```

For the normal recurring workflow, use:

```bash
npm run ai:fixtures:update
```

That command settles earlier forecasts first, then imports the latest fixture
window and regenerates future predictions using the newly completed matches as
rolling form history.
