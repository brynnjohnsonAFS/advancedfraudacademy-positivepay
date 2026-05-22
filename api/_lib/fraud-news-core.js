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
      pubDate: firstMatch(b, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) ||
               firstMatch(b, /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i),
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
      pubDate: firstMatch(b, /<published[^>]*>([\s\S]*?)<\/published>/i) ||
               firstMatch(b, /<updated[^>]*>([\s\S]*?)<\/updated>/i),
      summary: decodeEntities(
        firstMatch(b, /<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
        firstMatch(b, /<content[^>]*>([\s\S]*?)<\/content>/i)
      )
    });
  }
  return items;
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
        publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : null,
        summary: summary ? summary.slice(0, 400) : ''
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

// ── High-level: fetch + filter + tag + dedupe + sort ─────────────────────────
// Returns a list of matched, tagged, deduped stories sorted newest first.
// No item cap — callers slice as needed.
async function aggregateStories() {
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
    if (cats.length) {
      all[i].categories = cats;
      all[i].id = makeId(all[i].url);
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
      matched.push(all[i]);
    }
  }

  matched = dedupe(matched);

  matched.sort(function (a, b) {
    var ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    var tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  return matched;
}

module.exports = {
  FEEDS: FEEDS,
  KEYWORDS: KEYWORDS,
  AUDIENCE_PATTERN: AUDIENCE_PATTERN,
  decodeEntities: decodeEntities,
  parseRss: parseRss,
  parseAtom: parseAtom,
  fetchFeed: fetchFeed,
  tagItem: tagItem,
  dedupe: dedupe,
  makeId: makeId,
  aggregateStories: aggregateStories
};
