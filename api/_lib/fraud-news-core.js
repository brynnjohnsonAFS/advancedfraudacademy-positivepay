/* Advanced Fraud Academy — fraud-news-core.js
   Shared aggregation library. Used by api/fraud-news.js (UI ticker)
   and api/fraud-digest-csv.js (geo-tagged CSV digest for outreach).

   Zero dependencies. CommonJS, Vercel Node runtime.
*/

'use strict';

// ── Source feeds ─────────────────────────────────────────────────────────────
// Per-feed metadata:
//   googleNews:     true → parse <source> for the real publication, strip
//                          " - Publication" suffix from titles
//   audienceFilter: true → only keep items whose title/summary mentions a
//                          bank, credit union, FI, or related audience term
//   maxAgeDays:     number → drop items older than N days
//   grouping:       'breaking' (default) | 'research-data' — items tagged
//                   'research-data' are hidden from the default news list
//                   until the user opts in. Keeps survey/trend data from
//                   crowding out breaking-case items.
//   trustQuery:     true → the source URL is a pre-filtered search; skip the
//                   in-app keyword filter and force-tag with defaultCategory.
//                   Use for CourtListener saved searches where item titles
//                   are bare case captions (e.g. "United States v. Thao").
//   defaultCategory: string → category applied when trustQuery is true.
//
// Manual sources NOT in this list (no clean RSS — needs editorial check):
//   • FinCEN advisories (fincen.gov/news_room)
//   • Nacha payments fraud resources (nacha.org)
//   • ABA Deposit Account Fraud Survey (aba.com)
//   • GSU Evidence-Based Cybersecurity Research Group (ebcs.gsu.edu)
var FEEDS = [
  {
    name: 'FBI',
    type: 'atom',
    url: 'https://www.fbi.gov/feeds/national-press-releases/atom.xml'
  },
  {
    name: 'DOJ',
    type: 'rss',
    url: 'https://www.justice.gov/feeds/justice-news.xml'
  },
  {
    name: 'USPIS',
    type: 'rss',
    url: 'https://www.uspis.gov/feed'
  },
  {
    name: 'Krebs on Security',
    type: 'rss',
    url: 'https://krebsonsecurity.com/feed/'
  },
  {
    name: 'SecurityWeek',
    type: 'rss',
    url: 'https://www.securityweek.com/feed/'
  },
  {
    name: 'ABA Banking Journal',
    type: 'rss',
    url: 'https://bankingjournal.aba.com/feed/'
  },
  {
    name: 'BleepingComputer',
    type: 'rss',
    url: 'https://www.bleepingcomputer.com/feed/'
  },

  // ── CourtListener saved searches ─────────────────────────────────────────
  // Federal/state filings — indictments and complaints, often available
  // before any press release. Item titles are bare case captions, so the
  // search query is the relevance filter (trustQuery skips KEYWORDS check).
  // maxAgeDays guards against alert volume noted in ticket open questions.
  {
    name: 'CourtListener',
    type: 'atom',
    trustQuery: true, defaultCategory: 'Court filing', maxAgeDays: 30,
    url: 'https://www.courtlistener.com/feed/search/?q=%22check+fraud%22&type=r'
  },
  {
    name: 'CourtListener',
    type: 'atom',
    trustQuery: true, defaultCategory: 'Court filing', maxAgeDays: 30,
    url: 'https://www.courtlistener.com/feed/search/?q=%22check+washing%22+OR+%22mail+theft%22&type=r'
  },

  // ── Research & Data ──────────────────────────────────────────────────────
  // Aggregate/trend data — surfaces alongside breaking items only when the
  // user opts in via the "Research & Data" toggle. Keyword filter still
  // narrows the broad Fed press feed to payments/check fraud topics.
  {
    name: 'Federal Reserve',
    type: 'rss',
    grouping: 'research-data', maxAgeDays: 120,
    url: 'https://www.federalreserve.gov/feeds/press_all.xml'
  },

  // ── Google News searches ──────────────────────────────────────────────────
  // Google Alerts-style aggregation. Queries combine the fraud term with
  // audience terms so Google does the first-pass relevance filtering.
  // We then apply: max 30 days old + audience keyword must be present in the
  // title or summary. Source is extracted from the embedded <source> tag.
  {
    name: 'Google News',
    type: 'rss',
    googleNews: true, audienceFilter: true, maxAgeDays: 30,
    url: 'https://news.google.com/rss/search?q=%22check+fraud%22+(bank+OR+%22credit+union%22+OR+%22financial+institution%22)&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Google News',
    type: 'rss',
    googleNews: true, audienceFilter: true, maxAgeDays: 30,
    url: 'https://news.google.com/rss/search?q=%22wire+fraud%22+(bank+OR+%22credit+union%22+OR+%22financial+institution%22)&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Google News',
    type: 'rss',
    googleNews: true, audienceFilter: true, maxAgeDays: 30,
    url: 'https://news.google.com/rss/search?q=%22ACH+fraud%22+OR+%22ACH+scam%22+(bank+OR+%22credit+union%22+OR+%22financial+institution%22)&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Google News',
    type: 'rss',
    googleNews: true, audienceFilter: true, maxAgeDays: 30,
    url: 'https://news.google.com/rss/search?q=%22check+washing%22+(bank+OR+%22credit+union%22+OR+mail+OR+treasury)&hl=en-US&gl=US&ceid=US:en'
  },

  // Tuned regional alerts — small-dollar arrests that won't pass audienceFilter
  // because they rarely mention an FI by name. KEYWORDS gate them via
  // "mail theft" / "check fraud" terms instead.
  {
    name: 'Google News',
    type: 'rss',
    googleNews: true, maxAgeDays: 30,
    url: 'https://news.google.com/rss/search?q=%22mail+theft%22+(arrest+OR+indicted+OR+charged+OR+sentenced)&hl=en-US&gl=US&ceid=US:en'
  },
  {
    name: 'Google News',
    type: 'rss',
    googleNews: true, maxAgeDays: 30,
    url: 'https://news.google.com/rss/search?q=%22check+fraud+ring%22+OR+%22check+washing+ring%22&hl=en-US&gl=US&ceid=US:en'
  }
];

