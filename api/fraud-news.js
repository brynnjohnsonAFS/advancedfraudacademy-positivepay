/* Advanced Fraud Academy — fraud-news.js
   Aggregates fraud-relevant news from public RSS/Atom feeds.
   Zero dependencies. CommonJS, Vercel Node runtime.

   Returns: { ok, fetchedAt, items: [{ id, title, url, source, publishedAt, summary, categories }] }
*/

'use strict';

// ── Source feeds ─────────────────────────────────────────────────────────────
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
  }
];

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
// Not bulletproof, but RSS/Atom titles, links, dates, and summaries are simple
// enough that we don't need an XML parser dependency.

function decodeEntities(s) {
  if (!s) return '';
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '') // strip inline HTML
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, function (_, code) { return String.fromCharCode(parseInt(code, 10)); })
    .replace(/&nbsp;/g, ' ')
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
      )
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
      // 8-second timeout via AbortSignal
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    if (!res.ok) {
      console.warn('[fraud-news]', feed.name, 'returned', res.status);
      return [];
    }
    var xml = await res.text();
    var parsed = feed.type === 'atom' ? parseAtom(xml) : parseRss(xml);
    return parsed.map(function (it) {
      return {
        title: it.title,
        url: it.url,
        source: feed.name,
        publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : null,
        summary: it.summary ? it.summary.slice(0, 400) : ''
      };
    }).filter(function (it) { return it.title && it.url; });
  } catch (e) {
    console.warn('[fraud-news]', feed.name, 'fetch error:', e.message);
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

// ── Dedupe by URL ────────────────────────────────────────────────────────────

function dedupe(items) {
  var seen = {};
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var key = (items[i].url || '').split('#')[0];
    if (!key || seen[key]) continue;
    seen[key] = true;
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

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Edge cache: serve cached for 30 min, allow stale up to 1 hr while revalidating
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    var settled = await Promise.allSettled(FEEDS.map(fetchFeed));
    var all = [];
    settled.forEach(function (r) {
      if (r.status === 'fulfilled') all = all.concat(r.value);
    });

    // Filter by keyword + tag
    var matched = [];
    for (var i = 0; i < all.length; i++) {
      var cats = tagItem(all[i]);
      if (cats.length) {
        all[i].categories = cats;
        all[i].id = makeId(all[i].url);
        matched.push(all[i]);
      }
    }

    matched = dedupe(matched);

    // Sort newest first
    matched.sort(function (a, b) {
      var ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
      var tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
      return tb - ta;
    });

    // Cap to 40
    matched = matched.slice(0, 40);

    res.status(200).json({
      ok: true,
      fetchedAt: new Date().toISOString(),
      count: matched.length,
      items: matched
    });
  } catch (e) {
    console.error('[fraud-news] fatal:', e.message);
    res.status(500).json({ ok: false, error: 'aggregation_failed' });
  }
};
