/* Temporary diagnostic endpoint for the news summary feature.
   Reports what the serverless function can actually see at runtime.

   Delete this file once the summary feature is confirmed working.

   Returns JSON, no secrets — only:
     - whether ANTHROPIC_API_KEY is present and its length (NOT the value)
     - whether summary-generator + article-fetcher modules can be required
     - a single test LLM call result (success/failure + status code)
*/

'use strict';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  var out = {
    ok: true,
    now: new Date().toISOString(),
    runtime: {
      node: process.version,
      vercel_env: process.env.VERCEL_ENV || null,
      vercel_region: process.env.VERCEL_REGION || null
    },
    env: {},
    modules: {},
    llmTest: null
  };

  // Env var visibility (length only, never the value).
  // Matches the fallback chain used in summary-generator.js + fraud-news-core.js.
  var key = process.env.ANTHROPIC_API_KEY || process.env.Anthropic || process.env.ANTHROPIC;
  var keySource = process.env.ANTHROPIC_API_KEY ? 'ANTHROPIC_API_KEY'
                : process.env.Anthropic        ? 'Anthropic'
                : process.env.ANTHROPIC        ? 'ANTHROPIC'
                : null;
  out.env.key_present = !!key;
  out.env.key_source = keySource;
  out.env.key_length = key ? key.length : 0;
  out.env.key_prefix = key ? key.slice(0, 10) + '…' : null;

  // Show any other env vars whose name CONTAINS 'anthropic' (case-insensitive)
  // so we catch typos like `Anthropic`, `ANTHROPIC`, `ANTHROPIC_KEY`, etc.
  out.env.matching_vars = Object.keys(process.env)
    .filter(function (k) { return /anthrop|claude/i.test(k); });

  // Module require checks
  try {
    require('./_lib/summary-generator');
    out.modules.summary_generator = 'ok';
  } catch (e) {
    out.modules.summary_generator = 'ERROR: ' + e.message;
  }
  try {
    require('./_lib/article-fetcher');
    out.modules.article_fetcher = 'ok';
  } catch (e) {
    out.modules.article_fetcher = 'ERROR: ' + e.message;
  }

  // Single test LLM call (only if key is present)
  if (key) {
    try {
      var apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 30,
          messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }]
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
      });
      var body = await apiRes.text();
      out.llmTest = {
        status: apiRes.status,
        ok: apiRes.ok,
        body_excerpt: body.slice(0, 400)
      };
    } catch (e) {
      out.llmTest = { error: e.message };
    }
  } else {
    out.llmTest = 'skipped — no API key visible to function';
  }

  res.status(200).json(out);
};
