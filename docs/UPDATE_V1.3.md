# Upgrade to API-Football team crests v1.3

This update uses API-Football as the team identity asset source across the
KickPulse interface. It adds real team crests, cross-source name matching and a
safe initials fallback.

## Apply the update

1. Stop the development server.
2. Extract the updated ZIP over the existing `kickpulse-football-ai-hub` folder
   and allow Windows to replace matching source files.
3. Keep `.env.local` and `node_modules`; neither is included in the ZIP.
4. No Supabase SQL migration is required for v1.3.
5. Verify the project:

```bash
npm run check
```

6. Start the application:

```bash
npm run dev
```

7. Open `http://localhost:3000/admin`, enter your `ADMIN_SYNC_KEY`, and click
   **Sync team logos**.

The shortcut makes five `/teams` requests—one for each supported league using
season 2024—and stores their stable API-Football team IDs and logo URLs in the
existing normalized `teams` table.

8. Refresh `/predictions`, `/fixtures`, `/standings`, `/teams` or the dashboard.

No historical AI import or model retraining is needed. Team assets are display
data only and never enter model features.

## Missing promoted-team crest

The 2024 league lists may not contain a club promoted in a later season. The UI
will show initials safely. To add its logo, use the Admin endpoint selector:

```text
Endpoint: Teams
search: the club's current full name
```

Run the endpoint once and refresh the page. Its normalized team record will be
available to the AI name resolver on the next request.
