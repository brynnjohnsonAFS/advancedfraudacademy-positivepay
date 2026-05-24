# AFA News Archive — Cowork Ideation Brief

A structured, queryable record of every federal fraud prosecution and
postal-inspection case published in the last 18 months. Originally built
to populate the AFA news page, but the raw data is broader than what the
news page surfaces — it's a real asset for marketing, sales, customer
education, and analytics.

---

## TL;DR

We pulled every U.S. Attorney's Office press release, every DOJ Office
of Public Affairs press release, and every USPIS news item from the
last 18 months — roughly **18,700 records** — and turned each one into
a clean JSON object with title, publication date, source URL, and full
article body text. The data sits in `data/news-archive/` and is
reusable by any other application or analysis we want to build.

---

## What we now have

Three files under `data/news-archive/`:

| File              | What's in it | Approximate count |
|-------------------|--------------|-------------------|
| `doj_usao.jsonl`  | Press releases from the 94 U.S. Attorney's Offices (the district-level federal prosecutors — SDNY, NDIL, EDLA, etc.) | ~16,760 |
| `doj_opa.jsonl`   | Press releases from DOJ HQ (Office of Public Affairs — national-scale cases) | ~1,943 |
| `uspis.jsonl`     | USPIS press releases + standing "scam article" pages on check washing, money mules, mail theft | ~10 |

Each file is **JSONL** — one JSON object per line. Easy to stream-process
in any language, easy to load into a dataframe, easy to grep.

