/* Advanced Fraud Academy — fraud-news.js
   API endpoint for the homepage news ticker and the dedicated news page.
   Returns the N most recent fraud-relevant stories as JSON, controllable
   via the `?limit=N` query parameter (default 40 for the ticker, news
   page asks for more to surface the historical backfill).

   Aggregation logic lives in _lib so the CSV digest endpoint can reuse it.

   Query params:
     limit  — number of items to return. Default 40, max 2000. Values
              outside the range are clamped.

   Returns: { ok, fetchedAt, count, items: [{ id, title, url, source,
              publishedAt, summary, categories }] }
*/

'use strict';

var core = require('./_lib/fraud-news-core');

var DEFAULT_LIMIT = 40;
var MAX_LIMIT     = 2000;

function parseLimit(req) {
  var raw = req && req.query && req.query.limit;
  if (raw == null) {
    // req.query isn't always populated by the Vercel runtime — fall back to
    // parsing the URL manually so this works in any handler shape.
    try {
      var u = new URL(req.url, 'http://x');
      raw = u.searchParams.get('limit');
    } catch (e) { /* keep raw null */ }
  }
  if (raw == null) return DEFAULT_LIMIT;
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Edge cache: serve cached for 30 min, allow stale up to 1 hr while revalidating.
  // The limit param is part of the cache key, so the ticker (40) and the news
  // page (large limit) cache independently.
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  var limit = parseLimit(req);

  try {
    var matched = await core.aggregateStories();
    matched = matched.slice(0, limit);
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