// ── Audience-relevance filter ────────────────────────────────────────────────
// For Google News results, the story must mention at least one of these
// so we don't pollute the ticker with unrelated retail/consumer fraud.
var AUDIENCE_PATTERN = /\b(bank|banking|credit\s+union|financial\s+institution|community\s+FI|FDIC|NCUA|treasury|commercial\s+deposit|business\s+account|business\s+client|business\s+payment)\b/i;

// ── Keyword filter ───────────────────────────────────────────────────────────
// A story must match at least one of these (in title or summary) to be included.
// Each entry is { pattern: RegExp, category: string } so we can also tag stories.
var KEYWORDS = [
  { pattern: /\bcheck\s+fraud\b/i,                 category: 'Check fraud' },
  { pattern: /\bcheck[-\s]?washing\b/i,            category: 'Check fraud' },
  { pattern: /\baltered\s+check\b/i,               category: 'Check fraud' },
  { pattern: /\bcheck\s+kiting\b/i,                category: 'Check fraud' },
  { pattern: /\bcounterfeit\s+check\b/i,           category: 'Check fraud' },
  { pattern: /\bach\s+fraud\b/i,                   category: 'ACH fraud' },
  { pattern: /\bunauthorized\s+ach\b/i,            category: 'ACH fraud' },
  { pattern: /\bwire\s+fraud\b/i,                  category: 'Wire fraud' },
  { pattern: /\bwire[-\s]transfer\s+fraud\b/i,     category: 'Wire fraud' },
  { pattern: /\bbusiness\s+email\s+compromise\b/i, category: 'BEC' },
  { pattern: /\bbec\b/,                            category: 'BEC' }, // case-sensitive — avoid matching "because"
  { pattern: /\bvendor\s+impersonation\b/i,        category: 'BEC' },
  { pattern: /\bpayroll\s+fraud\b/i,               category: 'Payroll fraud' },
  { pattern: /\btreasury\s+fraud\b/i,              category: 'Treasury fraud' },
  { pattern: /\bpositive\s+pay\b/i,                category: 'Positive Pay' },
  { pattern: /\bpayee\s+match\b/i,                 category: 'Positive Pay' },
  { pattern: /\bbank\s+fraud\b/i,                  category: 'Bank fraud' },
  { pattern: /\bcredit\s+union\s+fraud\b/i,        category: 'FI fraud' },
  { pattern: /\bfinancial\s+institution\s+fraud\b/i, category: 'FI fraud' },
  { pattern: /\bembezzl/i,                         category: 'Embezzlement' },
  { pattern: /\bcheck\s+scheme\b/i,                category: 'Check fraud' },
  { pattern: /\bmail\s+theft\b/i,                  category: 'Check fraud' }, // a common precursor to check washing
  { pattern: /\bscheme\s+to\s+defraud\b/i,         category: 'Fraud scheme' },
  { pattern: /\bmoney\s+mule\b/i,                  category: 'Money mules' },
  { pattern: /\bdeposit\s+fraud\b/i,               category: 'Deposit fraud' },
  { pattern: /\belder\s+fraud\b/i,                 category: 'Elder fraud' },
  { pattern: /\bromance\s+scam\b/i,                category: 'Elder fraud' },
  { pattern: /\bsynthetic\s+identit/i,             category: 'Identity fraud' },
  { pattern: /\baccount\s+takeover\b/i,            category: 'ATO' },
  { pattern: /\bcheck\s+verification\b/i,          category: 'Check fraud' }
];

