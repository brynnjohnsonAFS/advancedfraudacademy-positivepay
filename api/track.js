module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const payload = req.body || {};
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
