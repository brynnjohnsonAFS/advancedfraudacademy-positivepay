#!/usr/bin/env node
/* Advanced Fraud Academy — news backfill runner
   One-time historical pull, 2024-11-22 → 2026-05-22, from federal sources
   via the Wayback Machine. See README.md for the design rationale.

   Phases (each resumable, run independently):
     harvest   CDX query → state/candidates.json
     fetch     Wayback snapshots → state/parsed/<source>.jsonl
     filter    Apply KEYWORDS from fraud-news-core → state/filtered.json
     finalize  Shape and write api/_lib/news-backfill.json

   Zero deps. CommonJS. Matches the surrounding codebase style.
*/

'use strict';

var fs    = require('fs');
var path  = require('path');
var https = require('https');
var zlib  = require('zlib');

// Reuse the live aggregator's KEYWORDS and helpers so backfill relevance
// matches the live page exactly. No drift between live and backfill.
var core = require('../../api/_lib/fraud-news-core');

// ── Config ──────────────────────────────────────────────────────────────────

var WINDOW_FROM = '20241122';
var WINDOW_TO   = '20260522';

var STATE_DIR   = path.join(__dirname, 'state');
var CANDIDATES  = path.join(STATE_DIR, 'candidates.json');
var PARSED_DIR  = path.join(STATE_DIR, 'parsed');
var FILTERED    = path.join(STATE_DIR, 'filtered.json');
var OUT_FILE    = path.join(__dirname, '..', '..', 'api', '_lib', 'news-backfill.json');

// Each source declares: how to slice the cached CDX dump, a URL regex that
// matches a single press release (excluding index/listing pages), and the
// label that appears on the news page.
var SOURCES = {
  uspis: {
    label:        'USPIS',
    cdxFile:      '/tmp/cdx-uspis.json',
    // USPIS URL shape is /news/<category>/<slug> — e.g. /news/press-release/...,
    // /news/scam-article/..., /news/news-article/...
    releaseRe:    /\/news\/(press-release|scam-article|news-article)\/[a-z0-9-]+/i,
    extractTitle: extractTitleFromMeta,
    extractDate:  extractDateFromMeta,
    extractBody:  extractBodyFromArticle
  },
  doj_opa: {
    label:        'DOJ',
    cdxFile:      '/tmp/cdx-doj-opa.json',
    releaseRe:    /\/opa\/pr\/[a-z0-9-]+$/i,
    extractTitle: extractTitleFromMeta,
    extractDate:  extractDateFromMeta,
    extractBody:  extractBodyFromArticle
  },
  doj_usao: {
    label:        'DOJ',
    cdxFile:      '/tmp/cdx-usao.json',
    // USAO URLs are /usao-<district>/pr/<slug>. Some CDX rows have stray
    // URL-encoded chars (e.g. %3E trailing) — accept them; we'll strip later.
    releaseRe:    /\/usao-[a-z]+\/pr\/[a-z0-9-]+/i,
    extractTitle: extractTitleFromMeta,
    extractDate:  extractDateFromMeta,
    extractBody:  extractBodyFromArticle
  }
};

// Broad slug pre-filter — fast, cheap, runs before we fetch anything. Tight
// keyword filter on body text happens in Stage 3 (uses fraud-news-core.KEYWORDS).
var SLUG_PREFILTER = new RegExp([
  'check[- ](fraud|washing|kit|scheme)',
  'altered[- ]check',
  'counterfeit[- ]check',
  'mail[- ](theft|fraud)',
  'wire[- ]fraud',
  'bank[- ]fraud',
  'ach[- ]fraud',
  'embezzl',
  'money[- ](launder|mule)',
  'business[- ]email[- ]compromise',
  'fraud[- ](ring|scheme|conspiracy)',
  'treasury[- ]check',
  'forgery'
].join('|'), 'i');