// ── Tiny regex-based RSS / Atom parser ───────────────────────────────────────

function decodeEntities(s) {
  if (!s) return '';
  // Order matters: unwrap CDATA, decode entities FIRST (so entity-escaped HTML
  // like &lt;a href=...&gt; becomes real tags), then strip tags.
  // Run the entity decode twice to catch double-encoded content
  // (Google News descriptions are often &amp;lt;a&amp;gt;… i.e. double-escaped).
  var out = s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (var i = 0; i < 2; i++) {
    out = out
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, code) { return String.fromCharCode(parseInt(code, 10)); })
      .replace(/&#x([0-9a-f]+);/gi, function (_, code) { return String.fromCharCode(parseInt(code, 16)); })
      .replace(/&nbsp;/g, ' ');
  }
  return out
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatch(s, re) {
  var m = s.match(re);
  return m ? m[1] : '';
}

function parseRss(xml) {
  var items = [];
  var blockRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  var m;
  while ((m = blockRe.exec(xml)) !== null) {
    var b = m[1];
    items.push({
      title: decodeEntities(firstMatch(b, /<title[^>]*>([\s\S]*?)<\/title>/i)),
      url: decodeEntities(firstMatch(b, /<link[^>]*>([\s\S]*?)<\/link>/i)),
      pubDate: decodeEntities(
        firstMatch(b, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
        firstMatch(b, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i)
      ),
      summary: decodeEntities(
        firstMatch(b, /<description[^>]*>([\s\S]*?)<\/description>/i) ||
        firstMatch(b, /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)
      ),
      sourceName: decodeEntities(firstMatch(b, /<source[^>]*>([\s\S]*?)<\/source>/i))
    });
  }
  return items;
}

function parseAtom(xml) {
  var items = [];
  var blockRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  var m;
  while ((m = blockRe.exec(xml)) !== null) {
    var b = m[1];
    var linkHref = firstMatch(b, /<link[^>]*href="([^"]+)"/i);
    items.push({
      title: decodeEntities(firstMatch(b, /<title[^>]*>([\s\S]*?)<\/title>/i)),
      url: linkHref,
      pubDate: decodeEntities(
        firstMatch(b, /<published[^>]*>([\s\S]*?)<\/published>/i) ||
        firstMatch(b, /<updated[^>]*>([\s\S]*?)<\/updated>/i)
      ),
      summary: decodeEntities(
        firstMatch(b, /<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
        firstMatch(b, /<content[^>]*>([\s\S]*?)<\/content>/i)
      )
    });
  }
  return items;
}

// Parse a date string into ISO. Returns null for missing or unparseable input
// — avoids throwing inside the per-feed map when a publisher emits weird dates.
function toIsoOrNull(s) {
  if (!s) return null;
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Feed fetch + normalize ───────────────────────────────────────────────────

async function fetchFeed(feed) {
  try {
    var res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'AdvancedFraudAcademy/1.0 (+https://advancedfraudacademy.com)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    if (!res.ok) {
      console.warn('[fraud-news-core]', feed.name, 'returned', res.status);
      return [];
    }
    var xml = await res.text();
    var parsed = feed.type === 'atom' ? parseAtom(xml) : parseRss(xml);

    var nowMs = Date.now();
    var maxAgeMs = feed.maxAgeDays ? feed.maxAgeDays * 24 * 60 * 60 * 1000 : null;

    return parsed.map(function (it) {
      var sourceName = feed.name;
      var title = it.title || '';
      var summary = it.summary || '';
      if (feed.googleNews && it.sourceName) {
        sourceName = it.sourceName;
        var suffix = new RegExp('\\s+[-‐-―]\\s+' +
          it.sourceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
        title = title.replace(suffix, '').trim();
        // Google News RSS doesn't carry real article excerpts — drop the
        // redundant <description> that just repeats the title.
        summary = '';
      }
      return {
        title: title,
        url: it.url,
        source: sourceName,
        publishedAt: toIsoOrNull(it.pubDate),
        summary: summary ? summary.slice(0, 400) : '',
        grouping: feed.grouping || 'breaking',
        trustQuery: !!feed.trustQuery,
        defaultCategory: feed.defaultCategory || null
      };
    }).filter(function (it) {
      if (!it.title || !it.url) return false;
      if (maxAgeMs && it.publishedAt) {
        var age = nowMs - Date.parse(it.publishedAt);
        if (age > maxAgeMs) return false;
      }
      if (feed.audienceFilter) {
        var hay = (it.title || '') + ' ' + (it.summary || '');
        if (!AUDIENCE_PATTERN.test(hay)) return false;
      }
      return true;
    });
  } catch (e) {
    console.warn('[fraud-news-core]', feed.name, 'fetch error:', e.message);
    return [];
  }
}

// ── Keyword match → tag with categories ──────────────────────────────────────

function tagItem(item) {
  var hay = (item.title + ' ' + item.summary);
  var cats = [];
  for (var i = 0; i < KEYWORDS.length; i++) {
    if (KEYWORDS[i].pattern.test(hay)) {
      if (cats.indexOf(KEYWORDS[i].category) === -1) cats.push(KEYWORDS[i].category);
    }
  }
  return cats;
}

// ── Dedupe ───────────────────────────────────────────────────────────────────

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[‘’“”'']/g, "'")
    .replace(/'s\b/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(gov|govs|former|federal|feds|fbi|doj|the|a|an|to|of|for|and|in|at|on)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleKey(t) {
  var n = normalizeTitle(t);
  return n.split(' ').slice(0, 5).join(' ');
}

function dedupe(items) {
  var seenUrls = {};
  var seenTitles = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var urlKey = (items[i].url || '').split('#')[0];
    if (!urlKey || seenUrls[urlKey]) continue;

    var tk = titleKey(items[i].title);
    if (tk && tk.split(' ').length >= 5 && seenTitles[tk]) continue;

    seenUrls[urlKey] = true;
    if (tk) seenTitles[tk] = true;
    out.push(items[i]);
  }
  return out;
}

