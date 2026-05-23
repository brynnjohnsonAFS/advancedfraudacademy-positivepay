# News archive — schema and usage

Raw parsed records for federal-source fraud news, pulled from the Wayback
Machine by `scripts/news-backfill/run.js`. Designed to be reusable across
applications — the AFA news page is the first consumer, but the data is
intentionally richer than what gets surfaced there.

## Files

One JSONL file per source. Each line is one parsed record.

| File             | Source                                                 |
|------------------|--------------------------------------------------------|
| `uspis.jsonl`    | U.S. Postal Inspection Service press releases + scam-article pages |
| `doj_opa.jsonl`  | DOJ Office of Public Affairs (HQ) press releases       |
| `doj_usao.jsonl` | DOJ U.S. Attorney's Office press releases (all districts) |

## Record shape

```jsonc
{
  "url": "https://www.justice.gov/usao-ndoh/pr/clevelander-sentenced-12-years-prison-bank-fraud-scheme",
  "source": "DOJ",                            // human label: "DOJ" | "USPIS"
  "waybackTimestamp": "20250307183312",       // YYYYMMDDhhmmss — when archive.org captured the page
  "title": "Clevelander Sentenced to 12 Years in Prison for Bank Fraud Scheme",
  "publishedAt": "2025-03-07T00:00:00.000Z",  // best-effort publish date, ISO 8601
  "body": "A Cleveland-area man was sentenced today to 12 years..."  // up to 1200 chars
}
```

### Field notes

- **url** — canonical URL on the original source. Query strings and tracking
  params stripped at harvest time.
- **publishedAt** — extracted in priority order: `article:published_time`
  meta → `<time datetime>` → "Last updated MM.DD.YYYY" (USPIS) → visible
  month-name date in body → Wayback snapshot timestamp (fallback only).
  USPIS scam-article evergreen pages carry their last-edit date, which
  can predate the backfill window — filter on `publishedAt` if you only
  want time-bound items.
- **body** — first ~1200 characters of article text, scripts/styles stripped.
  Drupal page chrome ("Skip to main content", "Download wanted poster",
  etc.) is filtered out at extraction. For full body text, refetch from
  Wayback using `https://web.archive.org/web/<waybackTimestamp>id_/<url>`.

## Window

The archive covers **2024-11-22 → 2026-05-22** by default (the AFA news
page launch window). Re-running `node scripts/news-backfill/run.js
harvest` with adjusted constants in `run.js` widens it. The data file
is append-friendly; the script's resume logic skips URLs already present.

## Usage examples

### Stream and filter — Node

```js
var fs = require('fs');
var readline = require('readline');

var rl = readline.createInterface({
  input: fs.createReadStream('data/news-archive/doj_usao.jsonl')
});

rl.on('line', function (line) {
  var rec = JSON.parse(line);
  if (/check\s+fraud/i.test(rec.title + ' ' + rec.body)) {
    console.log(rec.publishedAt.slice(0, 10), rec.title);
  }
});
```

### Bulk load — Python

```python
import json

with open('data/news-archive/doj_usao.jsonl') as f:
    items = [json.loads(line) for line in f if line.strip()]

by_district = {}
for it in items:
    # URL pattern: /usao-<district>/pr/...
    parts = it['url'].split('/')
    district = next((p[5:] for p in parts if p.startswith('usao-')), None)
    by_district.setdefault(district, []).append(it)
```

### Re-deriving categories and geo

The AFA news pipeline derives `categories` (via `KEYWORDS` regex in
`api/_lib/fraud-news-core.js`) and `state` / `region` (via
`api/_lib/geo-tagger.js`) at the filter/finalize stage. Other apps
can reuse those modules or run their own enrichment.

```js
var core = require('./api/_lib/fraud-news-core');
var geo  = require('./api/_lib/geo-tagger');
var cats = core.tagItem(rec);     // [] | ['Bank fraud', 'Wire fraud', ...]
var loc  = geo.tagGeo(rec);       // { state, stateCode, cities, region, confidence }
```

## Regeneration

```bash
node scripts/news-backfill/run.js harvest   # CDX → state/candidates.json
node scripts/news-backfill/run.js fetch     # Wayback → data/news-archive/*.jsonl (resumable, 2 RPS)
node scripts/news-backfill/run.js filter    # → state/filtered.json
node scripts/news-backfill/run.js finalize  # → api/_lib/news-backfill.json
```

The fetch phase is rate-limit-tolerant (back-off on 429/503) and
resumable — re-running picks up where it left off. Full re-fetch of
all sources at 2 RPS is roughly 2–3 hours.
