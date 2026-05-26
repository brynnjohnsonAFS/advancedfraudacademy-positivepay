# Fraud Themes Affecting Financial Institutions

Data analysis of `data/news-archive/` — 18,701 federal fraud prosecutions
(DOJ HQ + 94 U.S. Attorney's Offices + USPIS), publish dates 2009 → 2026.
Analysis run May 2026.

> **Caveat up front:** 2015 is over-represented in the data due to a
> Wayback re-crawl pattern (3-4× more records than typical years).
> Treat any 2015 number as noisy. Trend analysis below focuses on
> 2020–2026, where coverage is most consistent.

---

## The big picture

**Top fraud typologies across the full archive:**

| Typology         | Cases | % of records | Notes |
|------------------|------:|-------------:|-------|
| Wire fraud       | 5,595 | **29.9%**    | The dominant federal fraud charge. Co-occurs with almost everything else. |
| Money laundering | 3,779 | 20.2%        | Nearly every multi-defendant case has it. Often layers on top of wire/bank fraud. |
| Embezzlement     | 3,051 | 16.3%        | Steady-state, insider-driven, often small-dollar but high-frequency. |
| Bank fraud       | 2,975 | 15.9%        | Direct FI exposure. |
| Identity theft   | 1,997 | 10.7%        | Often paired with bank fraud as the enabling crime. |
| Healthcare fraud | 1,272 |  6.8%        | High-dollar but not in the FI risk lane. |
| Tax fraud        | 1,211 |  6.5%        | High-dollar, often crosses into bank/wire fraud. |
| Mortgage fraud   |   478 |  2.6%        | Declining from a 2015 peak. |
| PPP / COVID fraud|   394 |  2.1%        | Appeared 2020, still being prosecuted in 2025–26. |
| Mail theft       |   326 |  1.7%        | Real signal — accelerating. See theme #2. |
| Check fraud      |   244 |  1.3%        | Underrepresented in keyword count, but see theme #3 — actual exposure is much larger. |
| BEC              |   148 |  0.8%        | Underrepresented; BEC cases often charged simply as "wire fraud." |

**The "where" — top 5 states by case volume (all categories):**

CA (1,535) · FL (1,491) · NY (1,458) · PA (1,300) · MA (888)

Florida punches above weight on **identity theft** (#1 typology there).
New York and Pennsylvania lead on **money laundering**.
Connecticut and Ohio overweight on **embezzlement** — bookkeeper/treasurer
schemes in mid-size markets.

---

## 8 themes worth ideating around

### 1. Wire fraud is the master charge — affects everything

Wire fraud appears in 29.9% of all federal fraud prosecutions and is
the lead charge in most bank-fraud, BEC, and embezzlement cases.
For FIs, this means: **almost any fraud scheme that ultimately moves
money through your rails will be charged as wire fraud.** Anti-wire-
fraud controls (callback verification, dual approval on instruction
changes, anomaly detection on outbound wires) hit the biggest target.

> Recent example: *Defendant Extradited from Nigeria to Face Wire Fraud
> and Money Laundering Charges* — May 2026

**Implication for AFA:** wire fraud framing is universally applicable
in content. Every account briefing should reference a wire-fraud case
relevant to the prospect's region.

---

### 2. Mail theft and check fraud are accelerating together

Mail theft cases per year:
- 2020: 17 · 2021: 32 · 2022: 19 · 2023: 37 · 2024: 33 · **2025: 35**

Check fraud cases (slug-tagged) per year:
- 2020: 11 · 2021: 10 · 2022: 17 · 2023: 20 · 2024: 20 · **2025: 24**

Treasury check fraud specifically has spiked 2024–25 (1 → 10 per year).

The link: stolen mail → washed/altered checks → deposited via mule
accounts. USPIS has 5 standing "scam-alert" pages on mail theft,
check washing, and money mules — those evergreen pages exist because
the problem is sustained.

> Recent examples: *Calumet City Man Sentenced to 12+ Years for
> Mail Theft and Bank Fraud Scheme* · *Brockton Man Pleads Guilty to
> Role in Stolen Treasury Check Fraud* · *Richardson Man Sentenced
> to Federal Prison for Mail Theft*

**Implication for AFA:** check fraud isn't a legacy concern — it's the
front line again. Positive Pay messaging maps directly to the
prosecution narrative. Coordinate Academy content with USPIS
typology cycles.

---

### 3. The 244 "check fraud" tag-count understates real exposure

Only 244 records have "check fraud" in slug/body text — but **2,975
records have "bank fraud,"** and prosecutors routinely charge stolen-
check, forged-check, and check-washing schemes simply as "bank fraud"
or "scheme to defraud." The true check-fraud-related caseload in this
archive is probably 5–10× the slug-tagged count.

This is a content-strategy insight: when AFA cites "X federal check
fraud prosecutions," we should include bank-fraud cases that
mention checks in the body — not just slug-tagged ones. The raw
archive supports that deeper query.

---

### 4. Insider fraud at FIs is a real, prosecutable category

Excluding false positives (the word "lawyer" matched because every
press release names a U.S. Attorney), the real insider-perpetrator
counts:

| Insider role     | Cases | Examples |
|------------------|------:|----------|
| CFO / treasurer  | 568   | Labor-union treasurer embezzlement, IRS-agent CFO laundering $12M |
| Bookkeeper       | 258   | Small-business and nonprofit embezzlement, often 5–10 year schemes |
| Accountant / CPA | 235   | Tax preparer schemes, client-fund theft |
| **Bank teller / employee** | **209** | Direct FI insider fraud — laundering, stolen-check schemes |
| Postal worker    | 146   | Mail theft from the inside — facilitates the check-washing pipeline |
| Pastor / clergy  | 66    | Church and nonprofit fund embezzlement |

**209 federal cases of bank employees as perpetrators** in this
archive. For an FI fraud team, that's a real category — insider
threat isn't theoretical. The cases are searchable, citeable, and
specific.

> Recent example: *Former Bank Employee Pleads Guilty To Laundering
> Embezzled Funds* · *Mesa Woman Convicted of Embezzling Money from
> a Mesa Bank*

---

### 5. The $100K–$10M loss band is the sweet spot

Of the 54% of records where we could extract a dollar figure:

| Loss band       | Cases | % of dollar-tagged |
|-----------------|------:|-------------------:|
| < $10K          |   489 |  4.8% |
| $10K – $100K    |   991 |  9.8% |
| **$100K – $1M** | **3,561** | **35.2%** |
| **$1M – $10M**  | **3,315** | **32.8%** |
| $10M – $100M    | 1,319 | 13.0% |
| $100M+          |   445 |  4.4% |

**68% of federal fraud prosecutions involve losses between $100K
and $10M.** This is exactly the loss band where community FIs feel
real pain (concentrated enough to matter, not large enough to
attract a national bank's full fraud-response apparatus).

Mega-cases (Autonomy at $11.7B, etc.) get the press, but the modal
case is a $1M scheme that hit a regional FI.

**Implication for AFA:** this is the segment we serve. Real cases in
this loss band — not Goldman-Sachs-scale outliers — should anchor
every customer-facing piece.

---

### 6. Nearly half of federal fraud cases involve organized rings

44.1% of records contain multi-defendant or ring/enterprise language.
Lone actors are the minority. This matters because:

- Ring cases expand over time — initial defendant lists often grow
  through superseding indictments. A single ring may hit 20+ FIs.
- Customer accounts adjacent to ring defendants are higher-risk.
  If a defendant in a multi-defendant case banked at a community
  FI, related accounts (shared signers, addresses, devices) are
  worth proactively reviewing.
- Ring cases produce reusable narratives for tabletop exercises:
  "this case happened — your account was bank #4 of 12. What would
  have caught it earlier?"

---

### 7. Geographic hot spots have distinct typology profiles

| State | Top typology | Distinct angle |
|-------|--------------|----------------|
| Florida | Wire (378), **Identity theft (254)** | ID-theft capital — synthetic identity, romance scams, elder fraud |
| New York | Wire (449), Money laundering (324) | Wall Street + Manhattan DA cases skew large |
| Louisiana | **Wire (252)** very heavy for state size | Disproportionate wire-fraud volume |
| Connecticut | **Embezzlement (119)** | Insider/bookkeeper schemes dominate |
| Texas | Money laundering (159) heaviest | Border-related laundering volume |

**Implication for AFA:** vertical/geographic packs are viable. A
"Florida ID-Theft Briefing" or "Connecticut Embezzlement Watch"
pulls from real prosecution density and would feel data-driven, not
pitched.

---

### 8. PPP/COVID fraud is still being prosecuted — late-cycle enforcement signal

PPP/COVID fraud cases by year:
2020: 28 · 2021: 73 · 2022: 78 · 2023: 84 · 2024: 56 · 2025: 56

Still 56 prosecutions in 2025, four years after the program ended.
This is the **enforcement tail** pattern: federal prosecutions lag
the actual fraud by 2-4 years. For predicting where AFA messaging
should focus next, look at **today's incident reports**, not today's
prosecutions. Today's prosecutions reflect 2021-2023 incidents.

The corollary: pig-butchering crypto fraud (currently almost zero in
the prosecution data) will be a top-10 category by 2027-2028. Worth
positioning early.

---

## Named-FI mentions (national institutions)

The data captures explicit mentions of major banks as either victims
or operators in cases:

| FI               | Mentions |
|------------------|---------:|
| Wells Fargo      | 75       |
| Bank of America  | 74       |
| Chase Bank       | 33       |
| American Express | 31       |
| TD Bank          | 28       |
| Capital One      | 21       |
| PNC              | 15       |
| U.S. Bank        | 15       |
| JPMorgan / JPMorgan Chase | 24 combined |
| Navy Federal     | 11       |
| USAA             | 8        |

Plus **376 records mentioning "community bank," "credit union,"
"regional bank," or "savings bank"** generically — 2% of all records.
That's the community FI footprint, and it's real.

---

## Method-of-access patterns (where extraction worked)

| Method                        | Cases | % of records |
|-------------------------------|------:|-------------:|
| Stolen identity / SSN         |   425 |  2.3%        |
| Stolen mail                   |   417 |  2.2%        |
| Stolen / forged checks        |   315 |  1.7%        |
| Counterfeit instruments       |   199 |  1.1%        |
| BEC / wire-instruction change |   144 |  0.8%        |
| Synthetic identity            |    14 |  0.1%        |
| Account takeover              |     9 |  0.0% (under-detected) |
| Phishing                      |    16 |  0.1% (under-detected) |

**Note on under-detection:** federal indictments tend to charge by
statute (wire fraud, bank fraud) rather than describe technique
(phishing, account takeover). The low ATO and phishing counts almost
certainly reflect linguistic conventions in indictments rather than
real incidence rates. For accurate technique frequency, supplement
this dataset with industry incident reports.

---

## What the recent (2024–2026) data is saying

Of the 3,053 records dated 2024 or later:

- Wire fraud still dominates (29.2%, virtually unchanged)
- **Money laundering up to 23.3%** (from 20.2% baseline) — more
  cases now charge laundering alongside the predicate fraud
- **PPP fraud is 4.2% of recent caseload** — still active
- **BEC at 1.7%** is up slightly and likely undercounted
- **Treasury check fraud at 0.6%** is small but rising fast
- Crypto fraud at 1.5% — keep watching, low base, real growth

---

## Bottom line

If we had to pick **three themes** that an FI fraud team needs to be
loud about right now, based on what federal prosecutors are actually
prosecuting:

1. **Wire fraud and money laundering are the default frame.** Any
   message about fraud should expect the bad outcome to be one or
   both. Build controls around the wire and the funds-flow.
2. **Check fraud is back, riding mail theft.** The pipeline of
   stolen mail → washed checks → mule deposits is being prosecuted
   in real volume. Positive Pay is the obvious lever.
3. **Insider risk at FIs is bigger than the industry talks about.**
   209 federal cases of bank employees as perpetrators in this
   archive. Internal-controls messaging has a real basis.

Pick those three for cowork, build everything else around them.