// ── Stable item id (for client keying) ───────────────────────────────────────

function makeId(url) {
  var s = String(url || '');
  var h = 0;
  for (var i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return 'n' + Math.abs(h).toString(36);
}

// ── CourtListener filing → FI-focused summary card ───────────────────────────
// Replaces the raw filing header excerpt (case number / docket / page-ID
// noise) with a structured card built entirely from facts extractable from
// the feed excerpt. No prose interpretation — only restatement of what's in
// the filing header (case caption, court, document type, cited statutes,
// geography) plus a canned per-typology takeaway for FI fraud teams.
//
// Dollar amounts and affected-party counts are NOT extracted because they
// rarely appear in the CourtListener excerpt (they live inside the PDF).
// The card surfaces "See full filing →" instead of fabricating numbers.

// Common federal statutes that appear in fraud filings, mapped to plain-
// English charge labels and a FI typology bucket.
var STATUTE_MAP = {
  '1341':  { charge: 'Mail fraud',              typology: 'Mail fraud' },
  '1343':  { charge: 'Wire fraud',              typology: 'Wire fraud' },
  '1344':  { charge: 'Bank fraud',              typology: 'Bank fraud' },
  '1347':  { charge: 'Health care fraud',       typology: 'Health care fraud' },
  '1349':  { charge: 'Conspiracy to commit fraud', typology: 'Fraud conspiracy' },
  '371':   { charge: 'Conspiracy',              typology: 'Conspiracy' },
  '513':   { charge: 'Counterfeit securities',  typology: 'Counterfeit check' },
  '514':   { charge: 'Fictitious obligations',  typology: 'Counterfeit check' },
  '1708':  { charge: 'Mail theft',              typology: 'Mail theft' },
  '1956':  { charge: 'Money laundering',        typology: 'Money laundering' },
  '1957':  { charge: 'Monetary-transactions laundering', typology: 'Money laundering' },
  '1028':  { charge: 'Identity fraud',          typology: 'Identity fraud' },
  '1028A': { charge: 'Aggravated identity theft', typology: 'Identity fraud' }
};

// FI-fraud-team takeaways keyed to typology. Templated, not generated — keeps
// the page safe from misstating what's actually in the filing.
var FI_TAKEAWAYS = {
  'Check washing': 'Watch for altered payees, ink/handwriting inconsistencies, and mobile-RDC deposits from newly added payees. Enroll commercial accounts in payee-match Positive Pay if not already covered.',
  'Counterfeit check': 'Validate routing/account combinations on large or round-dollar deposits from new payees. Repeated serial numbers across deposits are a tell.',
  'Altered check': 'Compare cleared items against the issuer\'s Positive Pay file for amount or payee drift. Hold review on out-of-pattern items.',
  'Mail theft': 'Coordinate alerts with USPIS on ZIPs implicated by the filing. Notify customers in affected areas to consider electronic payment alternatives and to monitor outgoing checks.',
  'Bank fraud': 'Pull account-opening and KYC records at any branches named in the filing. Look for shared signers, addresses, or device fingerprints across new accounts.',
  'Wire fraud': 'Reinforce callback verification on payment-instruction changes. Watch for lookalike domains and urgency framing on wires above your review threshold.',
  'BEC': 'Verify any ACH or wire instruction change via a callback to a known contact (not a number in the email). Flag invoice-pattern anomalies on commercial accounts.',
  'Mail fraud': 'Mail fraud charges often pair with check washing or BEC schemes — review for associated payment-fraud indicators on accounts that transact with the named parties.',
  'Money laundering': 'Layering through new business accounts (especially LLCs registered in the last 90 days) and structured cash deposits are common. Review SAR thresholds.',
  'Identity fraud': 'Synthetic-identity accounts often build thin credit profiles fast. Tighten review on accounts opened in the last 6 months at named branches.',
  'Health care fraud': 'Lower priority for check-fraud teams unless the scheme involves check or wire payments to provider accounts.',
  'Fraud conspiracy': 'Multi-defendant fraud cases often expand. Cross-reference defendant names against your customer base and watch for related accounts.',
  'Conspiracy': 'Generic conspiracy charge — read the underlying fraud charge for the actionable signal.',
  'Court filing': 'Federal or state filing matched check-fraud terminology. Skim the full document for any FI, branch, or geography that maps to your customer base.'
};

// Detect document type from the raw excerpt. Returns short label.
function detectDocType(s) {
  var t = String(s || '');
  if (/SUPERSEDING INDICTMENT/i.test(t)) return 'Superseding indictment';
  if (/\bINDICTMENT\b/i.test(t))        return 'Indictment';
  if (/Criminal Complaint/i.test(t))     return 'Criminal complaint';
  if (/Search Warrant/i.test(t))         return 'Search warrant application';
  if (/MOTION(?:S)?\s+IN\s+LIMINE/i.test(t)) return 'Motion in limine';
  if (/\bMOTION\b/i.test(t))             return 'Motion';
  if (/Complaint for a Civil Case|CIVIL COMPLAINT|civil action/i.test(t)) return 'Civil complaint';
  if (/BANKRUPTCY|Chapter\s+\d+/i.test(t)) return 'Bankruptcy filing';
  if (/ORDER|MEMORANDUM/i.test(t))       return 'Order';
  return 'Filing';
}

// Priority order for picking which filing represents a case when several
// filings on the same docket are in the feed. Higher wins. An indictment or
// complaint is what an FI reader cares about; motions and orders are noise
// for our audience and should collapse behind the headline filing.
var DOC_TYPE_PRIORITY = {
  'Superseding indictment': 100,
  'Indictment':              90,
  'Criminal complaint':      80,
  'Civil complaint':         70,
  'Search warrant application': 60,
  'Motion in limine':        40,
  'Motion':                  30,
  'Order':                   20,
  'Bankruptcy filing':       10,
  'Filing':                   0
};

// Pull the docket id out of any CourtListener URL. RECAP search results all
// route through /docket/{id}/[entry/]slug — so the first /docket/{digits}
// segment is a reliable per-case key. Returns null if not a docket URL.
function extractDocketId(url) {
  var m = String(url || '').match(/\/docket\/(\d+)/);
  return m ? m[1] : null;
}

// Collapse CourtListener items so a single case appears only once. Multiple
// filings on one docket (complaint, indictment, motions) come through the
// feed as separate items; we pick the most reader-relevant one as the headline
// and stash the rest on .relatedFilings so the card can link to them.
//
// Non-CourtListener items and CL items without an extractable docket id pass
// through untouched.
function collapseByDocket(items) {
  var groups = {};
  var passthrough = [];

  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var docketId = it.source === 'CourtListener' ? extractDocketId(it.url) : null;
    if (!docketId) { passthrough.push(it); continue; }
    (groups[docketId] = groups[docketId] || []).push(it);
  }

  var winners = [];
  Object.keys(groups).forEach(function (docketId) {
    var arr = groups[docketId];
    arr.sort(function (a, b) {
      var pa = DOC_TYPE_PRIORITY[a.docType] || 0;
      var pb = DOC_TYPE_PRIORITY[b.docType] || 0;
      if (pa !== pb) return pb - pa;
      var ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      var tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });
    var winner = arr[0];
    if (arr.length > 1) {
      winner.relatedFilings = arr.slice(1).map(function (x) {
        return { url: x.url, docType: x.docType || 'Filing' };
      });
    }
    // The docketId served its purpose for grouping; drop it from the wire payload.
    delete winner.docketId;
    delete winner.docType;
    winners.push(winner);
  });

  // Passthrough items may still carry the helper fields if they were CL items
  // without a docket id — strip those too so the wire payload stays clean.
  passthrough.forEach(function (it) { delete it.docketId; delete it.docType; });

  return passthrough.concat(winners);
}

