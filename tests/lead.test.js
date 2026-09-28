import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { json, onRequestPost, sanitizePhone } from '../functions/api/lead.js';
import { authorized, onRequestGet, renderLeadsHtml } from '../functions/leads.js';

const require = createRequire(import.meta.url);
const { buildPayload } = require('../js/leads.js');

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

  await t.test('sets content-type header to application/json', async () => {
    const res = json({ message: 'hello' });
    assert.equal(res.headers.get('content-type'), 'application/json');
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
  await t.test('returns 400 JSON response on invalid JSON request body', async () => {
    const request = new Request('https://cleengreenz.com/api/lead', {
      method: 'POST',
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
});

test('onRequestGet authorization and response handling', async (t) => {
  const secret = 'super-secret-password-123';

  function basicAuth(username, password) {
    return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
  }

  await t.test('returns 401 when LEADS_PASSWORD env is missing', async () => {
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
    const html = await res.text();

    assert.match(html, /href="tel:269-555-0199%20\(1\)"/);
    assert.doesNotMatch(html, /onclick="alert\(1\)"/);
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
