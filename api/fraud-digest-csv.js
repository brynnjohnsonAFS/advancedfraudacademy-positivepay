/* Advanced Fraud Academy — fraud-digest-csv.js
   Geo-tagged fraud news digest as a downloadable CSV.

   Pulls fraud stories from the shared aggregator (api/_lib/fraud-news-core),
   adds US state / city / region tags via the geo-tagger, and emits a CSV
   sorted by state then date (newest first). Multi-state / Unknown stories
   are grouped at the bottom so they don't get missed.

   Query params:
     ?days=N        — filter to stories from the last N days (default 14, max 60)
     ?state=XX      — filter to a single state (postal code)
     ?confidence=   — minimum confidence: high | medium | low (default: include all)
     ?format=json   — return JSON instead of CSV (for debugging)

   CSV columns:
     state, state_code, region, cities, category, headline,
     summary, source, url, published_date, geo_confidence
*/

'use strict';

var core = require('./_lib/fraud-news-core');
var geo = require('./_lib/geo-tagger');

// ── Confidence ordering for filtering ────────────────────────────────────────
var CONFIDENCE_RANK = { high: 3, medium: 2, low: 1, none: 0 };

// ── CSV escaping ─────────────────────────────────────────────────────────────
// RFC 4180: fields containing comma, quote, newline, or carriage return must
// be quoted; embedded quotes are doubled.
function csvCell(value) {
  if (value === null || value === undefined) return '';
  var s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(values) {
  return values.map(csvCell).join(',');
}

// ── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Edge cache: serve cached for 30 min, allow stale up to 1 hr while revalidating.
  // Same cadence as the JSON ticker — the upstream feeds don't change faster than that.
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  // ── Parse query params ─────────────────────────────────────────────────────
  var q = req.query || {};
  var days = parseInt(q.days, 10);
  if (!days || days < 1) days = 14;
  if (days > 60) days = 60; // upstream feeds cap at ~30d anyway; 60 is generous

  var stateFilter = (q.state || '').toUpperCase().trim();
  if (stateFilter && stateFilter.length !== 2) stateFilter = '';

  var minConfidence = (q.confidence || '').toLowerCase().trim();
  if (!CONFIDENCE_RANK.hasOwnProperty(minConfidence)) minConfidence = 'none';

  var asJson = q.format === 'json';

  try {
    // ── Aggregate ──────────────────────────────────────────────────────────
    // CSV/JSON digest doesn't render LLM-generated summaries — skip enrichment
    // so we don't pay for Claude calls on a download path.
    var stories = await core.aggregateStories({ enrichSummaries: false });

    // ── Time window filter ─────────────────────────────────────────────────
    var cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    stories = stories.filter(function (s) {
      if (!s.publishedAt) return false; // can't bucket a story with no date
      return Date.parse(s.publishedAt) >= cutoff;
    });

    // ── Geo tag ────────────────────────────────────────────────────────────
    var tagged = stories.map(function (s) {
      var g = geo.tagGeo(s);
      return {
        state: g.state || 'Multi-state / Unknown',
        stateCode: g.stateCode || '',
        region: g.region || '',
        cities: g.cities,
        confidence: g.confidence,
        category: (s.categories || []).join('; '),
        headline: s.title,
        summary: s.summary || '',
        source: s.source,
        url: s.url,
        publishedDate: s.publishedAt ? s.publishedAt.slice(0, 10) : ''
      };
    });

    // ── Apply filters ──────────────────────────────────────────────────────
    if (stateFilter) {
      tagged = tagged.filter(function (t) { return t.stateCode === stateFilter; });
    }
    if (minConfidence !== 'none') {
      var minRank = CONFIDENCE_RANK[minConfidence];
      tagged = tagged.filter(function (t) {
        return (CONFIDENCE_RANK[t.confidence] || 0) >= minRank;
      });
    }

    // ── Sort: known states alphabetically, then date desc within state.
    //         Multi-state/Unknown rows always last. ───────────────────────
    tagged.sort(function (a, b) {
      var aUnknown = !a.stateCode;
      var bUnknown = !b.stateCode;
      if (aUnknown !== bUnknown) return aUnknown ? 1 : -1;
      if (a.state !== b.state) return a.state.localeCompare(b.state);
      // Same state → newest first
      return b.publishedDate.localeCompare(a.publishedDate);
    });

    // ── JSON debug mode ────────────────────────────────────────────────────
    if (asJson) {
      res.status(200).json({
        ok: true,
        fetchedAt: new Date().toISOString(),
        days: days,
        filters: { state: stateFilter || null, confidence: minConfidence !== 'none' ? minConfidence : null },
        count: tagged.length,
        items: tagged
      });
      return;
    }

    // ── Build CSV ──────────────────────────────────────────────────────────
    var header = [
      'state', 'state_code', 'region', 'cities', 'category',
      'headline', 'summary', 'source', 'url',
      'published_date', 'geo_confidence'
    ];
    var lines = [csvRow(header)];

    for (var i = 0; i < tagged.length; i++) {
      var t = tagged[i];
      lines.push(csvRow([
        t.state,
        t.stateCode,
        t.region,
        t.cities.join('; '),
        t.category,
        t.headline,
        t.summary,
        t.source,
        t.url,
        t.publishedDate,
        t.confidence
      ]));
    }

    var csv = lines.join('\r\n') + '\r\n';
    var filename = 'fraud-digest-' + new Date().toISOString().slice(0, 10) +
                   (stateFilter ? '-' + stateFilter : '') +
                   '-' + days + 'd.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.status(200).send(csv);
  } catch (e) {
    console.error('[fraud-digest-csv] fatal:', e.message);
    res.status(500).json({ ok: false, error: 'digest_failed' });
  }
};