// Two-word and three-word state names that the simple non-greedy regex would
// truncate ("Southern District of New" → should be "...New York"). Listed
// longest-first so the alternation matches the longest valid name.
var COMPOUND_STATES = [
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
  'North Carolina', 'North Dakota',
  'South Carolina', 'South Dakota',
  'West Virginia', 'Rhode Island',
  'District of Columbia',
  'Northern Mariana Islands', 'Puerto Rico'
];

// Detect the court from the excerpt. Returns a clean district label, or null.
function detectCourt(s) {
  var t = String(s || '').replace(/\s+/g, ' ');
  // First try the compound (multi-word) state names; otherwise fall back to a
  // single-word state. Compound list goes first because regex alternation is
  // left-to-right and we want "New York" not "New".
  var compoundRe = new RegExp(
    '(NORTHERN|SOUTHERN|EASTERN|WESTERN|MIDDLE|CENTRAL)?\\s*DISTRICT\\s+OF\\s+(' +
    COMPOUND_STATES.map(function (s) { return s.toUpperCase().replace(/\s+/g, '\\s+'); }).join('|') +
    ')\\b',
    'i'
  );
  var m = t.match(compoundRe);
  if (!m) {
    // Single-word state fallback
    m = t.match(/(NORTHERN|SOUTHERN|EASTERN|WESTERN|MIDDLE|CENTRAL)?\s*DISTRICT\s+OF\s+([A-Z][a-zA-Z]{2,})\b/);
  }
  if (m) {
    var compass = m[1] ? (m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() + ' ') : '';
    var state = m[2].trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    return compass + 'District of ' + state;
  }
  if (/BANKRUPTCY COURT/i.test(t)) return 'U.S. Bankruptcy Court';
  return null;
}

