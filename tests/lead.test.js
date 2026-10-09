import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { json, onRequestPost, sanitizePhone } from '../functions/api/lead.js';
import { authorized, onRequestGet, renderLeadsHtml } from '../functions/leads.js';

// js/leads.js is a classic browser script (loaded via <script src>), so it
// cannot use ESM export syntax. It assigns module.exports when a CommonJS-style
// `module` is present, so we evaluate it with one supplied. Using new Function
// (rather than vm) keeps the script in the real global scope, so buildPayload
// still reads globalThis.location / globalThis.document at call time.
function loadLeadsScript() {
  const src = fs.readFileSync(new URL('../js/leads.js', import.meta.url), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', src)(module, module.exports);
  return module.exports;
}
const { buildPayload } = loadLeadsScript();

test('sanitizePhone helper function', async (t) => {
  await t.test('preserves valid phone numbers and formatting characters', async () => {
    assert.equal(sanitizePhone('+1 (269) 362-8286'), '+1 (269) 362-8286');
    assert.equal(sanitizePhone('269-362-8286'), '269-362-8286');
  });

  await t.test('strips out unsafe HTML/URL injection characters', async () => {
    assert.equal(sanitizePhone('269-362-8286" onclick="alert(foo)"'), '269-362-8286 ()');
    assert.equal(sanitizePhone('javascript:alert("xss")'), '()');
    assert.equal(sanitizePhone('<script>alert("xss")</script>'), '()');
  });

  await t.test('handles empty or non-string inputs safely', async () => {
    assert.equal(sanitizePhone(''), '');
    assert.equal(sanitizePhone(null), '');
    assert.equal(sanitizePhone(undefined), '');
  });
});

test('json helper function', async (t) => {
  await t.test('returns status 200 by default', async () => {
    const res = json({ ok: true });
    assert.equal(res.status, 200);
  });

  await t.test('returns custom status code when provided', async () => {
    const res = json({ ok: false, error: 'bad_request' }, 400);
    assert.equal(res.status, 400);

    const res503 = json({ ok: false, error: 'email_failed' }, 503);
    assert.equal(res503.status, 503);
  });

  await t.test('sets content-type and security headers', async () => {
    const res = json({ message: 'hello' });
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.headers.get('content-security-policy'), "default-src 'none'");
  });

  await t.test('serializes object body correctly into valid JSON', async () => {
    const bodyObj = { ok: true, nested: { value: 123 }, list: ['a', 'b', null] };
    const res = json(bodyObj);
    const rawText = await res.text();
    assert.equal(rawText, JSON.stringify(bodyObj));
    assert.deepEqual(JSON.parse(rawText), bodyObj);
  });

  await t.test('handles non-object bodies (primitives, null, arrays)', async () => {
    const arrayRes = json([1, 2, 3]);
    assert.deepEqual(await arrayRes.json(), [1, 2, 3]);

    const stringRes = json('hello world');
    assert.equal(await stringRes.json(), 'hello world');

    const nullRes = json(null);
    assert.equal(await nullRes.json(), null);
  });
});

