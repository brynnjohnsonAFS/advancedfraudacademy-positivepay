module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).end();
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
