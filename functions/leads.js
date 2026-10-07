// GET /leads
//
// A private page for the team: lead counts by week and month, and the latest
// estimate requests. Protected by a browser password prompt; the password is
// the LEADS_PASSWORD secret (any username works).

import { sanitizePhone } from './api/lead.js';

// Pre-allocated static map to prevent creating object literals inside escapeHtml during string replacement.
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

// Module-scoped TextEncoder to avoid repeated instantiation on every authorization check.
const ENCODER = new TextEncoder();

export function authorized(request, password) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  let decoded = '';
  try {
    decoded = atob(header.slice(6));
  } catch {
    return false;
  }
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) return false;
  const given = decoded.slice(colonIndex + 1);
  // Constant-time compare so the password length and content can't be guessed via timing.
  const a = ENCODER.encode(given);
  const b = ENCODER.encode(password);
  const lengthsMatch = a.length === b.length;
  // Use b if lengths match; otherwise compare a against a dummy buffer of matching length.
  const compB = lengthsMatch ? b : new Uint8Array(a.length);
  let equal = false;
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.timingSafeEqual === 'function') {
    equal = crypto.subtle.timingSafeEqual(a, compB);
  } else {
    let mismatch = 0;
    for (let i = 0; i < a.length; i++) {
      mismatch |= a[i] ^ compB[i];
    }
    equal = mismatch === 0;
  }
  return lengthsMatch && equal;
}

const LABELS = { form: 'Estimate forms', call: 'Call taps', email: 'Email taps', estimate_click: 'Estimate button clicks' };
const TYPES = Object.keys(LABELS);

const SECURITY_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-permitted-cross-domain-policies': 'none',
  'permissions-policy': 'accelerometer=(), camera=(), microphone=(), geolocation=(), payment=()',
  'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline';",
};

export function renderLeadsHtml({ totals = [], months = [], recent = [] } = {}) {
  // Populate byType directly to avoid creating intermediate 2-tuple arrays with Object.fromEntries.
  const byType = {};
  for (let i = 0; i < totals.length; i++) {
    const r = totals[i];
    byType[r.type] = r;
  }
  const types = TYPES;
  const monthRows = {};
  for (const r of months) (monthRows[r.month] ||= {})[r.type] = r.n;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Cleen Greenz leads</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px 16px 48px; background: #f7f1e3; color: #3b2a1a; }
  main { max-width: 1000px; margin: 0 auto; }
  h1 { color: #1f4d2b; margin: 0 0 4px; } h2 { color: #1f4d2b; margin-top: 36px; }
  .note { color: #6b5a48; margin: 0 0 20px; font-size: .95rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .card { background: #fff; border-radius: 12px; padding: 16px; }
  .card b { display: block; font-size: 2rem; color: #1f4d2b; line-height: 1.1; }
  .card span { color: #6b5a48; font-size: .9rem; }
  .scroll { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #eee3cc; vertical-align: top; font-size: .95rem; }
  th { background: #1f4d2b; color: #fff; font-weight: 600; }
  .num { text-align: right; }
</style></head><body><main>
<h1>Leads</h1>
<p class="note">Estimate forms are full requests. Taps count people who pressed a call or email link, not finished calls.</p>
<div class="cards">
${types
  .map((t) => {
    const r = byType[t] || {};
    return `<div class="card"><span>${LABELS[t]}</span><b>${r.month || 0}</b><span>last 30 days · ${r.week || 0} this week · ${r.total || 0} all time</span></div>`;
  })
  .join('')}
</div>
<h2>By month</h2>
<div class="scroll"><table><tr><th>Month</th>${types.map((t) => `<th class="num">${LABELS[t]}</th>`).join('')}</tr>
${Object.keys(monthRows)
  .map((m) => `<tr><td>${escapeHtml(m)}</td>${types.map((t) => `<td class="num">${monthRows[m][t] || 0}</td>`).join('')}</tr>`)
  .join('') || `<tr><td colspan="${types.length + 1}">No leads yet.</td></tr>`}
</table></div>
<h2>Latest estimate requests</h2>
<div class="scroll"><table><tr><th>When (UTC)</th><th>Name</th><th>Phone</th><th>Address</th><th>Service</th><th>Notes</th><th>Emailed</th></tr>
${recent
  .map(
    (r) => `<tr><td>${escapeHtml(r.created_at.replace('T', ' ').slice(0, 16))}</td><td>${escapeHtml(r.name)}</td>
<td><a href="tel:${encodeURIComponent(sanitizePhone(r.phone))}">${escapeHtml(r.phone)}</a></td><td>${escapeHtml(r.address)}</td>
<td>${escapeHtml(r.service)}</td><td>${escapeHtml(r.notes)}</td><td>${r.emailed ? 'Yes' : 'No'}</td></tr>`
  )
  .join('') || '<tr><td colspan="7">No requests yet.</td></tr>'}
</table></div>
</main></body></html>`;
}

export async function onRequestGet({ request, env }) {
  if (!env.LEADS_PASSWORD || !authorized(request, env.LEADS_PASSWORD)) {
    return new Response('Password required', {
      status: 401,
      headers: {
        'www-authenticate': 'Basic realm="Cleen Greenz leads", charset="UTF-8"',
        ...SECURITY_HEADERS,
      },
    });
  }
  if (!env.DB) {
    return new Response('Lead database is not connected yet.', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        ...SECURITY_HEADERS,
      },
    });
  }

  const [totals, months, recent] = await env.DB.batch([
    env.DB.prepare(
      `SELECT type,
              SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-7 days'))  AS week,
              SUM(created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-30 days')) AS month,
              COUNT(*) AS total
         FROM leads GROUP BY type`
    ),
    env.DB.prepare(
      `SELECT substr(created_at, 1, 7) AS month, type, COUNT(*) AS n
         FROM leads WHERE created_at >= strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-12 months')
        GROUP BY month, type ORDER BY month DESC`
    ),
    env.DB.prepare(
      `SELECT created_at, name, phone, address, service, notes, emailed
         FROM leads WHERE type = 'form' ORDER BY id DESC LIMIT 50`
    ),
  ]);

  const html = renderLeadsHtml({
    totals: totals.results,
    months: months.results,
    recent: recent.results,
  });

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...SECURITY_HEADERS,
    },
  });
}
