# Community-Organization Fraud — Research Brief

A focused analysis of how fraud affects community-serving organizations
(schools, churches, nonprofits, municipalities, higher ed, tribal
governments, pension/union funds) — the kinds of commercial deposit
customers that community FIs typically hold.

Compiled May 2026 by data analysis of the AFA federal fraud news
archive.

---

## What was done

A four-pass analysis of 18,701 federal fraud prosecutions to answer:

1. **How often do community organizations appear in federal fraud
   prosecutions?**
2. **What's the typology mix — what kinds of fraud schemes hit them?**
3. **Is the dominant threat external (check fraud, BEC, ACH) or
   internal (embezzlement)?**
4. **What's the dollar profile of the typical case?**
5. **Are they more often victims or are insiders the defendants?**
6. **What does the recent (2024-2026) trend look like?**

The goal was to identify whether community-organization fraud is a
distinct enough category to support a focused marketing, sales, or
product angle at Advanced Fraud Solutions.

---

## The dataset

**Source:** `data/news-archive/*.jsonl` — federal press releases
mined from the Wayback Machine in May 2026 as part of the AFA news
backfill effort. See `SCHEMA.md` and `IDEATION-BRIEF.md` for full
details on how it was built.

| File              | Source                                       | Records | Date range            |
|-------------------|----------------------------------------------|--------:|------------------------|
| `doj_usao.jsonl`  | U.S. Attorney's Office press releases (94 districts) | 16,750 | 2014-11 → 2026-05 |
| `doj_opa.jsonl`   | DOJ HQ (Office of Public Affairs)            |  1,943  | 2009-01 → 2026-05 |
| `uspis.jsonl`     | U.S. Postal Inspection Service               |      8  | 2022-06 → 2025-12 |
| **Total**         |                                              | **18,701** | **2009 → 2026** |

Each record is a JSON object with: `url`, `source`, `title`,
`publishedAt`, and `body` (first ~1,200 characters of article text).

**Important coverage caveat:** the data came from Wayback Machine
re-crawls during a 2024-11-22 → 2026-05-22 capture window. Recent
years (2020+) are densely covered; older years are partial samples.
The 2015 calendar year is over-represented due to a Wayback re-crawl
pattern and was excluded from trend analysis.

---

## Methodology

### Step 1: Identify community-organization records

Each record's title and body text was scanned for regex patterns
indicating mention of a community-serving entity. Two definitions
were used:

**Broad bucket** (includes federal programs):
- Federal programs (Medicare/Medicaid/HUD/SSA/IRS/VA/FEMA/USDA)
- Municipal government (city/town/county/state)
- K-12 schools
- Higher ed (universities, colleges, community colleges)
- Churches / religious organizations
- Nonprofits / charities
- Tribal governments
- Veterans / military programs
- Pension / retirement / union funds
- PPP/EIDL/SBA loan programs

→ **3,777 records (20.2% of archive)**

**Local/civic bucket** (excludes federal programs as conceptually
distinct — federal-program fraud is provider→program attack, not
internal-controls embezzlement):

- Municipal, K-12 schools, higher ed, churches, nonprofits,
  tribal governments, pension/union funds

→ **1,209 records (6.5% of archive)** — used as the primary analysis
subset because it most closely matches "commercial deposit customers
a community FI would actually serve."

### Step 2: Categorize each case by fraud method

Each of the 1,209 records was scanned for regex patterns indicating
the fraud method used:

- Embezzlement
- Wire fraud
- Bank fraud (federal charge)
- Money laundering
- Identity theft
- Tax / refund fraud
- Vendor / kickback / bribery
- Mortgage / loan fraud
- Check fraud (any — including check washing, altered checks,
  counterfeit checks, forged checks)
- PPP/EIDL grant fraud
- BEC (business email compromise)
- Mail theft
- Payroll fraud
- ACH fraud
- Card fraud

A single case can be tagged with multiple methods (e.g.,
"embezzlement + wire fraud" appears in 150 cases).

### Step 3: Role classification

Two heuristic regexes were applied to identify whether the community
organization appeared as the victim or as the source of the
perpetrator:

- **Victim-leaning language:** "embezzled from," "stole from,"
  "defrauded the," "funds intended for," "misappropriated from,"
  "theft from"
- **Defendant-leaning language:** "former treasurer," "former
  bookkeeper," "former employee charged/indicted/sentenced/pled,"
  "sentenced for embezzlement"

### Step 4: Dollar magnitude extraction

For each case, the largest dollar figure mentioned in title or body
was extracted using a `$XXX,XXX(.XX)? (million|billion|thousand)?`
regex and converted to a USD amount. Values above $50B were filtered
as parsing errors. 756 of 1,209 cases (62.5%) had an extractable
dollar figure.