**Important context:** these aren't only check-fraud cases. The data
covers a deliberately broad fraud-related slug filter (see "How it was
assembled" below), so it includes:

- Check fraud, check washing, counterfeit checks, altered checks
- Mail theft, mail fraud
- Wire fraud
- Bank fraud
- ACH fraud
- Business Email Compromise (BEC)
- Money laundering, money mules
- Embezzlement
- Treasury check fraud
- Fraud rings, fraud schemes, fraud conspiracies
- Forgery

That breadth is intentional — the AFA news page narrows it further to
check-fraud-specific cases, but other applications can use the wider
set.

---

## What's in each record

Every line in every file is a JSON object with these fields:

```json
{
  "url": "https://www.justice.gov/usao-ndoh/pr/clevelander-sentenced-12-years-prison-bank-fraud-scheme",
  "source": "DOJ",
  "waybackTimestamp": "20250307183312",
  "title": "Clevelander Sentenced to 12 Years in Prison for Bank Fraud Scheme",
  "publishedAt": "2025-03-07T00:00:00.000Z",
  "body": "A Cleveland-area man was sentenced today to 12 years in prison for orchestrating a multi-year bank fraud scheme that targeted seven community banks across northeast Ohio..."
}
```

| Field             | Meaning |
|-------------------|---------|
| `url`             | Canonical link back to the original press release. Tracking params and share-link noise stripped. |
| `source`          | Human label: `DOJ` or `USPIS`. Note the file name tells you whether it's HQ vs USAO. |
| `waybackTimestamp`| When the Internet Archive crawled the page (YYYYMMDDhhmmss). Used internally; rarely needed downstream. |
| `title`           | Press release headline. Site-suffix junk stripped ("— Department of Justice", etc.). |
| `publishedAt`     | Best-effort actual publish date in ISO 8601. Pulled from page meta when present, falls back to visible date in body. |
| `body`            | First ~1,200 characters of article text with HTML, scripts, nav, and footer cruft stripped. For full-length text, refetch from the URL or the Wayback snapshot. |

**Derivable fields** (not stored, but trivial to compute):

- **District** — for USAO items, the URL pattern `/usao-<district>/pr/` carries the district code. e.g. `usao-sdny` → Southern District of New York.
- **State / region** — there's a geo-tagging module at `api/_lib/geo-tagger.js` that takes a record and returns `{ state, stateCode, cities, region }`.
- **Categories** — a keyword classifier at `api/_lib/fraud-news-core.js` (the `tagItem` function) returns the list of fraud typologies that match a record. e.g. `['Check fraud', 'Bank fraud']`.

These are derived at read time in the AFA news pipeline. Other apps can
reuse those modules or apply their own logic.

---

## How it was assembled

Briefly, so you can explain it to others — and so you can judge its
reliability:

1. **Discovery.** We queried the Internet Archive's CDX API for every
   URL captured under `justice.gov/opa/pr/*`, `justice.gov/usao-*/pr/*`,
   and `uspis.gov/news/*` between 2024-11-22 and 2026-05-22. That gave
   us ~318,000 candidate URLs.
2. **Slug filter.** We dropped any URL whose path didn't hint at fraud
   ("check fraud", "wire fraud", "embezzl", "money launder", "bank
   fraud", etc.). That narrowed it to ~18,700 candidates.
3. **Fetch.** For each remaining URL we pulled the page content from
   the Internet Archive (`web.archive.org`), not from the original
   site. The original federal sites block automated scraping; the
   Internet Archive does not. This took roughly 2.5 hours at a polite
   2 requests per second.
4. **Parse.** Each page's HTML was reduced to title + publish date +
   body text using simple regex extraction (the same zero-deps style
   as the rest of the project).
5. **Store.** Results written line-by-line to the JSONL files above.
   Resumable — if the pipeline is interrupted, re-running picks up
   exactly where it left off, no duplicate work.

The pipeline lives in `scripts/news-backfill/run.js`. Re-running it
later (e.g. to extend the window or pull a new source) is one
command per phase.

---

## Why this dataset is unusual

A few things make it worth ideating around, not just a one-off pull:

- **Authoritative sources only.** Every record is a federal-government
  press release. No aggregator gossip, no SEO-spam blogs, no AI
  summaries of someone else's reporting. If we cite a case, we can
  cite the indictment.
- **Built-in geography.** Every USAO record's URL tells you which
  district prosecuted the case. That gives us city/state/region
  resolution out of the box.
- **Built-in date.** Every record has a real publication date, not
  just the date we scraped it. We can do temporal analysis without
  worrying about crawl artifacts.
- **Full text searchable.** The body field has the lede paragraph and
  often more. Defendant names, dollar amounts, fraud methods, named
  victim institutions, indictment counts — all extractable.
- **Free to reuse.** Federal government press releases are public
  domain. No license headaches.
- **Reproducible.** The pipeline is committed code. Anyone can re-run
  it, extend the window, or add a source.

---

## Application directions to ideate around

These are starting points, not a roadmap. Categorized so cowork can
pick a lane.

### Marketing content

- **Weekly newsletter "Federal Fraud Roundup"** — auto-curated digest of
  the past week's most newsworthy cases, with AFA commentary on what
  it means for community FIs.
- **"Case of the week" LinkedIn series** — short post citing a real
  prosecution, linking the typology to a Positive Pay capability or
  Academy lesson.
- **Annual / quarterly trend reports** — "Check Fraud Prosecutions in
  Review: Q1 2026." Aggregate stats AFS could publish to build
  authority and earn backlinks.
- **Geographic heat maps** — interactive map of federal fraud
  prosecutions by district. Visual asset for blog, deck, social.
- **Embeddable widgets** — "fraud activity in your state" lookup that
  community FIs can put on their own sites with AFA attribution.

### Sales enablement

- **Account briefings** — when AE researches a prospect FI, surface
  federal cases in their region or naming similar-size FIs as victims.
- **Objection handling** — when a prospect says "we don't see this in
  our area," instantly pull up two or three local prosecutions.
- **Battlecard enrichment** — group cases by fraud method to support
  positioning of specific AFS capabilities.
- **Trigger events** — flag prospect FIs that appear by name as
  victims in a recent case. That's a warm lead signal.
- **Vertical packs** — cases by industry (real estate, healthcare,
  municipal, school districts) for vertical-specific outreach.

### Customer education

- **Real case studies for the Academy** — replace hypothetical
  examples in lessons with anonymized real prosecutions.
- **Tabletop exercise prompts** — "this case happened. How would
  Positive Pay have caught it? What detection gap let it through?"
- **Annual training certificate continuing-ed content** — quarterly
  updates drawn from new prosecutions.

### Sales intelligence + competitive

- **Named-FI database** — extract every financial institution
  mentioned as a victim in a case. Cross-reference with our CRM.
- **Competitor mentions** — if a prosecution references a fraud
  prevention product that failed, that's worth knowing.
- **DOJ enforcement priorities** — track which fraud types DOJ is
  prosecuting most. Leading indicator of where customer pain will
  spike next.

### Analytics + product

- **Detection-gap analysis** — for each case, classify how the fraud
  evaded controls. Feed into product roadmap.
- **Loss-figure trends** — extract dollar amounts from body text,
  trend over time and by region.
- **Defendant networks** — multi-defendant cases tend to expand;
  cross-reference defendant names across prosecutions.

### Other

- **Speaking opportunities** — themes drawn from active prosecutions
  fuel conference proposals and webinar topics.
- **Press / PR** — quote AFA as a source on prosecution trends.
  Position as the "we have the data" voice in the segment.
- **Lead magnet** — gated "Federal Fraud Index" report. Email capture
  in exchange for the aggregate stats.

---

## What this dataset can't do

Be honest about limits, especially in cowork — better to surface gaps
now than discover them mid-project:

- **Snapshot, not real-time.** The data reflects when the pipeline
  last ran. Re-running takes 2.5 hours. For live ticker use, the
  existing live aggregator at `/api/fraud-news` is the right tool.
- **FBI HQ is sparse.** Our slug filter didn't catch many FBI
  press-release URLs (their headlines tend not to include fraud
  typology in the slug). FBI HQ items in the live aggregator come
  through RSS, not this archive.
- **No CourtListener.** Federal court filings (indictments, plea
  agreements) aren't in this archive yet — they need a separate API
  token from courtlistener.com. Phase 2 if useful.
- **Body text is excerpted, not full-length.** First ~1,200 characters
  per record. For full text, the `url` is canonical; refetch as needed.
- **~5% of pages have empty bodies.** Some Wayback snapshots are
  incomplete. Title + date are still usable on those records.
- **Window-bounded.** 2024-11-22 through pipeline run date. Going
  earlier requires re-running with a wider window.
- **USPIS is thin.** Only ~10 USPIS records matched the slug filter
  in the window. Their archive may also be shallower than DOJ's.
- **Not de-duplicated across sources.** Same case can appear as a
  USAO release AND a DOJ HQ release. The AFA-facing
  `news-backfill.json` dedupes; the raw archive does not.

---

## How to load the data

Pick the snippet for whichever environment cowork wants to use.

### Node.js (streaming, low memory)

```js
var fs = require('fs');
var readline = require('readline');

readline.createInterface({
  input: fs.createReadStream('data/news-archive/doj_usao.jsonl')
}).on('line', function (line) {
  var rec = JSON.parse(line);
  // do something with rec.title, rec.publishedAt, rec.body...
});
```

### Python (bulk load to dataframe)

```python
import pandas as pd
df = pd.read_json('data/news-archive/doj_usao.jsonl', lines=True)
df['publishedAt'] = pd.to_datetime(df['publishedAt'])
recent_check_fraud = df[
    df['publishedAt'].dt.year == 2025
].query('body.str.contains("check fraud", case=False)')
```

### Quick grep from the shell

```bash
# Find all cases mentioning "check washing"
grep -i "check washing" data/news-archive/*.jsonl | wc -l

# Pull titles of the 10 most recent
jq -r '.title' data/news-archive/doj_usao.jsonl | tail -10
```

---

## What's already built on top of it

For context — the AFA news page is the first consumer, so cowork can
see one finished example of what an application looks like:

- **Filter to check-fraud only:** `api/_lib/news-backfill.json`
  contains the subset that passed the tight `KEYWORDS` regex from
  `api/_lib/fraud-news-core.js`, with geo-tags and deduplication
  applied. ~750 items.
- **Merge with live feed:** `api/_lib/fraud-news-core.js` reads
  `news-backfill.json` at request time, concatenates with current
  RSS pulls, dedupes, and serves both via `/api/fraud-news`.
- **Renders at:** `positivepay/news/` on the live site.

That whole flow is reproducible. Any other application built on this
data follows the same pattern: load JSONL → filter / enrich for the
use case → render or analyze.

---

*Pipeline source: `scripts/news-backfill/run.js`. Full record-shape
documentation: `data/news-archive/SCHEMA.md`. Live aggregator that
consumes the filtered view: `api/_lib/fraud-news-core.js`.*