// ── Tiny utilities ──────────────────────────────────────────────────────────

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readJSON(p)  { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJSON(p, d) { fs.writeFileSync(p, JSON.stringify(d, null, 2)); }
function log(msg)     { console.log('[backfill] ' + msg); }
function err(msg)     { console.error('[backfill] ' + msg); }

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// Wayback timestamps are YYYYMMDDhhmmss. We only need a date, so trim.
function tsToISO(ts) {
  if (!ts || ts.length < 8) return null;
  var y = ts.slice(0, 4), m = ts.slice(4, 6), d = ts.slice(6, 8);
  return y + '-' + m + '-' + d + 'T00:00:00Z';
}

// Polite, identifies the project. Wayback is friendly to identified clients.
var FETCH_HEADERS = {
  'User-Agent': 'AdvancedFraudAcademy-Backfill/1.0 (+https://advancedfraudacademy.com; one-time historical pull)',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Encoding': 'gzip, deflate'
};

// Node's built-in fetch is fine but doesn't auto-decompress on every Node
// version, and Wayback sometimes sends gzip even when you don't ask. Use
// raw https for predictability and minimal memory.
function httpGet(url) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url, { headers: FETCH_HEADERS, timeout: 30000 }, function (res) {
      // Follow one redirect (Wayback often redirects from undated URL to dated).
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        var next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        httpGet(next).then(resolve, reject);
        return;
      }
      var chunks = [];
      var stream = res;
      var enc = (res.headers['content-encoding'] || '').toLowerCase();
      if (enc === 'gzip')    stream = res.pipe(zlib.createGunzip());
      if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
      stream.on('data',  function (c) { chunks.push(c); });
      stream.on('end',   function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
      stream.on('error', reject);
    });
    req.on('timeout', function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

// Throttle: politely cap concurrency / RPS on Wayback.
function makeLimiter(rps) {
  var lastT = 0;
  var minInterval = 1000 / rps;
  return function next() {
    var now = Date.now();
    var wait = Math.max(0, lastT + minInterval - now);
    lastT = now + wait;
    return sleep(wait);
  };
}

// ── HTML extraction — same regex-only style as fraud-news-core ──────────────

function decodeEntities(s) { return core.decodeEntities(s || ''); }

function metaContent(html, attr, value) {
  // Robust-ish: match <meta ... attr="value" ... content="...">
  // or with content first. Decodes entities.
  var re1 = new RegExp(
    '<meta[^>]+' + attr + '=["\']' + value + '["\'][^>]*content=["\']([^"\']*)',
    'i'
  );
  var re2 = new RegExp(
    '<meta[^>]+content=["\']([^"\']*)["\'][^>]*' + attr + '=["\']' + value,
    'i'
  );
  var m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]) : '';
}

function extractTitleFromMeta(html) {
  return metaContent(html, 'property', 'og:title')
      || metaContent(html, 'name',     'twitter:title')
      || decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1])
         // DOJ/USPIS title tags often include " | OPA | Department of Justice" — strip
         .replace(/\s*[|]\s*(OPA|Department of Justice|U\.S\. Postal Inspection Service|USPIS|FBI|Federal Bureau of Investigation)[^|]*$/i, '')
         .trim();
}