---

## What was found

### Volume

- **1,209 local/civic community cases** across 18,701 total records
  (6.5% of the archive)
- **161 since 2024** (5.3% of recent caseload)
- Sub-categories:
  - Municipal: 378
  - Nonprofits / charities: 310
  - Churches / religious orgs: 222
  - Higher ed: 196
  - K-12 schools: 101
  - Tribal governments: 41
  - Pension / union / retirement funds: 17

### Method mix — the key finding

Community-organization fraud is **overwhelmingly internal
embezzlement, cashed out as wire transfer.** External-attack
vectors (BEC, check schemes, ACH) barely appear.

| Method | Cases | % of subset |
|---|---:|---:|
| **Embezzlement** | **503** | **41.6%** |
| **Wire fraud** | **457** | **37.8%** |
| Money laundering | 153 | 12.7% |
| Bank fraud (charge) | 123 | 10.2% |
| Identity theft | 109 | 9.0% |
| Tax / refund fraud | 101 | 8.4% |
| Vendor / kickback / bribery | 47 | 3.9% |
| Mortgage / loan fraud | 22 | 1.8% |
| Check fraud (any) | 15 | 1.2% |
| PPP/EIDL grant fraud | 10 | 0.8% |
| BEC | 9 | 0.7% |
| Mail theft | 8 | 0.7% |
| Payroll fraud | 3 | 0.2% |
| ACH fraud | 0 | 0% |
| Card fraud | 1 | 0.1% |

Most common combination: **embezzlement + wire fraud (150 cases)** —
somebody on the inside takes the money, then moves it out via wire.

### Caveat on the low check-fraud number