test('authorized authentication helper function', async (t) => {
  const secret = 'super-secret-password-123';

  function makeReq(authHeader) {
    const headers = new Headers();
    if (authHeader) headers.set('authorization', authHeader);
    return new Request('https://cleengreenz.com/leads', { headers });
  }

  function basicAuth(username, password) {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  await t.test('returns true for correct password', async () => {
    const req = makeReq(basicAuth('admin', secret));
    assert.equal(authorized(req, secret), true);
  });

  await t.test('returns false for wrong password of same length', async () => {
    const req = makeReq(basicAuth('admin', 'super-secret-password-124'));
    assert.equal(authorized(req, secret), false);
  });

  await t.test('returns false for wrong password of different length', async () => {
    const req = makeReq(basicAuth('admin', 'wrong'));
    assert.equal(authorized(req, secret), false);
    const reqLonger = makeReq(basicAuth('admin', 'super-secret-password-123-extra'));
    assert.equal(authorized(reqLonger, secret), false);
  });

  await t.test('returns false for missing or invalid authorization header', async () => {
    assert.equal(authorized(makeReq(null), secret), false);
    assert.equal(authorized(makeReq('Bearer xyz'), secret), false);
    assert.equal(authorized(makeReq('Basic invalid_base64!'), secret), false);
  });

  await t.test('handles basic auth strings without colon correctly', async () => {
    const noColon = 'Basic ' + Buffer.from('nocolonhere').toString('base64');
    assert.equal(authorized(makeReq(noColon), secret), false);
  });
});

test('onRequestPost uses json response formatting correctly', async (t) => {
  await t.test('returns 400 JSON response when Content-Type is not application/json', async () => {
    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ type: 'call' }),
    });
    const res = await onRequestPost({ request, env: {}, waitUntil: () => {} });

    assert.equal(res.status, 400);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { ok: false, error: 'bad_request' });
  });

  await t.test('returns 400 JSON response on invalid JSON request body', async () => {
    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'invalid-json-{',
    });
    const res = await onRequestPost({ request, env: {}, waitUntil: () => {} });

    assert.equal(res.status, 400);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { ok: false, error: 'bad_request' });
  });

  await t.test('returns 400 JSON response on invalid lead type', async () => {
    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'invalid_type' }),
    });
    const res = await onRequestPost({ request, env: {}, waitUntil: () => {} });

    assert.equal(res.status, 400);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { ok: false, error: 'bad_type' });
  });

  await t.test('returns 200 JSON response on valid click event', async () => {
    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'call' }),
    });
    const res = await onRequestPost({ request, env: {}, waitUntil: () => {} });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { ok: true });
  });

  await t.test('sanitizes linebreaks and control characters in form fields when submitted', async () => {
    let capturedBody = null;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ id: 'resend_123' }), { status: 200 });
    };

    try {
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'form',
          name: 'Jane\x00\x08\r\nDoe\x1F',
          phone: '269-555-0199\n',
          address: '123\r\nMain\nSt',
          service: 'Lawn\rCare',
          notes: 'Line 1\r\nLine 2\rLine 3\x07',
        }),
      });

      const res = await onRequestPost({
        request,
        env: { RESEND_API_KEY: 'test-key' },
        waitUntil: () => {},
      });

      assert.equal(res.status, 200);
      assert.equal(capturedBody.subject, 'Estimate request: Lawn Care (Jane Doe)');
      assert.match(capturedBody.text, /Name: Jane Doe/);
      assert.match(capturedBody.text, /Phone: 269-555-0199/);
      assert.match(capturedBody.text, /Address: 123 Main St/);
      assert.match(capturedBody.text, /Service: Lawn Care/);
      assert.match(capturedBody.text, /Notes: Line 1\nLine 2\nLine 3/);
      assert.equal(capturedBody.html.includes('Line 1<br>Line 2<br>Line 3'), true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('returns 400 with missing_fields error on form submission missing required fields', async () => {
    const testCases = [
      { body: { type: 'form' }, missing: 'all required fields' },
      { body: { type: 'form', phone: '269-555-0100', address: '123 Main St' }, missing: 'name' },
      { body: { type: 'form', name: 'John Doe', address: '123 Main St' }, missing: 'phone' },
      { body: { type: 'form', name: 'John Doe', phone: '269-555-0100' }, missing: 'address' },
      { body: { type: 'form', name: '   ', phone: '269-555-0100', address: '123 Main St' }, missing: 'whitespace name' },
    ];

    for (const { body, missing } of testCases) {
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res = await onRequestPost({ request, env: {}, waitUntil: () => {} });

      assert.equal(res.status, 400, `Expected status 400 when missing ${missing}`);
      assert.equal(res.headers.get('content-type'), 'application/json');
      assert.deepEqual(await res.json(), { ok: false, error: 'missing_fields' }, `Expected error missing_fields when missing ${missing}`);
    }
  });
  await t.test('returns 200 JSON response when bot trap website field is filled and bypasses DB/email', async () => {
    let dbCalled = false;
    const mockDb = {
      prepare: () => {
        dbCalled = true;
        return {
          bind: () => ({
            first: async () => ({ id: 1 }),
          }),
        };
      },
    };

    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'form',
        name: 'Bot User',
        phone: '1234567890',
        address: '123 Web St',
        website: 'http://spam-site.com',
      }),
    });

    const res = await onRequestPost({
      request,
      env: { DB: mockDb, RESEND_API_KEY: 'test-key' },
      waitUntil: () => {},
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/json');
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(dbCalled, false, 'DB insertion should be bypassed for bot trap requests');
  });

  await t.test('returns 503 with stored: false when email failed and not stored in DB', async () => {
    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'form',
        name: 'Jane Doe',
        phone: '269-555-0199',
        address: '123 Main St',
      }),
    });
    const res = await onRequestPost({ request, env: {}, waitUntil: () => {} });

    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, error: 'email_failed', stored: false });
  });

  await t.test('returns 503 with stored: true when email failed but lead stored in DB', async () => {
    const mockDb = {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ id: 42 }),
        }),
      }),
    };

    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'form',
        name: 'Jane Doe',
        phone: '269-555-0199',
        address: '123 Main St',
      }),
    });
    const res = await onRequestPost({ request, env: { DB: mockDb }, waitUntil: () => {} });

    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, error: 'email_failed', stored: true });
  });

  await t.test('returns 503 when Resend API returns HTTP error response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });

    try {
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'form',
          name: 'Jane Doe',
          phone: '269-555-0199',
          address: '123 Main St',
        }),
      });
      const res = await onRequestPost({
        request,
        env: { RESEND_API_KEY: 'test-key' },
        waitUntil: () => {},
      });

      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { ok: false, error: 'email_failed', stored: false });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('returns 503 when fetch throws network error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError('Network error');
    };

    try {
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'form',
          name: 'Jane Doe',
          phone: '269-555-0199',
          address: '123 Main St',
        }),
      });
      const res = await onRequestPost({
        request,
        env: { RESEND_API_KEY: 'test-key' },
        waitUntil: () => {},
      });

      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { ok: false, error: 'email_failed', stored: false });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('returns 200 on successful email delivery and updates DB', async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalledWith = null;

    globalThis.fetch = async (url, options) => {
      fetchCalledWith = { url, options };
      return new Response(JSON.stringify({ id: 'resend_123' }), { status: 200 });
    };

    let waitUntilPromise = null;
    let dbUpdated = false;

    const mockDb = {
      prepare: (sql) => {
        if (sql.includes('UPDATE leads SET emailed = 1')) {
          return {
            bind: (id) => ({
              run: async () => {
                if (id === 101) dbUpdated = true;
              },
            }),
          };
        }
        return {
          bind: () => ({
            first: async () => ({ id: 101 }),
          }),
        };
      },
    };

    try {
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'form',
          name: 'Jane Doe',
          phone: '269-555-0199',
          address: '123 Main St',
          service: 'Mowing',
          notes: 'Front yard only',
        }),
      });

      const res = await onRequestPost({
        request,
        env: { RESEND_API_KEY: 'test-key', DB: mockDb },
        waitUntil: (promise) => {
          waitUntilPromise = promise;
        },
      });

      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
      assert.equal(fetchCalledWith.url, 'https://api.resend.com/emails');

      if (waitUntilPromise) {
        await waitUntilPromise;
      }
      assert.equal(dbUpdated, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('handles D1 database insert failure gracefully for click lead', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const failingDb = {
        prepare() {
          throw new Error('D1 connection failed');
        },
      };
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'call' }),
      });
      const res = await onRequestPost({ request, env: { DB: failingDb }, waitUntil: () => {} });

      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
    } finally {
      console.error = originalConsoleError;
    }
  });

  await t.test('handles D1 database insert failure gracefully for form submission when emailing fails', async () => {
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      const failingDb = {
        prepare() {
          throw new Error('D1 insert failed');
        },
      };
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'form',
          name: 'Jane Doe',
          phone: '269-555-0199',
          address: '123 Main St',
        }),
      });
      const res = await onRequestPost({ request, env: { DB: failingDb }, waitUntil: () => {} });

      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { ok: false, error: 'email_failed', stored: false });
    } finally {
      console.error = originalConsoleError;
    }
  });

  await t.test('handles D1 database insert failure gracefully for form submission when emailing succeeds', async () => {
    const originalConsoleError = console.error;
    const originalFetch = globalThis.fetch;
    console.error = () => {};
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 'msg_123' }), { status: 200 });

    try {
      const failingDb = {
        prepare() {
          throw new Error('D1 insert failed');
        },
      };
      const request = new Request('https://cleengreenz.com/api/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'form',
          name: 'Jane Doe',
          phone: '269-555-0199',
          address: '123 Main St',
        }),
      });
      const res = await onRequestPost({
        request,
        env: { DB: failingDb, RESEND_API_KEY: 'test-key' },
        waitUntil: () => {},
      });

      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), { ok: true });
    } finally {
      console.error = originalConsoleError;
      globalThis.fetch = originalFetch;
    }
  });
});

