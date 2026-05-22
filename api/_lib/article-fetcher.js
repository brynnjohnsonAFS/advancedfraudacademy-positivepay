/* Advanced Fraud Academy — article-fetcher.js
   Pulls the main text body from a linked news article so the summary-generator
   has real source material to work with.

   Used primarily for Google News items, where the RSS <description> is just a
   repeat of the headline. Other feeds (FBI, DOJ, Krebs, etc.) already carry a
   usable excerpt in the RSS body, so callers can skip this path for those.

   Best-effort, zero-dependency. Failures return '' so the calling site can
   fall back to whatever excerpt it already had.
*/

'use strict';

var FETCH_TIMEOUT_MS = 6000;
var MAX_BODY_CHARS = 3000;

// Google News RSS links are wrappers like
//   https://news.google.com/rss/articles/CBMi...?oc=5
// that redirect to the real publisher. We follow up to a few redirects to land
// on the actual article. The platform fetch follows redirects by default in
// Node 18+; we just rely on `res.url` to expose the final URL.

async function fetchHtml(url) {
  try {
    var res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Some publishers gate bots. Identify ourselves honestly but mimic a
        // real browser so we get a static-rendered article body, not a
        // JS-only shell or a "please enable cookies" page.
        'User-Agent': 'Mozilla/5.0 (compatible; AdvancedFraudAcademy/1.0; +https://advancedfraudacademy.com)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined
    });
    if (!res.ok) return '';
    var ctype = res.headers.get('content-type') || '';
    if (!/html|xml/i.test(ctype)) return '';
    return await res.text();
  } catch (e) {
    return '';
  }
}

// Very lightweight readability heuristic — no DOM parser available.
// 1. Strip <script>, <style>, <nav>, <header>, <footer>, <aside>, <form>
//    blocks so they don't feed into the text.
// 2. Strip all remaining tags.
// 3. Collapse whitespace.
// 4. Trim. The summary-generator then crops further as needed.
function extractMainText(html) {
  if (!html) return '';
  var t = html;

  // Drop noisy structural sections entirely (open + content + close).
  ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form', 'iframe', 'svg'].forEach(function (tag) {
    var re = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>', 'gi');
    t = t.replace(re, ' ');
  });

  // Prefer <article> body if present — most news sites wrap the main story in one.
  var articleMatch = t.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) t = articleMatch[1];

  // Strip remaining tags + decode common entities.
  t = t
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, c) { return String.fromCharCode(parseInt(c, 10)); })
    .replace(/&#x([0-9a-f]+);/gi, function (_, c) { return String.fromCharCode(parseInt(c, 16)); })
    .replace(/\s+/g, ' ')
    .trim();

  return t.slice(0, MAX_BODY_CHARS);
}

// Public: fetch + extract. Returns extracted text or '' on any failure.
async function fetchArticleText(url) {
  if (!url) return '';
  var html = await fetchHtml(url);
  if (!html) return '';
  return extractMainText(html);
}

module.exports = {
  fetchArticleText: fetchArticleText,
  // exported for testing
  extractMainText: extractMainText
};