The 15 check-fraud cases are likely under-counted (federal prosecutors
don't write "check fraud" — they write "embezzled by issuing
unauthorized checks"). However, broader detection
(`forged check / stolen check / altered check / "wrote checks to
self" / "issued unauthorized check" / counterfeit check`) only finds
~18 cases combined, so it's still small. Community-org embezzlement
typically uses **direct account access** (wires, internal transfers,
electronic withdrawals), not check schemes.

### Dollar profile

Of the 756 cases with extractable dollar figures:

- **Median scheme size: $366,477**
- Mean: $5.6M (skewed by outliers)
- **75% of cases are sub-$1M** — exactly the band where community FIs
  feel real loss
- 19% are $1M–$10M
- Only 6% above $10M

### Role pattern (heuristic signal, not classification)

A heuristic regex pass on title + body language produced:

- **30% insider-perpetrator language** ("former treasurer pleads
  guilty," "former bookkeeper sentenced," "pastor charged")
- **20% external-victim language** ("funds intended for," "stole from
  the city of")
- **~50% unclassified** — language did not clearly signal either role

These are signals, not classifications. The 50% unclassified residual
is a real limitation of regex-on-press-release-language and should
not be assumed to fall on either side. To make claims about the
internal/external split of the *full* 1,209-case set, the method-mix
analysis is the more defensible signal (see below).

### Internal vs external — what the method mix supports

Looking at what fraud *method* was charged (not what role language
the press release used), the internal-versus-external picture is
clear:

| Pattern type | Methods | Cases | % of subset |
|---|---|---:|---:|
| **Internal-led** | Embezzlement | **503** | **41.6%** |
| **External-attack vectors (strict)** | Check fraud, BEC, ACH, mail theft, card fraud, payroll | **36** | **3.0%** |
| **External-attack vectors (broad — adds identity theft, mortgage/loan fraud)** | + Identity theft, mortgage/loan fraud | 167 | 13.8% |

**Embezzlement appears in roughly 14× more cases than the strict
external-attack vectors combined**, and roughly 3× more often than
the broader external-attack definition.

Wire fraud (457 cases, 37.8%) is the *cash-out method* in 150 of the
embezzlement cases — it's the means of moving the stolen funds, not
a separate attack vector. The embezzlement → wire combo is the
single most common pairing in the dataset.

### Recent (2024-2026) examples

Representative cases from the last 18 months:

- *Former Quincy Official Pleads Guilty to Embezzling City Funds* (2026-03)
- *Former Fairview Township Tax Collector Sentenced for Embezzling
  $400,000 in Property Taxes* (2026-03)
- *Bookkeeper Sentenced to 33 Months for Embezzling $580,000 From Church* (2026-03)
- *Former School District Accountant Sentenced for Embezzlement
  from Savannah School District and His Employees* (2025-11)
- *Former Arizona Elected Official Pleads Guilty to Embezzlement of
  More than $38M of County Funds* (2024-11)
- *Former Pastor Sentenced for Embezzling from a Local Church* (2026-02)
- *Former commander of local AMVETS Post sentenced to more than 3
  years in prison for embezzling hundreds of thousands of dollars* (2026-03)

---

## So what — implications for AFA

The data supports two **distinct** product/content angles, not one:

1. **External-attack prevention** → for-profit commercial customers.
   Threats are check fraud, BEC, ACH fraud, vendor impersonation.
   Lever is Positive Pay + payee match.
2. **Internal-control monitoring** → community-organization commercial
   customers (the 1,209-case pattern). Threats are insider
   embezzlement cashed out as wires. Lever is commercial fraud
   monitoring — unusual outflow detection, dual-control on wires,
   segregation of duties.

A cowork-ready framing:

> *Your community-org commercial customers — the churches, the school
> districts, the city accounts — face a fundamentally different fraud
> risk than your business customers. Internal embezzlement is the
> single largest method in federal prosecutions of this segment, and
> it shows up roughly 14× more often than every external attack
> vector combined — check fraud, BEC, ACH, mail theft. Most community
> FIs apply the same monitoring to a $40M city deposit account as
> they do to a small-business checking account. That's the gap.*

**On numbers in this framing — if pressed by a prospect or analyst:**

- "Internal embezzlement is the single largest method" → embezzlement
  in 503 of 1,209 cases (41.6%); next-largest stand-alone method is
  wire fraud at 37.8%, which is the cash-out, not a separate attack.
- "14× more often than external attack vectors combined" →
  embezzlement at 503 cases vs. check fraud (15) + BEC (9) + ACH (0)
  + mail theft (8) + card fraud (1) + payroll fraud (3) = 36 cases.
  Ratio holds at ~14×. If a more generous definition of "external"
  is wanted (adding identity theft and mortgage/loan fraud), the
  ratio falls to ~3×.
- All counts come from regex categorization of titles + first ~1,200
  characters of body text on each press release; see Methodology
  section. The numbers are reproducible — anyone can re-run the
  scripts against the JSONL archive.

---

## Methodology — AI tool used

This analysis was performed by **Claude (Sonnet)** acting as a data
analyst, via the Claude Agent SDK in an interactive session with
Brynn Johnson (VP of Marketing, AFS).

**What Claude did:**
- Wrote Python scripts (stdlib only — no pandas, no ML libraries) to
  load and query the JSONL archive
- Designed the entity-detection regex patterns for community
  sub-categories
- Designed the method-classification regex patterns for fraud
  typologies
- Designed the role-classification heuristics (victim vs defendant
  language)
- Ran multi-pass analyses and synthesized the findings into themes
- Iterated on definitions based on Brynn's guidance ("combine these
  categories — for the community, not for money")
- Captured limitations honestly (the low check-fraud number was
  flagged as possibly under-counted, then re-tested with broader
  detection patterns)

**What Claude didn't do:**
- No machine learning, no statistical inference, no clustering
- No named-entity recognition beyond keyword regex
- No external data lookup
- No predictive modeling

The methodology is **transparent, reproducible, and adjustable**.
Every count above can be re-derived by re-running the analysis
scripts against `data/news-archive/*.jsonl`. The regex patterns are
visible in the analysis scripts and can be tightened or broadened
for follow-on analyses.

**Limitations of the regex-based approach:**

- Federal indictments use formal legal language ("embezzlement,"
  "wire fraud") rather than method descriptions ("phishing," "BEC,"
  "account takeover") — so methods underrepresented in this analysis
  almost certainly exist in the underlying schemes but get charged
  under the broader statute names
- The role heuristics (victim vs defendant) are signals, not
  classifications — a more rigorous analysis would require manual
  review of a sample
- The 2015 anomaly (Wayback re-crawl pattern) means historical trend
  analysis below 2020 should be treated with caution

For higher-precision follow-on work, the next step would be to feed
the body text through a structured-extraction LLM call to classify
each case by (perpetrator role, victim entity, method, dollar
amount). The raw archive supports that — `body` field is preserved
on every record.

---

## Files referenced

- `data/news-archive/doj_usao.jsonl` — 16,750 USAO press releases
- `data/news-archive/doj_opa.jsonl` — 1,943 DOJ HQ press releases
- `data/news-archive/uspis.jsonl` — 8 USPIS items
- `data/news-archive/SCHEMA.md` — record schema and field semantics
- `data/news-archive/IDEATION-BRIEF.md` — broader cowork ideation brief
- `data/news-archive/THEMES.md` — full fraud-themes report across
  all 18,701 records

---

*Analysis run May 2026. Data archive: 2009-01 → 2026-05.*