test('onRequestGet authorization and response handling', async (t) => {
  const secret = 'super-secret-password-123';

  function basicAuth(username, password) {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  await t.test('returns 401 with security headers when LEADS_PASSWORD env is missing', async () => {
    const request = new Request('https://cleengreenz.com/leads', {
      headers: { authorization: basicAuth('admin', secret) },
    });
    const res = await onRequestGet({ request, env: {} });

    assert.equal(res.status, 401);
    assert.equal(await res.text(), 'Password required');
    assert.equal(
      res.headers.get('www-authenticate'),
      'Basic realm="Cleen Greenz leads", charset="UTF-8"'
    );
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(
      res.headers.get('content-security-policy'),
      "default-src 'self'; style-src 'self' 'sha256-nnmhsW+PD6dOzA3sJ2sc2gUbiRSRAlPO4uoz9DJ2yJ4=';"
    );
    assert.ok(!res.headers.get('content-security-policy').includes("'unsafe-inline'"));
  });

  await t.test('returns 401 when authorization header is missing', async () => {
    const request = new Request('https://cleengreenz.com/leads');
    const res = await onRequestGet({ request, env: { LEADS_PASSWORD: secret } });

    assert.equal(res.status, 401);
    assert.equal(await res.text(), 'Password required');
    assert.equal(
      res.headers.get('www-authenticate'),
      'Basic realm="Cleen Greenz leads", charset="UTF-8"'
    );
  });

  await t.test('returns 401 when authorization header has invalid password or format', async () => {
    const reqWrongPass = new Request('https://cleengreenz.com/leads', {
      headers: { authorization: basicAuth('admin', 'wrong-password') },
    });
    const resWrongPass = await onRequestGet({ request: reqWrongPass, env: { LEADS_PASSWORD: secret } });
    assert.equal(resWrongPass.status, 401);
    assert.equal(
      resWrongPass.headers.get('www-authenticate'),
      'Basic realm="Cleen Greenz leads", charset="UTF-8"'
    );

    const reqInvalidHeader = new Request('https://cleengreenz.com/leads', {
      headers: { authorization: 'Bearer token123' },
    });
    const resInvalidHeader = await onRequestGet({ request: reqInvalidHeader, env: { LEADS_PASSWORD: secret } });
    assert.equal(resInvalidHeader.status, 401);
  });

  await t.test('allows request when authorization header is valid', async () => {
    const request = new Request('https://cleengreenz.com/leads', {
      headers: { authorization: basicAuth('admin', secret) },
    });
    const res = await onRequestGet({ request, env: { LEADS_PASSWORD: secret } });

    // Should pass authorization check and hit DB missing check (503)
    assert.equal(res.status, 503);
    assert.equal(await res.text(), 'Lead database is not connected yet.');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(
      res.headers.get('content-security-policy'),
      "default-src 'self'; style-src 'self' 'sha256-nnmhsW+PD6dOzA3sJ2sc2gUbiRSRAlPO4uoz9DJ2yJ4=';"
    );
    assert.ok(!res.headers.get('content-security-policy').includes("'unsafe-inline'"));
  });
});

test('renderLeadsHtml helper function in functions/leads.js', async (t) => {
  await t.test('renders HTML with default empty arrays when options omitted', async () => {
    const html = renderLeadsHtml();
    assert.match(html, /<title>Cleen Greenz leads<\/title>/);
    assert.match(html, /No leads yet\./);
    assert.match(html, /No requests yet\./);
  });

  await t.test('renders total cards, monthly breakdown table, and recent requests', async () => {
    const totals = [
      { type: 'form', month: 5, week: 2, total: 10 },
      { type: 'call', month: 12, week: 3, total: 25 },
    ];
    const months = [
      { month: '2026-03', type: 'form', n: 5 },
      { month: '2026-03', type: 'call', n: 12 },
    ];
    const recent = [
      {
        created_at: '2026-03-30T14:30:00Z',
        name: 'Jane Doe',
        phone: '269-555-0100',
        address: '456 Oak St',
        service: 'Lawn Mowing',
        notes: 'Backyard only',
        emailed: 0,
      },
    ];

    const html = renderLeadsHtml({ totals, months, recent });
    assert.match(html, /Estimate forms/);
    assert.match(html, /2026-03/);
    assert.match(html, /Jane Doe/);
    assert.match(html, /269-555-0100/);
    assert.match(html, /No/);
  });

  await t.test('escapes HTML tags in month labels to prevent XSS', async () => {
    const months = [
      { month: '2026-03<script>alert(1)</script>', type: 'form', n: 5 },
    ];
    const html = renderLeadsHtml({ months });
    assert.match(html, /2026-03&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /2026-03<script>alert\(1\)<\/script>/);
  });
});

test('onRequestGet sanitizes phone numbers in tel links', async (t) => {
  await t.test('strips HTML attribute injection in phone numbers for tel: links', async () => {
    const mockDb = {
      prepare: (sql) => ({ sql }),
      batch: async () => [
        { results: [] },
        { results: [] },
        {
          results: [
            {
              created_at: '2026-03-30T12:00:00Z',
              name: 'John Doe',
              phone: '269-555-0199" onclick="alert(1)"',
              address: '123 Main St',
              service: 'Mowing',
              notes: 'None',
              emailed: 1,
            },
          ],
        },
      ],
    };

    const secret = 'test-pass';
    const authHeader = 'Basic ' + Buffer.from(`admin:${secret}`).toString('base64');
    const request = new Request('https://cleengreenz.com/leads', {
      headers: { authorization: authHeader },
    });

    const res = await onRequestGet({ request, env: { LEADS_PASSWORD: secret, DB: mockDb } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(
      res.headers.get('content-security-policy'),
      "default-src 'self'; style-src 'self' 'sha256-nnmhsW+PD6dOzA3sJ2sc2gUbiRSRAlPO4uoz9DJ2yJ4=';"
    );
    assert.ok(!res.headers.get('content-security-policy').includes("'unsafe-inline'"));
    const html = await res.text();

    assert.match(html, /href="tel:269-555-0199%20\(1\)"/);
    assert.doesNotMatch(html, /onclick="alert\(1\)"/);
  });
});

test('frontend js/leads.js event handling and form submission', async (t) => {
  const fs = await import('node:fs');
  const vm = await import('node:vm');

  function setupDomEnvironment() {
    class ClassList {
      constructor() { this._classes = new Set(); }
      add(c) { this._classes.add(c); }
      remove(c) { this._classes.delete(c); }
      contains(c) { return this._classes.has(c); }
    }

    class MockElement extends EventTarget {
      constructor(tagName, id = '') {
        super();
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.style = {};
        this.classList = new ClassList();
        this.attributes = {};
        this.value = '';
        this.innerHTML = '';
        this.children = [];
        this.disabled = false;
        this.type = '';
        this.name = '';
        this.focused = false;
      }
      setAttribute(k, v) { this.attributes[k] = String(v); }
      getAttribute(k) { return this.attributes[k] !== undefined ? this.attributes[k] : null; }
      removeAttribute(k) { delete this.attributes[k]; }
      appendChild(c) { this.children.push(c); return c; }
      querySelector(sel) { return querySelectorIn(this, sel); }
      querySelectorAll(sel) { return querySelectorAllIn(this, sel); }
      focus() { this.focused = true; }
      closest(sel) { return null; }
    }

    function matchesSelector(el, sel) {
      if (!el || !el.tagName) return false;
      if (sel === '.form-fields') return el.classList.contains('form-fields');
      if (sel === '.form-done') return el.classList.contains('form-done');
      if (sel === 'button[type="submit"]') return el.tagName === 'BUTTON' && el.type === 'submit';
      if (sel === '[required]') return el.attributes.required !== undefined;
      if (sel === 'h3') return el.tagName === 'H3';
      if (sel === 'p') return el.tagName === 'P';
      if (sel.startsWith('#')) {
        const idTarget = sel.slice(1);
        return el.id === idTarget;
      }
      if (sel.startsWith('a[href=')) return el.tagName === 'A';
      return false;
    }

    function querySelectorIn(parent, sel) {
      for (const child of parent.children) {
        if (matchesSelector(child, sel)) return child;
        const sub = querySelectorIn(child, sel);
        if (sub) return sub;
      }
      return null;
    }

    function querySelectorAllIn(parent, sel) {
      let results = [];
      for (const child of parent.children) {
        if (matchesSelector(child, sel)) results.push(child);
        results = results.concat(querySelectorAllIn(child, sel));
      }
      return results;
    }

    const doc = new EventTarget();
    doc.referrer = 'https://google.com';
    const elementsById = {};

    doc.getElementById = (id) => elementsById[id] || null;
    doc.createElement = (tagName) => new MockElement(tagName);

    const form = new MockElement('form', 'estimate-form');
    elementsById['estimate-form'] = form;

    const fieldsBox = new MockElement('div');
    fieldsBox.classList.add('form-fields');
    form.appendChild(fieldsBox);

    const doneBox = new MockElement('div');
    doneBox.classList.add('form-done');
    const doneHeading = new MockElement('h3');
    const doneParagraph = new MockElement('p');
    doneBox.appendChild(doneHeading);
    doneBox.appendChild(doneParagraph);
    form.appendChild(doneBox);

    const submitBtn = new MockElement('button');
    submitBtn.type = 'submit';
    submitBtn.innerHTML = 'Send request';
    fieldsBox.appendChild(submitBtn);

    const nameInput = new MockElement('input', 'f-name');
    nameInput.name = 'name';
    nameInput.setAttribute('required', 'true');
    fieldsBox.appendChild(nameInput);

    const nameErr = new MockElement('span', 'f-name-err');
    fieldsBox.appendChild(nameErr);
    elementsById['f-name-err'] = nameErr;

    const phoneInput = new MockElement('input', 'f-phone');
    phoneInput.name = 'phone';
    phoneInput.setAttribute('required', 'true');
    fieldsBox.appendChild(phoneInput);

    const phoneErr = new MockElement('span', 'f-phone-err');
    fieldsBox.appendChild(phoneErr);
    elementsById['f-phone-err'] = phoneErr;

    const serviceSelect = new MockElement('select', 'f-service');
    serviceSelect.name = 'service';
    serviceSelect.value = 'Mowing';
    fieldsBox.appendChild(serviceSelect);

    const locationObj = { pathname: '/estimate', href: 'https://cleengreenz.com/' };

    const trackedLeads = [];
    const windowObj = {
      location: locationObj,
      trackLead: (type, loc, extra) => {
        trackedLeads.push({ type, loc, extra });
      },
    };

    const fetchCalls = [];
    let fetchImpl = async (url, options) => {
      fetchCalls.push({ url, options });
      return { ok: true, status: 200 };
    };

    const sendBeaconCalls = [];
    const navigatorObj = {
      sendBeacon: (url, blob) => {
        sendBeaconCalls.push({ url, blob });
        return true;
      },
    };

    function collectInputs(parent) {
      let inputs = [];
      for (const child of parent.children) {
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(child.tagName)) {
          inputs.push(child);
        }
        inputs = inputs.concat(collectInputs(child));
      }
      return inputs;
    }

    class MockFormData {
      constructor(f) {
        this._map = new Map();
        for (const child of collectInputs(f)) {
          if (child.name) {
            this._map.set(child.name, child.value);
          }
        }
      }
      [Symbol.iterator]() {
        return this._map.entries();
      }
    }

    const sandbox = {
      document: doc,
      location: locationObj,
      window: windowObj,
      navigator: navigatorObj,
      fetch: (url, options) => fetchImpl(url, options),
      CSS: { escape: (str) => str },
      FormData: MockFormData,
      JSON,
      Object,
      Blob,
      CustomEvent,
      Event,
      setFetchImpl: (fn) => { fetchImpl = fn; },
      fetchCalls,
      sendBeaconCalls,
      trackedLeads,
      form,
      fieldsBox,
      doneBox,
      doneHeading,
      doneParagraph,
      submitBtn,
      nameInput,
      nameErr,
      phoneInput,
      phoneErr,
      serviceSelect,
    };

    const scriptCode = fs.readFileSync('js/leads.js', 'utf8');
    vm.createContext(sandbox);
    vm.runInContext(scriptCode, sandbox);

    return sandbox;
  }

  await t.test('submits valid form successfully and updates UI', async () => {
    const env = setupDomEnvironment();
    env.nameInput.value = 'Jane Doe';
    env.phoneInput.value = '(269) 555-0199';
    env.serviceSelect.value = 'Fall leaf cleanup';

    const submitEvent = new env.Event('submit', { cancelable: true });
    env.form.dispatchEvent(submitEvent);

    assert.equal(env.submitBtn.disabled, true);
    assert.equal(env.submitBtn.getAttribute('aria-busy'), 'true');

    // Wait for promise resolution chain in submit listener
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(env.fetchCalls.length, 1);
    assert.equal(env.fetchCalls[0].url, '/api/lead');
    const body = JSON.parse(env.fetchCalls[0].options.body);
    assert.deepEqual(body, {
      type: 'form',
      location: 'estimate',
      page: '/estimate',
      referrer: 'https://google.com',
      name: 'Jane Doe',
      phone: '(269) 555-0199',
      service: 'Fall leaf cleanup',
      website: '',
    });

    assert.equal(env.fieldsBox.style.display, 'none');
    assert.equal(env.doneBox.classList.contains('show'), true);
    assert.equal(env.doneHeading.focused, true);

    assert.equal(env.submitBtn.disabled, false);
    assert.equal(env.submitBtn.getAttribute('aria-busy'), null);
    assert.equal(env.submitBtn.innerHTML, 'Send request');

    assert.equal(env.trackedLeads.length, 1);
    assert.equal(env.trackedLeads[0].type, 'form');
    assert.equal(env.trackedLeads[0].loc, 'estimate');
    assert.equal(env.trackedLeads[0].extra.service, 'Fall leaf cleanup');
  });

  await t.test('falls back to mailto link when fetch fails', async () => {
    const env = setupDomEnvironment();
    env.setFetchImpl(async () => {
      throw new Error('Network error');
    });

    env.nameInput.value = 'John Smith';
    env.phoneInput.value = '269-555-1234';

    const submitEvent = new env.Event('submit', { cancelable: true });
    env.form.dispatchEvent(submitEvent);

    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.equal(env.doneHeading.textContent, 'Almost there!');
    assert.match(env.doneParagraph.textContent, /Your email app should have opened/);
    assert.match(env.location.href, /^mailto:chris@cleengreenz\.com/);
    assert.match(env.location.href, /John%20Smith/);
  });

  await t.test('sanitizes CRLF characters from name and service in mailto fallback link', async () => {
    const env = setupDomEnvironment();
    env.setFetchImpl(async () => {
      throw new Error('Network error');
    });

    env.nameInput.value = 'John\r\nHeaderInjection';
    env.phoneInput.value = '269-555-1234';
    env.serviceSelect.value = 'Fall\nLeaf\rCleanup';

    const submitEvent = new env.Event('submit', { cancelable: true });
    env.form.dispatchEvent(submitEvent);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const url = new URL(env.location.href);
    const subject = url.searchParams.get('subject');
    assert.equal(subject, 'Estimate request: Fall Leaf Cleanup (John HeaderInjection)');
  });

  await t.test('prevents submission when required fields are empty and shows errors', async () => {
    const env = setupDomEnvironment();
    env.nameInput.value = '   ';
    env.phoneInput.value = '';

    const submitEvent = new env.Event('submit', { cancelable: true });
    env.form.dispatchEvent(submitEvent);

    assert.equal(env.fetchCalls.length, 0);
    assert.equal(env.nameInput.getAttribute('aria-invalid'), 'true');
    assert.equal(env.nameInput.getAttribute('aria-describedby'), 'f-name-err');
    assert.equal(env.nameErr.classList.contains('show'), true);
    assert.equal(env.nameInput.focused, true);

    assert.equal(env.phoneInput.getAttribute('aria-invalid'), 'true');
    assert.equal(env.phoneInput.getAttribute('aria-describedby'), 'f-phone-err');
    assert.equal(env.phoneErr.classList.contains('show'), true);
  });

  await t.test('clears error state when user types into invalid input field', async () => {
    const env = setupDomEnvironment();
    env.nameInput.setAttribute('aria-invalid', 'true');
    env.nameInput.setAttribute('aria-describedby', 'f-name-err');
    env.nameErr.classList.add('show');

    const inputEvent = new env.CustomEvent('input', { bubbles: true });
    Object.defineProperty(inputEvent, 'target', { value: env.nameInput });
    env.form.dispatchEvent(inputEvent);

    assert.equal(env.nameInput.getAttribute('aria-invalid'), null);
    assert.equal(env.nameInput.getAttribute('aria-describedby'), null);
    assert.equal(env.nameErr.classList.contains('show'), false);
  });

  await t.test('sends lead data on cg:lead custom event via sendBeacon', async () => {
    const env = setupDomEnvironment();
    const customEvt = new env.CustomEvent('cg:lead', {
      detail: { lead_type: 'call', lead_location: 'header' },
    });
    env.document.dispatchEvent(customEvt);

    assert.equal(env.sendBeaconCalls.length, 1);
    assert.equal(env.sendBeaconCalls[0].url, '/api/lead');
  });
});

test('buildPayload helper function in js/leads.js', async (t) => {
  await t.test('enriches lead payload with location.pathname and document.referrer', async () => {
    globalThis.location = { pathname: '/estimate-page' };
    globalThis.document = { referrer: 'https://google.com' };

    const payload = buildPayload({ type: 'call', location: 'hero' });
    assert.deepEqual(payload, {
      page: '/estimate-page',
      referrer: 'https://google.com',
      type: 'call',
      location: 'hero',
    });

    delete globalThis.location;
    delete globalThis.document;
  });

  await t.test('enriches estimate form submission data correctly', async () => {
    globalThis.location = { pathname: '/' };
    globalThis.document = { referrer: 'https://bing.com' };

    const formData = { name: 'Jane', phone: '2695550199', service: 'Mowing' };
    const payload = buildPayload(Object.assign({ type: 'form', location: 'estimate' }, formData));

    assert.deepEqual(payload, {
      page: '/',
      referrer: 'https://bing.com',
      type: 'form',
      location: 'estimate',
      name: 'Jane',
      phone: '2695550199',
      service: 'Mowing',
    });

    delete globalThis.location;
    delete globalThis.document;
  });

  await t.test('handles missing location and document gracefully', async () => {
    delete globalThis.location;
    delete globalThis.document;

    const payload = buildPayload({ type: 'email' });
    assert.deepEqual(payload, {
      page: '',
      referrer: '',
      type: 'email',
    });
  });
});
