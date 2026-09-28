import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { json, onRequestPost, sanitizePhone } from '../functions/api/lead.js';
import { authorized, onRequestGet } from '../functions/leads.js';

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
