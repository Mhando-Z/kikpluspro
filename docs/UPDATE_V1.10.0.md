# Domestic expansion v1.10.0

This release adds EFL Championship (`E1`), Belgian Pro League (`B1`) and
Scottish Premiership (`SC0`) support across historical imports, live fixtures,
TheStatsAPI enrichment, model metadata, club crest reconciliation and UI labels.

It also introduces:

- A three-call TheStatsAPI coverage inspector.
- Linked-only paid enrichment to protect the temporary API quota.
- Explicit domestic competition filtering so UCL rows cannot enter domestic training.
- A changed-scope promotion guard requiring manual review.
- A fixture guard that skips new leagues until the active artifact contains league history.
- Team-name aliases for common English, Belgian and Scottish provider differences.

No database migration is required for this release.