function extractDateFromMeta(html) {
  // Try every common signal in order of reliability.
  var iso = metaContent(html, 'property', 'article:published_time')
         || metaContent(html, 'name',     'date')
         || metaContent(html, 'name',     'DC.date')
         || metaContent(html, 'name',     'pubdate')
         || metaContent(html, 'itemprop', 'datePublished');
  if (iso) return new Date(iso).toISOString();

  // Fallback: <time datetime="...">
  var t = html.match(/<time[^>]+datetime=["']([^"']+)/i);
  if (t) {
    var d = new Date(t[1]);
    if (!isNaN(d)) return d.toISOString();
  }

  // Fallback: visible "Wednesday, March 5, 2025" style
  var visible = html.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/);
  if (visible) {
    var d2 = new Date(visible[0]);
    if (!isNaN(d2)) return d2.toISOString();
  }
  return null;
}

function extractBodyFromArticle(html) {
  // Prefer og:description, fall back to first paragraph of <article>/<main>.
  var desc = metaContent(html, 'property', 'og:description')
          || metaContent(html, 'name',     'description');
  if (desc) return desc.slice(0, 1200);

  // Pull text inside <article> or fall back to <main>, strip tags
  var block = (html.match(/<article[\s\S]*?<\/article>/i)
            || html.match(/<main[\s\S]*?<\/main>/i)
            || [''])[0];
  return decodeEntities(block).slice(0, 1200);
}

// ── Stage 1: harvest ────────────────────────────────────────────────────────
// Read the cached CDX dumps from /tmp, dedupe by URL, slug-filter, write
// state/candidates.json with one entry per source/url.

async function phaseHarvest(opts) {
  ensureDir(STATE_DIR);

  var out = [];
  var onlySource = opts.source;

  Object.keys(SOURCES).forEach(function (name) {
    if (onlySource && onlySource !== name) return;
    var s = SOURCES[name];
    if (!fs.existsSync(s.cdxFile)) {
      err('skipping ' + name + ' — CDX file not found: ' + s.cdxFile);
      return;
    }
    var cdx = readJSON(s.cdxFile);
    var rows = cdx.slice(1); // first row is the header
    var byUrl = {};
    rows.forEach(function (r) {
      var ts = r[1], url = r[2];
      if (!s.releaseRe.test(url)) return;
      // Strip stray trailing URL-encoded chars and fragments. Some CDX rows
      // capture pages linked with weird query/anchor noise (%3E, %22, #...).
      var clean = url.split('#')[0].replace(/%[0-9A-F]{2,}.*$/i, '');
      if (!SLUG_PREFILTER.test(clean)) return;
      // Keep the earliest Wayback timestamp per URL — closest to true publish date
      if (!byUrl[clean] || ts < byUrl[clean].waybackTimestamp) {
        byUrl[clean] = { source: name, sourceLabel: s.label, url: clean, waybackTimestamp: ts };
      }
    });
    var items = Object.values(byUrl);
    if (opts.limit) items = items.slice(0, opts.limit);
    log(name + ': ' + items.length + ' candidates after slug pre-filter');
    out = out.concat(items);
  });

  writeJSON(CANDIDATES, out);
  log('wrote ' + out.length + ' candidates to ' + path.relative(process.cwd(), CANDIDATES));
}

// ── Stage 2: fetch ──────────────────────────────────────────────────────────
// Fetch each candidate from web.archive.org/web/<ts>/<url>. Resumable: writes
// JSONL incrementally per source, skips URLs already present.

async function phaseFetch(opts) {
  if (!fs.existsSync(CANDIDATES)) {
    err('no candidates.json — run `harvest` first'); process.exit(1);
  }
  ensureDir(PARSED_DIR);
  var candidates = readJSON(CANDIDATES);
  if (opts.source) candidates = candidates.filter(function (c) { return c.source === opts.source; });

  // Resume support: read existing JSONL, build URL set
  var seen = {};
  var bySource = {};
  Object.keys(SOURCES).forEach(function (n) { bySource[n] = []; });
  candidates.forEach(function (c) { bySource[c.source].push(c); });

  Object.keys(bySource).forEach(function (name) {
    var p = path.join(PARSED_DIR, name + '.jsonl');
    if (fs.existsSync(p)) {
      fs.readFileSync(p, 'utf8').split('\n').forEach(function (line) {
        if (!line.trim()) return;
        try { seen[JSON.parse(line).url] = true; } catch (e) { /* skip */ }
      });
    }
  });

  var throttle = makeLimiter(2);  // 2 req/sec — polite for Wayback
  var ok = 0, fail = 0, skipped = 0;

  for (var name of Object.keys(bySource)) {
    var items = bySource[name];
    if (!items.length) continue;
    var s = SOURCES[name];
    var outPath = path.join(PARSED_DIR, name + '.jsonl');
    var stream = fs.createWriteStream(outPath, { flags: 'a' });

    for (var i = 0; i < items.length; i++) {
      var c = items[i];
      if (seen[c.url]) { skipped++; continue; }
      await throttle();

      var wb = 'https://web.archive.org/web/' + c.waybackTimestamp + 'id_/' + c.url;
      try {
        var res = await httpGet(wb);
        if (res.status !== 200 || res.body.length < 500) {
          fail++; err('  ' + name + ' [' + (i + 1) + '/' + items.length + '] ' + res.status + ' ' + c.url);
          continue;
        }
        var rec = {
          url: c.url,
          source: c.sourceLabel,
          waybackTimestamp: c.waybackTimestamp,
          title: s.extractTitle(res.body),
          publishedAt: s.extractDate(res.body) || tsToISO(c.waybackTimestamp),
          body: s.extractBody(res.body)
        };
        stream.write(JSON.stringify(rec) + '\n');
        ok++;
        if (ok % 25 === 0) log(name + ': ' + ok + ' fetched, ' + fail + ' failed');
      } catch (e) {
        fail++; err('  ' + name + ' [' + (i + 1) + '/' + items.length + '] ' + e.message + ' ' + c.url);
      }
    }
    stream.end();
    log(name + ': done — ' + ok + ' new, ' + skipped + ' resumed, ' + fail + ' failed');
    ok = 0; fail = 0; skipped = 0;
  }
}

// ── Stage 3: filter ─────────────────────────────────────────────────────────
// Apply the real KEYWORDS regex from fraud-news-core to body text. Tag
// categories. Drop unmatched. Writes state/filtered.json.

async function phaseFilter() {
  ensureDir(STATE_DIR);
  var all = [];

  Object.keys(SOURCES).forEach(function (name) {
    var p = path.join(PARSED_DIR, name + '.jsonl');
    if (!fs.existsSync(p)) return;
    fs.readFileSync(p, 'utf8').split('\n').forEach(function (line) {
      if (!line.trim()) return;
      try { all.push(JSON.parse(line)); } catch (e) { /* skip */ }
    });
  });

  log('loaded ' + all.length + ' parsed items');

  var kept = [];
  all.forEach(function (it) {
    // Skip items without a usable title or date
    if (!it.title || !it.publishedAt) return;
    // Build the shape tagItem expects
    var probe = { title: it.title, summary: it.body || '' };
    var cats = core.tagItem(probe);
    if (!cats.length) return;
    it.categories = cats;
    it.id = core.makeId(it.url);
    // Trim body to a short summary for display, matching live items
    it.summary = (it.body || '').slice(0, 400);
    delete it.body;
    kept.push(it);
  });

  log('kept ' + kept.length + ' after KEYWORDS filter');
  writeJSON(FILTERED, kept);
}

// ── Stage 4: finalize ───────────────────────────────────────────────────────
// Dedup, sort, write to api/_lib/news-backfill.json. Final shape matches
// what aggregateStories() in fraud-news-core emits per item.

async function phaseFinalize() {
  if (!fs.existsSync(FILTERED)) {
    err('no filtered.json — run `filter` first'); process.exit(1);
  }
  var items = readJSON(FILTERED);

  // Dedup with the live aggregator's same function (URL + 5-word title key)
  items = core.dedupe(items);

  // Sort newest first — same as live
  items.sort(function (a, b) {
    var ta = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    var tb = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return tb - ta;
  });

  // Mark as backfill so the live aggregator can identify these if needed
  items.forEach(function (it) { it.backfill = true; });

  // Trim to the final shape the live page expects
  var finalItems = items.map(function (it) {
    return {
      id:          it.id,
      title:       it.title,
      url:         it.url,
      source:      it.source,
      publishedAt: it.publishedAt,
      summary:     it.summary || '',
      categories:  it.categories || [],
      backfill:    true
    };
  });

  ensureDir(path.dirname(OUT_FILE));
  writeJSON(OUT_FILE, {
    generatedAt: new Date().toISOString(),
    window:      { from: '2024-11-22', to: '2026-05-22' },
    count:       finalItems.length,
    items:       finalItems
  });
  log('wrote ' + finalItems.length + ' items to ' + path.relative(process.cwd(), OUT_FILE));
}

// ── CLI entry ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  var phase = argv[2];
  var opts = {};
  for (var i = 3; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--source')      opts.source = argv[++i];
    else if (a === '--limit')  opts.limit  = parseInt(argv[++i], 10);
  }
  return { phase: phase, opts: opts };
}

async function main() {
  var args = parseArgs(process.argv);
  var phases = {
    harvest:  phaseHarvest,
    fetch:    phaseFetch,
    filter:   phaseFilter,
    finalize: phaseFinalize
  };
  var fn = phases[args.phase];
  if (!fn) {
    console.log('Usage: node scripts/news-backfill/run.js <harvest|fetch|filter|finalize> [--source name] [--limit n]');
    process.exit(1);
  }
  try {
    await fn(args.opts || {});
  } catch (e) {
    err(e.stack || e.message);
    process.exit(1);
  }
}

main();