// Pull statute citations from the excerpt. Returns array of unique section
// numbers in the order encountered.
function detectStatutes(s) {
  var t = String(s || '');
  var out = [];
  var re = /18\s*U\.?S\.?C\.?\s*§+\s*(\d{2,4}[A-Z]?)/gi;
  var m;
  while ((m = re.exec(t)) !== null) {
    var k = m[1].toUpperCase();
    if (out.indexOf(k) === -1) out.push(k);
  }
  return out;
}

// Build the FI-focused card for one CourtListener item. Returns null if the
// item doesn't look like a CL filing.
function buildCourtListenerCard(item) {
  if (!item || item.source !== 'CourtListener') return null;
  var raw = item.summary || '';
  var docType = detectDocType(raw);
  var court = detectCourt(raw);
  var statuteKeys = detectStatutes(raw);

  // Charges + typologies from statutes
  var charges = [];
  var typologies = [];
  statuteKeys.forEach(function (k) {
    var info = STATUTE_MAP[k];
    if (info) {
      if (charges.indexOf(info.charge) === -1) charges.push(info.charge);
      if (typologies.indexOf(info.typology) === -1) typologies.push(info.typology);
    }
  });

  // If no statutes detected, layer in typology from item.categories
  // (already keyword-tagged in tagItem), excluding the generic 'Court filing'.
  if (!typologies.length && Array.isArray(item.categories)) {
    item.categories.forEach(function (c) {
      if (c !== 'Court filing' && typologies.indexOf(c) === -1) typologies.push(c);
    });
  }

  // ── What happened ── case caption + court + document type + (charges if any)
  var whatHappened = item.title;
  if (court) whatHappened += ' in the ' + court;
  whatHappened = docType + ': ' + whatHappened;
  if (charges.length) {
    whatHappened += '. Charges include ' + charges.slice(0, 3).join(', ').toLowerCase() + '.';
  } else {
    whatHappened += '.';
  }

  // ── Scale ── only restate what's in the excerpt; never invent a number.
  // Most CL excerpts don't carry $ amounts, so we typically defer to the
  // filing itself.
  var scale = null;
  var dollarMatch = raw.match(/\$\s?[\d]{1,3}(?:,\d{3})+(?:\.\d{2})?(?:\s*(?:million|billion|thousand))?/i) ||
                    raw.match(/\$\s?[\d]{4,}(?:\.\d{2})?/);
  if (dollarMatch) scale = 'Loss figure in excerpt: ' + dollarMatch[0].trim() + '.';
  if (item.state && item.state !== 'Multi-state / Unknown') {
    scale = (scale ? scale + ' ' : '') + 'Venue: ' + item.state + '.';
  }
  if (!scale) scale = 'Scale not stated in the filing excerpt — see full document.';

  // ── FI takeaway ── canned by typology. Pick the most specific match.
  var takeaway = null;
  for (var i = 0; i < typologies.length; i++) {
    if (FI_TAKEAWAYS[typologies[i]]) { takeaway = FI_TAKEAWAYS[typologies[i]]; break; }
  }
  if (!takeaway) takeaway = FI_TAKEAWAYS['Court filing'];

  return {
    whatHappened: whatHappened,
    typology: typologies.length ? typologies : ['Court filing'],
    scale: scale,
    fiTakeaway: takeaway
  };
}

