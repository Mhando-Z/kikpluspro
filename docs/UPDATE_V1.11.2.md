# KickPulse v1.11.2

This patch adds a quota-conscious admin action for expansion-league team logos.

## Expansion asset repair

The new **Sync expansion league teams** button fetches three API-Football country catalogs:

- England for EFL Championship (`E1`)
- Belgium for Belgian Pro League (`B1`)
- Scotland for Scottish Premiership (`SC0`)

After the three catalog requests succeed, the existing server-side reconciliation links cached team IDs and logo URLs to `ai_teams`. Existing exact, normalized and alias matching remains country-safe.
