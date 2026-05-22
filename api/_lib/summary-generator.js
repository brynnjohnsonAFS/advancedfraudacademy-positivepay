/* Advanced Fraud Academy — summary-generator.js
   Generates one-to-two sentence summaries for the news feed that lead with the
   fraud method and the impact on the financial institution.

   Calls the Anthropic Messages API directly via fetch (no SDK dependency, to
   match the rest of this codebase's zero-deps style). Uses prompt caching on
   the system prompt so repeated calls within a 5-minute window are cheap.

   Requires the ANTHROPIC_API_KEY environment variable. If it's not set, the
   generator no-ops and returns '' — callers should fall back to the raw RSS
   excerpt or render no summary, never drop the item.

   In-memory cache (Map) keyed by item URL so a warm function instance doesn't
   re-summarize the same story on every 30-min refresh. Cache is cold on a
   fresh deployment or a cold start — acceptable trade-off vs. wiring up
   Vercel KV.
*/

'use strict';

var ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
var ANTHROPIC_VERSION = '2023-06-01';
var MODEL = 'claude-haiku-4-5-20251001';

// Conservative — Claude API tolerates much more, but we don't need it and lower
// concurrency keeps the function well under Vercel's response-time budget.
var MAX_INPUT_CHARS = 4000;

// Per-warm-instance cache. Keyed by URL → { summary, ts }.
// We cap size so a long-running instance can't grow unbounded.
var CACHE = new Map();
var CACHE_MAX = 500;
var CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h — well past one feed refresh cycle

function cacheGet(url) {
  var hit = CACHE.get(url);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    CACHE.delete(url);
    return null;
  }
  return hit.summary;
}

function cacheSet(url, summary) {
  if (CACHE.size >= CACHE_MAX) {
    // Drop oldest insertion. Map preserves insertion order, so the first key
    // is the oldest.
    var firstKey = CACHE.keys().next().value;
    if (firstKey) CACHE.delete(firstKey);
  }
  CACHE.set(url, { summary: summary, ts: Date.now() });
}

// System prompt is stable across all items, so it caches well. We mark it as
// a cache_control breakpoint so Anthropic caches the prefix and we only pay
// full input cost on the first call within the 5-min cache TTL.
var SYSTEM_PROMPT =
  'You write one-to-two sentence summaries of fraud news stories for an audience of community-bank and credit-union fraud teams. ' +
  'The reader needs to triage the story fast, so:\n\n' +
  '1. LEAD with how the fraud was carried out — the method, scheme, or attack path (e.g., "Check washing through stolen mail," "BEC via spoofed vendor invoice," "ACH credit-push triggered by phished credentials").\n' +
  '2. INCLUDE how it affected the financial institution — losses, exposure, accounts hit, the control that failed, or the FI named.\n' +
  '3. KEEP it to one or two sentences, total under 280 characters.\n' +
  '4. NO court procedure, no charge lists, no defendant biographies, no "according to a press release," no generic "this highlights the importance of..." filler.\n' +
  '5. If the source content does not actually describe a fraud method or FI impact, write a single sentence summarizing what it does say — do not invent details.\n\n' +
  'Output ONLY the summary sentence(s). No preamble, no bullet points, no quotes around the output.';

// Build user prompt from item context. Source-content can be the RSS excerpt
// or the fetched article body.
function buildUserPrompt(item, sourceContent) {
  var parts = [];
  parts.push('Headline: ' + (item.title || '(none)'));
  if (item.source) parts.push('Source: ' + item.source);
  if (Array.isArray(item.categories) && item.categories.length) {
    parts.push('Tagged categories: ' + item.categories.join(', '));
  }
  parts.push('');
  parts.push('Source content:');
  parts.push(sourceContent && sourceContent.trim() ? sourceContent.trim().slice(0, MAX_INPUT_CHARS) : '(none — base summary on the headline alone)');
  return parts.join('\n');
}

// Public: generate a single summary. Returns '' on any failure (caller should
// fall back gracefully). Caches by item URL.
async function generateSummary(item, sourceContent) {
  if (!item || !item.url) return '';

  var cached = cacheGet(item.url);
  if (cached !== null) return cached;

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // No key configured — don't spam logs, just no-op.
    return '';
  }

  var userPrompt = buildUserPrompt(item, sourceContent);

  try {
    var res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION
      },
      // Cache breakpoint on the system prompt: identical across every item in
      // this feed refresh, so we get a cache hit on every call after the first.
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });

    if (!res.ok) {
      var errBody = await res.text().catch(function () { return ''; });
      console.warn('[summary-generator] HTTP', res.status, errBody.slice(0, 200));
      return '';
    }

    var data = await res.json();
    var text = '';
    if (data && Array.isArray(data.content)) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === 'text' && data.content[i].text) {
          text += data.content[i].text;
        }
      }
    }
    text = text.trim();

    // Defensive: strip any wrapping quotes the model occasionally adds.
    text = text.replace(/^["'“‘]+|["'”’]+$/g, '');

    if (text) cacheSet(item.url, text);
    return text;
  } catch (e) {
    console.warn('[summary-generator] error:', e.message);
    return '';
  }
}

// Public: run a batch with bounded concurrency. Each entry is
//   { item, sourceContent }
// Returns the same shape with `.summary` filled in. Mutates in place AND
// returns the array for convenience.
async function generateSummariesBatch(entries, concurrency) {
  concurrency = concurrency || 5;
  var idx = 0;

  async function worker() {
    while (idx < entries.length) {
      var my = idx++;
      var e = entries[my];
      try {
        e.summary = await generateSummary(e.item, e.sourceContent);
      } catch (err) {
        e.summary = '';
      }
    }
  }

  var workers = [];
  for (var i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  return entries;
}

module.exports = {
  generateSummary: generateSummary,
  generateSummariesBatch: generateSummariesBatch,
  // exported for tests / introspection
  _cacheSize: function () { return CACHE.size; }
};
