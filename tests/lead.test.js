import test from 'node:test';
import assert from 'node:assert/strict';
import { json, onRequestPost } from '../functions/api/lead.js';

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
});
