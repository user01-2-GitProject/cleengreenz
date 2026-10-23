// POST /api/lead
//
// Records a lead in D1 (binding DB) and, for estimate requests, emails Chris
// through Resend (secret RESEND_API_KEY). Each piece is optional so the site
// keeps working before setup is finished: if a form request couldn't be
// emailed, it answers 503 and the page falls back to opening an email.

const CLICK_TYPES = ['call', 'email', 'estimate_click'];
const LIMITS = { name: 100, phone: 40, address: 200, service: 80, notes: 2000, location: 40, page: 300, referrer: 300, country: 10, city: 100 };

// In-memory sliding window rate limiter: max 10 requests per minute per IP address
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const ipRequestLogs = new Map();

export function isRateLimited(ip, now = Date.now()) {
  if (!ip) return false;
  let timestamps = ipRequestLogs.get(ip);
  if (!timestamps) {
    timestamps = [];
    ipRequestLogs.set(ip, timestamps);
  }
  // Filter out timestamps outside the sliding window
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = timestamps.filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRequestLogs.set(ip, recent);
    return true;
  }
  recent.push(now);
  ipRequestLogs.set(ip, recent);
  // Periodic cleanup of stale IP entries when map grows
  if (ipRequestLogs.size > 1000) {
    for (const [k, v] of ipRequestLogs.entries()) {
      if (v.every((t) => t <= windowStart)) ipRequestLogs.delete(k);
    }
  }
  return false;
}
// Pre-allocated static map to prevent creating object literals inside escapeHtml during string replacement.
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Pre-compiled module-scoped RegExp instances to avoid re-compilation and garbage collection overhead per API request.
// Strips non-printable ASCII control characters, Unicode BIDI directionality overrides, and zero-width spaces.
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B\uFEFF]/g;
const CRLF_REGEX = /[\r\n]+/g;
const CRLF_SINGLE_REGEX = /\r\n?/g;
const CRLF_RAW_REGEX = /[\r\n]/g;
const HTML_CHARS_REGEX = /[&<>"']/g;
const SAN_PHONE_REGEX = /[^0-9+() -]/g;

function clean(value, field) {
  if (typeof value !== 'string') return null;
  // Strip non-printable ASCII control characters (excluding tab and newline).
  let val = value.replace(CONTROL_CHARS_REGEX, '');
  if (field !== 'notes') {
    // Strip CRLF linebreaks to prevent email header injection, log pollution, or response split attacks.
    val = val.replace(CRLF_REGEX, ' ');
  } else {
    val = val.replace(CRLF_SINGLE_REGEX, '\n');
  }
  const maxLen = LIMITS[field] || 300;
  const s = val.trim().slice(0, maxLen);
  return s || null;
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'strict-transport-security': 'max-age=31536000; includeSubDomains', // Enforce HTTPS to protect against SSL stripping and HTTP downgrade attacks
      'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none';",
      'permissions-policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
      'cross-origin-resource-policy': 'same-origin',
      'x-permitted-cross-domain-policies': 'none',
      ...extraHeaders,
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return json({ ok: false, error: 'method_not_allowed' }, 405, { allow: 'POST' });
}

function escapeHtml(s) {
  return String(s ?? '').replace(HTML_CHARS_REGEX, (c) => ESCAPE_MAP[c]);
}

export function sanitizePhone(phone) {
  return String(phone || '').replace(SAN_PHONE_REGEX, '');
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
    .join('')}</table><p><a href="tel:${encodeURIComponent(safePhone)}">Call ${escapeHtml(lead.name || 'Customer')}</a></p>`;

  const cleanSubjectService = (lead.service || 'lawn care').replace(CRLF_RAW_REGEX, ' ');
  const cleanSubjectName = (lead.name || '').replace(CRLF_RAW_REGEX, ' ');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: (env.LEAD_FROM || 'Cleen Greenz website <leads@cleengreenz.com>').replace(CRLF_RAW_REGEX, ''),
      to: (env.LEAD_TO || 'chris@cleengreenz.com')
        .split(',')
        .map((s) => s.trim().replace(CRLF_RAW_REGEX, ''))
        .filter(Boolean),
      subject: `Estimate request: ${cleanSubjectService} (${cleanSubjectName})`,
      text,
      html,
    }),
  });
  if (!res.ok) console.error('Resend failed', res.status, await res.text());
  return res.ok;
}

export async function onRequestPost({ request, env, waitUntil }) {
  // Rate Limiting: Prevent automated spam and DoS attacks by limiting requests per IP address
  const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (clientIp && isRateLimited(clientIp)) {
    return json({ ok: false, error: 'rate_limited' }, 429);
  }

  // CSRF Protection: Block cross-site requests to prevent unauthorized lead submissions/spam.
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const reqUrl = new URL(request.url);

  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.origin !== reqUrl.origin || (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:')) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
    } catch {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
  }
  if (referer) {
    try {
      const parsedReferer = new URL(referer);
      if (parsedReferer.origin !== reqUrl.origin || (parsedReferer.protocol !== 'http:' && parsedReferer.protocol !== 'https:')) {
        return json({ ok: false, error: 'forbidden' }, 403);
      }
    } catch {
      return json({ ok: false, error: 'forbidden' }, 403);
    }
  }

  const rawContentLength = request.headers.get('content-length');
  if (rawContentLength !== null) {
    const contentLength = parseInt(rawContentLength, 10);
    if (isNaN(contentLength) || contentLength < 0 || contentLength > 65536) {
      return json({ ok: false, error: 'payload_too_large' }, 413);
    }
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  if (rawBody.length > 65536) {
    return json({ ok: false, error: 'payload_too_large' }, 413);
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
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
    country: clean(request.cf?.country, 'country'),
    city: clean(request.cf?.city, 'city'),
  };

  // Validate raw string lengths against configured LIMITS to mitigate DoS / payload inflation risks
  for (const f of ['location', 'page', 'referrer']) {
    if (typeof body[f] === 'string' && body[f].length > (LIMITS[f] || 300)) {
      return json({ ok: false, error: 'bad_request' }, 400);
    }
  }

  if (type === 'form') {
    for (const f of ['name', 'phone', 'address', 'service', 'notes']) {
      if (typeof body[f] === 'string' && body[f].length > (LIMITS[f] || 300)) {
        return json({ ok: false, error: 'bad_request' }, 400);
      }
      lead[f] = clean(body[f], f);
    }
    if (!lead.name || !lead.phone || !lead.address) return json({ ok: false, error: 'missing_fields' }, 400);
    // Validate phone number has at least 7 numeric digits to prevent garbage or invalid contact numbers
    const phoneDigits = sanitizePhone(lead.phone).replace(/\D/g, '');
    if (phoneDigits.length < 7) return json({ ok: false, error: 'missing_fields' }, 400);
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
