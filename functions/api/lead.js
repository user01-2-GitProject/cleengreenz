// POST /api/lead
//
// Records a lead in D1 (binding DB) and, for estimate requests, emails Chris
// through Resend (secret RESEND_API_KEY). Each piece is optional so the site
// keeps working before setup is finished: if a form request couldn't be
// emailed, it answers 503 and the page falls back to opening an email.

const CLICK_TYPES = ['call', 'email', 'estimate_click'];
const LIMITS = { name: 100, phone: 40, address: 200, service: 80, notes: 2000, location: 40, page: 300, referrer: 300 };
// Pre-allocated static map to prevent creating object literals inside escapeHtml during string replacement.
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function clean(value, field) {
  if (typeof value !== 'string') return null;
  let val = value;
  if (field !== 'notes') {
    val = val.replace(/[\r\n]+/g, ' ');
  }
  const s = val.trim().slice(0, LIMITS[field]);
  return s || null;
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

export function sanitizePhone(phone) {
  return String(phone || '').replace(/[^0-9+() -]/g, '');
}

async function emailChris(env, lead) {
  if (!env.RESEND_API_KEY) return false;
  const rows = [
    ['Name', lead.name],
    ['Phone', lead.phone],
    ['Address', lead.address],
    ['Service', lead.service],
    ['Notes', lead.notes],
  ].filter(([, v]) => v);
  const safePhone = sanitizePhone(lead.phone);
  const text = ['New estimate request from cleengreenz.com', '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n');
  const html = `<p>New estimate request from cleengreenz.com</p><table>${rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><b>${k}</b></td><td>${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')}</table><p><a href="tel:${encodeURIComponent(safePhone)}">Call ${escapeHtml(lead.name)}</a></p>`;

  const cleanSubjectService = (lead.service || 'lawn care').replace(/[\r\n]/g, ' ');
  const cleanSubjectName = (lead.name || '').replace(/[\r\n]/g, ' ');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.LEAD_FROM || 'Cleen Greenz website <leads@cleengreenz.com>',
      to: (env.LEAD_TO || 'chris@cleengreenz.com').split(',').map((s) => s.trim()),
      subject: `Estimate request: ${cleanSubjectService} (${cleanSubjectName})`,
      text,
      html,
    }),
  });
  if (!res.ok) console.error('Resend failed', res.status, await res.text());
  return res.ok;
}

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const type = body.type === 'form' ? 'form' : CLICK_TYPES.includes(body.type) ? body.type : null;
  if (!type) return json({ ok: false, error: 'bad_type' }, 400);

  // Bots that fill every field trip the hidden "website" field. Pretend it worked.
  if (body.website) return json({ ok: true });

  const lead = {
    type,
    location: clean(body.location, 'location'),
    page: clean(body.page, 'page'),
    referrer: clean(body.referrer, 'referrer'),
    country: request.cf?.country || null,
    city: request.cf?.city || null,
  };

  if (type === 'form') {
    for (const f of ['name', 'phone', 'address', 'service', 'notes']) lead[f] = clean(body[f], f);
    if (!lead.name || !lead.phone || !lead.address) return json({ ok: false, error: 'missing_fields' }, 400);
  }

  let id = null;
  if (env.DB) {
    try {
      const row = await env.DB.prepare(
        `INSERT INTO leads (type, location, name, phone, address, service, notes, page, referrer, country, city)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
      )
        .bind(lead.type, lead.location, lead.name ?? null, lead.phone ?? null, lead.address ?? null,
          lead.service ?? null, lead.notes ?? null, lead.page, lead.referrer, lead.country, lead.city)
        .first();
      id = row?.id ?? null;
    } catch (err) {
      console.error('D1 insert failed', err);
    }
  }

  if (type !== 'form') return json({ ok: true });

  let emailed = false;
  try {
    emailed = await emailChris(env, lead);
  } catch (err) {
    console.error('Email failed', err);
  }
  if (emailed && id && env.DB) {
    waitUntil(env.DB.prepare('UPDATE leads SET emailed = 1 WHERE id = ?').bind(id).run().catch(() => {}));
  }

  // Chris only hears about a request by email, so if that didn't go out the
  // page falls back to opening the visitor's email app. It's still counted.
  if (!emailed) return json({ ok: false, error: 'email_failed', stored: Boolean(id) }, 503);
  return json({ ok: true });
}
