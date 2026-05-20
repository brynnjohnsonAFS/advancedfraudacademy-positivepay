// ── CORS allowlist ──────────────────────────────────────────────────────
// Locked down from "*" to a known set so random origins can't POST to the
// tracking proxy. Production domain + Vercel preview deployments are allowed;
// same-origin requests (the actual site calling its own API) don't need CORS
// headers at all, so locking this down doesn't affect normal site behavior.
const ALLOWED_ORIGINS = new Set([
  'https://advancedfraudacademy.com',
  'https://www.advancedfraudacademy.com'
]);
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

function applyCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_RE.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  // If origin is not in the allowlist, we simply omit the CORS header —
  // the browser will block the response. Same-origin and server-to-server
  // calls aren't affected.
}

// Returns true if the request should proceed past the gate.
// We allow:
//   - any request with no Origin header (same-origin GETs, server-to-server,
//     internal calls — these can't be triggered by a malicious 3rd-party site)
//   - requests whose Origin is in our allowlist
// We reject everything else BEFORE forwarding to Make, so unallowed origins
// can't pollute the audit log even though browser CORS would already block
// them from reading the response.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_RE.test(origin);
}

module.exports = async function handler(req, res) {
  applyCors(req, res);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  // Reject unallowed origins BEFORE forwarding to Make — prevents cross-site
  // pollution of the audit log even when an attacker calls the endpoint
  // from a browser context they control.
  if (!originAllowed(req)) {
    console.warn('[track] rejected origin:', req.headers.origin);
    res.status(403).json({ ok: false, error: 'origin_not_allowed' });
    return;
  }

  const payload = req.body || {};

  // ── Inject timestamps on every tracked event ────────────────────────────
  // Server-side timestamps are authoritative (client clocks can be wrong).
  // We add three formats:
  //   - timestamp:      ISO 8601 UTC, for structured logging / future schema
  //   - timestamp_local: ISO 8601 in America/New_York (AFS HQ), for analyst eyes
  //   - action: prefixed with [YYYY-MM-DD HH:MM ET] so it shows up in the
  //     existing audit log column without any Make/Sheets schema changes
  try {
    const now = new Date();
    payload.timestamp = now.toISOString();

    // Format an ET timestamp using Intl — handles DST automatically
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
    const parts = fmt.formatToParts(now).reduce((acc, p) => {
      acc[p.type] = p.value; return acc;
    }, {});
    const tsET = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ET`;
    payload.timestamp_local = tsET;

    // Prepend to action so it appears in the existing audit log view
    if (payload.action && typeof payload.action === 'string' &&
        !payload.action.startsWith('[')) {
      payload.action = `[${tsET}] ${payload.action}`;
    }
  } catch (e) {
    console.error('[track] timestamp injection failed:', e.message);
  }

  const body = Object.keys(payload)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]))
    .join('&');

  let pardotStatus = null;
  try {
    const r = await fetch('https://hook.us2.make.com/t9jglsyawveob5p7lserkqwovdxupsuv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    pardotStatus = r.status;
  } catch (e) {
    console.error('[track] Pardot fetch error:', e.message);
  }

  console.log('[track] payload:', body, '| pardot status:', pardotStatus);
  res.status(200).json({ ok: true, pardotStatus });
};
