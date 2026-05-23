# News backfill — one-time historical pull

Builds `api/_lib/news-backfill.json` from federal-source archives by
querying the Wayback Machine. Designed as a one-time job, separate
from the live aggregator (`api/_lib/fraud-news-core.js`). The live
aggregator merges the backfill JSON into its output at runtime.

## Why Wayback, not the live sites

DOJ, FBI, USPIS, FinCEN all return 403 to anonymous archive scrapes
behind AWS WAF / Akamai. The Internet Archive's CDX API and snapshot
fetches have full indexed coverage of those sources and no WAF, so
this script never touches the originals. CourtListener requires a
free API token and is deferred to a phase-2 backfill — the live
aggregator already pulls CL filings ongoing.

## Phases

```
node scripts/news-backfill/run.js harvest    # Stage 1 — CDX → candidates
node scripts/news-backfill/run.js fetch      # Stage 2 — Wayback snapshots → data/news-archive/
node scripts/news-backfill/run.js filter     # Stage 3 — apply KEYWORDS, tag
node scripts/news-backfill/run.js finalize   # Stage 4 — write api/_lib/news-backfill.json
```

Each phase is resumable: re-running `fetch` skips URLs already present
in `data/news-archive/<source>.jsonl`. To start clean, delete those
files (or the candidates.json / filtered.json in `state/`, depending
on which phase you want to redo).

## Outputs

| Path                                  | Purpose | Tracked? |
|---------------------------------------|---------|----------|
| `data/news-archive/<source>.jsonl`    | Raw parsed records — reusable across applications. See `data/news-archive/SCHEMA.md`. | Yes |
| `api/_lib/news-backfill.json`         | Trimmed, dedup'd, geo-tagged final view consumed by `aggregateStories()` | Yes |
| `scripts/news-backfill/state/candidates.json` | URL list after CDX + slug pre-filter | No (`.gitignore`'d, regenerable) |
| `scripts/news-backfill/state/filtered.json`   | Records that passed KEYWORDS + window filter | No |

Optional flags:
- `--source <name>` — restrict to one source (uspis, doj_opa, doj_usao). Default: all.
- `--limit <n>` — cap items per source during dev. Default: no cap.

## Window

Fixed: `2024-11-22` → `2026-05-22` (18 months ending today).

## Output

`api/_lib/news-backfill.json` is committed to the repo. The live
aggregator (`fraud-news-core.aggregateStories`) reads it at request
time, concatenates with live RSS items, dedupes by URL + title key,
and sorts by date desc. Backfilled items render through the same
news template as live items.
