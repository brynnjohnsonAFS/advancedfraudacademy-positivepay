/* Temp diagnostic: runs the summary generator against a CourtListener item
   and a Google News item, and reports exactly what happened.

   Delete after debugging.
*/

'use strict';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  var out = { ok: true, now: new Date().toISOString(), env: {}, tests: {} };
  var key = process.env.ANTHROPIC_API_KEY || process.env.Anthropic || process.env.ANTHROPIC;
  out.env.key_present = !!key;
  out.env.key_length = key ? key.length : 0;

  // Pull module
  var sg;
  try {
    sg = require('./_lib/summary-generator');
    out.tests.module_load = 'ok';
  } catch (e) {
    out.tests.module_load = 'ERROR: ' + e.message;
    res.status(200).json(out);
    return;
  }

  // Test 1: CourtListener-style item with raw filing excerpt
  var clItem = {
    title: 'United States v. Morales',
    url: 'https://www.courtlistener.com/docket/diag-test-cl/',
    source: 'CourtListener',
    categories: ['Court filing', 'Check fraud']
  };
  var clExcerpt = '8:25-cr-00216-RFR-MDN Doc # 35 Filed: 05/19/26 Page 1 of 11 IN THE UNITED STATES DISTRICT COURT FOR THE DISTRICT OF NEBRASKA UNITED STATES OF AMERICA Plaintiff SUPERSEDING INDICTMENT vs 18 USC sections 1344 and 1349. Bank fraud and conspiracy to commit bank fraud.';

  try {
    var t0 = Date.now();
    var clSummary = await sg.generateSummary(clItem, clExcerpt);
    out.tests.cl_call = {
      elapsed_ms: Date.now() - t0,
      summary: clSummary,
      summary_length: clSummary.length
    };
  } catch (e) {
    out.tests.cl_call = { error: e.message, stack: e.stack };
  }

  // Test 2: Direct Anthropic call (no wrapper) to confirm baseline works
  if (key) {
    try {
      var t1 = Date.now();
      var apiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 100,
          messages: [{ role: 'user', content: 'Summarize in 1 sentence: ' + clExcerpt }]
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
      });
      var body = await apiRes.text();
      out.tests.direct_call = {
        elapsed_ms: Date.now() - t1,
        status: apiRes.status,
        body_excerpt: body.slice(0, 600)
      };
    } catch (e) {
      out.tests.direct_call = { error: e.message };
    }
  }

  res.status(200).json(out);
};