// ── High-level: fetch + filter + tag + dedupe + sort ─────────────────────────
// Returns a list of matched, tagged, deduped stories sorted newest first.
// No item cap — callers slice as needed.
//
// Options:
//   enrichSummaries: bool (default true) — if true, run the LLM summary
//     generator on non-CourtListener items so each carries a 1–2 sentence
//     summary leading with fraud method + FI impact. Callers that don't
//     render the summary (e.g. the CSV digest) can pass false to skip the
//     LLM round-trip.
//   summaryLimit: number (default 40) — how many top items (after sort) to
//     enrich. The UI ticker only renders 40, so summarizing more is waste.
async function aggregateStories(opts) {
  opts = opts || {};
  var enrichSummaries = opts.enrichSummaries !== false;
  var summaryLimit = opts.summaryLimit != null ? opts.summaryLimit : 40;

  var settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  var all = [];
  settled.forEach(function (r) {
    if (r.status === 'fulfilled') all = all.concat(r.value);
  });

  // Lazy-require so we don't pull the geo dictionaries unless aggregateStories runs
  var geoTagger;
  try { geoTagger = require('./geo-tagger'); } catch (e) { geoTagger = null; }

  var matched = [];
  for (var i = 0; i < all.length; i++) {
    var cats = tagItem(all[i]);
    // trustQuery feeds (e.g. CourtListener saved searches) bypass the keyword
    // filter — the search URL itself is the relevance gate. Force-tag with
    // the feed's defaultCategory so they still pick up a category chip.
    if (!cats.length && all[i].trustQuery && all[i].defaultCategory) {
      cats = [all[i].defaultCategory];
    }
    if (cats.length) {
      all[i].categories = cats;
      all[i].id = makeId(all[i].url);
      // Strip the per-item plumbing fields before they reach the client.
      delete all[i].trustQuery;
      delete all[i].defaultCategory;
      if (geoTagger && typeof geoTagger.tagGeo === 'function') {
        try {
          var geo = geoTagger.tagGeo(all[i]);
          if (geo) {
            all[i].state      = geo.state;
            all[i].stateCode  = geo.stateCode;
            all[i].cities     = geo.cities;
            all[i].region     = geo.region;
            all[i].geoConfidence = geo.confidence;
          }
        } catch (e) { /* tagging failure shouldn't drop the item */ }
      }
      // Build the FI-focused card for CourtListener items, then drop the
      // raw filing-header excerpt — the page renders the card in its place,
      // resolving the "wonky load" of dense legalese in the news feed.
      if (all[i].source === 'CourtListener') {
        // Capture docType + docketId from the raw excerpt before the card
        // overwrites .summary — collapseByDocket needs both to pick a winner
        // when one case has multiple filings in the feed.
        all[i].docType = detectDocType(all[i].summary);
        all[i].docketId = extractDocketId(all[i].url);
        try {
          var card = buildCourtListenerCard(all[i]);
          if (card) {
            all[i].card = card;
            all[i].summary = '';
          }
        } catch (e) { /* card failure falls back to default render */ }
      }
      matched.push(all[i]);
    }
  }

  // ── Merge in the one-time historical backfill, if present ──────────────────
  // news-backfill.json is generated by scripts/news-backfill/run.js — a
  // one-time pull from federal-source archives via Wayback (see that
  // script's README). Items are already tagged, geo-tagged, and shaped to
  // match a live aggregate item, so we slot them in here before dedup and
  // sort. dedupe() will collapse any live-side duplicate of a backfilled
  // story (e.g. a recently re-published archive page).
  try {
    var backfill = require('./news-backfill');
    if (backfill && Array.isArray(backfill.items) && backfill.items.length) {
      matched = matched.concat(backfill.items);
    }
  } catch (e) {
    // file doesn't exist yet, or invalid JSON — non-fatal
    if (e.code !== 'MODULE_NOT_FOUND') {
      console.warn('[fraud-news-core] backfill load failed:', e.message);
    }
  }

  matched = dedupe(matched);
  matched = collapseByDocket(matched);

  matched.sort(function (a, b) {
    var ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    var tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  if (enrichSummaries) {
    await enrichWithSummaries(matched.slice(0, summaryLimit));
  }

  return matched;
}

// ── LLM-generated 1–2 sentence summaries ─────────────────────────────────────
// CourtListener items already render a structured card (covered by the
// CourtListener Summary Cards ticket), so we skip them here. Everything else
// gets a summary that leads with fraud method + FI impact, per the
// "One-Line Story Summaries" ticket.
//
// For Google News items the RSS excerpt is just a repeat of the headline
// (it's stripped in fetchFeed), so we fetch the underlying article body
// first to give the LLM real source content to work from.
//
// Mutates items in place: sets item.summary on success. On failure, leaves
// whatever summary was already there (or empty string) — never throws.
async function enrichWithSummaries(items) {
  var summaryGenerator;
  var articleFetcher;
  try {
    summaryGenerator = require('./summary-generator');
    articleFetcher = require('./article-fetcher');
  } catch (e) {
    console.warn('[fraud-news-core] summary modules unavailable:', e.message);
    return;
  }

  // Skip if no API key — generateSummary would return '' anyway, but checking
  // up-front lets us avoid the article fetches too.
  if (!process.env.ANTHROPIC_API_KEY) return;

  // Step 1: for Google News items (no RSS excerpt) fetch the article body in
  // parallel. Other sources already have a usable excerpt in item.summary.
  var googleItems = items.filter(function (it) {
    return it.source && it.source !== 'CourtListener' && !it.card && !(it.summary && it.summary.length > 40);
  });
  if (googleItems.length) {
    // Cap fetch concurrency — these are external HTTP hits to a wide variety
    // of publisher sites, some slow.
    await runWithConcurrency(googleItems, 4, async function (it) {
      try {
        var body = await articleFetcher.fetchArticleText(it.url);
        if (body) it._fetchedBody = body;
      } catch (e) { /* swallow — fall back to title-only summary */ }
    });
  }

  // Step 2: generate summaries for every non-CourtListener item with a card-less render path.
  var batch = items
    .filter(function (it) { return !it.card && it.source !== 'CourtListener'; })
    .map(function (it) {
      // Prefer fetched article body, fall back to RSS excerpt, fall back to nothing.
      var sourceContent = it._fetchedBody || it.summary || '';
      return { item: it, sourceContent: sourceContent };
    });

  if (!batch.length) return;

  await summaryGenerator.generateSummariesBatch(batch, 5);

  batch.forEach(function (e) {
    if (e.summary) e.item.summary = e.summary;
    // Drop the working field so it doesn't ship to the client.
    delete e.item._fetchedBody;
  });
}

// Small bounded-concurrency runner for an array of items. Resolves when all
// work is done. Per-item errors don't abort the batch.
async function runWithConcurrency(items, concurrency, fn) {
  var idx = 0;
  async function worker() {
    while (idx < items.length) {
      var my = idx++;
      try { await fn(items[my]); } catch (e) { /* item-level swallow */ }
    }
  }
  var workers = [];
  for (var i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
}

module.exports = {
  FEEDS: FEEDS,
  KEYWORDS: KEYWORDS,
  AUDIENCE_PATTERN: AUDIENCE_PATTERN,
  buildCourtListenerCard: buildCourtListenerCard,
  decodeEntities: decodeEntities,
  parseRss: parseRss,
  parseAtom: parseAtom,
  fetchFeed: fetchFeed,
  tagItem: tagItem,
  dedupe: dedupe,
  extractDocketId: extractDocketId,
  collapseByDocket: collapseByDocket,
  makeId: makeId,
  aggregateStories: aggregateStories
};
