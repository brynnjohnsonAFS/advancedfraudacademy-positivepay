/* Advanced Fraud Academy — fraud-news.js
   API endpoint for the homepage news ticker. Returns the 40 most recent
   fraud-relevant stories as JSON. Aggregation logic lives in _lib so the
   CSV digest endpoint can reuse it.

   Returns: { ok, fetchedAt, count, items: [{ id, title, url, source,
              publishedAt, summary, categories }] }
*/

'use strict';

var core = require('./_lib/fraud-news-core');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // Edge cache: serve cached for 30 min, allow stale up to 1 hr while revalidating
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');

  try {
    var matched = await core.aggregateStories();
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
