export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const payload = req.body || {};
  const body = Object.keys(payload)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(payload[k]))
    .join('&');

  try {
    await fetch('https://go.advancedfraudsolutions.com/l/783193/2026-05-14/67431i', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      redirect: 'manual'
    });
  } catch (e) {}

  res.status(200).json({ ok: true });
}
