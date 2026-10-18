/* Emails a short alert when a new problem report is saved.
   Called by a Supabase Database Webhook (INSERT on public.feedback). Needs three settings in Netlify:
   FEEDBACK_WEBHOOK_SECRET, RESEND_API_KEY, FEEDBACK_TO (defaults to ahmed.salem@arnour.com).
   Without them it does nothing; reports still appear in Admin > Feedback. */
exports.handler = async function (event) {
  const secret = process.env.FEEDBACK_WEBHOOK_SECRET, key = process.env.RESEND_API_KEY;
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  if (!secret || !key) return { statusCode: 200, body: 'not configured' };
  if ((event.headers['x-webhook-secret'] || '') !== secret) return { statusCode: 401, body: 'unauthorized' };
  let rec;
  try { rec = (JSON.parse(event.body || '{}').record) || {}; } catch (e) { return { statusCode: 400, body: 'bad request' }; }
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const subject = 'Arnour: new ' + esc(rec.category || 'report') + ' report' + (rec.email ? ' from ' + rec.email : '');
  const html = '<p><b>' + esc(rec.category) + '</b> from ' + esc(rec.email || 'anonymous') + (rec.role ? ' (' + esc(rec.role) + ')' : '') + '</p>' +
    '<p style="white-space:pre-wrap">' + esc(rec.message) + '</p>' +
    '<p style="color:#64748b;font-size:12px">' + esc(rec.page) + '<br>' + esc(rec.ua) + '</p>' +
    '<p><a href="https://arnour.com/#/admin/feedback">Open Admin &gt; Feedback</a></p>';
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'authorization': 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.FEEDBACK_FROM || 'Arnour <onboarding@resend.dev>', to: [process.env.FEEDBACK_TO || 'ahmed.salem@arnour.com'], subject: subject, html: html, reply_to: rec.email || undefined })
  });
  return { statusCode: r.ok ? 200 : 502, body: r.ok ? 'sent' : 'mail failed' };
};
